"""冒烟测试脚本：走完契约核心流程并逐项打印结果"""
import json
import time
import urllib.request

BASE = "http://127.0.0.1:18080"
COOKIE = None
results = []


def call(method, path, body=None, raw=False):
    global COOKIE
    req = urllib.request.Request(BASE + path, method=method)
    req.add_header("Content-Type", "application/json")
    if COOKIE:
        req.add_header("Cookie", COOKIE)
    data = json.dumps(body).encode("utf-8") if body is not None else None
    try:
        resp = urllib.request.urlopen(req, data=data)
        set_cookie = resp.headers.get("Set-Cookie")
        if set_cookie:
            COOKIE = set_cookie.split(";")[0]
        payload = resp.read()
        return resp.status, (payload if raw else json.loads(payload or b"{}"))
    except urllib.error.HTTPError as e:
        set_cookie = e.headers.get("Set-Cookie")
        if set_cookie:
            COOKIE = set_cookie.split(";")[0]
        payload = e.read()
        try:
            return e.code, json.loads(payload or b"{}")
        except Exception:
            return e.code, payload


def check(name, cond, detail=""):
    results.append((name, bool(cond), detail))
    print(("PASS" if cond else "FAIL"), name, detail if not cond else "")


def poll_job(job_id, timeout=30):
    deadline = time.time() + timeout
    while time.time() < deadline:
        st, job = call("GET", f"/api/jobs/{job_id}")
        if st == 404:
            return None
        if job.get("state") in ("done", "error"):
            return job
        time.sleep(1)
    return {"state": "timeout"}


# 1. 未登录 401 错误体
st, body = call("GET", "/api/auth/me")
check("未登录 401 + 中文错误体", st == 401 and body == {"error": "请先登录"}, f"{st} {body}")

# 2. demo 登录
st, body = call("POST", "/api/auth/demo", {"name": "测试"})
check("demo 登录", st == 200 and body["user"]["id"] == "demo:测试", f"{st} {body}")

# 3. me / status
st, body = call("GET", "/api/auth/me")
check("auth/me", st == 200 and body["user"]["isAdmin"] is True, f"{st} {body}")
st, body = call("GET", "/api/status")
check("status", st == 200 and body == {"configured": False, "feishu": False}, f"{st} {body}")

# 4. 候选人列表（之前 sync 已入库）
st, body = call("GET", "/api/candidates")
check("candidates 列表", st == 200 and body["total"] >= 8, f"{st} total={body.get('total')}")
cand = next(c for c in body["candidates"] if "CRA" in c["currentPosition"])
cid = cand["id"]

# 5. 岗位列表 + 建岗（已存在则复用）
st, body = call("GET", "/api/positions")
if st == 200 and body["positions"]:
    pos = body["positions"][0]
else:
    st, pos = call("POST", "/api/positions", {"title": "临床监查员（CRA）", "city": "广州", "department": "临床运营部",
                                              "jd": {"content": "负责肿瘤项目临床监查。",
                                                     "requirements": "本科以上，3年以上CRA经验，熟悉GCP。", "note": ""}})
    check("建岗位 201", st == 201 and pos["jd"]["version"] == 1, f"{st} {pos}")
pid = pos["id"]

# 6. 关联匹配（自动触发初筛）+ 幂等重复
st, m = call("POST", f"/api/candidates/{cid}/matches", {"positionId": pid})
check("建匹配 201", st == 201 and m["verdict"] in ("", "合适", "待定", "不合适", "信息不足"), f"{st} {m}")
mid = m["id"]
st, m2 = call("POST", f"/api/candidates/{cid}/matches", {"positionId": pid})
check("匹配幂等（返回已有）", st == 201 and m2["id"] == mid, f"{st}")

# 7. 手动 screen job → 轮询到 done（LLM 未配置走本地降级）
st, job = call("POST", f"/api/matches/{mid}/screen")
check("screen 202 + Job", st == 202 and job["type"] == "screen", f"{st} {job}")
final = poll_job(job["id"])
check("screen job done", final and final["state"] == "done", f"{final}")
st, m3 = call("GET", f"/api/candidates/{cid}")
verdict = next(mm["verdict"] for mm in m3["matches"] if mm["id"] == mid)
check("verdict 四档之一", verdict in ("合适", "待定", "不合适", "信息不足"), verdict)

# 8. 待办
st, body = call("GET", "/api/todos")
check("todos 五段结构", st == 200 and all(k in body for k in ("toScreen", "toContact", "upcomingInterviews", "toFeedback", "offerUpdates")), f"{st}")

# 9. 约面 → 幂等 → 改期 → feedback confirm
start = "2026-10-20T14:00:00+08:00"
end = "2026-10-20T15:00:00+08:00"
iv_body = {"candidateId": cid, "positionId": pid, "round": "一面", "mode": "online",
           "startAt": start, "endAt": end, "location": "", "interviewerIds": [], "idempotencyKey": "smoke-iv-1"}
st, iv = call("POST", "/api/interviews", iv_body)
check("约面 201", st == 201 and iv["status"] == "scheduled", f"{st} {iv}")
iid = iv["id"]
st, iv_dup = call("POST", "/api/interviews", iv_body)
check("约面幂等（同 id 返回）", st == 201 and iv_dup["id"] == iid, f"{st} {iv_dup.get('id')}")
time.sleep(2)  # 等异步通知落库
st, iv2 = call("GET", f"/api/interviews?candidateId={cid}")
iv_state = next(x for x in iv2["interviews"] if x["id"] == iid)
check("通知降级 skipped（飞书/邮件/短信未配置）",
      iv_state["notify"]["feishu"]["state"] == "skipped"
      and iv_state["notify"]["email"]["state"] == "skipped"
      and iv_state["notify"]["sms"]["state"] == "skipped", json.dumps(iv_state["notify"], ensure_ascii=False))

st, iv3 = call("PATCH", f"/api/interviews/{iid}", {"action": "reschedule", "startAt": "2026-10-21T14:00:00+08:00",
                                                   "endAt": "2026-10-21T15:00:00+08:00", "reason": "候选人时间冲突"})
check("改期", st == 200 and iv3["status"] == "rescheduled" and iv3["startAt"].startswith("2026-10-21"), f"{st}")
st, fb = call("POST", f"/api/interviews/{iid}/feedback", {"scores": [{"dimension": "专业能力", "score": 4}], "note": "表现稳定"})
check("面评草稿 upsert", st == 200 and fb["confirmedAt"] == "", f"{st} {fb}")
st, fb2 = call("POST", f"/api/interviews/{iid}/feedback/confirm", {"scores": [{"dimension": "专业能力", "score": 4}],
                                                                   "note": "表现稳定", "conclusion": "通过"})
check("面评确认", st == 200 and fb2["confirmedAt"], f"{st}")

# 10. 录取申请 → refresh 推进 mock
st, offer = call("POST", "/api/offers", {"candidateId": cid, "positionId": pid, "note": "录取申请",
                                         "materials": [{"name": "背调授权书", "ok": True}]})
check("offer 201 + 双侧已发起", st == 201 and offer["bpm"]["state"] == "submitted" and offer["feishu"]["state"] == "submitted",
      f"{st} {json.dumps(offer.get('bpm'), ensure_ascii=False)}")
oid = offer["id"]
st, dup = call("POST", "/api/offers", {"candidateId": cid, "positionId": pid})
check("offer 幂等 409", st == 409 and "error" in dup, f"{st} {dup}")
st, o1 = call("POST", f"/api/offers/{oid}/refresh")
time.sleep(6)
st, o2 = call("POST", f"/api/offers/{oid}/refresh")
check("mock 状态推进 submitted→processing", o2["bpm"]["state"] in ("processing", "approved"), o2["bpm"]["state"])
time.sleep(16)
st, o3 = call("POST", f"/api/offers/{oid}/refresh")
check("mock 推进至 approved", o3["bpm"]["state"] == "approved" and o3["overall"] == "approved",
      f"bpm={o3['bpm']['state']} overall={o3['overall']}")

# 11. 管理集成状态
st, integ = call("GET", "/api/admin/integrations")
check("integrations", st == 200 and integ["minio"]["mode"] == "local" and integ["bpm"]["mode"] == "mock"
      and integ["sourceDb"]["totalCandidates"] >= 8, f"{st}")

# 12. 题库种子 / JD 库 / sessions
st, bank = call("GET", "/api/bank")
check("bank 空组无种子（demo 用户无组织）", st == 200 and "parts" in bank and "questions" in bank, f"{st}")
st, jd = call("POST", "/api/jds", {"title": "QA 工程师", "company": "", "content": "负责质量体系维护与偏差管理。"})
check("建 JD 201", st == 201 and jd["title"] == "QA 工程师", f"{st}")
st, sess = call("GET", "/api/sessions")
check("sessions 空数组", st == 200 and isinstance(sess, list), f"{st}")

print("\n==== 汇总 ====")
failed = [r for r in results if not r[1]]
print(f"{len(results) - len(failed)}/{len(results)} 通过")
for name, ok, detail in failed:
    print("FAIL:", name, detail)
