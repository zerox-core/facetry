import secrets
import time

from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from ..core.config import get_settings
from ..core.database import get_db
from ..core.deps import CurrentUser, cookie_token, issue_session, require_user
from ..core.errors import fail
from ..models import AuthRow, iso_now
from ..services import feishu, perm
from ..services.util import clip

router = APIRouter(prefix="/api")

# OAuth state 缓存（state → 过期时间戳），等价旧 oauthStates
_oauth_states: dict[str, float] = {}


@router.get("/status")
async def status():
    s = get_settings()
    return {"configured": s.llm_configured, "feishu": s.feishu_configured, "demo": s.enable_demo_login}


@router.get("/auth/feishu")
async def auth_feishu(request: Request):
    s = get_settings()
    if not s.feishu_configured:
        raise fail("未配置飞书应用")
    now = time.time()
    for st, exp in list(_oauth_states.items()):
        if exp < now:
            _oauth_states.pop(st, None)
    state = secrets.token_hex(8)
    _oauth_states[state] = now + 10 * 60
    base_path = (s.base_path or "").rstrip("/")
    host = request.headers.get("host", "127.0.0.1:8080")
    redirect_uri = s.feishu_redirect_uri or f"http://{host}{base_path}/api/auth/feishu/callback"
    location = ("https://open.feishu.cn/open-apis/authen/v1/authorize?app_id=" + s.feishu_app_id
                + "&redirect_uri=" + redirect_uri + "&state=" + state)
    return RedirectResponse(location, status_code=302)


@router.get("/auth/feishu/callback")
async def auth_feishu_callback(request: Request, state: str = "", code: str = "", db: Session = Depends(get_db)):
    expires = _oauth_states.pop(state, None)
    if not expires or expires < time.time():
        raise fail("登录状态已失效，请重新发起登录")
    try:
        user = await feishu.oauth_exchange(code)
    except Exception as e:
        msg = getattr(e, "message", "飞书登录失败")
        return RedirectResponse(f"/?login_error={msg}", status_code=302)
    if not user.get("userId"):
        return RedirectResponse("/?login_error=飞书登录失败，请重试", status_code=302)

    # 组织架构：解析部门并缓存
    org = perm.load_org(db)
    groups, leader_of = [], []
    try:
        groups, leader_of = await feishu.resolve_user_groups(user["appToken"], user.get("unionId", ""), user.get("deptIds") or [], org)
        if groups:
            org["fetchedAt"] = iso_now()
            perm.save_org(db, org)
    except Exception as e:
        import logging
        logging.getLogger("facetry.auth").warning("组织架构获取失败（需 contact 相关权限）: %s", e)

    # 用户目录 + 首个飞书用户自动成为管理员
    record = {"name": clip(user["name"], 50) or "飞书用户",
              "avatar": user["avatar"] if isinstance(user["avatar"], str) else "",
              "groups": groups, "leaderOf": leader_of, "updatedAt": iso_now()}
    perm.save_user(db, user["userId"], record)
    if not user["userId"].startswith("demo:"):
        meta = perm.load_meta(db)
        if not meta.get("admins") and not get_settings().env_admins:
            meta.setdefault("admins", []).append(user["userId"])
            perm.save_meta(db, meta)
    db.commit()

    resp = RedirectResponse("/", status_code=302)
    issue_session(resp, db, user["userId"], record["name"], record["avatar"])
    return resp


@router.post("/auth/demo")
async def auth_demo(request: Request, response: Response, db: Session = Depends(get_db)):
    # 演示登录仅用于本地开发与测试；生产部署不得设置 ENABLE_DEMO_LOGIN
    if not get_settings().enable_demo_login:
        raise fail("演示登录未启用", 403)
    try:
        body = await request.json()
    except Exception:
        raise fail("请求格式不正确")
    name = clip(body.get("name"), 50).strip()
    if not name:
        raise fail("请提供用户名")
    user = issue_session(response, db, "demo:" + name, name, "")
    if user.id not in perm.load_users(db):
        perm.save_user(db, user.id, {"name": user.name, "avatar": "", "groups": [], "updatedAt": iso_now()})
        db.commit()
    return {"user": {"id": user.id, "name": user.name, "avatar": user.avatar}}


@router.get("/auth/me")
async def auth_me(user: CurrentUser = Depends(require_user), db: Session = Depends(get_db)):
    return {
        "user": {"id": user.id, "name": user.name, "avatar": user.avatar,
                 "role": perm.user_role(db, user.id),
                 "isAdmin": perm.is_admin(db, user.id), "isSuper": perm.is_super(db, user.id)},
        "groups": perm.user_groups(db, user.id),
    }


@router.post("/auth/logout", status_code=204)
async def auth_logout(request: Request, response: Response, db: Session = Depends(get_db)):
    token = cookie_token(request)
    if token:
        row = db.get(AuthRow, token)
        if row:
            db.delete(row)
            db.commit()
    response.delete_cookie("zm_sess", path="/")
    return Response(status_code=204)


@router.get("/users")
async def list_users(user: CurrentUser = Depends(require_user), db: Session = Depends(get_db)):
    users = [{"id": uid, "name": u.get("name") or uid, "avatar": u.get("avatar") or "",
              "role": perm.user_role(db, uid),
              "groupName": (u.get("groups") or [{}])[0].get("name", "")}
             for uid, u in perm.load_users(db).items()]
    users.sort(key=lambda u: u["name"])
    return {"users": users}
