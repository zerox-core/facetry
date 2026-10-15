"""题库存储：等价迁移旧 server.js 的 loadBank/saveBank/ensureSeeds/resolvePart"""
import hashlib
import json
import secrets
from pathlib import Path

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..models import BankMetaRow, BankPartRow, BankQuestionRow, iso_now
from . import perm
from .util import clip

PART_ORDER = ["A", "B", "E", "F", "C", "D"]

_SEED = json.loads((Path(__file__).parent / "bank_seed.json").read_text(encoding="utf-8"))
SEED_PARTS: dict = _SEED["parts"]
SEED_QUESTIONS: list = _SEED["questions"]


def save_bank(db: Session, bank: dict) -> None:
    db.execute(delete(BankQuestionRow))
    db.execute(delete(BankPartRow))
    for q in bank["questions"]:
        db.add(BankQuestionRow(id=q["id"], part=q.get("part", ""), groupId=q.get("groupId", ""),
                               custom=1 if q.get("custom") else 0, userId=q.get("userId", ""), data=q))
    for k, p in bank["parts"].items():
        db.add(BankPartRow(key=k, name=p["name"], weight=p.get("weight", 0),
                           custom=1 if p.get("custom") else 0, groupId=p.get("groupId", "")))
    meta = db.get(BankMetaRow, 1)
    if meta:
        meta.seededGroups = bank.get("seededGroups", [])
    else:
        db.add(BankMetaRow(id=1, seededGroups=bank.get("seededGroups", [])))
    db.commit()


def load_bank(db: Session) -> dict:
    parts = {}
    for r in db.scalars(select(BankPartRow)).all():
        parts[r.key] = {"name": r.name, "weight": r.weight,
                        **({"custom": True} if r.custom else {}), **({"groupId": r.groupId} if r.groupId else {})}
    # 初始为空：内置种子分类；各组首次访问时由 ensure_seeds 生成自己的基础题副本
    if not parts:
        parts = json.loads(json.dumps(SEED_PARTS))
    questions = [r.data for r in db.scalars(select(BankQuestionRow)).all()]
    meta = db.get(BankMetaRow, 1)
    return {"parts": parts, "questions": questions, "seededGroups": meta.seededGroups if meta else []}


def ensure_seeds(db: Session, bank: dict, user) -> bool:
    """每个最小用户组首次访问时生成组内共享的种子基础题副本；未识别组织的用户不发副本"""
    if not isinstance(bank.get("seededGroups"), list):
        bank["seededGroups"] = []
    group = perm.primary_group(db, user.id)
    if not group:
        return False
    scope_id = group["id"]
    if scope_id in bank["seededGroups"]:
        return False
    suffix = "-" + hashlib.sha1(scope_id.encode()).hexdigest()[:6]
    for sq in SEED_QUESTIONS:
        bank["questions"].append({**sq, "id": sq["id"] + suffix, "custom": False, "seed": True,
                                  "groupId": scope_id, "groupName": group["name"], "updatedAt": iso_now()})
    bank["seededGroups"].append(scope_id)
    return True


def resolve_part(bank: dict, input_: str, scope_id: str = "") -> dict:
    """解析分类：已有 key / 已有名称 → 复用；否则按名称新建自定义分类（按组隔离）"""
    if input_ in ("CUST", "自定义", ""):
        return {"part": "CUST", "partName": "自定义"}

    def visible(k):
        return k in bank["parts"] and (not bank["parts"][k].get("groupId") or bank["parts"][k].get("groupId") == scope_id)

    if visible(input_):
        return {"part": input_, "partName": bank["parts"][input_]["name"]}
    name = clip(str(input_), 20).strip()
    if not name:
        return {"part": "CUST", "partName": "自定义"}
    for k, p in bank["parts"].items():
        if visible(k) and p["name"] == name:
            return {"part": k, "partName": p["name"]}
    key = "X" + secrets.token_hex(3)
    bank["parts"][key] = {"name": name, "weight": 0, "custom": True, **({"groupId": scope_id} if scope_id else {})}
    return {"part": key, "partName": name}
