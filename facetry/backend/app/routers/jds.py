from fastapi import APIRouter, Depends, Query, Request, Response
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.deps import CurrentUser, require_user
from ..core.errors import fail
from ..models import iso_now, new_id
from ..services import perm
from ..services.jds_store import load_jds, save_jds
from ..services.util import clip

router = APIRouter(prefix="/api/jds")


@router.get("")
async def list_jds(group: str | None = Query(None), user: CurrentUser = Depends(require_user), db: Session = Depends(get_db)):
    if group is not None and perm.is_super(db, user.id):
        jds = [{**j, "readonly": True} for j in load_jds(db)["jds"] if (j.get("groupId") or "") == group]
    else:
        jds = [{**j, "readonly": not perm.can_edit_scoped(db, {"id": user.id}, j)}
               for j in load_jds(db)["jds"] if perm.can_view_scoped(db, {"id": user.id}, j)]
    jds.sort(key=lambda j: j.get("updatedAt", ""), reverse=True)
    return {"jds": jds}


@router.post("", status_code=201)
async def create_jd(request: Request, user: CurrentUser = Depends(require_user), db: Session = Depends(get_db)):
    try:
        b = await request.json()
    except Exception:
        raise fail("请求格式不正确")
    title, content = clip(b.get("title"), 100), clip(b.get("content"), 20000)
    if not title.strip() or not content.strip():
        raise fail("岗位名称和 JD 内容不能为空")
    grp = perm.primary_group(db, user.id)
    now = iso_now()
    jd = {"id": new_id(), "title": title.strip(), "company": clip(b.get("company"), 100),
          "content": content, "requirements": clip(b.get("requirements"), 4000),
          "tags": [clip(x, 30) for x in (b.get("tags") if isinstance(b.get("tags"), list) else []) if isinstance(x, str)][:8],
          "userId": user.id, "userName": user.name,
          "groupId": grp["id"] if grp else "", "groupName": grp["name"] if grp else "",
          "createdAt": now, "updatedAt": now}
    store = load_jds(db)
    store["jds"].append(jd)
    save_jds(db, store)
    return jd


@router.patch("/{jid}")
async def update_jd(jid: str, request: Request, user: CurrentUser = Depends(require_user), db: Session = Depends(get_db)):
    store = load_jds(db)
    jd = next((j for j in store["jds"] if j["id"] == jid), None)
    if not jd or not perm.can_view_scoped(db, {"id": user.id}, jd):
        raise fail("岗位不存在", 404)
    if not perm.can_edit_scoped(db, {"id": user.id}, jd):
        raise fail("没有权限修改该岗位", 403)
    try:
        b = await request.json()
    except Exception:
        raise fail("请求格式不正确")
    if isinstance(b.get("title"), str):
        t = clip(b["title"], 100)
        if not t.strip():
            raise fail("岗位名称不能为空")
        jd["title"] = t
    if isinstance(b.get("company"), str):
        jd["company"] = clip(b["company"], 100)
    if isinstance(b.get("content"), str):
        c = clip(b["content"], 20000)
        if not c.strip():
            raise fail("JD 内容不能为空")
        jd["content"] = c
    if isinstance(b.get("requirements"), str):
        jd["requirements"] = clip(b["requirements"], 4000)
    if isinstance(b.get("tags"), list):
        jd["tags"] = [clip(x, 30) for x in b["tags"] if isinstance(x, str)][:8]
    jd["updatedAt"] = iso_now()
    save_jds(db, store)
    return jd


@router.delete("/{jid}", status_code=204)
async def delete_jd(jid: str, user: CurrentUser = Depends(require_user), db: Session = Depends(get_db)):
    store = load_jds(db)
    index = next((i for i, j in enumerate(store["jds"]) if j["id"] == jid), None)
    if index is None or not perm.can_view_scoped(db, {"id": user.id}, store["jds"][index]):
        raise fail("岗位不存在", 404)
    if not perm.can_edit_scoped(db, {"id": user.id}, store["jds"][index]):
        raise fail("没有权限删除该岗位", 403)
    store["jds"].pop(index)
    save_jds(db, store)
    return Response(status_code=204)
