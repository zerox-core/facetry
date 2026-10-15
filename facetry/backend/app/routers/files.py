import re

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.deps import CurrentUser, require_user
from ..core.errors import fail
from ..services import jobs as jobsvc
from ..services import perm, storage
from ..services.sessions import get_session

router = APIRouter()

MIME = {"pdf": "application/pdf", "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "txt": "text/plain; charset=utf-8", "png": "image/png", "jpg": "image/jpeg"}


@router.get("/api/jobs/{job_id}")
async def get_job(job_id: str, user: CurrentUser = Depends(require_user)):
    job = jobsvc.get_job(job_id)
    if not job:
        raise fail("任务已结束或服务已重启，请重试", 404)
    return jobsvc.public_job(job)


@router.get("/files/{name}")
async def serve_file(name: str, user: CurrentUser = Depends(require_user), db: Session = Depends(get_db)):
    if not re.fullmatch(r"[\w-]+\.(pdf|docx|txt|png|jpg)", name or ""):
        raise fail("文件不存在", 404)
    owner_session = get_session(db, name.rsplit(".", 1)[0])
    uid = owner_session.get("userId", "")
    if uid != user.id and user.id not in (owner_session.get("shares") or []) \
            and not perm.is_super(db, user.id) and not perm.can_lead_view(db, {"id": user.id}, uid):
        raise fail("文件不存在", 404)
    data = storage.read_file(name)
    if data is None:
        raise fail("文件不存在", 404)
    ext = name.rsplit(".", 1)[-1]
    return Response(content=data, media_type=MIME.get(ext, "application/octet-stream"),
                    headers={"X-Content-Type-Options": "nosniff", "Cache-Control": "no-cache"})
