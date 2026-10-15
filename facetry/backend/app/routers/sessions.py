import re

from fastapi import APIRouter, Depends, Query, Request, Response
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.deps import CurrentUser, require_user
from ..core.errors import fail
from ..models import SessionRow, iso_now, new_id
from ..services import jobs as jobsvc
from ..services import perm, storage
from ..services.jds_store import load_jds
from ..services.sessions import get_session, list_sessions, save_session
from ..services.util import clip

router = APIRouter(prefix="/api")

MIME = {".pdf": "application/pdf", ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".txt": "text/plain; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg"}


def _session_access(db: Session, user: CurrentUser, s: dict) -> tuple[bool, bool, bool, bool]:
    owner = s.get("userId") == user.id
    shared = not owner and user.id in (s.get("shares") or [])
    super_view = not owner and not shared and perm.is_super(db, user.id)
    leader_view = not owner and not shared and not super_view and perm.can_lead_view(db, {"id": user.id}, s.get("userId", ""))
    return owner, shared, super_view, leader_view


@router.get("/sessions")
async def list_all(user: CurrentUser = Depends(require_user), db: Session = Depends(get_db)):
    users = perm.load_users(db)
    super_view = perm.is_super(db, user.id)
    running = {j["sessionId"]: j["type"] for j in jobsvc.running_jobs() if j.get("sessionId")}
    out = []
    for x in list_sessions(db):
        if not (x.get("userId") == user.id or super_view or perm.can_lead_view(db, {"id": user.id}, x.get("userId", ""))
                or user.id in (x.get("shares") or [])):
            continue
        questions = [q for sec in (x.get("sections") or []) for q in sec["questions"] if not q.get("excluded")]
        scored = [q for q in questions if q.get("score") is not None]
        shares = x.get("shares") or []
        really_shared = x.get("userId") != user.id and user.id in shares
        not_own = x.get("userId") != user.id and not really_shared
        evaluation = x.get("evaluation")
        item = {k: v for k, v in x.items() if k not in ("sections", "lines", "text", "evaluation", "shares")}
        item.update({
            "sharedBy": "" if x.get("userId") == user.id else (users.get(x.get("userId"), {}).get("name") or "同事"),
            "viaSuper": not_own and super_view,
            "viaLeader": not_own and not super_view and perm.can_lead_view(db, {"id": user.id}, x.get("userId", "")),
            "jobState": running.get(x["id"]) or None,
            "questionCount": len(questions),
            "scoredCount": len(scored),
            "avgScore": round(sum(q["score"] for q in scored) / len(scored) * 10) / 10 if scored else None,
            "hasEvaluation": bool(evaluation),
            "suggestion": clip(evaluation.get("suggestion", ""), 200) if evaluation else "",
        })
        out.append(item)
    out.sort(key=lambda s: s.get("updatedAt", ""), reverse=True)
    return out


@router.post("/upload", status_code=201)
async def upload(request: Request, name: str = Query(""), jd: str = Query(""),
                 user: CurrentUser = Depends(require_user), db: Session = Depends(get_db)):
    name = clip(name, 200)
    ext = ("." + name.rsplit(".", 1)[-1].lower()) if "." in name else ""
    if ext not in (".pdf", ".docx", ".txt", ".png", ".jpg", ".jpeg"):
        raise fail("支持 PDF、DOCX、TXT、PNG 和 JPG 格式")
    file = await request.body()
    if len(file) > 20 * 1024 * 1024:
        raise fail("文件过大，请使用 20 MB 以内的简历", 413)
    if not file:
        raise fail("文件为空")
    if ext == ".pdf" and file[:5] != b"%PDF-":
        raise fail("不是有效的 PDF 文件")
    if ext == ".png" and file[:8].hex() != "89504e470d0a1a0a":
        raise fail("不是有效的 PNG 文件")
    if ext in (".jpg", ".jpeg") and file[:3].hex() != "ffd8ff":
        raise fail("不是有效的 JPG 文件")
    text = ""
    if ext == ".txt":
        text = file.decode("utf-8", errors="replace")[:60000]
    if ext == ".docx":
        try:
            import io
            import mammoth
            text = mammoth.extract_raw_text(io.BytesIO(file)).value[:60000]
        except Exception:
            raise fail("Word 文件无法解析，请导出为 PDF 后上传")
    jd_id, role = "", ""
    if jd:
        found = next((j for j in load_jds(db)["jds"] if j["id"] == jd), None)
        if not found or not perm.can_view_scoped(db, {"id": user.id}, found):
            raise fail("岗位 JD 不存在", 404)
        jd_id, role = found["id"], found["title"]
    sid = new_id()
    stored_ext = ".jpg" if ext == ".jpeg" else ext
    storage.save_file(sid + stored_ext, file)
    s = {"id": sid, "userId": user.id, "fileName": name, "file": sid + stored_ext,
         "name": re.sub(r"\.[^.]+$", "", name), "role": role, "summary": "", "text": text,
         "sections": [], "lines": [], "pageCount": 1, "phase": "prepare", "note": "",
         "evaluation": None, **({"jdId": jd_id} if jd_id else {}), "createdAt": iso_now()}
    return save_session(db, s)


@router.get("/sessions/{sid}")
async def get_one(sid: str, user: CurrentUser = Depends(require_user), db: Session = Depends(get_db)):
    s = get_session(db, sid)
    owner, shared, super_view, leader_view = _session_access(db, user, s)
    if not (owner or shared or super_view or leader_view):
        raise fail("简历不存在", 404)
    return s


@router.delete("/sessions/{sid}", status_code=204)
async def delete_one(sid: str, user: CurrentUser = Depends(require_user), db: Session = Depends(get_db)):
    s = get_session(db, sid)
    if s.get("userId") != user.id:
        raise fail("只有所有者可删除", 403)
    row = db.get(SessionRow, s["id"])
    if row:
        db.delete(row)
        db.commit()
    if s.get("file"):
        storage.delete_file(s["file"].rsplit("/", 1)[-1])
    return Response(status_code=204)


@router.patch("/sessions/{sid}")
async def patch_one(sid: str, request: Request, user: CurrentUser = Depends(require_user), db: Session = Depends(get_db)):
    s = get_session(db, sid)
    owner, shared, super_view, leader_view = _session_access(db, user, s)
    if not (owner or shared or super_view or leader_view):
        raise fail("简历不存在", 404)
    if super_view or leader_view:
        raise fail("仅可查看，不能修改他人的面试记录", 403)
    try:
        b = await request.json()
    except Exception:
        raise fail("请求格式不正确")

    if isinstance(b.get("role"), str) or "jdId" in b:
        if not owner:
            raise fail("只有所有者可修改岗位信息", 403)
        if "jdId" in b:
            if not b["jdId"]:
                s.pop("jdId", None)
            else:
                jd = next((j for j in load_jds(db)["jds"] if j["id"] == b["jdId"]), None)
                if not jd or not perm.can_view_scoped(db, {"id": user.id}, jd):
                    raise fail("岗位 JD 不存在", 404)
                s["jdId"] = jd["id"]
                s["role"] = jd["title"]
        elif isinstance(b.get("role"), str):
            s["role"] = clip(b["role"], 100)

    if "shares" in b:
        if not owner:
            raise fail("只有所有者可调整分享", 403)
        if not isinstance(b["shares"], list):
            raise fail("分享格式不正确")
        s["shares"] = list(dict.fromkeys(x for x in b["shares"] if isinstance(x, str) and x != user.id))[:50]

    if isinstance(b.get("note"), str):
        s["note"] = b["note"][:20000]
    if b.get("phase") in ("prepare", "interview", "review"):
        s["phase"] = b["phase"]

    if b.get("question"):
        patch = b["question"]
        q = next((q for sec in s.get("sections", []) for q in sec["questions"] if q["id"] == patch.get("id")), None)
        if not q:
            raise fail("题目不存在", 404)
        if "score" in patch:
            v = patch["score"]
            if v is not None and (not isinstance(v, int) or isinstance(v, bool) or v < 1 or v > 5):
                raise fail("评分应在 1–5 分之间")
            q["score"] = v
        if isinstance(patch.get("note"), str):
            q["note"] = patch["note"][:10000]
        if isinstance(patch.get("excluded"), bool):
            q["excluded"] = patch["excluded"]
        if isinstance(patch.get("q"), str):
            q["q"] = clip(patch["q"])
        if isinstance(patch.get("point"), str):
            q["point"] = clip(patch["point"], 200)
        if isinstance(patch.get("followUp"), str):
            q["followUp"] = clip(patch["followUp"], 500)
        if isinstance(patch.get("type"), str):
            q["type"] = clip(patch["type"], 50)
        if isinstance(patch.get("expected"), list):
            q["expected"] = [clip(x, 300) for x in patch["expected"] if isinstance(x, str)][:6]

    if b.get("anchor"):
        a = b["anchor"]
        section = next((x for x in s.get("sections", []) if x["id"] == a.get("id")), None)
        page, y = a.get("page"), a.get("y")
        if not section or not isinstance(page, int) or page < 1 or page > s.get("pageCount", 1) \
                or not isinstance(y, (int, float)) or y < 0 or y > 1:
            raise fail("定位无效")
        section["anchor"] = {**(section.get("anchor") or {}), "page": page, "y": y, "matched": True, "manual": True}

    if b.get("addQuestion"):
        nq = b["addQuestion"].get("question") or {}
        if not isinstance(nq.get("q"), str) or not nq["q"].strip():
            raise fail("问题内容不能为空")
        question = {"id": new_id(), "type": clip(nq.get("type"), 50) or "补充提问", "q": clip(nq.get("q")),
                    "point": clip(nq.get("point"), 200), "followUp": clip(nq.get("followUp"), 500),
                    "expected": [clip(x, 300) for x in (nq.get("expected") or []) if isinstance(x, str)][:6],
                    "excluded": False, "score": None, "note": ""}
        section = next((x for x in s.get("sections", []) if x["id"] == b["addQuestion"].get("sectionId")), None)
        if not section:
            section = {"id": new_id(), "title": clip(b["addQuestion"].get("sectionTitle"), 100) or "补充问题",
                       "kind": "custom", "anchor": None, "questions": []}
            s.setdefault("sections", []).append(section)
        section["questions"].append(question)

    if b.get("removeQuestion"):
        rid = b["removeQuestion"].get("id")
        index = next((i for i, x in enumerate(s.get("sections", [])) if any(q["id"] == rid for q in x["questions"])), None)
        if index is None:
            raise fail("题目不存在", 404)
        s["sections"][index]["questions"] = [q for q in s["sections"][index]["questions"] if q["id"] != rid]
        if not s["sections"][index]["questions"]:
            s["sections"].pop(index)

    if b.get("question") or "note" in b or b.get("addQuestion") or b.get("removeQuestion"):
        s["evaluation"] = None
    return save_session(db, s)


@router.post("/sessions/{sid}/{action}", status_code=202)
async def analyze_or_evaluate(sid: str, action: str, request: Request,
                              user: CurrentUser = Depends(require_user), db: Session = Depends(get_db)):
    if action not in ("analyze", "evaluate"):
        raise fail("接口不存在", 404)
    s = get_session(db, sid)
    owner, shared, super_view, leader_view = _session_access(db, user, s)
    if not (owner or shared or super_view or leader_view):
        raise fail("简历不存在", 404)
    if not owner:
        raise fail("只有所有者可生成问题或评价", 403)
    try:
        b = await request.json()
    except Exception:
        raise fail("请求格式不正确")

    if action == "evaluate" and s.get("evaluation") and not b.get("force"):
        raise fail("已生成综合评价，如需覆盖请确认重新生成", 409)
    existing = jobsvc.find_running(session_id=s["id"])
    if existing:
        return jobsvc.public_job(existing)
    if action == "analyze" and s.get("sections") and not b.get("force"):
        raise fail("该简历已生成题目。如需重新识别，请在准备阶段使用「重新识别生成」", 409)

    lines = []
    for l in (b.get("lines") if isinstance(b.get("lines"), list) else [])[:2000]:
        try:
            lines.append({"id": clip(l.get("id"), 40), "text": clip(l.get("text"), 1500),
                          "page": max(1, min(20, int(l.get("page") or 1))),
                          "y": max(0.0, min(1.0, float(l.get("y") or 0))),
                          "x": max(0.0, min(1.0, float(l.get("x") or 0)))})
        except (TypeError, ValueError):
            continue
    eff_lines = lines or s.get("lines") or []
    try:
        pages = max(1, min(20, int(b.get("pageCount") or s.get("pageCount") or 1)))
    except (TypeError, ValueError):
        pages = 1
    images = [x for x in (b.get("images") if isinstance(b.get("images"), list) else [])
              if isinstance(x, str) and re.match(r"^data:image/(jpeg|png);base64,", x)][:20]
    records = [q for sec in s.get("sections", []) for q in sec["questions"] if not q.get("excluded")]
    if action == "analyze" and not eff_lines and not images:
        raise fail("简历内容尚未加载，请稍后重试")
    if action == "evaluate" and not any(q.get("score") is not None or (q.get("note") or "").strip() for q in records) \
            and not (s.get("note") or "").strip():
        raise fail("请先记录评分或面试观察，再生成综合评价")
    payload = {"role": clip(b.get("role"), 100), "lines": eff_lines, "pageCount": pages,
               "images": images, "force": b.get("force") is True}
    job = jobsvc.create_job(action, session_id=s["id"], payload=payload)
    return jobsvc.public_job(job)
