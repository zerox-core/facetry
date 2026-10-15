"""BPM（内部 OA）mock 适配层。
接入方式（开放 API / 数据库 / 其他）尚未确定：确认后在 submit/refresh/cancel 三个方法内
替换为真实调用，接口形状保持不变（返回 {state, processId, error}）。"""
import hashlib
import logging
from datetime import datetime, timezone

logger = logging.getLogger("facetry.bpm")

# mock 推进节奏：submitted 提交后 5 秒进 processing，15 秒后 approved
_SUBMIT_TO_PROCESSING_S = 5
_PROCESSING_TO_APPROVED_S = 15


def mode() -> str:
    # TODO(待确认)：BPM 接入方式确认后按配置切换真实模式
    return "mock"


async def submit(offer: dict) -> dict:
    """发起 BPM 流程，返回 {state, processId, error}"""
    seed = f"{offer.get('id', '')}:{offer.get('candidateId', '')}"
    process_id = "MOCK-BPM-" + hashlib.sha1(seed.encode()).hexdigest()[:10].upper()
    return {"state": "submitted", "processId": process_id, "error": ""}


async def refresh(offer: dict) -> dict:
    """查询流程最新状态；mock 按提交时间推进 submitted→processing→approved"""
    bpm = offer.get("bpm") or {}
    state = bpm.get("state", "pending")
    process_id = bpm.get("processId", "")
    if state in ("approved", "rejected", "returned", "canceled"):
        return {"state": state, "processId": process_id, "error": bpm.get("error", "")}
    if state in ("pending", "error") or not process_id:
        return {"state": state or "pending", "processId": process_id, "error": bpm.get("error", "")}
    try:
        elapsed = (datetime.now(timezone.utc) - datetime.fromisoformat(bpm.get("updatedAt", ""))).total_seconds()
    except Exception:
        elapsed = 0
    if state == "submitted" and elapsed >= _SUBMIT_TO_PROCESSING_S:
        state = "processing"
    if state == "processing" and elapsed >= _PROCESSING_TO_APPROVED_S:
        state = "approved"
    return {"state": state, "processId": process_id, "error": ""}


async def cancel(offer: dict) -> dict:
    """撤销流程；mock 下未完成一律可撤"""
    bpm = offer.get("bpm") or {}
    if bpm.get("state") in ("approved", "rejected"):
        return {"state": bpm["state"], "processId": bpm.get("processId", ""), "error": "流程已办结，无法撤销"}
    return {"state": "canceled", "processId": bpm.get("processId", ""), "error": ""}
