import json, time, urllib.request, http.cookiejar
from datetime import datetime, timedelta

BASE = "http://127.0.0.1:18080"
cj = http.cookiejar.CookieJar()
op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))

def call(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE+path, data=data, method=method,
        headers={"Content-Type":"application/json"} if body is not None else {})
    try:
        with op.open(req) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")

def wait_job(jid):
    for _ in range(60):
        s, j = call("GET", f"/api/jobs/{jid}")
        if s == 404 or j.get("state") in ("done","error"): return j
        time.sleep(0.5)
    return {"state":"timeout"}

s, r = call("POST", "/api/auth/demo", {"name": "演示用户"})
assert s == 200, r
me = r["user"]["id"]
print("login ok:", me)

s, r = call("POST", "/api/admin/sync", {})
print("sync:", s)
if r.get("id"): print("sync job:", wait_job(r["id"]).get("state"))

positions = [
  {"title":"临床监查员 CRA","city":"上海","department":"临床运营部","jd":{
    "content":"1、确保所有的临床操作符合方案、SOP、ICH-GCP/中国GCP和相关法规的要求；\n2、负责试验中心的选择、启动监查、常规监查、关闭中心监查，并按时提交监查报告；\n3、负责伦理资料的递交工作，并及时获得伦理批件；\n4、试验中心合同的谈判和签署。",
    "requirements":"1、本科及以上医学或药学、公共卫生、护理等相关学位；\n2、1-4年以上I、II、III期药物临床监查工作经验，熟悉ICH-GCP/中国GCP；\n3、具备较好的沟通协调能力、抗压能力、较强的责任心。",
    "note":"1、没有CRA/监查经验的完全不考虑；\n2、如果职位要求都符合，但是学历是专科，可以按待定处理"}},
  {"title":"药物警戒专员 PV","city":"广州","department":"医学部","jd":{
    "content":"1、负责药品不良反应报告的收集、录入与上报；\n2、维护药物警戒体系文件，配合监管检查；\n3、定期开展信号检测与风险评估。",
    "requirements":"1、本科及以上，医学、药学、流行病学相关专业；\n2、1年以上药物警戒或相关经验，熟悉GVP；\n3、英语读写良好，能处理英文文献。",
    "note":"没有药物警戒/PV经验的不考虑"}},
  {"title":"财务总监","city":"珠海","department":"财务部","jd":{
    "content":"1、全面负责公司财务战略、预算与资金管理；\n2、建立和完善财务内控体系，支持经营决策；\n3、统筹税务筹划与外部审计对接。",
    "requirements":"1、本科及以上学历，财务、会计相关专业，CPA优先；\n2、8年以上财务工作经验，3年以上财务负责人经验；\n3、有医药或制造业背景者优先。",
    "note":"没有财务负责人经验的不考虑"}},
]
pids = {}
for p in positions:
    s, r = call("POST", "/api/positions", p)
    print("position", s)
    if r.get("id"): pids[p["title"]] = r["id"]

_, data = call("GET", "/api/candidates?size=50")
cands = data["candidates"]
def find(kw): return next((c for c in cands if kw in c["currentPosition"] or kw in c["name"]), None)

links = [("CRA","临床监查员 CRA"), ("PV","药物警戒专员 PV"), ("财务总监","财务总监"),
         ("CRC","临床监查员 CRA"), ("MA","临床监查员 CRA"), ("QA","药物警戒专员 PV")]
for ckw, ptitle in links:
    c, pid = find(ckw), pids.get(ptitle)
    if not c or not pid: continue
    s, m = call("POST", f"/api/candidates/{c['id']}/matches", {"positionId": pid})
    mid = m.get("id")
    if mid:
        s, j = call("POST", f"/api/matches/{mid}/screen")
        if s == 202:
            wait_job(j["id"])
            _, md = call("GET", f"/api/candidates/{c['id']}")
            mm = next((x for x in md.get("matches",[]) if x["id"]==mid), {})
            print("screen:", mm.get("verdict"), mm.get("score"))

# 负责人全部指给演示用户
for c in cands:
    call("PATCH", f"/api/candidates/{c['id']}", {"ownerId": me})

c = find("CRA")
if c:
    call("POST", f"/api/candidates/{c['id']}/followups", {"content":"电话沟通 15 分钟，候选人对上海 base 可接受，期望薪资涨幅 20%，约一面。","nextStep":"安排一面"})
    call("PATCH", f"/api/candidates/{c['id']}", {"stage":"interviewing","nextStep":"一面安排中"})
for kw in ("PV", "财务总监"):
    c2 = find(kw)
    if c2: call("PATCH", f"/api/candidates/{c2['id']}", {"stage":"contact","nextStep":"电话初聊"})

today = datetime.now()
def dt(d, h, m=0):
    return (today + timedelta(days=d)).replace(hour=h, minute=m, second=0, microsecond=0).isoformat()

c1, c2 = find("CRA"), find("PV")
ivs = []
if c1:
    s, iv = call("POST", "/api/interviews", {"candidateId":c1["id"],"positionId":pids["临床监查员 CRA"],"round":"一面","mode":"online","startAt":dt(1,14),"endAt":dt(1,15),"location":"","interviewerIds":[],"notifyEmail":"","notifySms":"","idempotencyKey":"demo-iv-1"})
    print("interview1", s); ivs.append(iv.get("id"))
if c2:
    s, iv = call("POST", "/api/interviews", {"candidateId":c2["id"],"positionId":pids["药物警戒专员 PV"],"round":"一面","mode":"offline","startAt":dt(2,10),"endAt":dt(2,11),"location":"珠海总部 3F 会议室","interviewerIds":[],"notifyEmail":"","notifySms":"","idempotencyKey":"demo-iv-2"})
    print("interview2", s); ivs.append(iv.get("id"))

if ivs and ivs[0]:
    call("PATCH", f"/api/interviews/{ivs[0]}", {"action":"reschedule","startAt":dt(0,16),"endAt":dt(0,17),"reason":"面试官临时会议，提前到今天"})
    call("PATCH", f"/api/interviews/{ivs[0]}", {"action":"complete"})
    s, fb = call("POST", f"/api/interviews/{ivs[0]}/feedback/confirm", {"scores":[{"dimension":"岗位专业能力","score":4},{"dimension":"通用能力","score":4},{"dimension":"文化契合","score":3}],"note":"GCP 理解扎实，监查报告案例讲得具体；英语听说一般，建议二面加测。","conclusion":"通过"})
    print("feedback", s)

if c1:
    s, of = call("POST", "/api/offers", {"candidateId":c1["id"],"positionId":pids["临床监查员 CRA"],"note":"一面通过，用人部门已确认意向","materials":[{"name":"简历原件","ok":True},{"name":"学历证明","ok":True},{"name":"背调授权","ok":False}],"idempotencyKey":"demo-offer-1"})
    print("offer", s)
    if of.get("id"):
        time.sleep(6); call("POST", f"/api/offers/{of['id']}/refresh")
        time.sleep(11); call("POST", f"/api/offers/{of['id']}/refresh")
        _, of2 = call("GET", f"/api/offers/{of['id']}")
        print("offer:", of2.get("feishu",{}).get("state"), of2.get("bpm",{}).get("state"), of2.get("overall"))
print("DONE")
