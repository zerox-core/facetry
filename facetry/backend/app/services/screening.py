"""AI 初筛：严格按 API 契约 V2 第 5 节。
LLM 优先；未配置或调用失败走本地关键词规则降级；JD 备注硬规则强制兜底。"""
import logging
import re
from datetime import datetime, timezone

from sqlalchemy import select

from ..core.database import SessionLocal
from ..core.prompts import SCREEN_SYS, SCREEN_USER_TMPL
from ..models import CandidateRow, MatchRow, PositionRow
from . import llm

logger = logging.getLogger("facetry.screening")

EDU_ORDER = {"大专": 1, "本科": 2, "硕士": 3, "博士": 4, "MBA": 4}
VERDICTS = ("合适", "待定", "不合适", "信息不足")


def _clip(s, n):
    s = str(s or "")
    return s[:n]


def _hard_rules(jd_note: str, resume_text: str) -> str | None:
    """JD 备注含「没有X经验…不考虑」且简历正文无对应关键词 → 强制不合适。
    X 中的并列写法（CRA/监查、药物警戒/PV）命中任一项即视为具备该经验。"""
    for m in re.finditer(r"没有([^，。；;\n]{1,15}?)经验(?:的)?[^，。；;\n]{0,8}?不考虑", jd_note or ""):
        group = m.group(1).strip()
        alts = [a.strip() for a in re.split(r"[/、或,，]+", group) if a.strip()]
        if alts and not any(a in (resume_text or "") for a in alts):
            return group
    return None


def _local_screen(jd: dict, cand: dict, resume_text: str) -> dict:
    """本地关键词规则降级：命中要求关键词计数 + 学历/年限粗比"""
    req_text = (jd.get("requirements", "") + "\n" + jd.get("content", ""))[:4000]
    keywords = [w for w in re.split(r"[、，,;；/\s]+", req_text) if 2 <= len(w) <= 12]
    cand_text = resume_text + " " + " ".join(cand.get("skills") or []) + " " + cand.get("currentPosition", "")
    # 双向命中：JD 关键词出现在候选人材料，或候选人技能词出现在 JD 文本
    skill_hits = [s for s in (cand.get("skills") or []) if 2 <= len(s) <= 12 and s in req_text]
    hits = sorted({w for w in keywords if w in cand_text} | set(skill_hits))[:8]
    ratio = len(hits) / max(1, min(len(keywords), 12))
    score = int(min(90, 30 + ratio * 80))
    misses = []
    # 学历粗比
    m = re.search(r"(博士|硕士|本科|大专)", jd.get("requirements", ""))
    if m:
        req_edu = EDU_ORDER.get(m.group(1), 0)
        cand_edu = EDU_ORDER.get(cand.get("education", ""), 0)
        if cand_edu and cand_edu < req_edu:
            score -= 15
            misses.append(f"学历低于要求（要求{m.group(1)}）")
    # 年限粗比
    m = re.search(r"(\d+)\s*年", jd.get("requirements", ""))
    if m and cand.get("yearsOfExperience", -1) >= 0:
        if cand["yearsOfExperience"] < int(m.group(1)):
            score -= 10
            misses.append(f"工作年限不足（要求{m.group(1)}年）")
    if not resume_text.strip():
        verdict, score = "信息不足", min(score, 40)
        reason = "简历正文缺失，无法评估（规则版）"
    elif score >= 70:
        verdict, reason = "合适", "关键词命中较多，建议人工复看（规则版）"
    elif score >= 45:
        verdict, reason = "待定", "部分要求命中，需人工确认（规则版）"
    else:
        verdict, reason = "不合适", "核心要求命中较少（规则版）"
    return {"verdict": verdict, "score": max(0, min(100, score)), "reason": _clip(reason, 30),
            "hits": hits, "misses": misses, "ai_summary": _clip(reason, 100), "concerns": []}


async def screen_match(match_id: str) -> None:
    with SessionLocal() as db:
        match = db.get(MatchRow, match_id)
        if not match:
            return
        cand = db.get(CandidateRow, match.candidateId)
        pos = db.get(PositionRow, match.positionId)
        if not cand or not pos:
            return
        resume_text = (cand.resumeText or "")[:8000]
        cand_view = {"currentPosition": cand.currentPosition, "skills": cand.skills,
                     "education": cand.education, "yearsOfExperience": cand.yearsOfExperience}
        jd_view = {"content": pos.jdContent, "requirements": pos.jdRequirements}
        result = None
        try:
            user_msg = SCREEN_USER_TMPL.format(
                city=pos.city or "未识别", name=pos.title or "未识别",
                description=pos.jdContent or "未识别", requirements=pos.jdRequirements or "未识别",
                note=pos.jdNote or "无",
                cand_name=cand.name or "未识别", current_position=cand.currentPosition or "未识别",
                current_company=cand.currentCompany or "未识别", expected_city=cand.expectedCity or "未识别",
                education=cand.education or "未识别", major=cand.major or "未识别",
                years=(f"{cand.yearsOfExperience}年" if cand.yearsOfExperience >= 0 else "未识别"),
                skills="、".join(cand.skills or []) or "未识别", resume_text=resume_text or "未识别")
            raw = await llm.llm_chat(
                [{"role": "system", "content": SCREEN_SYS}, {"role": "user", "content": user_msg}],
                temperature=0.1)
            if raw.get("verdict") in VERDICTS:
                result = {
                    "verdict": raw["verdict"],
                    "score": max(0, min(100, int(raw.get("score") or 0))),
                    "reason": _clip(raw.get("reason"), 30),
                    "hits": [str(x) for x in (raw.get("hits") or [])][:10],
                    "misses": [str(x) for x in (raw.get("misses") or [])][:10],
                    "ai_summary": _clip(raw.get("ai_summary"), 200),
                    "concerns": [str(x) for x in (raw.get("concerns") or [])][:10],
                }
        except Exception as e:
            logger.warning("初筛 LLM 调用失败，走本地规则降级: %s", e)
        if result is None:
            result = _local_screen(jd_view, cand_view, resume_text)
        # 硬规则兜底：LLM 与规则结果都要过
        hard_kw = _hard_rules(pos.jdNote, resume_text + " " + " ".join(cand.skills or []))
        if hard_kw:
            result["verdict"] = "不合适"
            result["score"] = min(result["score"], 30)
            result["reason"] = _clip(f"[硬规则强制] 没有{hard_kw}经验", 30)
            if f"没有{hard_kw}经验" not in result["misses"]:
                result["misses"] = [f"没有{hard_kw}经验（备注硬规则）"] + result["misses"]
        now = datetime.now(timezone.utc).isoformat()
        match.verdict = result["verdict"]
        match.score = result["score"]
        match.reason = result["reason"]
        match.hits = result["hits"]
        match.misses = result["misses"]
        match.aiSummary = result["ai_summary"]
        match.concerns = result["concerns"]
        match.jdVersion = pos.jdVersion
        match.jdSnapshot = {"title": pos.title, "city": pos.city, "content": pos.jdContent,
                            "requirements": pos.jdRequirements, "note": pos.jdNote}
        match.screenedAt = now
        match.updatedAt = now
        # 阶段推进：筛选完成进入「待联系」（仅在筛选中状态自动流转）
        if cand.stage == "screening":
            cand.stage = "contact"
            cand.updatedAt = now
        db.commit()


async def execute_screen(job: dict) -> None:
    await screen_match(job["refId"])


async def execute_rescreen(job: dict) -> None:
    """按当前 JD 版本重新初筛该岗位全部已关联候选人"""
    position_id = job["refId"]
    with SessionLocal() as db:
        ids = [r.id for r in db.scalars(select(MatchRow).where(MatchRow.positionId == position_id)).all()]
    for mid in ids:
        await screen_match(mid)


async def execute_feedback_draft(job: dict) -> None:
    from .feedback import generate_feedback_draft
    await generate_feedback_draft(job["refId"])
