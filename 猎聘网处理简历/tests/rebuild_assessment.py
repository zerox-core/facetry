"""把旧候选人的 ai_assessment 统一成新格式：删除 highlights，把特别亮点合并进 summary。

新格式: {summary, concerns}
- summary: 保留原 summary（不重算，避免丢失 LLM 丰富信息）；若能从 work_experience 识别到
           知名公司/团队管理/显著亮点，且原 summary 未提及，则追加 "；特别亮点"。
- concerns: 保留原 concerns。
"""
import sys, os, json, re
from pathlib import Path
sys.path.insert(0, str(Path(os.path.dirname(os.path.abspath(__file__))).parent))

from app.core.config import load_config, get_db_path
from app.core.db import get_conn

APPLY = "--apply" in sys.argv

FAMOUS = [
    "辉瑞","罗氏","诺华","拜耳","默沙东","强生","赛诺菲","阿斯利康","葛兰素","礼来",
    "武田","勃林格","恒瑞","药明康德","药明生物","康龙化成","泰格医药","昭衍","昆泰","科文斯",
    "IQVIA","Covance","LabCorp","丽珠","石药","齐鲁","正大天晴","扬子江","百济神州","信达",
    "君实","复宏汉霖","再鼎","智飞","沃森","华兰","天坛","中国生物","迈瑞","GSK","Pfizer",
    "Roche","Novartis","Bayer","MSD","Johnson","Sanofi","AstraZeneca","Eli Lilly","Takeda","Boehringer","WuXi",
]
MGMT_KW = ["管理团队","带领","团队管理","带教","下属","汇报线","负责人","总监","组建团队","组建部门"]
SIGNALS = [
    ("主导III期/上市申报项目", ["iii期","3期","三期","nda","上市申报","关键试验","pivotal"]),
    ("海外/跨国项目经验", ["海外","跨国","global","international","fda","ema"]),
    ("专利/核心期刊论文", ["专利","sci","一作","核心期刊"]),
    ("从0到1体系/团队搭建", ["从0到1","0到1","体系搭建","制度建设","组建团队"]),
]

def detect_special(blob):
    special = []
    for f in FAMOUS:
        if f in blob:
            special.append(f"知名企业{f}经验")
            break
    if any(k in blob for k in MGMT_KW) or re.search(r"管理\s*\d+\s*人", blob):
        special.append("具备团队管理经验")
    low = blob.lower()
    for label, kws in SIGNALS:
        if any(k in low for k in kws):
            special.append(label)
            break
    return special

def build_blob(detail):
    parts = []
    we = detail.get("work_experience")
    if isinstance(we, list):
        for w in we:
            if isinstance(w, dict):
                parts.append(" ".join(str(w.get(k, "")) for k in ["company","position","period","description","raw"]))
            else:
                parts.append(str(w))
    elif isinstance(we, str):
        parts.append(we)
    parts.append(str(detail.get("raw_text_snippet", "") or ""))
    return " ".join(parts)

db = get_db_path(load_config())
conn = get_conn(db)
rows = conn.execute("SELECT id, candidate_name, detail_json FROM candidates").fetchall()

changed = 0
for row in rows:
    rid = row["id"]
    name = row["candidate_name"]
    detail = json.loads(row["detail_json"]) if row["detail_json"] else {}
    old = detail.get("ai_assessment") or {}
    if "highlights" not in old and "summary" in old and "concerns" in old:
        # 已经是新格式
        print(f"[跳过] {name}: 已是新格式")
        continue
    summary = old.get("summary") or ""
    concerns = old.get("concerns") or []
    old_highlights = old.get("highlights") or []
    blob = build_blob(detail)
    special = detect_special(blob)
    for s in special:
        if s not in summary:
            summary = summary + "；" + s
    new_ai = {"summary": summary, "concerns": concerns}
    detail["ai_assessment"] = new_ai
    if APPLY:
        conn.execute("UPDATE candidates SET detail_json = ? WHERE id = ?",
                     (json.dumps(detail, ensure_ascii=False), rid))
        conn.commit()
        changed += 1
    print(f"[{'将写入' if APPLY else '预览'}] {name}")
    print(f"   原highlights({len(old_highlights)}): {old_highlights[:3]}")
    print(f"   识别特别亮点: {special}")
    print(f"   新summary: {summary[:120]}{'…' if len(summary)>120 else ''}")

print(f"\n{'已写入 '+str(changed)+' 条' if APPLY else 'DRY-RUN 完成，共 '+str(len(rows))+' 条。加 --apply 执行写入'}")
