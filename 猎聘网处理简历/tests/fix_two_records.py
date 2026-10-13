"""用修正后的逻辑，重新评估并修正 谭女士 / 程女士 两条记录。

- 程女士：实际投递"临床项目经理"，之前被错配成"生产副总经理"；改判为临床项目经理PM岗。
- 谭女士：期望城市应为"武汉、宜昌"（之前误抓成上海）；且城市不一致不应判待定。
"""
import sys, json
sys.path.insert(0, '.')

from app.core.config import load_config, get_db_path, get_jd_path
from app.core.db import get_conn
from app.core.jd_loader import load_jds
from app.core.jd_matcher import match, CandidateInfo

cfg = load_config()
db = get_db_path(cfg)
conn = get_conn(db)
jds = load_jds(get_jd_path())
jd_by_name = {j.name: j for j in jds}

TARGETS = [
    # (姓名, 正确应聘JD名, 修正后的期望城市或 None)
    ("程女士", "临床项目经理PM/高级临床项目经理SPM", None),
    ("谭女士", "SSU专员", "武汉、宜昌"),
]


def reconstruct(row, exp_city):
    d = json.loads(row["detail_json"]) if row["detail_json"] else {}
    snippet = d.get("raw_text_snippet") or ""
    wes = d.get("work_experience") or []
    full = (snippet + "\n" + "\n".join(w.get("raw", "") for w in wes)).strip()
    return d, CandidateInfo(
        name=row["candidate_name"],
        current_position=row["current_position"] or "",
        current_company=row["current_company"] or "",
        expected_city=exp_city or row["expected_city"] or "",
        education=d.get("education") or "",
        major=d.get("major") or "",
        years_of_experience=d.get("years_of_experience", -1),
        skills=d.get("skills") or [],
        work_experience=wes,
        raw_text=full,
    )


for name, jd_name, exp_city in TARGETS:
    row = conn.execute("SELECT * FROM candidates WHERE candidate_name=?", (name,)).fetchone()
    if not row:
        print("跳过（未找到）:", name)
        continue
    d, cand = reconstruct(row, exp_city)
    jd = jd_by_name.get(jd_name)
    if not jd:
        print("跳过（JD未找到）:", name, jd_name)
        continue
    result = match(cand, jd, cfg.get("llm", {}))
    new_detail = dict(d)
    new_detail["ai_assessment"] = result.ai_assessment
    new_detail["work_experience"] = cand.work_experience
    conn.execute(
        "UPDATE candidates SET applied_position=?, jd_key=?, verdict=?, score=?, reason=?, "
        "hits=?, misses=?, expected_city=?, detail_json=? WHERE id=?",
        (
            jd.name, jd.key, result.verdict, result.score, result.reason,
            json.dumps(result.hits, ensure_ascii=False),
            json.dumps(result.misses, ensure_ascii=False),
            cand.expected_city,
            json.dumps(new_detail, ensure_ascii=False),
            row["id"],
        ),
    )
    conn.commit()
    print(f"{name}: 应聘={jd.name} | 期望城市={cand.expected_city} | 判定={result.verdict} | 分数={result.score}")
    print(f"   理由: {result.reason}")
