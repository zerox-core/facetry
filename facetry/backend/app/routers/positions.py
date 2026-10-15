from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.deps import CurrentUser, require_user
from ..core.errors import fail
from ..models import MatchRow, PositionRow, PositionVersionRow, iso_now, new_id
from ..services import jobs as jobsvc
from ..services.serializers import position_json
from ..services.util import clip

router = APIRouter(prefix="/api/positions")


@router.get("")
async def list_positions(status: str = "", q: str = "", user: CurrentUser = Depends(require_user),
                         db: Session = Depends(get_db)):
    stmt = select(PositionRow)
    if status:
        stmt = stmt.where(PositionRow.status == status)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(PositionRow.title.like(like) | PositionRow.department.like(like))
    rows = db.scalars(stmt.order_by(PositionRow.updatedAt.desc())).all()
    return {"positions": [position_json(db, p, with_stats=True) for p in rows]}


@router.post("", status_code=201)
async def create_position(request: Request, user: CurrentUser = Depends(require_user), db: Session = Depends(get_db)):
    try:
        b = await request.json()
    except Exception:
        raise fail("请求格式不正确")
    title = clip(b.get("title"), 255).strip()
    jd = b.get("jd") or {}
    content = clip(jd.get("content"), 20000).strip()
    if not title:
        raise fail("岗位名称不能为空")
    if not content:
        raise fail("岗位必须关联 JD，JD 内容不能为空")
    now = iso_now()
    p = PositionRow(id=new_id(), title=title, city=clip(b.get("city"), 128),
                    department=clip(b.get("department"), 128), status="open",
                    jdContent=content, jdRequirements=clip(jd.get("requirements"), 4000),
                    jdNote=clip(jd.get("note"), 4000), jdVersion=1, jdUpdatedAt=now,
                    createdAt=now, updatedAt=now)
    db.add(p)
    db.add(PositionVersionRow(id=new_id(), positionId=p.id, version=1, content=p.jdContent,
                              requirements=p.jdRequirements, note=p.jdNote, updatedAt=now, updatedBy=user.id))
    db.commit()
    return position_json(db, p, with_versions=True, with_stats=True)


@router.get("/{pid}")
async def get_position(pid: str, user: CurrentUser = Depends(require_user), db: Session = Depends(get_db)):
    p = db.get(PositionRow, pid)
    if not p:
        raise fail("岗位不存在", 404)
    return position_json(db, p, with_versions=True)


@router.patch("/{pid}")
async def patch_position(pid: str, request: Request, user: CurrentUser = Depends(require_user), db: Session = Depends(get_db)):
    p = db.get(PositionRow, pid)
    if not p:
        raise fail("岗位不存在", 404)
    try:
        b = await request.json()
    except Exception:
        raise fail("请求格式不正确")
    now = iso_now()
    if isinstance(b.get("title"), str):
        t = clip(b["title"], 255).strip()
        if not t:
            raise fail("岗位名称不能为空")
        p.title = t
    if isinstance(b.get("city"), str):
        p.city = clip(b["city"], 128)
    if isinstance(b.get("department"), str):
        p.department = clip(b["department"], 128)
    if b.get("status") in ("open", "paused", "closed"):
        p.status = b["status"]
    if isinstance(b.get("jd"), dict):
        jd = b["jd"]
        content = clip(jd.get("content"), 20000).strip()
        if not content:
            raise fail("JD 内容不能为空")
        # 提交 jd 即产生新版本；已完成的初筛保留旧版本快照
        p.jdVersion += 1
        p.jdContent = content
        p.jdRequirements = clip(jd.get("requirements"), 4000)
        p.jdNote = clip(jd.get("note"), 4000)
        p.jdUpdatedAt = now
        db.add(PositionVersionRow(id=new_id(), positionId=p.id, version=p.jdVersion, content=p.jdContent,
                                  requirements=p.jdRequirements, note=p.jdNote, updatedAt=now, updatedBy=user.id))
    p.updatedAt = now
    db.commit()
    return position_json(db, p, with_versions=True)


@router.delete("/{pid}", status_code=204)
async def delete_position(pid: str, user: CurrentUser = Depends(require_user), db: Session = Depends(get_db)):
    p = db.get(PositionRow, pid)
    if not p:
        raise fail("岗位不存在", 404)
    linked = db.scalars(select(MatchRow).where(MatchRow.positionId == pid)).first()
    if linked:
        raise fail("该岗位已关联候选人，不能删除，建议改为已关闭", 409)
    for v in db.scalars(select(PositionVersionRow).where(PositionVersionRow.positionId == pid)).all():
        db.delete(v)
    db.delete(p)
    db.commit()
    return Response(status_code=204)


@router.post("/{pid}/rescreen", status_code=202)
async def rescreen(pid: str, user: CurrentUser = Depends(require_user), db: Session = Depends(get_db)):
    p = db.get(PositionRow, pid)
    if not p:
        raise fail("岗位不存在", 404)
    existing = jobsvc.find_running(ref_id=pid, job_type="rescreen")
    if existing:
        return jobsvc.public_job(existing)
    return jobsvc.public_job(jobsvc.create_job("rescreen", ref_id=pid))
