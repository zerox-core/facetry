import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select

from ..core.database import SessionLocal
from ..models import JobRow, new_id

logger = logging.getLogger("facetry.jobs")

# 内存注册表 + jobs 表持久化；重启后恢复 running 任务重新执行
_jobs: dict[str, dict] = {}
_executors: dict[str, "callable"] = {}


def register_executor(job_type: str, fn) -> None:
    _executors[job_type] = fn


def public_job(job: dict) -> dict:
    return {k: v for k, v in job.items() if k != "payload"}


def get_job(job_id: str) -> dict | None:
    return _jobs.get(job_id)


def running_jobs() -> list[dict]:
    return [j for j in _jobs.values() if j["state"] == "running"]


def find_running(session_id: str = "", ref_id: str = "", job_type: str = "") -> dict | None:
    for j in _jobs.values():
        if j["state"] != "running":
            continue
        if session_id and j.get("sessionId") != session_id:
            continue
        if ref_id and j.get("refId") != ref_id:
            continue
        if job_type and j.get("type") != job_type:
            continue
        return j
    return None


def persist_jobs() -> None:
    with SessionLocal() as db:
        db.execute(delete(JobRow))
        for j in _jobs.values():
            db.add(JobRow(id=j["id"], sessionId=j.get("sessionId", ""), state=j.get("state", ""), data=public_job(j) | {"payload": j.get("payload")}))
        db.commit()


def create_job(job_type: str, session_id: str = "", ref_id: str = "", payload: dict | None = None, auto_start: bool = True) -> dict:
    job = {
        "id": new_id(),
        "type": job_type,
        "state": "running",
        "startedAt": datetime.now(timezone.utc).isoformat(),
    }
    if session_id:
        job["sessionId"] = session_id
    if ref_id:
        job["refId"] = ref_id
    if payload:
        job["payload"] = payload
    _jobs[job["id"]] = job
    persist_jobs()
    if auto_start:
        asyncio.create_task(execute_job(job))
    return job


async def execute_job(job: dict) -> None:
    fn = _executors.get(job["type"])
    try:
        if fn is None:
            raise RuntimeError(f"未知任务类型 {job['type']}")
        await fn(job)
        job["state"] = "done"
    except Exception as e:
        job["state"] = "error"
        job["error"] = getattr(e, "message", None) or str(e)
    job.pop("payload", None)
    persist_jobs()

    async def _gc():
        await asyncio.sleep(30 * 60)
        _jobs.pop(job["id"], None)
        persist_jobs()

    asyncio.create_task(_gc())


def restore_jobs() -> None:
    """启动时恢复：30 分钟内的 running 任务重新执行"""
    with SessionLocal() as db:
        rows = db.scalars(select(JobRow)).all()
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=30)
        for r in rows:
            j = r.data or {}
            if not j.get("id"):
                continue
            started = j.get("startedAt", "")
            try:
                stale = datetime.fromisoformat(started) < cutoff
            except Exception:
                stale = True
            if stale:
                continue
            _jobs[j["id"]] = j
            if j.get("state") == "running":
                logger.info("恢复未完成的任务: %s %s", j.get("type"), j.get("sessionId") or j.get("refId"))
                asyncio.create_task(execute_job(j))
