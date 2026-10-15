import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.config import get_settings
from ..models import GrantRow, MetaRow, OrgRow, UserRow


def load_users(db: Session) -> dict:
    return {r.id: r.data for r in db.scalars(select(UserRow)).all()}


def save_user(db: Session, user_id: str, data: dict) -> None:
    row = db.get(UserRow, user_id)
    if row:
        row.data = data
    else:
        db.add(UserRow(id=user_id, data=data))


def load_grants(db: Session) -> dict:
    return {r.userId: r.deptIds for r in db.scalars(select(GrantRow)).all()}


def save_grants(db: Session, user_id: str, dept_ids: list) -> None:
    row = db.get(GrantRow, user_id)
    if dept_ids:
        if row:
            row.deptIds = dept_ids
        else:
            db.add(GrantRow(userId=user_id, deptIds=dept_ids))
    elif row:
        db.delete(row)


def load_org(db: Session) -> dict:
    row = db.get(OrgRow, 1)
    return row.data if row else {"depts": {}, "fetchedAt": ""}


def save_org(db: Session, org: dict) -> None:
    row = db.get(OrgRow, 1)
    if row:
        row.data = org
    else:
        db.add(OrgRow(id=1, data=org))


def load_meta(db: Session) -> dict:
    row = db.get(MetaRow, "meta")
    if row:
        try:
            return json.loads(row.v)
        except Exception:
            pass
    return {"admins": []}


def save_meta(db: Session, meta: dict) -> None:
    v = json.dumps(meta, ensure_ascii=False)
    row = db.get(MetaRow, "meta")
    if row:
        row.v = v
    else:
        db.add(MetaRow(k="meta", v=v))


def is_admin(db: Session, user_id: str) -> bool:
    s = get_settings()
    return user_id in s.env_admins or user_id in load_meta(db).get("admins", [])


def is_super(db: Session, user_id: str) -> bool:
    s = get_settings()
    return user_id in s.env_super_admins or user_id in load_meta(db).get("superAdmins", [])


def user_role(db: Session, user_id: str) -> str:
    """业务角色：hr（默认）/ interviewer。历史数据角色曾存于 data blob，做兼容读取。"""
    row = db.get(UserRow, user_id)
    if not row:
        return "hr"
    return row.role or (row.data or {}).get("role") or "hr"


def set_user_role(db: Session, user_id: str, role: str) -> None:
    row = db.get(UserRow, user_id)
    if row:
        row.role = role


def is_interviewer_only(db: Session, user_id: str) -> bool:
    """纯面试官（非管理员/超管）：候选人库等 HR 域数据对其收敛为「分配给我的」"""
    return user_role(db, user_id) == "interviewer" and not is_admin(db, user_id) and not is_super(db, user_id)


def user_groups(db: Session, user_id: str) -> list:
    return load_users(db).get(user_id, {}).get("groups") or []


def primary_group(db: Session, user_id: str) -> dict | None:
    groups = user_groups(db, user_id)
    return groups[0] if groups else None


def compute_leader_of(union_id: str, groups: list, org: dict) -> list:
    out = set()
    for g in groups or []:
        for did in g.get("path") or []:
            if org.get("depts", {}).get(did, {}).get("leaderId") == union_id:
                out.add(did)
        if org.get("depts", {}).get(g.get("id"), {}).get("leaderId") == union_id:
            out.add(g.get("id"))
    return list(out)


def can_lead_view(db: Session, user: dict, owner_id: str) -> bool:
    """负责人视角：能查看其负责部门（含子部门）成员的简历"""
    scopes = load_users(db).get(user["id"], {}).get("leaderOf") or []
    if not scopes:
        return False
    pg = primary_group(db, owner_id)
    if not pg:
        return False
    return any(pg["id"] == did or did in (pg.get("path") or []) for did in scopes)


def in_grant_subtree(db: Session, grant_id: str, group_id: str) -> bool:
    if grant_id == group_id:
        return True
    path = load_org(db).get("depts", {}).get(group_id, {}).get("path")
    return isinstance(path, list) and grant_id in path


def can_view_scoped(db: Session, user: dict, item: dict) -> bool:
    """组内容可见性：全局 / 本人创建 / 同最小组成员 / 被授权的组织子树"""
    gid = item.get("groupId")
    if gid == "GLOBAL":
        return True
    if not gid:
        return item.get("userId") == user["id"]
    if item.get("userId") == user["id"]:
        return True
    if any(g["id"] == gid for g in user_groups(db, user["id"])):
        return True
    return any(in_grant_subtree(db, g, gid) for g in load_grants(db).get(user["id"], []))


def can_edit_scoped(db: Session, user: dict, item: dict, global_custom_open: bool = False) -> bool:
    """组内容可编辑：管理员 / 创建者 / 同组成员；授权只读；全局种子题仅管理员可改"""
    if is_admin(db, user["id"]):
        return True
    gid = item.get("groupId")
    if not gid:
        return item.get("userId") == user["id"]
    if gid == "GLOBAL":
        return bool(item.get("custom")) if global_custom_open else item.get("userId") == user["id"]
    return item.get("userId") == user["id"] or any(g["id"] == gid for g in user_groups(db, user["id"]))
