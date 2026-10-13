"""一次性小工具：把所有候选人数据导出 CSV，便于 Excel 归档"""
import csv
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.core.config import get_db_path, load_config
from app.core.db import init_db, list_candidates

CFG = load_config()
DB = get_db_path(CFG)
init_db(DB)

out = ROOT / "exports" / "candidates.csv"
out.parent.mkdir(parents=True, exist_ok=True)

rows = list_candidates(DB, page_size=100000)["rows"]
with open(out, "w", encoding="utf-8-sig", newline="") as f:
    w = csv.writer(f)
    w.writerow([
        "扫描时间", "平台", "候选人", "目前岗位", "目前公司", "期望城市", "应聘职位",
        "判定", "分数", "理由", "命中条件", "缺失条件", "简历链接", "已操作"
    ])
    for r in rows:
        hits = "; ".join(json.loads(r.get("hits") or "[]")) if isinstance(r.get("hits"), str) else ""
        misses = "; ".join(json.loads(r.get("misses") or "[]")) if isinstance(r.get("misses"), str) else ""
        w.writerow([
            r.get("scanned_at"),
            r.get("platform"),
            r.get("candidate_name"),
            r.get("current_position"),
            r.get("current_company"),
            r.get("expected_city"),
            r.get("applied_position"),
            r.get("verdict"),
            r.get("score"),
            r.get("reason"),
            hits,
            misses,
            r.get("page_url"),
            "是" if r.get("operated") else "否",
        ])
print(f"已导出 {len(rows)} 条到 {out}")
