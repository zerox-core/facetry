import secrets

from fastapi import APIRouter, Depends, Query, Request, Response
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.deps import CurrentUser, require_user
from ..core.errors import fail
from ..core.prompts import BANKGEN
from ..models import iso_now
from ..services import llm, perm
from ..services.bank_store import PART_ORDER, ensure_seeds, load_bank, resolve_part, save_bank
from ..services.jds_store import load_jds
from ..services.util import clip

router = APIRouter(prefix="/api/bank")


def _visible_parts(bank: dict, scope_id: str, group_view: str | None) -> list:
    parts = [{"key": k, "name": bank["parts"][k]["name"], "weight": bank["parts"][k].get("weight", 0)}
             for k in PART_ORDER if k in bank["parts"]]
    for k, p in bank["parts"].items():
        if k in PART_ORDER:
            continue
        gid = p.get("groupId") or ""
        if group_view is not None:
            if gid != group_view:
                continue
        elif gid and gid != scope_id:
            continue  # 其他组的自定义分类不外露
        parts.append({"key": k, "name": p["name"], "weight": p.get("weight", 0)})
    if any(q.get("custom") for q in bank["questions"]):
        parts.append({"key": "CUST", "name": "自定义", "weight": 0})
    return parts


@router.get("")
async def get_bank(request: Request, group: str | None = Query(None),
                   user: CurrentUser = Depends(require_user), db: Session = Depends(get_db)):
    bank = load_bank(db)
    # 超管可通过管理台按组查看（只读），不影响普通视图
    if group is not None and perm.is_super(db, user.id):
        parts = _visible_parts(bank, "", group)
        questions = [{**q, "readonly": True} for q in bank["questions"] if (q.get("groupId") or "") == group]
        return {"parts": parts, "questions": questions}
    if ensure_seeds(db, bank, user):
        save_bank(db, bank)
    grp = perm.primary_group(db, user.id)
    scope_id = grp["id"] if grp else ""
    parts = _visible_parts(bank, scope_id, None)
    questions = [{**q, "readonly": not perm.can_edit_scoped(db, {"id": user.id}, q, global_custom_open=True)}
                 for q in bank["questions"] if perm.can_view_scoped(db, {"id": user.id}, q)]
    return {"parts": parts, "questions": questions}


@router.post("", status_code=201)
async def create_question(request: Request, user: CurrentUser = Depends(require_user), db: Session = Depends(get_db)):
    bank = load_bank(db)
    try:
        b = await request.json()
    except Exception:
        raise fail("请求格式不正确")
    title, q = clip(b.get("title"), 100), clip(b.get("q"))
    if not title.strip() or not q.strip():
        raise fail("标题和题干不能为空")
    grp = perm.primary_group(db, user.id)
    question = {"id": "U-" + secrets.token_hex(4), **resolve_part(bank, b.get("part") or "", grp["id"] if grp else ""),
                "title": title, "q": q, "answer": clip(b.get("answer"), 6000), "custom": True,
                "userId": user.id, "userName": user.name,
                "groupId": grp["id"] if grp else "", "groupName": grp["name"] if grp else "",
                "updatedAt": iso_now()}
    if isinstance(b.get("material"), str) and b["material"].strip():
        question["material"] = clip(b["material"], 6000)
    if isinstance(b.get("jdId"), str) and b["jdId"]:
        jd = next((j for j in load_jds(db)["jds"] if j["id"] == b["jdId"]), None)
        if not jd or not perm.can_view_scoped(db, {"id": user.id}, jd):
            raise fail("岗位 JD 不存在", 404)
        question["jdId"] = jd["id"]
        question["jdTitle"] = jd["title"]
    bank["questions"].append(question)
    save_bank(db, bank)
    return question


@router.post("/generate")
async def generate_questions(request: Request, user: CurrentUser = Depends(require_user), db: Session = Depends(get_db)):
    try:
        b = await request.json()
    except Exception:
        raise fail("请求格式不正确")
    try:
        count = max(1, min(10, int(b.get("count") or 5)))
    except (TypeError, ValueError):
        count = 5
    jd_text = clip(b.get("jdText"), 12000)
    source_jd = None
    if b.get("jdId"):
        source_jd = next((j for j in load_jds(db)["jds"] if j["id"] == b["jdId"]), None)
        if not source_jd or not perm.can_view_scoped(db, {"id": user.id}, source_jd):
            raise fail("岗位 JD 不存在", 404)
        jd_text = source_jd.get("content", "")
    if not jd_text.strip():
        raise fail("请提供岗位 JD 内容")
    requirements = clip(b.get("requirements"), 2000)
    bank_now = load_bank(db)
    gen_group = perm.primary_group(db, user.id)
    gen_scope = gen_group["id"] if gen_group else ""
    existing_names = [p["name"] for p in bank_now["parts"].values() if not p.get("groupId") or p.get("groupId") == gen_scope]
    result = await llm.llm_chat([
        {"role": "system", "content": BANKGEN},
        {"role": "user", "content": f"岗位 JD：\n{jd_text}\n\n出题要求：{requirements or '按 JD 要求出题'}\n题目数量：{count}\n现有分类：{'、'.join(existing_names)}、自定义"},
    ])
    questions = []
    for x in (result.get("questions") if isinstance(result.get("questions"), list) else []):
        if not x or not isinstance(x.get("q"), str) or not x["q"].strip():
            continue
        raw = clip(str(x.get("part") or ""), 20).strip()
        part, part_name = "", raw
        if raw in bank_now["parts"] and (not bank_now["parts"][raw].get("groupId") or bank_now["parts"][raw].get("groupId") == gen_scope):
            part, part_name = raw, bank_now["parts"][raw]["name"]
        else:
            for k, p in bank_now["parts"].items():
                if (not p.get("groupId") or p.get("groupId") == gen_scope) and p["name"] == raw:
                    part, part_name = k, p["name"]
                    break
        questions.append({
            "title": clip(x.get("title"), 100) or clip(x.get("q"), 30), "q": clip(x.get("q")),
            "answer": clip(x.get("answer"), 6000), "material": clip(x.get("material"), 6000),
            "part": part, "partName": part_name,
            **({"jdId": source_jd["id"], "jdTitle": source_jd["title"]} if source_jd else {}),
        })
        if len(questions) >= 10:
            break
    if not questions:
        raise fail("模型未生成有效题目，请重试", 422)
    return {"questions": questions}


@router.patch("/parts/{key}")
async def rename_part(key: str, request: Request, user: CurrentUser = Depends(require_user), db: Session = Depends(get_db)):
    bank = load_bank(db)
    try:
        b = await request.json()
    except Exception:
        raise fail("请求格式不正确")
    part = bank["parts"].get(key)
    if not part:
        raise fail("分类不存在", 404)
    grp = perm.primary_group(db, user.id)
    if part.get("groupId") and part["groupId"] != (grp["id"] if grp else "") and not perm.is_admin(db, user.id):
        raise fail("没有权限修改该分类", 403)
    name = clip(b.get("name"), 20).strip()
    if not name:
        raise fail("分类名称不能为空")
    part["name"] = name
    for q in bank["questions"]:
        if q.get("part") == key:
            q["partName"] = name
    save_bank(db, bank)
    return {"key": key, "name": name}


@router.patch("/{qid}")
async def update_question(qid: str, request: Request, user: CurrentUser = Depends(require_user), db: Session = Depends(get_db)):
    bank = load_bank(db)
    question = next((q for q in bank["questions"] if q["id"] == qid), None)
    if not question or not perm.can_view_scoped(db, {"id": user.id}, question):
        raise fail("题目不存在", 404)
    if not perm.can_edit_scoped(db, {"id": user.id}, question, global_custom_open=True):
        raise fail("没有权限修改该题目", 403)
    try:
        b = await request.json()
    except Exception:
        raise fail("请求格式不正确")
    if "title" in b:
        title = clip(b["title"], 100)
        if not title.strip():
            raise fail("标题和题干不能为空")
        question["title"] = title
    if "q" in b:
        q = clip(b["q"])
        if not q.strip():
            raise fail("标题和题干不能为空")
        question["q"] = q
    if "part" in b:
        question.update(resolve_part(bank, b["part"], "" if question.get("groupId") == "GLOBAL" else question.get("groupId", "")))
    if isinstance(b.get("answer"), str):
        question["answer"] = clip(b["answer"], 6000)
    if isinstance(b.get("material"), str):
        question["material"] = clip(b["material"], 6000)
    elif b.get("material") is None and "material" in b:
        question.pop("material", None)
    if "jdId" in b:
        if not b["jdId"]:
            question.pop("jdId", None)
            question.pop("jdTitle", None)
        else:
            jd = next((j for j in load_jds(db)["jds"] if j["id"] == b["jdId"]), None)
            if not jd or not perm.can_view_scoped(db, {"id": user.id}, jd):
                raise fail("岗位 JD 不存在", 404)
            question["jdId"] = jd["id"]
            question["jdTitle"] = jd["title"]
    question["updatedAt"] = iso_now()
    save_bank(db, bank)
    return question


@router.delete("/{qid}", status_code=204)
async def delete_question(qid: str, user: CurrentUser = Depends(require_user), db: Session = Depends(get_db)):
    bank = load_bank(db)
    index = next((i for i, q in enumerate(bank["questions"]) if q["id"] == qid), None)
    if index is None or not perm.can_view_scoped(db, {"id": user.id}, bank["questions"][index]):
        raise fail("题目不存在", 404)
    if not perm.can_edit_scoped(db, {"id": user.id}, bank["questions"][index], global_custom_open=False):
        raise fail("没有权限删除该题目", 403)
    bank["questions"].pop(index)
    save_bank(db, bank)
    return Response(status_code=204)
