"""新业务对象 → 契约 JSON 形状（design/api-contract-v2.md 第 2 节）"""
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import CandidateRow, InterviewRow, MatchRow, PositionRow, PositionVersionRow
from . import jobs as jobsvc


def candidate_json(c: CandidateRow) -> dict:
    return {
        "id": c.id, "name": c.name, "currentPosition": c.currentPosition,
        "currentCompany": c.currentCompany, "expectedCity": c.expectedCity,
        "education": c.education, "major": c.major, "yearsOfExperience": c.yearsOfExperience,
        "skills": c.skills or [], "phone": c.phone, "email": c.email,
        "channel": c.channel, "channelName": c.channelName, "sourceId": c.sourceId,
        "summary": c.summary, "detailUrl": c.detailUrl, "stage": c.stage,
        "ownerId": c.ownerId, "ownerName": c.ownerName, "nextStep": c.nextStep,
        "attachments": c.attachments or [],
        "createdAt": c.createdAt, "updatedAt": c.updatedAt,
    }


def match_summary(db: Session, m: MatchRow) -> dict:
    pos = db.get(PositionRow, m.positionId)
    return {"id": m.id, "positionId": m.positionId, "positionTitle": pos.title if pos else "",
            "verdict": m.verdict, "score": m.score, "screenedAt": m.screenedAt}


def candidate_row_json(db: Session, c: CandidateRow) -> dict:
    matches = db.scalars(select(MatchRow).where(MatchRow.candidateId == c.id)
                         .order_by(MatchRow.updatedAt.desc())).all()
    return {**candidate_json(c), "matches": [match_summary(db, m) for m in matches[:2]]}


def match_json(db: Session, m: MatchRow) -> dict:
    pos = db.get(PositionRow, m.positionId)
    running = jobsvc.find_running(ref_id=m.id, job_type="screen")
    return {
        "id": m.id, "candidateId": m.candidateId, "positionId": m.positionId,
        "positionTitle": pos.title if pos else "",
        "verdict": m.verdict, "score": m.score, "reason": m.reason,
        "hits": m.hits or [], "misses": m.misses or [],
        "aiSummary": m.aiSummary, "concerns": m.concerns or [],
        "jdVersion": m.jdVersion, "jdSnapshot": m.jdSnapshot or {},
        "screenedAt": m.screenedAt,
        "jobState": "screen" if running else None,
    }


def position_json(db: Session, p: PositionRow, with_versions: bool = False, with_stats: bool = False) -> dict:
    out = {
        "id": p.id, "title": p.title, "city": p.city, "department": p.department, "status": p.status,
        "jd": {"version": p.jdVersion, "content": p.jdContent, "requirements": p.jdRequirements,
               "note": p.jdNote, "updatedAt": p.jdUpdatedAt},
        "createdAt": p.createdAt, "updatedAt": p.updatedAt,
    }
    if with_versions:
        versions = db.scalars(select(PositionVersionRow).where(PositionVersionRow.positionId == p.id)
                              .order_by(PositionVersionRow.version.desc())).all()
        out["versions"] = [{"version": v.version, "updatedAt": v.updatedAt, "updatedBy": v.updatedBy} for v in versions]
    if with_stats:
        rows = db.execute(select(MatchRow.candidateId).where(MatchRow.positionId == p.id)).all()
        cand_ids = [r[0] for r in rows]
        by_stage: dict = {}
        if cand_ids:
            stage_counts = db.execute(
                select(CandidateRow.stage, func.count()).where(CandidateRow.id.in_(cand_ids))
                .group_by(CandidateRow.stage)).all()
            by_stage = {stage: cnt for stage, cnt in stage_counts}
        out["stats"] = {"total": len(cand_ids), "byStage": by_stage}
    return out


def _candidate_name(db: Session, cid: str) -> str:
    c = db.get(CandidateRow, cid)
    return c.name if c else ""


def _position_title(db: Session, pid: str) -> str:
    p = db.get(PositionRow, pid)
    return p.title if p else ""


DEFAULT_NOTIFY = {"email": {"state": "pending", "error": ""},
                  "sms": {"state": "pending", "error": ""},
                  "feishu": {"state": "pending", "eventId": "", "error": ""}}


def interview_json(db: Session, iv: InterviewRow) -> dict:
    notify = dict(DEFAULT_NOTIFY)
    for k, v in (iv.notify or {}).items():
        notify.setdefault(k, {}).update(v)
    return {
        "id": iv.id, "candidateId": iv.candidateId, "candidateName": _candidate_name(db, iv.candidateId),
        "positionId": iv.positionId, "positionTitle": _position_title(db, iv.positionId),
        "round": iv.round, "mode": iv.mode, "startAt": iv.startAt, "endAt": iv.endAt,
        "location": iv.location, "meetingUrl": iv.meetingUrl,
        "interviewers": iv.interviewers or [], "status": iv.status,
        "notify": notify, "feedback": iv.feedback, "history": iv.history or [],
        "createdBy": iv.createdBy, "createdAt": iv.createdAt, "updatedAt": iv.updatedAt,
    }


def offer_json(db: Session, o) -> dict:
    return {
        "id": o.id, "candidateId": o.candidateId, "candidateName": _candidate_name(db, o.candidateId),
        "positionId": o.positionId, "positionTitle": _position_title(db, o.positionId),
        "note": o.note, "materials": o.materials or [],
        "feishu": o.feishu or {"state": "pending", "instanceId": "", "updatedAt": "", "error": ""},
        "bpm": o.bpm or {"state": "pending", "processId": "", "updatedAt": "", "error": ""},
        "overall": o.overall, "history": o.history or [],
        "createdBy": o.createdBy, "createdByName": o.createdByName,
        "createdAt": o.createdAt, "updatedAt": o.updatedAt,
    }
