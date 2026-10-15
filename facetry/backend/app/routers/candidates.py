from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.deps import CurrentUser, require_user
from ..core.errors import fail
from ..models import CandidateRow, FollowUpRow, InterviewRow, MatchRow, OfferRow, PositionRow, iso_now, new_id
from ..services import jobs as jobsvc
from ..services import perm
from ..services.serializers import (candidate_json, candidate_row_json, interview_json, match_json, offer_json)
from ..services.util import clip

router = APIRouter(prefix="/api")

STAGES = ("new", "screening", "contact", "interviewing", "evaluating", "offer", "done", "parked")


def _get_candidate(db: Session, cid: str) -> CandidateRow:
    c = db.get(CandidateRow, cid)
    if not c:
        raise fail("候选人不存在", 404)
    return c


def _interviewer_candidate_ids(db: Session, user_id: str) -> set[str]:
    """面试官可见的候选人：分配给我面试的 + 我负责的（面试量级小，显式遍历即可）"""
    ids = set()
    for iv in db.scalars(select(InterviewRow)).all():
        if any(i.get("id") == user_id for i in (iv.interviewers or [])):
            ids.add(iv.candidateId)
    for c in db.scalars(select(CandidateRow).where(CandidateRow.ownerId == user_id)).all():
        ids.add(c.id)
    return ids


@router.get("/candidates")
async def list_candidates(stage: str = "", positionId: str = "", channel: str = "", ownerId: str = "",
                          q: str = "", verdict: str = "", page: int = 1, size: int = 20,
                          user: CurrentUser = Depends(require_user), db: Session = Depends(get_db)):
    stmt = select(CandidateRow)
    if stage:
        stmt = stmt.where(CandidateRow.stage == stage)
    if channel:
        stmt = stmt.where(CandidateRow.channel == channel)
    if ownerId:
        stmt = stmt.where(CandidateRow.ownerId == ownerId)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(CandidateRow.name.like(like) | CandidateRow.currentCompany.like(like)
                          | CandidateRow.currentPosition.like(like))
    rows = db.scalars(stmt.order_by(CandidateRow.updatedAt.desc())).all()
    # 面试官（非管理员）只见分配给自己面试或自己负责的候选人
    if perm.is_interviewer_only(db, user.id):
        allowed = _interviewer_candidate_ids(db, user.id)
        rows = [c for c in rows if c.id in allowed]
    if positionId or verdict:
        match_map: dict[str, MatchRow] = {}
        m_stmt = select(MatchRow)
        if positionId:
            m_stmt = m_stmt.where(MatchRow.positionId == positionId)
        if verdict:
            m_stmt = m_stmt.where(MatchRow.verdict == verdict)
        for m in db.scalars(m_stmt).all():
            if m.candidateId not in match_map or m.updatedAt > match_map[m.candidateId].updatedAt:
                match_map[m.candidateId] = m
        rows = [c for c in rows if c.id in match_map]
    total = len(rows)
    page = max(1, page)
    size = max(1, min(100, size))
    rows = rows[(page - 1) * size: page * size]
    return {"total": total, "candidates": [candidate_row_json(db, c) for c in rows]}


@router.get("/candidates/{cid}")
async def get_candidate(cid: str, user: CurrentUser = Depends(require_user), db: Session = Depends(get_db)):
    c = _get_candidate(db, cid)
    if perm.is_interviewer_only(db, user.id) and cid not in _interviewer_candidate_ids(db, user.id):
        raise fail("候选人不存在", 404)
    matches = db.scalars(select(MatchRow).where(MatchRow.candidateId == cid).order_by(MatchRow.updatedAt.desc())).all()
    followups = db.scalars(select(FollowUpRow).where(FollowUpRow.candidateId == cid).order_by(FollowUpRow.createdAt.desc())).all()
    interviews = db.scalars(select(InterviewRow).where(InterviewRow.candidateId == cid).order_by(InterviewRow.startAt.desc())).all()
    offers = db.scalars(select(OfferRow).where(OfferRow.candidateId == cid).order_by(OfferRow.createdAt.desc())).all()
    return {
        "candidate": candidate_json(c),
        "matches": [match_json(db, m) for m in matches],
        "followups": [{"id": f.id, "candidateId": f.candidateId, "userId": f.userId, "userName": f.userName,
                       "content": f.content, "nextStep": f.nextStep, "createdAt": f.createdAt} for f in followups],
        "interviews": [interview_json(db, iv) for iv in interviews],
        "offers": [offer_json(db, o) for o in offers],
    }


@router.patch("/candidates/{cid}")
async def patch_candidate(cid: str, request: Request, user: CurrentUser = Depends(require_user), db: Session = Depends(get_db)):
    c = _get_candidate(db, cid)
    try:
        b = await request.json()
    except Exception:
        raise fail("请求格式不正确")
    now = iso_now()
    if "stage" in b:
        if b["stage"] not in STAGES:
            raise fail("阶段取值无效")
        if b["stage"] != c.stage:
            history = list(c.stageHistory or [])
            history.append({"at": now, "from": c.stage, "to": b["stage"], "by": user.id, "byName": user.name})
            c.stageHistory = history
            c.stage = b["stage"]
    if "ownerId" in b:
        c.ownerId = clip(b["ownerId"], 128)
        owner = perm.load_users(db).get(c.ownerId, {})
        c.ownerName = owner.get("name", "") if c.ownerId else ""
    if "nextStep" in b:
        c.nextStep = clip(b["nextStep"], 512)
    c.updatedAt = now
    db.commit()
    return candidate_json(c)


@router.post("/candidates/{cid}/followups", status_code=201)
async def add_followup(cid: str, request: Request, user: CurrentUser = Depends(require_user), db: Session = Depends(get_db)):
    c = _get_candidate(db, cid)
    try:
        b = await request.json()
    except Exception:
        raise fail("请求格式不正确")
    content = str(b.get("content") or "").strip()
    if not content:
        raise fail("跟进内容不能为空")
    f = FollowUpRow(id=new_id(), candidateId=cid, userId=user.id, userName=user.name,
                    content=clip(content, 4000), nextStep=clip(b.get("nextStep"), 512), createdAt=iso_now())
    db.add(f)
    if f.nextStep:
        c.nextStep = f.nextStep
        c.updatedAt = f.createdAt
    db.commit()
    return {"id": f.id, "candidateId": f.candidateId, "userId": f.userId, "userName": f.userName,
            "content": f.content, "nextStep": f.nextStep, "createdAt": f.createdAt}


@router.post("/candidates/{cid}/matches", status_code=201)
async def add_match(cid: str, request: Request, user: CurrentUser = Depends(require_user), db: Session = Depends(get_db)):
    c = _get_candidate(db, cid)
    try:
        b = await request.json()
    except Exception:
        raise fail("请求格式不正确")
    position_id = str(b.get("positionId") or "")
    pos = db.get(PositionRow, position_id)
    if not pos:
        raise fail("岗位不存在", 404)
    existing = db.scalars(select(MatchRow).where(MatchRow.candidateId == cid, MatchRow.positionId == position_id)).first()
    if existing:
        # 已有记录：未筛直接返回；已筛返回已有记录（如需重筛走 rescreen / screen）
        return match_json(db, existing)
    now = iso_now()
    m = MatchRow(id=new_id(), candidateId=cid, positionId=position_id, verdict="", score=None,
                 jdVersion=pos.jdVersion,
                 jdSnapshot={"title": pos.title, "city": pos.city, "content": pos.jdContent,
                             "requirements": pos.jdRequirements, "note": pos.jdNote},
                 createdAt=now, updatedAt=now)
    db.add(m)
    if c.stage == "new":
        c.stage = "screening"
        c.updatedAt = now
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = db.scalars(select(MatchRow).where(MatchRow.candidateId == cid, MatchRow.positionId == position_id)).first()
        if existing:
            return match_json(db, existing)
        raise
    # 自动触发初筛 Job（幂等：同 match 已有 running job 不重复发起）
    job = jobsvc.create_job("screen", ref_id=m.id)
    return match_json(db, m)


@router.delete("/candidates/{cid}/matches/{match_id}", status_code=204)
async def delete_match(cid: str, match_id: str, user: CurrentUser = Depends(require_user), db: Session = Depends(get_db)):
    _get_candidate(db, cid)
    m = db.get(MatchRow, match_id)
    if not m or m.candidateId != cid:
        raise fail("匹配记录不存在", 404)
    db.delete(m)
    db.commit()
    return Response(status_code=204)


@router.post("/matches/{match_id}/screen", status_code=202)
async def screen_match(match_id: str, user: CurrentUser = Depends(require_user), db: Session = Depends(get_db)):
    m = db.get(MatchRow, match_id)
    if not m:
        raise fail("匹配记录不存在", 404)
    existing = jobsvc.find_running(ref_id=match_id, job_type="screen")
    if existing:
        return jobsvc.public_job(existing)
    return jobsvc.public_job(jobsvc.create_job("screen", ref_id=match_id))


@router.get("/candidates/{cid}/resume-text")
async def resume_text(cid: str, user: CurrentUser = Depends(require_user), db: Session = Depends(get_db)):
    c = _get_candidate(db, cid)
    text = c.resumeText or c.summary or ""
    return {"text": text}
