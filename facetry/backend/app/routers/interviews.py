import logging

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.deps import CurrentUser, require_user
from ..core.errors import fail
from ..models import CandidateRow, InterviewRow, PositionRow, iso_now, new_id
from ..services import feishu, jobs as jobsvc, notify, perm
from ..services.serializers import DEFAULT_NOTIFY, interview_json
from ..services.sessions import get_session
from ..services.util import clip

logger = logging.getLogger("facetry.interviews")

router = APIRouter(prefix="/api/interviews")


def _notify_defaults() -> dict:
    return {k: dict(v) for k, v in DEFAULT_NOTIFY.items()}


async def _run_create_side_effects(interview_id: str) -> None:
    """创建后异步：飞书日程 + 候选人邮件/短信通知；任何失败只写状态不崩溃"""
    from ..core.database import SessionLocal
    with SessionLocal() as db:
        iv = db.get(InterviewRow, interview_id)
        if not iv:
            return
        cand = db.get(CandidateRow, iv.candidateId)
        pos = db.get(PositionRow, iv.positionId)
        state = dict(_notify_defaults())
        for k, v in (iv.notify or {}).items():
            state.setdefault(k, {}).update(v)
        # 飞书日程（含线上会议）
        r = await feishu.create_calendar_event({
            "candidateName": cand.name if cand else "", "round": iv.round,
            "location": iv.location, "mode": iv.mode, "startAt": iv.startAt, "endAt": iv.endAt,
        })
        state["feishu"] = {"state": r["state"], "eventId": r.get("eventId", ""), "error": r.get("error", "")}
        if r.get("meetingUrl"):
            iv.meetingUrl = r["meetingUrl"]
        # 候选人通知
        time_text = iv.startAt.replace("T", " ")[:16]
        location_text = iv.location or (iv.meetingUrl or "线上会议（链接待飞书创建后补充）" if iv.mode == "online" else "待定")
        body = notify.render_template(None, name=cand.name if cand else "", position=pos.title if pos else "",
                                      time=time_text, location=location_text)
        email_result = await notify.send_email((cand.email if cand else ""), f"面试通知：{pos.title if pos else ''}", body)
        state["email"] = email_result
        sms_result = await notify.send_sms(cand.phone if cand else "", {})
        state["sms"] = sms_result
        iv.notify = state
        iv.updatedAt = iso_now()
        db.commit()


def _append_history(iv: InterviewRow, action: str, detail: str, by: str) -> None:
    history = list(iv.history or [])
    history.append({"at": iso_now(), "action": action, "detail": detail, "by": by})
    iv.history = history


@router.get("")
async def list_interviews(from_: str = Query("", alias="from"), to: str = "", candidateId: str = "",
                          mine: str = "", user: CurrentUser = Depends(require_user), db: Session = Depends(get_db)):
    stmt = select(InterviewRow)
    if candidateId:
        stmt = stmt.where(InterviewRow.candidateId == candidateId)
    rows = db.scalars(stmt.order_by(InterviewRow.startAt)).all()
    if from_:
        rows = [iv for iv in rows if iv.endAt >= from_]
    if to:
        rows = [iv for iv in rows if iv.startAt <= to]
    if mine == "1":
        rows = [iv for iv in rows if iv.createdBy == user.id or any(i.get("id") == user.id for i in (iv.interviewers or []))]
    return {"interviews": [interview_json(db, iv) for iv in rows]}


@router.post("", status_code=201)
async def create_interview(request: Request, user: CurrentUser = Depends(require_user), db: Session = Depends(get_db)):
    try:
        b = await request.json()
    except Exception:
        raise fail("请求格式不正确")
    candidate_id = str(b.get("candidateId") or "")
    position_id = str(b.get("positionId") or "")
    cand = db.get(CandidateRow, candidate_id)
    if not cand:
        raise fail("候选人不存在", 404)
    pos = db.get(PositionRow, position_id)
    if not pos:
        raise fail("岗位不存在", 404)
    round_ = clip(b.get("round"), 64).strip() or "一面"
    start_at, end_at = str(b.get("startAt") or ""), str(b.get("endAt") or "")
    if not start_at or not end_at:
        raise fail("请提供面试开始与结束时间")
    if b.get("mode") not in ("online", "offline"):
        raise fail("面试方式无效")
    idem_key = str(b.get("idempotencyKey") or "") or None

    # 幂等：显式 idempotencyKey 或自然键（candidateId+positionId+round+startAt）重复 → 返回已有记录
    if idem_key:
        dup = db.scalars(select(InterviewRow).where(InterviewRow.idempotencyKey == idem_key)).first()
        if dup:
            return interview_json(db, dup)
    dup = db.scalars(select(InterviewRow).where(InterviewRow.candidateId == candidate_id,
                                                InterviewRow.positionId == position_id,
                                                InterviewRow.round == round_,
                                                InterviewRow.startAt == start_at)).first()
    if dup:
        return interview_json(db, dup)

    users = perm.load_users(db)
    interviewers = []
    for uid in (b.get("interviewerIds") if isinstance(b.get("interviewerIds"), list) else [])[:10]:
        if isinstance(uid, str) and uid:
            interviewers.append({"id": uid, "name": users.get(uid, {}).get("name") or uid})

    now = iso_now()
    iv = InterviewRow(
        id=new_id(), candidateId=candidate_id, positionId=position_id, round=round_,
        mode=b["mode"], startAt=start_at, endAt=end_at,
        location=clip(b.get("location"), 512), meetingUrl="",
        interviewers=interviewers, status="scheduled",
        notify=_notify_defaults(), feedback=None,
        history=[], createdBy=user.id, idempotencyKey=idem_key,
        createdAt=now, updatedAt=now,
    )
    _append_history(iv, "created", f"创建{round_}预约", user.id)
    db.add(iv)
    if cand.stage in ("new", "screening", "contact"):
        cand.stage = "interviewing"
        cand.updatedAt = now
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        dup = db.scalars(select(InterviewRow).where(InterviewRow.candidateId == candidate_id,
                                                    InterviewRow.positionId == position_id,
                                                    InterviewRow.round == round_,
                                                    InterviewRow.startAt == start_at)).first()
        if dup:
            return interview_json(db, dup)
        raise fail("重复的面试预约", 409)
    import asyncio
    asyncio.create_task(_run_create_side_effects(iv.id))
    return interview_json(db, db.get(InterviewRow, iv.id))


@router.patch("/{iid}")
async def patch_interview(iid: str, request: Request, user: CurrentUser = Depends(require_user), db: Session = Depends(get_db)):
    iv = db.get(InterviewRow, iid)
    if not iv:
        raise fail("面试不存在", 404)
    try:
        b = await request.json()
    except Exception:
        raise fail("请求格式不正确")
    action = b.get("action")
    if action not in ("reschedule", "cancel", "complete"):
        raise fail("action 取值无效")
    event_id = (iv.notify or {}).get("feishu", {}).get("eventId", "")
    if action == "reschedule":
        start_at, end_at = str(b.get("startAt") or ""), str(b.get("endAt") or "")
        if not start_at or not end_at:
            raise fail("请提供改期后的开始与结束时间")
        iv.startAt, iv.endAt = start_at, end_at
        iv.status = "rescheduled"
        r = await feishu.update_calendar_event(event_id, start_at, end_at)
        notify_state = dict(iv.notify or _notify_defaults())
        notify_state["feishu"] = {**notify_state.get("feishu", {}), "state": r["state"], "error": r.get("error", "")}
        iv.notify = notify_state
        _append_history(iv, "rescheduled", f"改期至 {start_at}（{clip(b.get('reason'), 200) or '无原因'}）", user.id)
    elif action == "cancel":
        iv.status = "canceled"
        r = await feishu.delete_calendar_event(event_id)
        notify_state = dict(iv.notify or _notify_defaults())
        notify_state["feishu"] = {**notify_state.get("feishu", {}), "state": r["state"], "error": r.get("error", "")}
        iv.notify = notify_state
        _append_history(iv, "canceled", clip(b.get("reason"), 200) or "取消面试", user.id)
    else:
        iv.status = "completed"
        _append_history(iv, "completed", "面试完成", user.id)
    iv.updatedAt = iso_now()
    db.commit()
    return interview_json(db, iv)


@router.post("/{iid}/resend")
async def resend_notify(iid: str, request: Request, user: CurrentUser = Depends(require_user), db: Session = Depends(get_db)):
    iv = db.get(InterviewRow, iid)
    if not iv:
        raise fail("面试不存在", 404)
    try:
        b = await request.json()
    except Exception:
        raise fail("请求格式不正确")
    channel = b.get("channel")
    if channel not in ("email", "sms"):
        raise fail("channel 取值无效")
    cand = db.get(CandidateRow, iv.candidateId)
    pos = db.get(PositionRow, iv.positionId)
    time_text = iv.startAt.replace("T", " ")[:16]
    location_text = iv.location or (iv.meetingUrl or "线上会议" if iv.mode == "online" else "待定")
    body = notify.render_template(None, name=cand.name if cand else "", position=pos.title if pos else "",
                                  time=time_text, location=location_text)
    if channel == "email":
        r = await notify.send_email(cand.email if cand else "", f"面试通知：{pos.title if pos else ''}", body)
    else:
        r = await notify.send_sms(cand.phone if cand else "", {})
    notify_state = dict(iv.notify or _notify_defaults())
    notify_state[channel] = r
    iv.notify = notify_state
    iv.updatedAt = iso_now()
    _append_history(iv, "resend", f"重发{'邮件' if channel == 'email' else '短信'}通知：{r['state']}", user.id)
    db.commit()
    return interview_json(db, iv)


def _feedback_base(iv: InterviewRow, user: CurrentUser) -> dict:
    fb = dict(iv.feedback or {})
    fb.setdefault("interviewId", iv.id)
    fb.setdefault("interviewerId", user.id)
    fb.setdefault("interviewerName", user.name)
    fb.setdefault("scores", [])
    fb.setdefault("note", "")
    fb.setdefault("conclusion", "")
    fb.setdefault("aiDraft", "")
    fb.setdefault("confirmedAt", "")
    fb.setdefault("sessionId", "")
    return fb


@router.post("/{iid}/feedback")
async def upsert_feedback(iid: str, request: Request, user: CurrentUser = Depends(require_user), db: Session = Depends(get_db)):
    iv = db.get(InterviewRow, iid)
    if not iv:
        raise fail("面试不存在", 404)
    try:
        b = await request.json()
    except Exception:
        raise fail("请求格式不正确")
    fb = _feedback_base(iv, user)
    if fb.get("confirmedAt"):
        raise fail("面评已确认，如需修改请联系管理员", 409)
    if isinstance(b.get("scores"), list):
        scores = []
        for s in b["scores"][:20]:
            if not isinstance(s, dict):
                continue
            v = s.get("score")
            if v is not None and (not isinstance(v, (int, float)) or v < 1 or v > 5):
                raise fail("评分应在 1–5 分之间")
            scores.append({"dimension": clip(s.get("dimension"), 100), "score": v})
        fb["scores"] = scores
    if isinstance(b.get("note"), str):
        fb["note"] = clip(b["note"], 10000)
    if b.get("conclusion") in ("通过", "待定", "不通过", ""):
        fb["conclusion"] = b["conclusion"]
    fb["updatedAt"] = iso_now()
    iv.feedback = fb
    iv.updatedAt = fb["updatedAt"]
    db.commit()
    return fb


@router.post("/{iid}/feedback/ai-draft", status_code=202)
async def ai_draft(iid: str, user: CurrentUser = Depends(require_user), db: Session = Depends(get_db)):
    iv = db.get(InterviewRow, iid)
    if not iv:
        raise fail("面试不存在", 404)
    fb = _feedback_base(iv, user)
    if fb.get("confirmedAt"):
        raise fail("面评已确认，不再生成草稿", 409)
    existing = jobsvc.find_running(ref_id=iid, job_type="feedback_draft")
    if existing:
        return jobsvc.public_job(existing)
    return jobsvc.public_job(jobsvc.create_job("feedback_draft", ref_id=iid))


@router.post("/{iid}/feedback/confirm")
async def confirm_feedback(iid: str, request: Request, user: CurrentUser = Depends(require_user), db: Session = Depends(get_db)):
    iv = db.get(InterviewRow, iid)
    if not iv:
        raise fail("面试不存在", 404)
    try:
        b = await request.json()
    except Exception:
        raise fail("请求格式不正确")
    fb = _feedback_base(iv, user)
    scores = []
    for s in (b.get("scores") if isinstance(b.get("scores"), list) else [])[:20]:
        if not isinstance(s, dict):
            continue
        v = s.get("score")
        if v is not None and (not isinstance(v, (int, float)) or v < 1 or v > 5):
            raise fail("评分应在 1–5 分之间")
        scores.append({"dimension": clip(s.get("dimension"), 100), "score": v})
    if b.get("conclusion") not in ("通过", "待定", "不通过"):
        raise fail("请给出面评结论（通过/待定/不通过）")
    fb["scores"] = scores
    fb["note"] = clip(b.get("note"), 10000)
    fb["conclusion"] = b["conclusion"]
    fb["confirmedAt"] = iso_now()
    fb["updatedAt"] = fb["confirmedAt"]
    iv.feedback = fb
    iv.updatedAt = fb["updatedAt"]
    # 面评确认后候选人进入「面评中→评估完成」流转由详情页人工操作，这里推进到 evaluating 之后的流转不自动做
    cand = db.get(CandidateRow, iv.candidateId)
    if cand and cand.stage == "interviewing":
        cand.stage = "evaluating"
        cand.updatedAt = fb["updatedAt"]
    _append_history(iv, "feedback_confirmed", f"面评确认：{b['conclusion']}", user.id)
    db.commit()
    return fb


@router.post("/{iid}/link-session")
async def link_session(iid: str, request: Request, user: CurrentUser = Depends(require_user), db: Session = Depends(get_db)):
    iv = db.get(InterviewRow, iid)
    if not iv:
        raise fail("面试不存在", 404)
    try:
        b = await request.json()
    except Exception:
        raise fail("请求格式不正确")
    session_id = str(b.get("sessionId") or "")
    if session_id:
        s = get_session(db, session_id)
        if s.get("userId") != user.id and user.id not in (s.get("shares") or []) and not perm.is_super(db, user.id):
            raise fail("评审会话不存在", 404)
    fb = _feedback_base(iv, user)
    fb["sessionId"] = session_id
    fb["updatedAt"] = iso_now()
    iv.feedback = fb
    iv.updatedAt = fb["updatedAt"]
    _append_history(iv, "link_session", f"关联评审会话 {session_id or '（取消）'}", user.id)
    db.commit()
    return interview_json(db, iv)
