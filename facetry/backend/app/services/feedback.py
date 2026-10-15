"""面试评价 AI 草稿：依据已填评分与备注生成综合评价草稿，不覆盖已确认的"""
import logging

from ..core.database import SessionLocal
from ..core.prompts import EVALUATE
from ..models import InterviewRow, iso_now
from . import llm

logger = logging.getLogger("facetry.feedback")


async def generate_feedback_draft(interview_id: str) -> None:
    with SessionLocal() as db:
        iv = db.get(InterviewRow, interview_id)
        if not iv:
            return
        fb = dict(iv.feedback or {})
        if fb.get("confirmedAt"):
            return  # 已确认的评价不被 AI 草稿覆盖
        records = [
            {"dimension": s.get("dimension", ""), "score": s.get("score")}
            for s in (fb.get("scores") or [])
        ]
        payload = {
            "name": _candidate_name(db, iv.candidateId),
            "role": _position_title(db, iv.positionId),
            "totalQuestions": len(records),
            "scoredCount": len([r for r in records if r["score"] is not None]),
            "records": [{"id": f"D{i + 1:02d}", "q": r["dimension"], "score": r["score"], "note": ""} for i, r in enumerate(records)],
            "note": fb.get("note", ""),
        }
        draft = ""
        try:
            result = await llm.llm_chat(
                [{"role": "system", "content": EVALUATE},
                 {"role": "user", "content": __import__("json").dumps(payload, ensure_ascii=False)}])
            parts = [result.get("overall", "")]
            if result.get("strengths"):
                parts.append("优势：" + "；".join(str(x) for x in result["strengths"]))
            if result.get("weaknesses"):
                parts.append("待验证：" + "；".join(str(x) for x in result["weaknesses"]))
            if result.get("suggestion"):
                parts.append("建议：" + str(result["suggestion"]))
            draft = "\n".join(p for p in parts if p).strip()
        except Exception as e:
            logger.warning("AI 评价草稿生成失败，使用本地汇总降级: %s", e)
        if not draft:
            scored = [r for r in records if r["score"] is not None]
            avg = sum(r["score"] for r in scored) / len(scored) if scored else 0
            draft = f"（规则版草稿）已评 {len(scored)} 个维度，平均 {avg:.1f} 分。" + (f"备注摘要：{fb['note'][:200]}" if fb.get("note") else "")
        iv.feedback = {**fb, "aiDraft": draft, "updatedAt": iso_now()}
        iv.updatedAt = iso_now()
        db.commit()


def _candidate_name(db, cid: str) -> str:
    from ..models import CandidateRow
    row = db.get(CandidateRow, cid)
    return row.name if row else ""


def _position_title(db, pid: str) -> str:
    from ..models import PositionRow
    row = db.get(PositionRow, pid)
    return row.title if row else ""
