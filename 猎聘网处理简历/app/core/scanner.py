"""扫描编排：作为后台线程运行
  - 通过平台驱动（app.core.platforms）抓简历列表 → 详情页解析 → 匹配 JD → 写库 → 推送进度
  - 同一套流程支持猎聘网 / 前程无忧 / 后续新平台
"""
from __future__ import annotations

import json
import queue
import random
import re
import threading
import time
import traceback
import uuid
from datetime import datetime
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Optional

from .cdp_client import CDPClient
from .config import get_db_path, get_jd_path, load_config
from .db import aggregate_stats, create_session, finish_session, init_db, insert_candidate, mark_operated
from .jd_loader import JD, load_jds
from .jd_matcher import match
from .resume_parser import parse_detail_js
from .platforms import ListItem, get_driver
from .platforms.liepin import LiepinDriver  # noqa: F401  保留为旧 import 兼容


# 进度事件队列，每条事件推到 SSE 流里
ProgressEvent = dict  # {type, payload}


@dataclass
class ScanState:
    running: bool = False
    session_id: str = ""
    started_at: float = 0.0
    finished_at: float = 0.0
    scanned: int = 0
    qualified: int = 0
    pending: int = 0
    rejected: int = 0
    incomplete: int = 0
    error: str = ""
    platform: str = "猎聘网"

    def stats(self) -> dict:
        return {
            "scanned": self.scanned,
            "qualified": self.qualified,
            "pending": self.pending,
            "rejected": self.rejected,
            "incomplete": self.incomplete,
        }


class Scanner:
    def __init__(self, on_event: Callable[[ProgressEvent], None] | None = None):
        self.cfg = load_config()
        self.db_path = get_db_path(self.cfg)
        init_db(self.db_path)
        self.jds: list[JD] = load_jds(get_jd_path(self.cfg))
        self.on_event = on_event or (lambda ev: None)
        self._state_lock = threading.Lock()
        self.state = ScanState()
        self._stop_flag = threading.Event()
        self._thread: Optional[threading.Thread] = None
        self.event_queue: queue.Queue[ProgressEvent] = queue.Queue()
        # 自动操作开关（可由前端覆盖）
        self.auto_operate = bool(self.cfg.get("scanner", {}).get("auto_operate", False))
        self.dry_run = bool(self.cfg.get("scanner", {}).get("dry_run", True))

    # ---------- 控制 ----------
    def start(self, platform: str = "猎聘网", use_mock: bool = False,
              auto_operate: Optional[bool] = None, dry_run: Optional[bool] = None) -> str:
        # 校验 platform 有驱动
        try:
            get_driver(platform)
        except KeyError as e:
            raise ValueError(str(e))

        if auto_operate is not None:
            self.auto_operate = bool(auto_operate)
        if dry_run is not None:
            self.dry_run = bool(dry_run)
        with self._state_lock:
            if self.state.running:
                return self.state.session_id
            self._stop_flag.clear()
            self.state = ScanState(
                running=True,
                session_id=uuid.uuid4().hex[:12],
                started_at=time.time(),
                platform=platform,
            )
        sid = self.state.session_id
        create_session(self.db_path, sid, platform)

        # 同步通知前端：session 开始
        self._emit("session_started", {"session_id": sid, "platform": platform})
        if self.auto_operate and self.dry_run:
            self._emit("warn", {
                "message": f"⚠️ 仅模拟模式：本次扫描只会判定并入库，【不会】在 {platform} 页面点任何按钮，"
                           f"简历扫描后仍是「未处理」状态。要真实点击请取消勾选「仅模拟」后重新扫描。"
            })
        else:
            self._emit("info", {
                "message": f"自动操作{platform}：{'开启' if self.auto_operate else '关闭'}"
                           f"（{'仅模拟(不真点)' if self.dry_run else '真实点击'}）"
            })

        self._thread = threading.Thread(
            target=self._run, args=(sid, use_mock), daemon=True
        )
        self._thread.start()
        return sid

    def stop(self) -> None:
        self._stop_flag.set()
        with self._state_lock:
            self.state.running = False

    def is_running(self) -> bool:
        return self.state.running

    def emit_event(self, ev: ProgressEvent) -> None:
        self._emit(ev["type"], ev.get("payload", {}))

    def _emit(self, ev_type: str, payload) -> None:
        # payload 可能是 dict 或 str（兼容老调用）
        if isinstance(payload, str):
            payload = {"message": payload}
        elif not isinstance(payload, dict):
            payload = {"value": str(payload)}
        ev = {"type": ev_type, "payload": payload, "ts": time.time()}
        self.event_queue.put(ev)
        try:
            self.on_event(ev)
        except Exception:
            pass

    # ---------- 流程 ----------
    def _run(self, session_id: str, use_mock: bool):
        try:
            if use_mock:
                self._run_mock(session_id)
            else:
                platform = self.state.platform
                driver = get_driver(platform)
                self._run_with_driver(session_id, driver)
        except Exception as e:
            err = f"{e.__class__.__name__}: {e}"
            traceback.print_exc()
            self._emit("error", {"message": err})
            with self._state_lock:
                self.state.error = err
                self.state.running = False
            finish_session(self.db_path, session_id, {**self.state.stats(), "error": err})
        finally:
            with self._state_lock:
                self.state.running = False
                self.state.finished_at = time.time()
            self._emit("session_finished", {"session_id": session_id, "stats": self.state.stats()})

    # ----- 通用：按 driver 跑 -----
    def _run_with_driver(self, session_id: str, driver):
        cdp = CDPClient(host=self.cfg["chrome"]["host"], port=self.cfg["chrome"]["port"])
        if not cdp.is_reachable():
            raise ConnectionError(
                "Chrome 调试端口不可达。请先用以下命令启动 Chrome（关闭所有 Chrome 后）：\n"
                "    chrome.exe --remote-debugging-port=9222 --remote-allow-origins=*"
            )

        def emit_info(msg): self._emit("info", {"message": msg})
        def emit_warn(msg): self._emit("warn", {"message": msg})

        # 1) 找/创建 tab
        tab, current_url = driver.acquire_tab(cdp, lambda kind, m: self._emit(kind, {"message": m}))
        self._emit("info", {"message": f"已连接：{tab.title} | {tab.url}"})
        cdp.connect(tab)
        # 2) 若不在列表页，导航回去
        if hasattr(driver, "navigate_to_list_if_needed"):
            driver.navigate_to_list_if_needed(cdp, current_url, lambda kind, m: self._emit(kind, {"message": m}))
        # 3) 等 SPA 渲染
        if hasattr(driver, "wait_for_spa"):
            driver.wait_for_spa(cdp)
        # 3.5) 等列表真正渲染出姓名（前程无忧 待处理 999+ 简历需数秒拉取，
        #       未就绪时卡片是空壳，直接扫会抓到空记录/回退列表链接）
        #       注：只在扫描开始时等待一次，循环内不再重复等待（避免每条都等35秒）
        if hasattr(driver, "wait_for_list_ready"):
            ready = driver.wait_for_list_ready(cdp, timeout=35)
            if not ready:
                self._emit("warn", {"message": "列表长时间未渲染出简历卡片，请确认「待处理」页是否正常加载（可能需要先选择职位/刷新）。"})
            else:
                self._emit("info", {"message": "列表已就绪（已检测到姓名），开始扫描"})
        # 4) 抓列表
        # 预收集：扫描前一次性把「待处理」里所有候选人（含虚拟列表滚动加载）收进名单。
        # 之后按名单逐条导航到详情页处理，不再依赖"回列表后重新识别"——
        # 这彻底绕开了 51job SPA 在 Page.navigate 回列表后渲染异常、被误判"页面丢失/无新简历"的问题。
        if getattr(driver, "stream_top", False) and hasattr(driver, "collect_all_candidates"):
            self._emit("info", {"message": "正在预扫描「待处理」列表，收集全部候选人..."})
            candidates = driver.collect_all_candidates(cdp, max_count=50)
            self._emit("info", {"message": f"已预扫描到 {len(candidates)} 位候选人，将按名单顺序处理"})
        else:
            list_data = driver.fetch_list(cdp)
            candidates = (list_data or {}).get("items") or []
            self._emit("info", {"message": f"列表中共 {len(candidates)} 份简历（截前 50）"})

        if not candidates:
            self._emit("warn", {"message": "未解析到任何简历条目。可能页面结构已变化或不在「待处理」页，请先点「诊断」看真实 DOM。"})
            return

        handled: set[str] = set()
        try:
            if getattr(driver, "stream_top", False):
                MAX_BATCH = 50  # 定版：单次扫描最多处理 50 份，达到即自动停止
                total = len(candidates)
                processed = 0
                reached_limit = False
                for idx, item in enumerate(candidates):
                    if self._stop_flag.is_set():
                        self._emit("info", {"message": "扫描已停止"})
                        break
                    if processed >= MAX_BATCH:
                        reached_limit = True
                        # 达到上限停止后同样停留在最后一份详情页（不回列表），便于人工复核
                        break
                    href = item.get("href") or ""
                    if not href or href in handled:
                        continue
                    handled.add(href)
                    li = ListItem(href=href, text=item.get("text", "") or "",
                                  apply_id=item.get("apply_id", "") or "",
                                  extra=item.get("extra") or item)
                    try:
                        # 51job 扫描结束后停留在最后一份简历的详情页（不回列表），便于人工复核。
                        # 其余处理完直接由下一轮 open_detail 导航到下一位详情页，中间不再回列表。
                        # 日志与猎聘对齐：每份只输出一条整合日志（进度随 candidate 事件带 current/total），
                        # 故这里不再额外 emit「处理中」那一行。
                        self._process_stream_item(session_id, driver, cdp, li, return_to_list=False,
                                                  current=idx + 1, total=total)
                    except Exception as e:
                        self._emit("warn", {"message": f"处理失败: {e}"})
                    processed += 1
                if reached_limit:
                    self._emit("info", {"message": f"已处理 {processed} 份，达到单次扫描上限（{MAX_BATCH} 份），自动停止。"})
                elif not self._stop_flag.is_set():
                    self._emit("info", {"message": "没有更多未处理的简历，扫描结束。"})
                if processed > 0:
                    self._emit("info", {"message": "已停留在最后一份简历详情页，可直接在浏览器查看/复核。"})
            else:
                # ===== 猎聘网：拟人化防风控（仅作用于猎聘，不影响前程无忧）=====
                lp_cfg = (self.cfg.get("scanner", {}) or {}).get("liepin", {}) or {}
                lp_humanize = bool(lp_cfg.get("humanize", False))
                if lp_humanize:
                    self._emit("info", {"message": "猎聘网已开启拟人化模式：抖动间隔 + 真实鼠标操作 + 随机微休（速度会变慢，但更像真人操作）"})
                lp_max_session = int(lp_cfg.get("max_per_session", 0) or 0)
                total = len(candidates)
                processed = 0
                # 分段耗时累计（打开页面 / AI评估 / 页面点击 / 间隔等待），用于结束时的耗时统计
                timing = {"open": 0.0, "eval": 0.0, "apply": 0.0, "gap": 0.0}
                for i, it in enumerate(candidates):
                    if self._stop_flag.is_set():
                        self._emit("info", {"message": "扫描已停止"})
                        break
                    href = it.get("href") or ""
                    if not href or href in handled:
                        continue
                    handled.add(href)
                    item = ListItem(
                        href=href,
                        text=it.get("text", "") or "",
                        apply_id=it.get("apply_id", "") or "",
                        extra=it.get("extra") or it,
                    )
                    lp_wait_ms = (self._liepin_open_wait_ms(lp_cfg) if lp_humanize
                                  else self.cfg["scanner"].get("delay_between_resumes_ms", 1500))
                    try:
                        self._emit("scanning", {"href": href, "preview": item.text[:80],
                                               "current": i + 1, "total": total,
                                               "platform": self.state.platform})
                        _t0 = time.time()
                        page_url = driver.open_detail(cdp, item, wait_ms=lp_wait_ms, humanize=lp_humanize)
                        cand_data = driver.fetch_detail(cdp)
                        cand_info = parse_detail_js(cand_data or {})
                        _t1 = time.time()
                        if lp_humanize:
                            # 拟人模式：AI 评估（耗时数秒~数十秒）期间让浏览器持续“阅读”，
                            # 避免页面在最长的时间窗口里静止不动被风控识别为机器人
                            verdict = self._liepin_process_with_activity(
                                session_id, driver, cdp, cand_info, page_url or href,
                                applied_text=item.text, lp_cfg=lp_cfg,
                                current=i + 1, total=total)
                        else:
                            verdict = self._process_one(session_id, cand_info, page_url or href,
                                                        applied_text=item.text, current=i + 1, total=total)
                        _t2 = time.time()
                        if self.auto_operate and verdict:
                            self._apply_action(driver, cdp, verdict, item=item)
                        _t3 = time.time()
                        timing["open"] += _t1 - _t0
                        timing["eval"] += _t2 - _t1
                        timing["apply"] += _t3 - _t2
                    except Exception as e:
                        self._emit("warn", {"message": f"跳过 {href[-40:]}: {e}"})
                        continue
                    processed += 1
                    # 单批上限：避免一次连续扫太多触发风控，到量主动停下（可稍后再扫一批）
                    if lp_max_session and processed >= lp_max_session:
                        self._emit("info", {"message": f"已处理 {processed} 份，达到本批上限（{lp_max_session}），自动停止（可稍后再扫一批）"})
                        break
                    # 拟人化：份间抖动延迟 + 每 N 份微休 + 偶发长思考停顿
                    if lp_humanize:
                        _tg = time.time()
                        time.sleep(self._liepin_gap(i, lp_cfg))
                        timing["gap"] += time.time() - _tg
                # 耗时统计：一行汇总，便于判断慢在哪一环（打开/评估/点击/间隔）
                if processed:
                    n = float(processed)
                    per = (timing["open"] + timing["eval"] + timing["apply"] + timing["gap"]) / n
                    self._emit("info", {"message": (
                        f"⏱ 耗时统计：{processed} 份，平均 {per:.0f} 秒/份 → "
                        f"打开页面 {timing['open']/n:.0f}s · AI评估 {timing['eval']/n:.0f}s · "
                        f"点击 {timing['apply']/n:.0f}s · 间隔等待 {timing['gap']/n:.0f}s"
                    )})
        finally:
            cdp.close()
        with self._state_lock:
            s = self.state
            finish_session(self.db_path, session_id, s.stats())

    def _process_stream_item(self, session_id: str, driver, cdp, li: "ListItem", return_to_list: bool = False,
                             current: Optional[int] = None, total: Optional[int] = None) -> bool:
        """流式模式处理单条（前程无忧）：
        打开详情 -> 评估 -> 详情页点按钮。
        return_to_list=False（默认）：处理完不回列表页，下一个候选直接 Page.navigate 到其详情 URL，
            彻底避开"回列表后 SPA 渲染异常被误判页面丢失"的问题。
        return_to_list=True：处理完导航回列表页（用于最后一位，恢复列表供用户查看）。
        current/total：进度（对齐猎聘，让 candidate 日志带 [x/total] 前缀、顶端进度条生效）。"""
        try:
            self._emit("scanning", {"href": li.href, "preview": li.text[:80],
                                   "current": current, "total": total,
                                   "platform": self.state.platform})
            page_url = driver.open_detail(cdp, li,
                                         wait_ms=self.cfg["scanner"].get("delay_between_resumes_ms", 1500))
            cand_data = driver.fetch_detail(cdp)
            # 详情抓取失败（链接失效/仍是列表页）→ 重试一次，仍失败则跳过该简历，避免误判
            if not (cand_data.get("full_text") or "").strip() or "talent/management" in (cand_data.get("url") or ""):
                time.sleep(2)
                cand_data = driver.fetch_detail(cdp)
            if not (cand_data.get("full_text") or "").strip() or "talent/management" in (cand_data.get("url") or ""):
                nm = (li.extra or {}).get("name", "?") if li.extra else "?"
                self._emit("warn", {"message": f"{nm} 详情页抓取为空或仍是列表页，已跳过（链接可能失效）"})
                if return_to_list and hasattr(driver, "close_detail_and_return_to_list"):
                    driver.close_detail_and_return_to_list(cdp)
                return False
            cand_info = parse_detail_js(cand_data or {})
            fallback_url = getattr(driver, "LIST_URL", "") or ""
            verdict = self._process_one(session_id, cand_info, page_url or fallback_url,
                                        applied_text=li.text, current=current, total=total)
            # 真实模式：仍在详情页时点 合适/不合适（列表页只读，避免操作后列表 SPA 崩坏）
            if self.auto_operate and verdict:
                self._apply_action(driver, cdp, verdict, item=li)
            # 仅最后一位（return_to_list=True）才回到列表页；其余直接由下一轮 open_detail 导航到下一位
            if return_to_list and hasattr(driver, "close_detail_and_return_to_list"):
                driver.close_detail_and_return_to_list(cdp)
            return True
        except Exception as e:
            self._emit("warn", {"message": f"跳过 {li.href[:40]}: {e}"})
            return False

    def _apply_action(self, driver, cdp, verdict: str, item=None):
        """通过 driver 在页面上执行「通过/合适」或「淘汰/不合适」操作（含 dry_run 保护）"""
        try:
            r = driver.apply_action(cdp, verdict, self.cfg, dry_run=self.dry_run, item=item)
        except Exception as e:
            self._emit("warn", {"message": f"页面操作失败（{verdict}）：{e}"})
            return
        if not r.get("ok"):
            reason = r.get("reason")
            if reason == "button_not_found":
                self._emit("warn", {
                    "message": f"未在页面找到「{r.get('action')}」按钮（已跳过，未操作）。"
                               f" 可运行诊断（按平台）抓取真实按钮后调整。"
                })
            else:
                self._emit("warn", {"message": f"点击「{r.get('action')}」失败：{r.get('error')}"})
            return
        # 真实点击成功：落库标记「已操作」，便于事后核对哪些简历真正在平台上处理过
        # （此前 mark_operated 只 import 未调用，导致 operated 恒为 0，无法验证是否真点）
        if not r.get("dry_run"):
            cid = getattr(self, "_last_cand_id", None)
            if cid:
                try:
                    mark_operated(self.db_path, cid, verdict)
                except Exception as e:
                    self._emit("warn", {"message": f"标记已操作失败：{e}"})
        # 成功点击/模拟操作：静默（不刷日志），避免每份简历出现多条日志；
        # 异常已在上方以 warn 输出。判定结果由 candidate 事件统一展示。

    def _run_mock(self, session_id: str):
        """Mock 模式：演示用例——生成若干简历用于验证流程"""
        demo_pool = [
            {
                "name": "张琳琳",
                "current_position": "高级临床监查员",
                "current_company": "康龙化成",
                "expected_city": "上海",
                "education_block": "中国药科大学 | 本科 | 药学 | 2014-2018",
                "full_text": "张琳琳 女 8年工作经验 CRA GCP SSU 临床监查员 SSU专员 监查员 ICH-GCP FDA 期望：医药 期望薪资：25K 北京",
                "work_exps": [
                    {"company": "康龙化成", "position": "高级临床监查员", "period": "2020.07-至今", "raw": "2020.07-至今 康龙化成 高级临床监查员 负责III期临床监查"},
                    {"company": "泰格医药", "position": "临床监查员", "period": "2018.07-2020.06", "raw": "2018.07-2020.06 泰格医药 临床监查员 II/III期"},
                ],
            },
            {
                "name": "李明",
                "current_position": "SSU主管",
                "current_company": "某CRO",
                "expected_city": "广州",
                "education_block": "中山大学 | 本科 | 临床医学",
                "full_text": "李明 男 5年工作经验 SSU专员 CRC CRA GCP 期望珠海临床 SSU 本科 期望薪资：15K",
                "work_exps": [
                    {"company": "某CRO", "position": "SSU主管", "period": "2021.03-至今", "raw": "2021.03-至今 某CRO SSU主管 中心筛选 伦理递交"},
                    {"company": "某医院", "position": "CRC", "period": "2019.07-2021.02", "raw": "2019.07-2021.02 某医院 CRC"},
                ],
            },
            {
                "name": "王芳",
                "current_position": "财务专员",
                "current_company": "某上市公司",
                "expected_city": "珠海",
                "education_block": "北京外国语大学 | 硕士 | 金融",
                "full_text": "王芳 女 6年工作经验 信息披露 A股 H股 董事会秘书 期望珠海证券事务 硕士",
                "work_exps": [
                    {"company": "某上市公司", "position": "财务专员", "period": "2020.01-至今", "raw": "2020.01-至今 某上市公司 财务专员"},
                ],
            },
            {
                "name": "陈强",
                "current_position": "生产总监",
                "current_company": "丽珠集团",
                "expected_city": "宁夏",
                "education_block": "华东理工 | 本科 | 制药工程",
                "full_text": "陈强 男 12年工作经验 FDA EMA GMP 原料药 发酵 提取 纯化 期望宁夏生产副总经理 本科",
                "work_exps": [
                    {"company": "丽珠集团", "position": "生产总监", "period": "2018-至今", "raw": "2018-至今 丽珠集团 宁夏 生产总监"},
                ],
            },
            {
                "name": "刘鑫",
                "current_position": "实习生",
                "current_company": "中国药科大学",
                "expected_city": "珠海",
                "education_block": "中国药科大学 | 本科在读 | 药学",
                "full_text": "刘鑫 男 0年 临床药理实习生 PK PopPK 期望珠海实习 本科",
                "work_exps": [],
            },
        ]

        random.shuffle(demo_pool)
        for sample in demo_pool[: random.randint(4, 6)]:
            if self._stop_flag.is_set():
                break
            cand_info = parse_detail_js(sample)
            href = f"https://lpt.liepin.com/resume/mock/{sample['name']}"
            self._emit("scanning", {"href": href, "preview": sample["full_text"][:80]})
            self._process_one(session_id, cand_info, href)
            time.sleep(self.cfg["scanner"].get("delay_between_resumes_ms", 1500) / 1000)

        with self._state_lock:
            s = self.state
            finish_session(self.db_path, session_id, s.stats())

    # ---------- 猎聘拟人化延迟（仅猎聘网使用）----------
    def _liepin_open_wait_ms(self, lp_cfg: dict) -> int:
        """打开详情后、解析前的“阅读停留”毫秒数（随机，模拟人读简历）。"""
        lo = lp_cfg.get("reading_min_ms", 1200)
        hi = lp_cfg.get("reading_max_ms", 3500)
        return int(random.uniform(lo, hi))

    def _liepin_gap(self, idx: int, lp_cfg: dict) -> float:
        """份间间隔（秒）：基础抖动 + 每 N 份微休 + 偶发长思考停顿。

        这样相邻两份简历的处理间隔不再固定，而是随机落在 4.5~9 秒，
        每 5 份左右再插一段 25~70 秒的“离开一下”，并有 ~12% 概率额外停顿 8~20 秒，
        整体节奏贴近真实人工筛简历，避免“完美周期”被风控识别。"""
        lo = lp_cfg.get("min_delay_ms", 4500)
        hi = lp_cfg.get("max_delay_ms", 9000)
        g = random.uniform(lo, hi) / 1000.0
        every = int(lp_cfg.get("micro_break_every", 5) or 0)
        if every and (idx + 1) % every == 0:
            g += random.uniform(lp_cfg.get("micro_break_min_ms", 25000),
                                lp_cfg.get("micro_break_max_ms", 70000)) / 1000.0
        chance = float(lp_cfg.get("thinking_chance", 0.12) or 0)
        if random.random() < chance:
            g += random.uniform(lp_cfg.get("thinking_min_ms", 8000),
                                lp_cfg.get("thinking_max_ms", 20000)) / 1000.0
        return g

    def _process_one(self, session_id: str, cand_info, page_url: str, applied_text: str = "", current=None, total=None) -> str:
        """对一份简历做匹配并入库（page_url = 详情页地址栏最终 URL），返回判定结果"""
        # 优先以人选实际投递的岗位关键字匹配 JD
        jd = self._match_applied_jd(applied_text) or self._guess_jd(cand_info)
        if not jd:
            self._emit("warn", {"message": f"{cand_info.name} 找不到适配 JD，已标为'信息不足'"})
            return "信息不足"

        llm_cfg = self.cfg.get("llm", {})
        try:
            result = match(cand_info, jd, llm_cfg)
        except Exception as e:
            result = type("MR", (), {"verdict": "信息不足", "score": 0, "reason": str(e), "hits": [], "misses": []})()
        return self._persist_candidate(session_id, cand_info, jd, result, page_url, applied_text, current=current, total=total)

    def _resolve_site_action(self, verdict: str) -> str:
        """计算日志里要展示的「网站已点」状态：
        - 关闭自动操作，或处于「仅模拟」：不真点 → 暂不点击
        - 真实自动操作：不合适 → 已点不合适；其余（合适/待定/信息不足）→ 已点合适
        （点击失败的极端情况由 _apply_action 的 warn 单独提示，此处按处置意图展示）"""
        if not self.auto_operate or self.dry_run:
            return "暂不点击"
        if verdict == "不合适":
            return "已点不合适"
        return "已点合适"

    def _persist_candidate(self, session_id, cand_info, jd, result, page_url, applied_text, current=None, total=None) -> str:
        """把已得到的匹配结果写入库并推送前端（被 _process_one 与猎聘拟人分支复用）"""
        verdict = getattr(result, "verdict", "信息不足")
        ai_assessment = getattr(result, "ai_assessment", {}) or {}
        cand_row = {
            "scan_session_id": session_id,
            "scanned_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
            "platform": self.state.platform,
            "candidate_name": cand_info.name,
            "current_position": cand_info.current_position,
            "current_company": cand_info.current_company,
            "expected_city": cand_info.expected_city,
            "applied_position": jd.name if jd else "未匹配",
            "jd_key": jd.key if jd else "",
            "verdict": result.verdict,
            "score": result.score,
            "reason": result.reason,
            "hits": result.hits,
            "misses": result.misses,
            "detail": {
                "education": cand_info.education,
                "major": cand_info.major,
                "years_of_experience": cand_info.years_of_experience,
                "skills": cand_info.skills,
                "work_experience": cand_info.work_experience,
                "raw_text_snippet": (cand_info.raw_text or "")[:300],
                "ai_assessment": ai_assessment,
            },
            "page_url": page_url,
        }
        cand_id = insert_candidate(self.db_path, cand_row)
        # 记住刚入库的候选人 id，供随后 _apply_action 真实点击成功后标记 operated 用
        self._last_cand_id = cand_id

        with self._state_lock:
            self.state.scanned += 1
            if result.verdict == "合适":
                self.state.qualified += 1
            elif result.verdict == "待定":
                self.state.pending += 1
            elif result.verdict == "不合适":
                self.state.rejected += 1
            else:
                self.state.incomplete += 1

        site_action = self._resolve_site_action(verdict)
        self._emit("candidate", {
            "id": cand_id,
            "candidate_name": cand_info.name,
            "current_position": cand_info.current_position,
            "current_company": cand_info.current_company,
            "expected_city": cand_info.expected_city,
            "applied_position": jd.name if jd else "",
            "verdict": verdict,
            "site_action": site_action,
            "score": result.score,
            "reason": result.reason,
            "hits": result.hits,
            "misses": result.misses,
            "ai_assessment": ai_assessment,
            "page_url": page_url,
            "platform": self.state.platform,
            "current": current,
            "total": total,
        })
        self._emit("stats", self.state.stats())
        return verdict

    def _liepin_process_with_activity(self, session_id, driver, cdp, cand_info, page_url, applied_text, lp_cfg, current=None, total=None) -> str:
        """猎聘拟人分支专用：在 AI 评估（耗时数秒~数十秒）期间，让浏览器持续“阅读”
        （小幅滚动 + 鼠标游走），避免页面在最长的时间窗口里静止不动——这是比“固定间隔”
        更隐蔽的机器人特征。AI 评估本身在后台线程跑，主线程负责维持页面活跃度。"""
        jd = self._match_applied_jd(applied_text) or self._guess_jd(cand_info)
        if not jd:
            self._emit("warn", {"message": f"{cand_info.name} 找不到适配 JD，已标为'信息不足'"})
            return "信息不足"
        llm_cfg = self.cfg.get("llm", {})

        # ---- 后台线程跑 AI 评估（不阻塞浏览器活跃度维持）----
        holder: dict = {}
        def _eval():
            try:
                holder["r"] = match(cand_info, jd, llm_cfg)
            except Exception as e:
                holder["r"] = type("MR", (), {"verdict": "信息不足", "score": 0,
                                              "reason": str(e), "hits": [], "misses": []})()
        t = threading.Thread(target=_eval, daemon=True)
        t.start()

        # ---- 评估期间持续“阅读”：每隔几秒让页面有输入活动 ----
        deadline = time.time() + float(lp_cfg.get("eval_max_wait_sec", 90))
        while t.is_alive() and time.time() < deadline:
            try:
                if random.random() < 0.6:
                    driver.human_scroll(cdp, random.randint(80, 260))
                else:
                    driver._human_idle_mouse(cdp)
            except Exception:
                pass
            time.sleep(random.uniform(1.8, 3.8))
        t.join(timeout=10)
        result = holder.get("r")
        if result is None:
            result = type("MR", (), {"verdict": "信息不足", "score": 0,
                                    "reason": "AI评估超时", "hits": [], "misses": []})()
        return self._persist_candidate(session_id, cand_info, jd, result, page_url, applied_text, current=current, total=total)

    # ---------- JD 匹配工具 ----------
    def _jd_name_candidates(self, jd: JD) -> list[str]:
        name = jd.name or ""
        base = re.split(r"[（(]", name)[0].strip()
        raw_parts = [p.strip() for p in re.split(r"[/、,，;；\s]+", base) if len(p.strip()) >= 2]
        cands = set()
        if name:
            cands.add(name)
        if base:
            cands.add(base)
        for p in raw_parts:
            cands.add(p)
            core = re.sub(r"(高级|资深|初级|中级)", "", p)
            core = re.sub(r"[A-Za-z]+$", "", core).strip()
            if len(core) >= 2:
                cands.add(core)
        return sorted(cands, key=len, reverse=True)

    def _best_jd_for_text(self, text: str) -> Optional[JD]:
        if not text:
            return None
        best, best_len = None, 0
        for jd in self.jds:
            for c in self._jd_name_candidates(jd):
                if c in text or text in c:
                    if len(c) > best_len:
                        best_len, best = len(c), jd
        return best

    def _match_applied_jd(self, card_text: str) -> Optional[JD]:
        if not card_text or not self.jds:
            return None
        t = card_text
        for pat in [
            r"应聘职位[:：\s]*([^\s，,。；;\n]{2,30})",
            r"应聘岗位[:：\s]*([^\s，,。；;\n]{2,30})",
            r"投递职位[:：\s]*([^\s，,。；;\n]{2,30})",
            r"申请职位[:：\s]*([^\s，,。；;\n]{2,30})",
            r"应聘[:：\s]*([^\s，,。；;\n]{2,30})",
        ]:
            m = re.search(pat, t)
            if m:
                best = self._best_jd_for_text(m.group(1).strip())
                if best:
                    return best
        best_jd, best_idx, best_applied = None, None, False
        for jd in self.jds:
            for c in self._jd_name_candidates(jd):
                idx = t.find(c)
                if idx == -1:
                    continue
                nearby = t[max(0, idx - 12):idx]
                applied = bool(re.search(r"应聘|申请|投递|职位", nearby))
                if applied and not best_applied:
                    best_applied, best_jd, best_idx = True, jd, idx
                elif (applied == best_applied) and (best_idx is None or idx < best_idx):
                    best_jd, best_idx = jd, idx
                break
        return best_jd

    def _guess_jd(self, cand_info) -> Optional[JD]:
        if not self.jds:
            return None
        text = (cand_info.full_text or "").lower()
        best, best_score = None, -1
        for jd in self.jds:
            kw_set = set(_jd_keywords(jd))
            if not kw_set:
                continue
            score = sum(1 for k in kw_set if k.lower() in text)
            if score > best_score:
                best, best_score = jd, score
        if best is not None and best_score > 0:
            return best
        return self.jds[0]


def _jd_keywords(jd: JD) -> list[str]:
    out = []
    for src in (jd.name, jd.description, jd.requirements):
        if not src:
            continue
        for m in re.findall(r"[\u4e00-\u9fa5A-Za-z]{2,8}", src):
            if m not in out and len(m) >= 2:
                out.append(m)
            if len(out) >= 30:
                break
    return out
