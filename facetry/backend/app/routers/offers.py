from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.deps import CurrentUser, require_user
from ..core.errors import fail
from ..models import CandidateRow, OfferRow, PositionRow, iso_now, new_id
from ..services import bpm, feishu
from ..services.serializers import offer_json
from ..services.util import clip

router = APIRouter(prefix="/api/offers")

# 进行中状态（幂等键 candidateId+positionId+active 的 active 定义）
ACTIVE_STATES = ("pending", "submitted", "processing")


def _overall(feishu_side: dict, bpm_side: dict) -> str:
    """汇总：全部通过=approved；退回/拒绝/撤销/异常优先暴露；其余 processing"""
    states = [feishu_side.get("state", "pending"), bpm_side.get("state", "pending")]
    for bad in ("rejected", "returned", "error", "canceled"):
        if bad in states:
            return bad
    if all(s == "approved" for s in states):
        return "approved"
    if all(s == "pending" for s in states):
        return "pending"
    return "processing"


def _append(o: OfferRow, side: str, action: str, detail: str) -> None:
    history = list(o.history or [])
    history.append({"at": iso_now(), "side": side, "action": action, "detail": detail})
    o.history = history


async def _submit_sides(o: OfferRow) -> None:
    """发起两侧审批；失败写 error 状态，绝不崩溃"""
    now = iso_now()
    r = await feishu.create_approval_instance({"id": o.id, "candidateId": o.candidateId,
                                               "candidateName": "", "positionTitle": "", "note": o.note,
                                               "createdBy": o.createdBy})
    if r["state"] == "skipped":
        # 飞书审批未配置：走 mock 推进（与 BPM mock 同节奏）
        r = {"state": "submitted", "instanceId": "MOCK-FS-" + o.id[:8].upper(), "error": ""}
        o.feishu = {"state": r["state"], "instanceId": r.get("instanceId", ""), "updatedAt": now, "error": ""}
        _append(o, "feishu", "submit", "飞书审批未配置，mock 推进")
    else:
        o.feishu = {"state": r["state"], "instanceId": r.get("instanceId", ""), "updatedAt": now, "error": r.get("error", "")}
        _append(o, "feishu", "submit", "飞书审批已发起" if r["state"] == "submitted" else f"发起失败：{r.get('error', '')}")
    r2 = await bpm.submit({"id": o.id, "candidateId": o.candidateId})
    o.bpm = {"state": r2["state"], "processId": r2.get("processId", ""), "updatedAt": now, "error": r2.get("error", "")}
    _append(o, "bpm", "submit", f"BPM 流程已发起（{bpm.mode()}）")
    o.overall = _overall(o.feishu, o.bpm)
    o.updatedAt = now


@router.get("")
async def list_offers(state: str = "", q: str = "", user: CurrentUser = Depends(require_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(OfferRow).order_by(OfferRow.createdAt.desc())).all()
    out = [offer_json(db, o) for o in rows]
    if state:
        out = [o for o in out if o["overall"] == state or o["feishu"]["state"] == state or o["bpm"]["state"] == state]
    if q:
        out = [o for o in out if q in o["candidateName"] or q in o["positionTitle"]]
    return {"offers": out}


@router.post("", status_code=201)
async def create_offer(request: Request, user: CurrentUser = Depends(require_user), db: Session = Depends(get_db)):
    try:
        b = await request.json()
    except Exception:
        raise fail("请求格式不正确")
    candidate_id = str(b.get("candidateId") or "")
    position_id = str(b.get("positionId") or "")
    cand = db.get(CandidateRow, candidate_id)
    if not cand:
        raise fail("候选人不存在", 404)
    pos = db.get(PositionRow, position_id)
    if not pos:
        raise fail("岗位不存在", 404)
    # 幂等键 candidateId+positionId+active：已有进行中申请则 409
    dup = db.scalars(select(OfferRow).where(OfferRow.candidateId == candidate_id,
                                            OfferRow.positionId == position_id)).all()
    for d in dup:
        if d.overall in ACTIVE_STATES or (d.feishu or {}).get("state") in ACTIVE_STATES or (d.bpm or {}).get("state") in ACTIVE_STATES:
            raise fail("该候选人已有进行中的录取申请", 409)
    materials = []
    for m in (b.get("materials") if isinstance(b.get("materials"), list) else [])[:20]:
        if isinstance(m, dict) and m.get("name"):
            materials.append({"name": clip(m["name"], 200), "ok": bool(m.get("ok"))})
    now = iso_now()
    o = OfferRow(id=new_id(), candidateId=candidate_id, positionId=position_id, note=clip(b.get("note"), 4000),
                 materials=materials,
                 feishu={"state": "pending", "instanceId": "", "updatedAt": "", "error": ""},
                 bpm={"state": "pending", "processId": "", "updatedAt": "", "error": ""},
                 overall="pending", history=[], createdBy=user.id, createdByName=user.name,
                 idempotencyKey=str(b.get("idempotencyKey") or "") or None, createdAt=now, updatedAt=now)
    _append(o, "system", "created", "创建录取申请")
    db.add(o)
    db.commit()
    await _submit_sides(o)
    if cand.stage != "offer":
        cand.stage = "offer"
        cand.updatedAt = iso_now()
    db.commit()
    return offer_json(db, o)


@router.get("/{oid}")
async def get_offer(oid: str, user: CurrentUser = Depends(require_user), db: Session = Depends(get_db)):
    o = db.get(OfferRow, oid)
    if not o:
        raise fail("录取申请不存在", 404)
    return offer_json(db, o)


@router.post("/{oid}/refresh")
async def refresh_offer(oid: str, user: CurrentUser = Depends(require_user), db: Session = Depends(get_db)):
    """主动查询两侧最新状态；幂等，不重复发起"""
    o = db.get(OfferRow, oid)
    if not o:
        raise fail("录取申请不存在", 404)
    now = iso_now()
    fs_side = dict(o.feishu or {})
    if fs_side.get("state") in ACTIVE_STATES:
        if fs_side.get("instanceId", "").startswith("MOCK-FS-"):
            # mock 推进（与 BPM mock 同节奏，按提交时间）
            r = await bpm.refresh({"bpm": {"state": fs_side["state"], "processId": fs_side["instanceId"],
                                           "updatedAt": fs_side.get("updatedAt", ""), "error": fs_side.get("error", "")}})
            new_state = r["state"]
            if new_state != fs_side.get("state"):
                _append(o, "feishu", "refresh", f"状态推进：{fs_side.get('state')} → {new_state}")
            fs_side.update({"state": new_state, "updatedAt": now})
        else:
            r = await feishu.get_approval_instance(fs_side.get("instanceId", ""))
            if r["state"] != "skipped":
                if r["state"] != fs_side.get("state"):
                    _append(o, "feishu", "refresh", f"状态推进：{fs_side.get('state')} → {r['state']}")
                fs_side.update({"state": r["state"], "error": r.get("error", ""), "updatedAt": now})
    o.feishu = fs_side
    bpm_side = dict(o.bpm or {})
    if bpm_side.get("state") in ACTIVE_STATES:
        r = await bpm.refresh({"bpm": bpm_side})
        if r["state"] != bpm_side.get("state"):
            _append(o, "bpm", "refresh", f"状态推进：{bpm_side.get('state')} → {r['state']}")
        bpm_side.update({"state": r["state"], "error": r.get("error", ""), "updatedAt": now})
    o.bpm = bpm_side
    o.overall = _overall(o.feishu, o.bpm)
    o.updatedAt = now
    if o.overall == "approved":
        cand = db.get(CandidateRow, o.candidateId)
        if cand and cand.stage == "offer":
            cand.stage = "done"
            cand.updatedAt = now
    db.commit()
    return offer_json(db, o)


@router.post("/{oid}/cancel")
async def cancel_offer(oid: str, user: CurrentUser = Depends(require_user), db: Session = Depends(get_db)):
    o = db.get(OfferRow, oid)
    if not o:
        raise fail("录取申请不存在", 404)
    if o.overall == "approved":
        raise fail("审批已通过，不能撤销", 409)
    now = iso_now()
    fs_side = dict(o.feishu or {})
    if fs_side.get("state") in ACTIVE_STATES:
        if fs_side.get("instanceId", "").startswith("MOCK-FS-"):
            fs_side.update({"state": "canceled", "updatedAt": now})
        else:
            r = await feishu.cancel_approval_instance(fs_side.get("instanceId", ""), o.createdBy.removeprefix("fs:"))
            fs_side.update({"state": r["state"], "error": r.get("error", ""), "updatedAt": now})
        _append(o, "feishu", "cancel", f"撤销结果：{fs_side['state']}")
    o.feishu = fs_side
    bpm_side = dict(o.bpm or {})
    if bpm_side.get("state") in ACTIVE_STATES:
        r = await bpm.cancel({"bpm": bpm_side})
        bpm_side.update({"state": r["state"], "error": r.get("error", ""), "updatedAt": now})
        _append(o, "bpm", "cancel", f"撤销结果：{bpm_side['state']}")
    o.bpm = bpm_side
    o.overall = _overall(o.feishu, o.bpm)
    if o.overall not in ("canceled",):
        # 一侧已办结不可撤时，仅标记本方取消意图
        o.overall = "canceled" if o.feishu["state"] == "canceled" and o.bpm["state"] == "canceled" else o.overall
        _append(o, "system", "cancel_intent", "记录取消意图")
    o.updatedAt = now
    db.commit()
    return offer_json(db, o)
