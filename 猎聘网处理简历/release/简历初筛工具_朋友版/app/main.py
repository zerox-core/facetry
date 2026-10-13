"""Flask 应用入口"""
from __future__ import annotations

import json
import os
import sys
import threading
import time
from pathlib import Path

# 确保以项目根目录为基准
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from flask import Flask, Response, jsonify, render_template, request, send_from_directory  # noqa: E402

from app.core.cdp_client import CDPClient
from app.core.config import get_db_path, get_jd_path, load_config
from app.core.db import aggregate_stats, init_db, list_candidates, mark_operated, update_verdict
from app.core.jd_loader import load_jds
from app.core.scanner import Scanner
from app.core.platforms import get_driver, list_drivers  # noqa: E402


app = Flask(__name__, template_folder=str(ROOT / "app" / "templates"), static_folder=None)

CFG = load_config()
DB = get_db_path(CFG)
init_db(DB)
SCANNER = Scanner()


# -------------------- 页面 --------------------

@app.route("/")
def index():
    return render_template("index.html")


# -------------------- Chrome 状态 --------------------

@app.route("/api/chrome/status")
def chrome_status():
    cdp = CDPClient(host=CFG["chrome"]["host"], port=CFG["chrome"]["port"])
    info = {"reachable": False, "tabs": [], "platforms": {}, "need_restart": False, "hint": ""}
    try:
        info["reachable"] = cdp.is_reachable()
        if info["reachable"]:
            tabs = cdp.list_tabs()
            info["tabs"] = [
                {"title": t.title[:60], "url": t.url[:80], "type": t.page_type}
                for t in tabs
            ]
            # 列出每个已注册平台在本 Chrome 里的标签页命中情况
            for d in list_drivers():
                hit = next((t for t in tabs if d.url_match in (t.url or "").lower()), None)
                info["platforms"][d.display_name] = {
                    "code": d.code,
                    "url_match": d.url_match,
                    "tab": {"title": hit.title, "url": hit.url} if hit else None,
                }
            hint_lines = []
            for name, p in info["platforms"].items():
                hint_lines.append(f"  · {name}: {'✅' if p['tab'] else '❌'}{p['tab']['url'] if p['tab'] else '（未找到）'}")
            if any(p["tab"] for p in info["platforms"].values()):
                info["hint"] = "Chrome 已连接。\n" + "\n".join(hint_lines)
            else:
                info["hint"] = "Chrome 已连接，但未找到任何已注册平台页面（请在 Chrome 中打开对应平台的「待处理简历」页）。\n" + "\n".join(hint_lines)
        else:
            info["hint"] = (
                "未连接 Chrome。请先关闭所有 Chrome 窗口，然后执行以下命令：\n\n"
                "    chrome.exe --remote-debugging-port=9222 --remote-allow-origins=*\n\n"
                "（--remote-allow-origins=* 是新版 Chrome 必需参数）"
            )
    except Exception as e:
        info["hint"] = f"诊断失败：{e}"
    return jsonify(info)


# -------------------- 深度诊断：抓取猎聘页真实 DOM --------------------

# 纯 ASCII 探针：统计各类"一条简历"选择器命中数，并取出正文开头，
# 用于区分"登录页 / 简历列表页"以及判断 LIEPIN_LIST_JS 选择器是否对得上。
DIAGNOSE_PROBE_JS = r"""
(function(){
  function cnt(sel){ try { return document.querySelectorAll(sel).length; } catch(e){ return -1; } }
  var sels = ['.resume-item','.candidate-item','.apply-item','.apply-list-item',
    '.position-apply-item','.resume-card','.list-item','[data-resume-id]',
    '[data-candidate-id]','[data-id]','li[class*="resume"]','li[class*="apply"]',
    'li[class*="item"]','div[class*="resume"]','div[class*="apply"]','div[class*="item"]',
    'a[href*="resume"]','a[href*="candidate"]','a[href*="apply"]'];
  var hits = {};
  sels.forEach(function(s){ var c = cnt(s); if (c > 0) hits[s] = c; });
  var body = (document.body && document.body.innerText) ? document.body.innerText : '';
  var links = [];
  try {
    links = Array.prototype.slice.call(document.querySelectorAll('a[href]'))
      .filter(function(a){ return /resume|candidate|apply|position/i.test(a.href); })
      .slice(0, 12).map(function(a){ return a.href; });
  } catch(e) {}
  return {
    url: location.href,
    title: document.title,
    bodyLen: body.length,
    bodyHead: body.substring(0, 600),
    selectorHits: hits,
    resumeLikeLinks: links
  };
})()
"""


@app.route("/api/diagnose")
def api_diagnose():
    """深度诊断：列出调试 Chrome 全部标签页 + 选中平台页的真实 DOM 探针。"""
    platform = request.args.get("platform", "猎聘网")
    cdp = CDPClient(host=CFG["chrome"]["host"], port=CFG["chrome"]["port"])
    out = {"reachable": False, "platform": platform, "tabs": [], "platform_tab": None, "probe": None,
           "list_js_items_count": None, "list_js_sample": [], "error": ""}
    try:
        if not cdp.is_reachable():
            out["error"] = "Chrome 调试端口不可达（9222）。请确认调试 Chrome 已用 --remote-debugging-port=9222 启动。"
            return jsonify(out)
        out["reachable"] = True
        out["tabs"] = [
            {"title": t.title, "url": t.url, "type": t.page_type}
            for t in cdp.list_tabs()
        ]
        try:
            driver = get_driver(platform)
        except KeyError:
            out["error"] = f"未注册的平台: {platform!r}"
            return jsonify(out)
        target_tab = next(
            (t for t in cdp.list_tabs() if driver.url_match in (t.url or "").lower()),
            None
        )
        if not target_tab:
            out["error"] = f"在调试 Chrome 中未找到任何 URL 含 {driver.url_match} 的标签页。请在该调试 Chrome 里打开 {platform}「待处理简历」页面并登录，再点诊断。"
            return jsonify(out)
        out["platform_tab"] = {"title": target_tab.title, "url": target_tab.url}
        cdp.connect(target_tab)
        # 跑该平台的诊断 JS
        out["probe"] = cdp.evaluate(driver.diagnostics_probe_js(), timeout=20)
        # 跑该平台的列表抓取 JS，看抓到几条
        try:
            list_data = cdp.evaluate(driver.fetch_list.__self__ if False else _driver_fetch_list_js(driver), timeout=20)
            items = (list_data or {}).get("items") or []
            out["list_js_items_count"] = len(items)
            out["list_js_sample"] = [
                {"href": (it.get("href") or "")[:140], "text": (it.get("text") or "")[:160]}
                for it in items[:5]
            ]
        except Exception as e:
            out["list_js_error"] = f"{e.__class__.__name__}: {e}"
        # 实测滚动能否推进虚拟列表（验证"只看到 3 份"是否因滚动容器错误）
        if hasattr(driver, "diagnostics_scroll_test"):
            try:
                out["scroll_test"] = driver.diagnostics_scroll_test(cdp)
            except Exception as e:
                out["scroll_test_error"] = f"{e.__class__.__name__}: {e}"
        cdp.close()
    except Exception as e:
        out["error"] = f"{e.__class__.__name__}: {e}"
    return jsonify(out)


def _driver_fetch_list_js(driver):
    """取 driver 的列表抓取 JS 字符串（只读一次再 evaluate，避免重复创建）"""
    # driver.fetch_list 内部会 evaluate 内部 JS；为了探针我们直接复用 driver 的 JS 字符串
    # 各 driver 暴露的常量在模块里：liepin.LIEPIN_LIST_JS / qianchengwuyou.QCWY_LIST_JS
    from .core.platforms.liepin import LIEPIN_LIST_JS as _L
    from .core.platforms.qianchengwuyou import QCWY_LIST_JS as _Q
    return _L if driver.code == "liepin" else _Q


# -------------------- JD 与 字典 --------------------

@app.route("/api/jds")
def api_jds():
    jds = load_jds(get_jd_path(CFG))
    return jsonify(
        {
            "jds": [
                {
                    "key": j.key,
                    "seq": j.seq,
                    "name": j.name,
                    "city": j.city,
                    "requirements": j.requirements,
                    "description": j.description,
                    "note": j.note,
                }
                for j in jds
            ]
        }
    )


@app.route("/api/config")
def api_config():
    """返回给前端用：脱敏后的配置"""
    safe = {
        "chrome": CFG.get("chrome", {}),
        "scanner": {
            "auto_operate": CFG.get("scanner", {}).get("auto_operate", False),
            "dry_run": CFG.get("scanner", {}).get("dry_run", True),
        },
        "llm_enabled": bool(CFG.get("llm", {}).get("enabled") and CFG.get("llm", {}).get("api_key")),
        "llm_model": CFG.get("llm", {}).get("model", ""),
        "platforms": [p.get("name") for p in CFG.get("platforms", []) if p.get("enabled")],
    }
    return jsonify(safe)


# -------------------- 候选人 / 统计 --------------------

@app.route("/api/stats")
def api_stats():
    s = aggregate_stats(DB)
    return jsonify(
        {
            "total": s["total"],
            "today": s["today"],
            "qualified": s["qualified"],
            "pending": s["pending"],
            "rejected": s["rejected"],
            "incomplete": s["incomplete"],
            "scanning": SCANNER.is_running(),
            # 仅返回「正在运行的平台」，前端据此只给该平台显示"扫描中"，避免串台
            "scanning_platform": SCANNER.state.platform if SCANNER.is_running() else None,
        }
    )


@app.route("/api/candidates")
def api_candidates():
    verdict = request.args.get("verdict", "全部")
    jd_key = request.args.get("jd_key", "全部岗位")
    platform = request.args.get("platform", "全部平台")
    date_from = request.args.get("date_from") or None
    date_to = request.args.get("date_to") or None
    try:
        page = int(request.args.get("page", 1))
    except (TypeError, ValueError):
        page = 1
    try:
        page_size = int(request.args.get("page_size", 50))
    except (TypeError, ValueError):
        page_size = 50
    data = list_candidates(
        DB, verdict=verdict, jd_key=jd_key, platform=platform,
        date_from=date_from, date_to=date_to, page=page, page_size=page_size,
    )
    rows = data["rows"]
    total = data["total"]
    for r in rows:
        # SQLite Row -> dict 后 hits/misses/detail_json 是字符串
        if isinstance(r.get("hits"), str):
            try:
                r["hits"] = json.loads(r["hits"])
            except Exception:
                r["hits"] = []
        if isinstance(r.get("misses"), str):
            try:
                r["misses"] = json.loads(r["misses"])
            except Exception:
                r["misses"] = []
        if isinstance(r.get("detail_json"), str):
            r["detail"] = json.loads(r["detail_json"]) if r["detail_json"] else {}
        else:
            r["detail"] = {}
        # 时间格式化
        if "scanned_at" in r and r["scanned_at"]:
            r["scanned_at"] = str(r["scanned_at"])
    total_pages = (total + page_size - 1) // page_size if page_size > 0 else 1
    return jsonify({
        "rows": rows, "count": total,
        "page": page, "page_size": page_size, "total_pages": total_pages,
    })


@app.route("/api/candidate/<int:cid>/decide", methods=["POST"])
def api_candidate_decide(cid: int):
    """人工修改判定/标记已处理"""
    data = request.get_json(force=True, silent=True) or {}
    new_verdict = data.get("verdict")
    if new_verdict not in {"合适", "待定", "不合适", "信息不足"}:
        return jsonify({"ok": False, "error": "verdict 非法"}), 400
    # 直接复用 mark_operated 同时写入 verdict（语义对齐"已操作"）
    mark_operated(DB, cid, new_verdict)
    return jsonify({"ok": True})


@app.route("/api/candidate/<int:cid>/verdict", methods=["POST"])
def api_candidate_verdict(cid: int):
    """手动纠正判定标签：仅更新 verdict 字段，不动 operated 状态。"""
    data = request.get_json(force=True, silent=True) or {}
    new_verdict = data.get("verdict")
    if new_verdict not in {"合适", "待定", "不合适", "信息不足"}:
        return jsonify({"ok": False, "error": "verdict 非法"}), 400
    try:
        update_verdict(DB, cid, new_verdict)
    except ValueError as e:
        return jsonify({"ok": False, "error": str(e)}), 400
    return jsonify({"ok": True})


# -------------------- 扫描控制 --------------------

@app.route("/api/scan/start", methods=["POST"])
def api_scan_start():
    if SCANNER.is_running():
        return jsonify({"ok": False, "error": "已有扫描在运行"}), 400
    data = request.get_json(force=True, silent=True) or {}
    use_mock = bool(data.get("mock", False))
    platform = data.get("platform") or "猎聘网"
    auto_operate = data.get("auto_operate", None)
    dry_run = data.get("dry_run", None)
    auto_operate = bool(auto_operate) if isinstance(auto_operate, bool) else None
    dry_run = bool(dry_run) if isinstance(dry_run, bool) else None
    try:
        sid = SCANNER.start(platform=platform, use_mock=use_mock, auto_operate=auto_operate, dry_run=dry_run)
    except (ValueError, KeyError) as e:
        return jsonify({"ok": False, "error": str(e)}), 400
    return jsonify({"ok": True, "session_id": sid})


@app.route("/api/scan/stop", methods=["POST"])
def api_scan_stop():
    if not SCANNER.is_running():
        return jsonify({"ok": False, "error": "没有正在进行的扫描"}), 400
    SCANNER.stop()
    return jsonify({"ok": True})


@app.route("/api/scan/status")
def api_scan_status():
    s = SCANNER.state
    return jsonify({
        "running": SCANNER.is_running(),
        "session_id": s.session_id,
        "started_at": s.started_at,
        "stats": s.stats(),
        "error": s.error,
        "platform": s.platform,
    })


@app.route("/api/scan/events")
def api_scan_events():
    """SSE 实时事件流"""
    def gen():
        last_heartbeat = time.time()
        while True:
            try:
                ev = SCANNER.event_queue.get(timeout=10)
                yield f"data: {json.dumps(ev, ensure_ascii=False)}\n\n"
            except Exception:
                pass
            now = time.time()
            if now - last_heartbeat > 5:
                # keepalive
                yield f": ping {int(now)}\n\n"
                last_heartbeat = now
            if not SCANNER.is_running() and SCANNER.event_queue.empty():
                # 给前端一个结束信号
                yield f"data: {json.dumps({'type':'closed','ts':now}, ensure_ascii=False)}\n\n"
                break

    return Response(gen(), mimetype="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


# -------------------- 启动 --------------------

def open_browser(port: int):
    """程序启动后自动打开浏览器（多策略 + 日志，便于排查）"""
    import webbrowser
    time.sleep(2.0)
    url = f"http://127.0.0.1:{port}/"
    print(f"\n[浏览器] 正在打开 {url}", flush=True)
    opened = False
    for fn_name in ("open_new_tab", "open"):
        try:
            fn = getattr(webbrowser, fn_name, None)
            if not fn:
                continue
            ok = fn(url)
            print(f"[浏览器] webbrowser.{fn_name}() 返回 {ok}", flush=True)
            if ok:
                opened = True
                break
        except Exception as e:
            print(f"[浏览器] webbrowser.{fn_name}() 失败：{e}", flush=True)
    if not opened:
        print("[浏览器] ⚠️ 自动打开失败，请手动访问：", url, flush=True)


if __name__ == "__main__":
    port = 7788
    # 浏览器窗口由 启动.bat 的 --new-tab 负责打开；
    # 仅当显式设置 OPEN_BROWSER=1 时才自动打开，避免重复弹窗。
    if os.environ.get("OPEN_BROWSER") == "1":
        threading.Thread(target=open_browser, args=(port,), daemon=True).start()
    # use_reloader=False 避免后台线程被 fork 双份
    app.run(host="127.0.0.1", port=port, debug=False, use_reloader=False, threaded=True)
