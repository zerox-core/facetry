# -*- coding: utf-8 -*-
"""测试 MiniMax LLM 连通性：用项目的 match_by_llm 走真实请求"""
import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.core.jd_loader import JD
from app.core.jd_matcher import match_by_llm, CandidateInfo
from app.core.config import load_config

cfg = load_config()
llm_cfg = cfg.get("llm", {})
print("LLM 配置: enabled=%s model=%s base=%s" % (llm_cfg.get("enabled"), llm_cfg.get("model"), llm_cfg.get("base_url")))

cand = CandidateInfo(
    name="测试候选人",
    current_position="临床监查员CRA",
    current_company="某CRO公司",
    education="本科",
    major="药学",
    years_of_experience=5,
    expected_city="珠海",
    skills=["GCP", "监查", "药物警戒"],
    raw_text="2019-2024 在某CRO公司担任临床监查员，负责3个III期项目的中心监查，熟悉GCP和EDC。本科药学专业毕业。",
)
jd = JD(
    key="临床监查员CRA",
    seq="1",
    name="临床监查员CRA",
    city="全国",
    description="负责临床试验中心监查、数据核对、研究者沟通。",
    requirements="1. 本科及以上学历，药学/临床医学相关专业；2. 4年以上CRA监查经验；3. 熟悉GCP。",
    note="无CRA/监查经验不考虑",
)

try:
    result = match_by_llm(cand, jd, llm_cfg)
    print("=== 调用成功 ===")
    print("verdict:", result.verdict)
    print("score:", result.score)
    print("reason:", result.reason)
    print("ai_assessment:", json.dumps(result.ai_assessment, ensure_ascii=False, indent=2) if result.ai_assessment else None)
except Exception as e:
    print("=== 调用失败 ===")
    print(type(e).__name__, str(e)[:500])
    sys.exit(1)
