from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.deps import CurrentUser, require_user
from ..models import CandidateRow, InterviewRow, MatchRow, OfferRow, PositionRow
from ..services.serializers import interview_json

router = APIRouter(prefix="/api")


@router.get("/todos")
async def todos(user: CurrentUser = Depends(require_user), db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    in_7d = (now + timedelta(days=7)).isoformat()
    ago_14d = (now - timedelta(days=14)).isoformat()
    now_iso = now.isoformat()

    # 待初筛：我负责的、已关联岗位但未初筛或 JD 已更新的候选人
    to_screen = []
    my_candidates = db.scalars(select(CandidateRow).where(CandidateRow.ownerId == user.id)).all()
    my_ids = {c.id for c in my_candidates}
    matches = db.scalars(select(MatchRow).where(MatchRow.candidateId.in_(my_ids))).all() if my_ids else []
    for m in matches:
        pos = db.get(PositionRow, m.positionId)
        if not pos:
            continue
        if not m.verdict or m.jdVersion < pos.jdVersion:
            cand = db.get(CandidateRow, m.candidateId)
            to_screen.append({"matchId": m.id, "candidateId": m.candidateId,
                              "candidateName": cand.name if cand else "", "positionTitle": pos.title,
                              "verdict": m.verdict, "createdAt": m.createdAt})

    to_contact = [{"candidateId": c.id, "candidateName": c.name, "stage": c.stage, "updatedAt": c.updatedAt}
                  for c in my_candidates if c.stage == "contact"]

    # 未来 7 天我参与/创建的面试
    upcoming = []
    for iv in db.scalars(select(InterviewRow)).all():
        if iv.status not in ("scheduled", "rescheduled"):
            continue
        if not (now_iso <= iv.startAt <= in_7d):
            continue
        if iv.createdBy == user.id or any(i.get("id") == user.id for i in (iv.interviewers or [])):
            upcoming.append(interview_json(db, iv))

    # 已结束未填面评的面试
    to_feedback = []
    for iv in db.scalars(select(InterviewRow)).all():
        if iv.status not in ("scheduled", "rescheduled", "completed") or iv.endAt > now_iso:
            continue
        if not (iv.createdBy == user.id or any(i.get("id") == user.id for i in (iv.interviewers or []))):
            continue
        fb = iv.feedback or {}
        if not fb.get("confirmedAt"):
            to_feedback.append(interview_json(db, iv))

    # 近 14 天我发起的审批状态变化
    offer_updates = []
    for o in db.scalars(select(OfferRow).where(OfferRow.createdBy == user.id)).all():
        cand = db.get(CandidateRow, o.candidateId)
        for side, data in (("feishu", o.feishu or {}), ("bpm", o.bpm or {})):
            updated = data.get("updatedAt", "")
            if updated and updated >= ago_14d and data.get("state") not in ("pending", ""):
                offer_updates.append({"offerId": o.id, "candidateName": cand.name if cand else "",
                                      "side": side, "state": data.get("state", ""), "updatedAt": updated})
    offer_updates.sort(key=lambda x: x["updatedAt"], reverse=True)

    return {"toScreen": to_screen, "toContact": to_contact,
            "upcomingInterviews": upcoming, "toFeedback": to_feedback, "offerUpdates": offer_updates}
