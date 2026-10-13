# -*- coding: utf-8 -*-
"""验证：应聘岗位按卡片投递关键字匹配 JD（忽略末尾编号）；AI 评估已无 jd_match"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.core.jd_matcher import build_ai_assessment, CandidateInfo, JD, match
from app.core.jd_loader import load_jds
from app.core.scanner import Scanner
from pathlib import Path

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
jds = load_jds(Path(os.path.join(ROOT, "职位JD汇总.xlsx")))
print("加载 JD 数:", len(jds))
print("JD 名:", [j.name for j in jds])

# 模拟 Scanner 的 _match_applied_jd（不连 Chrome）
sc = Scanner.__new__(Scanner)
sc.jds = jds

cases = [
    "医学经理 #7845 何睿雪 女 32岁 硕士 临床医学 北京",   # 末尾编号
    "临床项目经理PM/高级临床项目经理SPM（全国） - 第3期 李明",
    "临床监查员CRA 王芳 本科 药学",                         # 无编号
    "一个完全无关的岗位名 张三",                            # 不应误匹配
]
for c in cases:
    jd = sc._match_applied_jd(c)
    print(f"[卡片] {c[:20]}... -> 匹配JD: {jd.name if jd else '未匹配(回退正文)'}")

# 验证 AI 评估无 jd_match
cand = CandidateInfo(name="测试", current_position="临床监查员", current_company="某CRO",
                     education="本科", major="药学", years_of_experience=3.0,
                     skills=["CRA","GCP"], raw_text="临床监查员2年 ICH-GCP III期")
res = match(cand, jds[0], None)  # 规则版
print("\nAI 评估字段:", list(res.ai_assessment.keys()))
print("含 jd_match:", "jd_match" in res.ai_assessment)
print("summary:", res.ai_assessment.get("summary"))
print("highlights:", res.ai_assessment.get("highlights"))
print("concerns:", res.ai_assessment.get("concerns"))
