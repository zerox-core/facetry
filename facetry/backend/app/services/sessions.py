import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.errors import fail
from ..models import SessionRow, iso_now


def get_session(db: Session, sid: str) -> dict:
    if not re.fullmatch(r"[\w-]+", sid or "") or sid.startswith("_"):
        raise fail("无效编号")
    row = db.get(SessionRow, sid)
    if not row:
        raise fail("简历不存在", 404)
    return row.data


def save_session(db: Session, s: dict) -> dict:
    s["updatedAt"] = iso_now()
    row = db.get(SessionRow, s["id"])
    values = dict(
        userId=s.get("userId", ""), name=s.get("name", ""), role=s.get("role", ""),
        phase=s.get("phase", "prepare"), createdAt=s.get("createdAt") or s["updatedAt"],
        updatedAt=s["updatedAt"], data=s,
    )
    if row:
        for k, v in values.items():
            setattr(row, k, v)
    else:
        db.add(SessionRow(id=s["id"], **values))
    db.commit()
    return s


def list_sessions(db: Session) -> list[dict]:
    return [r.data for r in db.scalars(select(SessionRow)).all()]
