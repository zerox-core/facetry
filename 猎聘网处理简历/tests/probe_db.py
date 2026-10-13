import sys, os, json
from pathlib import Path
sys.path.insert(0, str(Path(os.path.dirname(os.path.abspath(__file__))).parent))

from app.core.config import load_config, get_db_path
from app.core.db import get_conn

db = get_db_path(load_config())
conn = get_conn(db)
row = conn.execute("SELECT * FROM candidates ORDER BY id DESC LIMIT 1").fetchone()
d = dict(row)
print("=== candidates 表列 ===")
print([k for k in d.keys()])
print("\n=== 关键列值 ===")
for k in ["candidate_name","current_position","current_company","expected_city","applied_position","jd_key","score","verdict","reason"]:
    print(f"{k} = {d.get(k)!r}")
print("\n=== hits/misses ===")
print("hits:", d.get("hits"))
print("misses:", d.get("misses"))
print("\n=== detail_json 键 ===")
detail = json.loads(d["detail_json"]) if d.get("detail_json") else {}
print(list(detail.keys()))
print("\n=== detail 内 ai_assessment ===")
print(json.dumps(detail.get("ai_assessment"), ensure_ascii=False, indent=2))
print("\n=== detail 内教育/专业/年限/技能/正文 ===")
for k in ["education","major","years_of_experience","skills","raw_text","full_text","name"]:
    v = detail.get(k)
    print(f"{k} = {str(v)[:80]!r}")
print("\n=== 总记录数 ===")
print(conn.execute("SELECT COUNT(*) c FROM candidates").fetchone()["c"])
