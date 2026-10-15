from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..models import JdRow


def load_jds(db: Session) -> dict:
    return {"jds": [r.data for r in db.scalars(select(JdRow)).all()]}


def save_jds(db: Session, store: dict) -> None:
    db.execute(delete(JdRow))
    for j in store["jds"]:
        db.add(JdRow(id=j["id"], groupId=j.get("groupId", ""), userId=j.get("userId", ""), data=j))
    db.commit()
