import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from fastapi import Depends, Request, Response
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from .database import get_db
from .errors import fail
from ..models import AuthRow
from ..services import perm

SESSION_COOKIE = "zm_sess"
SESSION_DAYS = 30


@dataclass
class CurrentUser:
    id: str
    name: str
    avatar: str
    token: str


def _cutoff() -> str:
    return (datetime.now(timezone.utc) - timedelta(days=SESSION_DAYS)).isoformat()


def cookie_token(request: Request) -> str | None:
    return request.cookies.get(SESSION_COOKIE)


def current_user(request: Request, db: Session) -> CurrentUser | None:
    token = cookie_token(request)
    if not token:
        return None
    row = db.scalars(select(AuthRow).where(AuthRow.token == token, AuthRow.createdAt > _cutoff())).first()
    if not row:
        return None
    data = row.data or {}
    return CurrentUser(id=data.get("userId", ""), name=data.get("name", ""), avatar=data.get("avatar", ""), token=token)


def require_user(request: Request, db: Session = Depends(get_db)) -> CurrentUser:
    u = current_user(request, db)
    if not u:
        raise fail("请先登录", 401)
    return u


def require_admin(request: Request, db: Session = Depends(get_db)) -> CurrentUser:
    u = require_user(request, db)
    if not perm.is_admin(db, u.id):
        raise fail("需要管理员权限", 403)
    return u


def require_super(request: Request, db: Session = Depends(get_db)) -> CurrentUser:
    u = require_user(request, db)
    if not perm.is_super(db, u.id):
        raise fail("需要超级管理员权限", 403)
    return u


def issue_session(response: Response, db: Session, user_id: str, name: str, avatar: str) -> CurrentUser:
    token = secrets.token_hex(24)
    now = datetime.now(timezone.utc).isoformat()
    db.add(AuthRow(token=token, userId=user_id, createdAt=now, data={"userId": user_id, "name": name, "avatar": avatar, "createdAt": now}))
    db.execute(delete(AuthRow).where(AuthRow.createdAt <= _cutoff()))
    db.commit()
    response.set_cookie(SESSION_COOKIE, token, httponly=True, samesite="lax", max_age=SESSION_DAYS * 24 * 3600, path="/")
    return CurrentUser(id=user_id, name=name, avatar=avatar, token=token)
