from fastapi import APIRouter, Depends, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..core.config import get_settings
from ..core.database import get_db
from ..core.deps import CurrentUser, require_admin, require_super
from ..core.errors import fail
from ..models import CandidateRow, SyncRunRow, iso_now
from ..services import bpm, feishu, jobs as jobsvc, perm
from ..services.bank_store import load_bank
from ..services.jds_store import load_jds
from ..services.sessions import list_sessions

router = APIRouter(prefix="/api/admin")


@router.get("/overview")
async def overview(user: CurrentUser = Depends(require_admin), db: Session = Depends(get_db)):
    grants = perm.load_grants(db)
    org = perm.load_org(db)
    users = [{"id": uid, "name": u.get("name") or uid, "avatar": u.get("avatar") or "",
              "groupName": (u.get("groups") or [{}])[0].get("pathName", ""),
              "role": perm.user_role(db, uid),
              "isAdmin": perm.is_admin(db, uid), "isSuper": perm.is_super(db, uid),
              "grants": grants.get(uid, [])}
             for uid, u in perm.load_users(db).items()]
    users.sort(key=lambda u: u["name"])
    return {"users": users, "depts": org.get("depts", {}), "fetchedAt": org.get("fetchedAt", "")}


@router.get("/dashboard")
async def dashboard(user: CurrentUser = Depends(require_super), db: Session = Depends(get_db)):
    users = perm.load_users(db)
    sessions = list_sessions(db)
    by_user: dict = {}
    evaluated = scored_questions = total_questions = score_sum = 0
    for s in sessions:
        active = [q for sec in (s.get("sections") or []) for q in sec["questions"] if not q.get("excluded")]
        scored = [q for q in active if q.get("score") is not None]
        total_questions += len(active)
        scored_questions += len(scored)
        score_sum += sum(q["score"] for q in scored)
        if s.get("evaluation"):
            evaluated += 1
        u = by_user.setdefault(s.get("userId", ""), {"userId": s.get("userId", ""), "sessions": 0, "questions": 0, "scored": 0, "evaluated": 0,
                                                     "name": users.get(s.get("userId", ""), {}).get("name") or s.get("userId", "")})
        u["sessions"] += 1
        u["questions"] += len(active)
        u["scored"] += len(scored)
        if s.get("evaluation"):
            u["evaluated"] += 1
    bank = load_bank(db)
    bank_by_group: dict = {}
    for q in bank["questions"]:
        k = q.get("groupId") or ""
        g = bank_by_group.setdefault(k, {"groupId": k, "groupName": q.get("groupName") or "个人题目", "total": 0, "custom": 0})
        g["total"] += 1
        if q.get("custom"):
            g["custom"] += 1
    jds = load_jds(db)["jds"]
    jd_by_group: dict = {}
    for j in jds:
        k = j.get("groupId") or ""
        g = jd_by_group.setdefault(k, {"groupId": k, "groupName": j.get("groupName") or "个人岗位", "count": 0})
        g["count"] += 1
    recent = sorted(sessions, key=lambda s: s.get("updatedAt", ""), reverse=True)[:10]
    recent = [{
        "id": s["id"], "name": s.get("name", ""), "role": s.get("role", ""),
        "ownerName": users.get(s.get("userId", ""), {}).get("name") or s.get("userId", ""),
        "phase": s.get("phase", "prepare"), "updatedAt": s.get("updatedAt", ""),
        "questionCount": len(active := [q for sec in (s.get("sections") or []) for q in sec["questions"] if not q.get("excluded")]),
        "scoredCount": len(scored := [q for q in active if q.get("score") is not None]),
        "avgScore": round(sum(q["score"] for q in scored) / len(scored) * 10) / 10 if scored else None,
        "hasEvaluation": bool(s.get("evaluation")),
    } for s in recent]
    return {
        "userCount": len(users),
        "sessions": {"total": len(sessions), "evaluated": evaluated,
                     "byPhase": {p: len([s for s in sessions if s.get("phase") == p]) for p in ("prepare", "interview", "review")}},
        "questions": {"total": total_questions, "scored": scored_questions,
                      "avgScore": round(score_sum / scored_questions * 10) / 10 if scored_questions else None},
        "byUser": sorted(by_user.values(), key=lambda u: -u["sessions"]),
        "bank": {"total": len(bank["questions"]), "byGroup": sorted(bank_by_group.values(), key=lambda g: -g["total"])},
        "jds": {"total": len(jds), "byGroup": sorted(jd_by_group.values(), key=lambda g: -g["count"])},
        "recent": recent,
    }


@router.put("/roles")
async def put_role(request: Request, admin: CurrentUser = Depends(require_admin), db: Session = Depends(get_db)):
    """设置业务角色：hr / interviewer（与管理员、超管标记正交）"""
    b = await request.json()
    if not isinstance(b.get("userId"), str) or not b["userId"]:
        raise fail("请指定用户")
    role = str(b.get("role") or "")
    if role not in ("hr", "interviewer"):
        raise fail("角色取值无效（hr / interviewer）")
    if b["userId"] not in perm.load_users(db):
        raise fail("用户不存在", 404)
    perm.set_user_role(db, b["userId"], role)
    db.commit()
    return {"userId": b["userId"], "role": role}


@router.put("/grants")
async def put_grants(request: Request, user: CurrentUser = Depends(require_admin), db: Session = Depends(get_db)):
    b = await request.json()
    if not isinstance(b.get("userId"), str) or not b["userId"]:
        raise fail("请指定用户")
    if not isinstance(b.get("deptIds"), list):
        raise fail("授权格式不正确")
    dept_ids = list(dict.fromkeys(x for x in b["deptIds"] if isinstance(x, str)))[:100]
    perm.save_grants(db, b["userId"], dept_ids)
    db.commit()
    return {"userId": b["userId"], "deptIds": dept_ids}


@router.put("/admins")
async def put_admins(request: Request, admin: CurrentUser = Depends(require_admin), db: Session = Depends(get_db)):
    b = await request.json()
    if not isinstance(b.get("userId"), str) or not b["userId"]:
        raise fail("请指定用户")
    if b["userId"] == admin.id and not b.get("admin"):
        raise fail("不能撤销自己的管理员权限")
    meta = perm.load_meta(db)
    admins = set(meta.get("admins", []))
    if b.get("admin"):
        admins.add(b["userId"])
    else:
        admins.discard(b["userId"])
    if not admins and not get_settings().env_admins:
        raise fail("至少保留一名管理员")
    meta["admins"] = list(admins)
    perm.save_meta(db, meta)
    db.commit()
    return {"userId": b["userId"], "admin": bool(b.get("admin"))}


@router.put("/super-admins")
async def put_super_admins(request: Request, admin: CurrentUser = Depends(require_super), db: Session = Depends(get_db)):
    b = await request.json()
    if not isinstance(b.get("userId"), str) or not b["userId"]:
        raise fail("请指定用户")
    if b["userId"] == admin.id and not b.get("super"):
        raise fail("不能撤销自己的超管权限")
    meta = perm.load_meta(db)
    supers = set(meta.get("superAdmins") or [])
    if b.get("super"):
        supers.add(b["userId"])
    else:
        supers.discard(b["userId"])
    # 环境变量中的超管无法通过界面撤销，只约束数据库内的名单
    if not supers and not get_settings().env_super_admins:
        raise fail("至少保留一名超管")
    meta["superAdmins"] = list(supers)
    perm.save_meta(db, meta)
    db.commit()
    return {"userId": b["userId"], "super": bool(b.get("super"))}


@router.post("/org/refresh")
async def org_refresh(user: CurrentUser = Depends(require_admin), db: Session = Depends(get_db)):
    if not get_settings().feishu_configured:
        raise fail("未配置飞书应用")
    org = await feishu.refresh_org()
    perm.save_org(db, org)
    # 顺带补齐没有组织信息的用户（未识别组织），上限 50 人
    synced = 0
    users = perm.load_users(db)
    dirty = False
    at = await feishu.app_access_token()
    for uid, u in users.items():
        if not uid.startswith("fs:") or u.get("groups"):
            continue
        if synced >= 50:
            break
        try:
            groups, _ = await feishu.resolve_user_groups(at, uid[3:], [], org)
            if not groups:
                # resolve_user_groups 需要 deptIds；从飞书拉取
                import httpx
                async with httpx.AsyncClient(timeout=15) as client:
                    ud = (await client.get(
                        f"{feishu.BASE}/contact/v3/users/{uid[3:]}?user_id_type=union_id&department_id_type=open_department_id",
                        headers={"Authorization": f"Bearer {at}"})).json()
                dept_ids = (ud.get("data") or {}).get("user", {}).get("department_ids") or []
                groups, _ = await feishu.resolve_user_groups(at, uid[3:], dept_ids, org)
            if groups:
                u["groups"] = groups
                u["updatedAt"] = iso_now()
                dirty = True
                synced += 1
        except Exception:
            continue
    # 依据本次刷新的部门负责人信息，重算所有用户的 leaderOf
    for uid, u in users.items():
        if not uid.startswith("fs:") or not u.get("groups"):
            continue
        leader_of = perm.compute_leader_of(uid[3:], u["groups"], org)
        if leader_of != (u.get("leaderOf") or []):
            u["leaderOf"] = leader_of
            dirty = True
    if dirty:
        for uid, u in users.items():
            perm.save_user(db, uid, u)
    perm.save_org(db, org)
    db.commit()
    return {"depts": org["depts"], "fetchedAt": org["fetchedAt"], "syncedUsers": synced}


@router.get("/integrations")
async def integrations(user: CurrentUser = Depends(require_admin), db: Session = Depends(get_db)):
    s = get_settings()
    last_run = db.scalars(select(SyncRunRow).order_by(SyncRunRow.startedAt.desc())).first()
    total = db.scalar(select(func.count()).select_from(CandidateRow)) or 0
    return {
        "llm": {"configured": s.llm_configured, "model": s.llm_model if s.llm_configured else ""},
        "feishu": {"configured": s.feishu_configured, "calendar": s.feishu_configured,
                   "approval": bool(s.feishu_configured and s.feishu_approval_code)},
        "minio": {"configured": s.minio_configured, "mode": "minio" if s.minio_configured else "local"},
        "smtp": {"configured": s.smtp_configured},
        "sms": {"configured": bool(s.sms_provider), "provider": s.sms_provider},
        "bpm": {"mode": bpm.mode()},
        "sourceDb": {
            "configured": s.source_db_configured, "type": s.source_db_type if s.source_db_configured else "",
            "lastSyncAt": last_run.finishedAt if last_run and last_run.status == "done" else "",
            "lastError": last_run.error if last_run and last_run.status == "error" else "",
            "lastCount": last_run.added if last_run else 0,
            "totalCandidates": total,
        },
    }


@router.post("/sync", status_code=202)
async def admin_sync(user: CurrentUser = Depends(require_admin)):
    existing = jobsvc.find_running(job_type="source_sync")
    if existing:
        return jobsvc.public_job(existing)
    return jobsvc.public_job(jobsvc.create_job("source_sync"))
