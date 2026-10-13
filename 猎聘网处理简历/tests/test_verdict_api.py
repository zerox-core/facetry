import json
import urllib.request

BASE = "http://127.0.0.1:7788"


def get_one():
    with urllib.request.urlopen(f"{BASE}/api/candidates") as r:
        rows = json.load(r)["rows"]
    return rows[0]["id"], rows[0]["verdict"]


def set_verdict(cid, v):
    req = urllib.request.Request(
        f"{BASE}/api/candidate/{cid}/verdict",
        data=json.dumps({"verdict": v}).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req) as r:
        return json.load(r)


def current_verdict(cid):
    with urllib.request.urlopen(f"{BASE}/api/candidates") as r:
        rows = json.load(r)["rows"]
    return next(x["verdict"] for x in rows if x["id"] == cid)


cid, orig = get_one()
print("test cid =", cid, "| orig =", orig)

newv = "不合适" if orig != "不合适" else "合适"
resp = set_verdict(cid, newv)
print("update ->", resp)
assert resp.get("ok") is True, "update failed"
assert current_verdict(cid) == newv, "db not updated"
print("db verified =", current_verdict(cid))

# 非法值应被拒绝
try:
    set_verdict(cid, "瞎填")
    print("ERROR: illegal value accepted!")
except urllib.error.HTTPError as e:
    print("illegal rejected ->", e.code)

# 改回原值
set_verdict(cid, orig)
assert current_verdict(cid) == orig, "restore failed"
print("restored ->", current_verdict(cid))
print("ALL OK")
