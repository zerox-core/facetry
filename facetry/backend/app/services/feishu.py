"""飞书开放平台服务：OAuth 登录、组织架构、日历事件、审批实例。
原则：未配置或调用失败绝不崩溃，返回明确的 skipped/error 状态由业务层落库。"""
import logging
import time
from datetime import datetime, timezone

import httpx

from ..core.config import get_settings
from ..core.errors import fail

logger = logging.getLogger("facetry.feishu")

BASE = "https://open.feishu.cn/open-apis"
_token_cache: dict = {"token": "", "expires": 0.0}


def configured() -> bool:
    return get_settings().feishu_configured


async def app_access_token() -> str:
    s = get_settings()
    if not s.feishu_configured:
        raise fail("未配置飞书应用", 503)
    if _token_cache["token"] and time.time() < _token_cache["expires"]:
        return _token_cache["token"]
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(f"{BASE}/auth/v3/app_access_token/internal",
                              json={"app_id": s.feishu_app_id, "app_secret": s.feishu_app_secret})
        at = r.json()
        if r.status_code >= 400 or at.get("code") != 0 or not at.get("app_access_token"):
            raise fail("飞书应用凭证获取失败", 502)
        _token_cache["token"] = at["app_access_token"]
        _token_cache["expires"] = time.time() + max(60, int(at.get("expire", 7200)) - 300)
        return _token_cache["token"]


async def oauth_exchange(code: str) -> dict:
    """OAuth code 换用户信息 + 部门解析；失败抛 502"""
    s = get_settings()
    try:
        at = await app_access_token()
        async with httpx.AsyncClient(timeout=15) as client:
            ut_res = await client.post(f"{BASE}/authen/v1/access_token",
                                       headers={"Authorization": f"Bearer {at}"},
                                       json={"grant_type": "authorization_code", "code": code})
            ut = ut_res.json()
            if ut_res.status_code >= 400 or ut.get("code") != 0 or not ut.get("data", {}).get("access_token"):
                raise fail("飞书登录失败，请重试", 502)
            ui_res = await client.get(f"{BASE}/authen/v1/user_info",
                                      headers={"Authorization": f"Bearer {ut['data']['access_token']}"})
            ui = ui_res.json()
            if ui_res.status_code >= 400 or ui.get("code") != 0 or not ui.get("data") \
                    or not (ui["data"].get("union_id") or ui["data"].get("open_id")):
                raise fail("飞书登录失败，请重试", 502)
            union_id = ui["data"].get("union_id") or ui["data"].get("open_id")
            user_id = "fs:" + union_id
            dept_ids = []
            try:
                ud_res = await client.get(
                    f"{BASE}/contact/v3/users/{union_id}?user_id_type=union_id&department_id_type=open_department_id",
                    headers={"Authorization": f"Bearer {at}"})
                ud = ud_res.json() if ud_res.status_code < 400 else {}
                dept_ids = (ud.get("data") or {}).get("user", {}).get("department_ids") or []
            except Exception as e:
                logger.warning("用户部门获取失败（需 contact 权限）: %s", e)
            return {
                "userId": user_id,
                "unionId": union_id,
                "name": ui["data"].get("name") or ui["data"].get("en_name") or "飞书用户",
                "avatar": ui["data"].get("avatar_url") or "",
                "deptIds": dept_ids[:20],
                "appToken": at,
            }
    except Exception as e:
        if hasattr(e, "status"):
            raise
        logger.error("飞书登录失败: %s", e)
        raise fail("飞书登录失败，请重试", 502)


async def resolve_dept(token: str, dept_id: str, org: dict, depth: int) -> dict | None:
    """递归解析部门（含父链 path/pathName），等价旧逻辑"""
    if dept_id in org["depts"]:
        return org["depts"][dept_id]
    if depth > 10:
        return None
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(
            f"{BASE}/contact/v3/departments/{dept_id}?department_id_type=open_department_id&user_id_type=union_id",
            headers={"Authorization": f"Bearer {token}"})
        try:
            j = r.json()
        except Exception:
            j = {}
    d = (j.get("data") or {}).get("department")
    if not d:
        return None
    parent = d.get("parent_department_id") or ""
    if parent == "0":
        parent = ""
    parent_info = await resolve_dept(token, parent, org, depth + 1) if parent else None
    rec = {
        "id": dept_id,
        "name": d.get("name") or dept_id,
        "parentId": parent,
        "leaderId": d.get("leader_user_id") or "",
        "path": [*(parent_info["path"] if parent_info else []), dept_id],
        "pathName": " / ".join([*(parent_info["pathName"].split(" / ") if parent_info else []), d.get("name") or dept_id]),
    }
    org["depts"][dept_id] = rec
    return rec


async def resolve_user_groups(token: str, union_id: str, dept_ids: list, org: dict) -> tuple[list, list]:
    """返回 (groups, leaderOf)；groups 取最深层部门为最小用户组"""
    from ..services.perm import compute_leader_of

    resolved = []
    for did in dept_ids[:20]:
        rec = await resolve_dept(token, did, org, 0)
        if rec:
            resolved.append(rec)
    max_depth = max([len(d["path"]) for d in resolved], default=0)
    groups = [{"id": d["id"], "name": d["name"], "pathName": d["pathName"], "path": d["path"]}
              for d in resolved if len(d["path"]) == max_depth]
    return groups, compute_leader_of(union_id, groups, org)


async def refresh_org() -> dict:
    """全量刷新部门缓存；失败抛 502"""
    at = await app_access_token()
    org = {"depts": {}, "fetchedAt": datetime.now(timezone.utc).isoformat()}
    page_token = ""
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            for _guard in range(50):
                url = (f"{BASE}/contact/v3/departments?department_id_type=open_department_id&user_id_type=union_id"
                       f"&parent_department_id=0&fetch_child=true&page_size=50")
                if page_token:
                    url += "&page_token=" + page_token
                r = await client.get(url, headers={"Authorization": f"Bearer {at}"})
                j = r.json()
                if r.status_code >= 400 or j.get("code") != 0:
                    raise fail("组织架构同步失败：请检查飞书配置与网络", 502)
                for d in (j.get("data") or {}).get("items") or []:
                    did = d.get("open_department_id") or d.get("department_id")
                    if not did:
                        continue
                    parent = d.get("parent_department_id") or ""
                    org["depts"][did] = {"id": did, "name": d.get("name") or did,
                                         "parentId": "" if parent == "0" else parent,
                                         "leaderId": d.get("leader_user_id") or "", "path": [], "pathName": ""}
                if not (j.get("data") or {}).get("has_more"):
                    break
                page_token = (j.get("data") or {}).get("page_token") or ""

        def resolve(did: str, depth: int):
            d = org["depts"].get(did)
            if not d or depth > 15:
                return None
            if d["path"]:
                return d
            if not d["parentId"] or d["parentId"] not in org["depts"]:
                d["path"] = [did]
                d["pathName"] = d["name"]
                return d
            p = resolve(d["parentId"], depth + 1)
            d["path"] = [*(p["path"] if p else []), did]
            d["pathName"] = (p["pathName"] + " / " if p else "") + d["name"]
            return d

        for did in list(org["depts"]):
            resolve(did, 0)
        return org
    except Exception as e:
        if hasattr(e, "status"):
            raise
        logger.error("组织架构同步失败: %s", e)
        raise fail("组织架构同步失败：请检查飞书配置与网络", 502)


def _ts(iso: str) -> str:
    """ISO 8601 → 秒级时间戳字符串"""
    try:
        return str(int(datetime.fromisoformat(iso).timestamp()))
    except Exception:
        return str(int(datetime.now(timezone.utc).timestamp()))


async def _calendar_request(method: str, path: str, **kwargs) -> dict:
    at = await app_access_token()
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.request(method, f"{BASE}{path}", headers={"Authorization": f"Bearer {at}"}, **kwargs)
        j = r.json() if r.content else {}
        if r.status_code >= 400 or (isinstance(j, dict) and j.get("code") not in (0, None)):
            raise RuntimeError(str(j)[:300])
        return j if isinstance(j, dict) else {}


def _skipped(reason: str) -> dict:
    return {"state": "skipped", "eventId": "", "meetingUrl": "", "error": reason}


async def create_calendar_event(interview: dict) -> dict:
    """创建面试日程（线上模式附带会议）；返回 {state, eventId, meetingUrl, error}"""
    s = get_settings()
    if not s.feishu_configured:
        return _skipped("飞书未配置")
    try:
        body = {
            "summary": f"面试：{interview.get('candidateName', '')} · {interview.get('round', '')}",
            "description": interview.get("location", ""),
            "start_time": {"timestamp": _ts(interview["startAt"])},
            "end_time": {"timestamp": _ts(interview["endAt"])},
            "need_notification": True,
        }
        j = await _calendar_request("POST", "/calendar/v4/calendars/primary/events", json=body,
                                    params={"user_id_type": "union_id"})
        event = (j.get("data") or {}).get("event") or {}
        event_id = event.get("event_id", "")
        meeting_url = ""
        if interview.get("mode") == "online" and event_id:
            # 飞书日程的线上会议：vc 配置在创建时一并传入；此处补建会议
            try:
                vc = await _calendar_request(
                    "PATCH", f"/calendar/v4/calendars/primary/events/{event_id}",
                    json={"vchat": {"vc_type": "vc", "meeting_settings": {"topic": body["summary"]}}},
                    params={"user_id_type": "union_id"})
                meeting_url = (((vc.get("data") or {}).get("event") or {}).get("vchat") or {}).get("meeting_url", "")
            except Exception as e:
                logger.warning("飞书会议创建失败: %s", e)
        return {"state": "sent", "eventId": event_id, "meetingUrl": meeting_url, "error": ""}
    except Exception as e:
        logger.error("飞书日程创建失败: %s", e)
        return {"state": "error", "eventId": "", "meetingUrl": "", "error": f"飞书日程创建失败：{e}"}


async def update_calendar_event(event_id: str, start_at: str, end_at: str) -> dict:
    if not get_settings().feishu_configured or not event_id:
        return _skipped("飞书未配置或无日程")
    try:
        await _calendar_request("PATCH", f"/calendar/v4/calendars/primary/events/{event_id}",
                                json={"start_time": {"timestamp": _ts(start_at)}, "end_time": {"timestamp": _ts(end_at)}},
                                params={"user_id_type": "union_id"})
        return {"state": "sent", "eventId": event_id, "error": ""}
    except Exception as e:
        logger.error("飞书日程改期失败: %s", e)
        return {"state": "error", "eventId": event_id, "error": f"飞书日程改期失败：{e}"}


async def delete_calendar_event(event_id: str) -> dict:
    if not get_settings().feishu_configured or not event_id:
        return _skipped("飞书未配置或无日程")
    try:
        await _calendar_request("DELETE", f"/calendar/v4/calendars/primary/events/{event_id}",
                                params={"user_id_type": "union_id"})
        return {"state": "sent", "eventId": event_id, "error": ""}
    except Exception as e:
        logger.error("飞书日程取消失败: %s", e)
        return {"state": "error", "eventId": event_id, "error": f"飞书日程取消失败：{e}"}


async def create_approval_instance(offer: dict) -> dict:
    """发起飞书审批实例；未配置 FEISHU_APPROVAL_CODE 时返回 skipped 由 BPM mock 推进"""
    s = get_settings()
    if not s.feishu_configured or not s.feishu_approval_code:
        return {"state": "skipped", "instanceId": "", "error": "飞书审批未配置"}
    try:
        # 控件 form 映射待业务方确认审批定义后配置化；当前按通用文本控件传递摘要
        form = [
            {"id": "candidate", "type": "input", "value": offer.get("candidateName", "")},
            {"id": "position", "type": "input", "value": offer.get("positionTitle", "")},
            {"id": "note", "type": "textarea", "value": offer.get("note", "")},
        ]
        import json as _json
        j = await _calendar_request("POST", "/approval/v4/instances", json={
            "approval_code": s.feishu_approval_code,
            "user_id": offer.get("createdByUnionId") or offer.get("createdBy", ""),
            "form": _json.dumps(form, ensure_ascii=False),
        }, params={"user_id_type": "union_id"})
        instance_id = (j.get("data") or {}).get("instance_code", "")
        return {"state": "submitted", "instanceId": instance_id, "error": ""}
    except Exception as e:
        logger.error("飞书审批发起失败: %s", e)
        return {"state": "error", "instanceId": "", "error": f"飞书审批发起失败：{e}"}


async def get_approval_instance(instance_id: str) -> dict:
    """查询审批实例状态；映射到 SideState"""
    if not get_settings().feishu_configured or not instance_id:
        return {"state": "skipped", "error": "飞书审批未配置"}
    try:
        j = await _calendar_request("GET", f"/approval/v4/instances/{instance_id}",
                                    params={"user_id_type": "union_id"})
        status = (j.get("data") or {}).get("status", "")
        mapping = {"PENDING": "processing", "APPROVED": "approved", "REJECTED": "rejected", "CANCELED": "canceled", "DELETED": "canceled"}
        return {"state": mapping.get(status, "processing"), "error": ""}
    except Exception as e:
        logger.error("飞书审批查询失败: %s", e)
        return {"state": "error", "error": f"飞书审批查询失败：{e}"}


async def cancel_approval_instance(instance_id: str, user_id: str) -> dict:
    if not get_settings().feishu_configured or not instance_id:
        return {"state": "skipped", "error": "飞书审批未配置"}
    try:
        await _calendar_request("POST", "/approval/v4/instances/cancel",
                                json={"approval_code": get_settings().feishu_approval_code,
                                      "instance_id": instance_id, "user_id": user_id},
                                params={"user_id_type": "union_id"})
        return {"state": "canceled", "error": ""}
    except Exception as e:
        logger.error("飞书审批撤销失败: %s", e)
        return {"state": "error", "error": f"飞书审批撤销失败：{e}"}
