"""简历与 JD 的匹配器
两种策略：
  - rules: 关键词 + 简单规则匹配（免费本地）
  - llm:   OpenAI 兼容协议的大模型做语义匹配（更准，需 API Key）

输出：
  verdict: '合适' | '待定' | '不合适' | '信息不足'
  score:   0-100
  reason:  判定理由（短）
  hits:    命中条件列表
  misses:  缺失/不达标条件列表
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field

from .jd_loader import JD


@dataclass
class CandidateInfo:
    """从简历 DOM 抓到的候选人信息（结构由解析器决定，这里是最小字段集）"""
    name: str = ""
    current_position: str = ""
    current_company: str = ""
    expected_city: str = ""
    education: str = ""            # 学历：本科/硕士/专科
    major: str = ""
    years_of_experience: float = -1.0  # 工作年限
    skills: list[str] = field(default_factory=list)
    work_experience: list[dict] = field(default_factory=list)  # [{company, position, period, description}]
    raw_text: str = ""             # 简历全文（关键词匹配用）
    resume_html: str = ""          # 原始 HTML（LLM 用）

    @property
    def full_text(self) -> str:
        """合并成一段全文本"""
        chunks = [
            self.current_position,
            self.current_company,
            self.education,
            self.major,
            " ".join(self.skills),
            self.raw_text,
        ]
        return " ".join([c for c in chunks if c])


@dataclass
class MatchResult:
    verdict: str       # 合适 / 待定 / 不合适 / 信息不足
    score: float
    reason: str
    hits: list[str] = field(default_factory=list)
    misses: list[str] = field(default_factory=list)
    # AI 结构化评估（两段式）
    ai_assessment: dict = field(default_factory=dict)  # {summary, concerns}


# ============================================================
# AI 评估构建器（规则版，无需 API Key）
# ============================================================

def build_ai_assessment(cand: CandidateInfo, jd: JD, result: MatchResult) -> dict:
    """根据候选人信息 + JD + 匹配结果，构建简洁 AI 评估。

    返回:
      summary: str   - "学历专业，有相关岗位经验X年，综合评分XX分"；若有知名公司/团队管理/显著亮点，用分号追加
      concerns: list[str] - 简历注意点（普通亮点不赘述）
    """
    # --- 第 1 段：学历专业 + 经验年限 + 综合评分 ---
    edu_str = cand.education or "学历未识别"
    major_str = cand.major or "专业未识别"
    yoe = cand.years_of_experience
    if yoe is not None and yoe >= 0:
        yoe_str = f"{int(yoe) if yoe == int(yoe) else yoe}年"
    else:
        yoe_str = "年限未识别"
    score_val = int(round(result.score))
    summary = f"{edu_str}{major_str}专业，有相关岗位经验{yoe_str}，综合评分{score_val}分"

    # --- 特别亮点：仅合并「知名公司 / 团队管理 / 显著亮点」，普通亮点不赘述 ---
    special: list[str] = []
    # 1. 知名公司经验（药企 / CRO / 知名外企）
    FAMOUS_COMPANIES = [
        "辉瑞", "罗氏", "诺华", "拜耳", "默沙东", "强生", "赛诺菲", "阿斯利康", "葛兰素", "礼来",
        "武田", "勃林格", "恒瑞", "药明康德", "药明生物", "康龙化成", "泰格医药", "昭衍", "昆泰", "科文斯",
        "IQVIA", "Covance", "LabCorp", "丽珠", "石药", "齐鲁", "正大天晴", "扬子江", "百济神州", "信达",
        "君实", "复宏汉霖", "再鼎", "智飞", "沃森", "华兰", "天坛", "中国生物", "GSK", "Pfizer", "Roche",
        "Novartis", "Bayer", "MSD", "Johnson", "Sanofi", "AstraZeneca", "Eli Lilly", "Takeda", "Boehringer", "WuXi",
    ]
    _company_blob = f"{cand.current_company or ''} {cand.full_text or ''}"
    for f in FAMOUS_COMPANIES:
        if f in _company_blob:
            special.append(f"知名企业{f}经验")
            break
    # 2. 团队管理经验（需明确团队管理信号，避免"管理N家中心"误判）
    _mgmt_blob = f"{cand.current_position or ''} {cand.full_text or ''}"
    _mgmt_keywords = ["管理团队", "带领", "团队管理", "带教", "下属", "汇报线", "负责人", "总监", "组建团队", "组建部门"]
    _mgmt_people = re.search(r"管理\s*\d+\s*人", _mgmt_blob)
    if any(k in _mgmt_blob for k in _mgmt_keywords) or _mgmt_people:
        special.append("具备团队管理经验")
    # 3. 显著亮点（强信号，取首个）
    STRONG_SIGNALS = [
        ("主导III期/上市申报项目", ["iii期", "3期", "三期", "nda", "上市申报", "关键试验", "pivotal"]),
        ("海外/跨国项目经验", ["海外", "跨国", "global", "international", "fda", "ema"]),
        ("专利/核心期刊论文", ["专利", "sci", "一作", "核心期刊"]),
        ("从0到1体系/团队搭建", ["从0到1", "0到1", "体系搭建", "制度建设", "组建团队"]),
    ]
    _low = (_company_blob + " " + _mgmt_blob).lower()
    for label, kws in STRONG_SIGNALS:
        if any(k in _low for k in kws):
            special.append(label)
            break
    if special:
        summary += "；" + "、".join(special)

    # --- 注意点：从 misses 提取 ---
    concerns: list[str] = []
    for m in result.misses[:4]:
        clean = m.replace("缺少", "缺少").replace("偏低", "偏低")
        if clean:
            concerns.append(clean)
    # 学历偏低
    edu_need = _parse_required_education(jd.requirements)
    if edu_need > 0 and 0 < _edu_to_rank(cand.education) < edu_need:
        concerns.append(f"学历{cand.education}低于JD要求{_rank_to_label(edu_need)}")
    # 经验不足
    years_need = _parse_required_years(jd.requirements)
    if years_need > 0 and yoe is not None and 0 <= yoe < years_need:
        concerns.append(f"工作经验{yoe_str}低于JD要求{int(years_need)}年")
    # JD备注硬性条件
    if jd.note:
        must_kws = re.findall(r"没有([^，,。；;\n]+?)(?:经验|的)", jd.note)
        for kw in must_kws[:2]:
            k = kw.strip()
            if k and not any(a in cand.full_text for a in re.split(r"[/、,，;；\s]+", k)):
                concerns.append(f"缺少{k}经验（JD硬性要求）")
    if not concerns:
        concerns.append("暂无明显短板")

    return {
        "summary": summary,
        "concerns": concerns[:5],
    }


# ============================================================
# 规则匹配
# ============================================================

# 学历映射（顺序从高到低）
_EDU_RANK = {"博士": 4, "硕士": 3, "研究生": 3, "本科": 2, "专科": 1, "大专": 1}


def _edu_to_rank(edu: str) -> int:
    edu = edu.strip()
    for k, v in _EDU_RANK.items():
        if k in edu:
            return v
    return 0


# 一些通用硬规则：黑名单关键词
_BLACKLIST_KEYWORDS = [
    # 候选 JD 已写在备注里，规则层只兜底
]


def match_by_rules(cand: CandidateInfo, jd: JD) -> MatchResult:
    """基于关键词 + 简单规则做硬匹配。

    思路：
      1) 先检查 JD 备注里的"必备条件"（如"没有CRA经验的完全不考虑" → 必须有 CRA 经验）
      2) 业务关键词命中（JOB 通用：GCP / SSU / FDA 等）
      3) 学历、经验年限做数值判断
      4) 给最终判定
    """
    text = cand.full_text
    hits: list[str] = []
    misses: list[str] = []

    # ----- 1) JD 备注里的必备条件 -----
    # "没有X经验/的不考虑" → 必须命中 X（否则视为硬性缺失）
    # 例如 JD1 备注: "1、没有CRA/监查经验的完全不考虑"
    #        → 候选人必须含 "CRA" 或 "监查"
    req_keywords_from_note = re.findall(r"没有([^，,。；;\n]+?)(?:经验|的)[^，,。；;\n]*?(?:不考虑|不考虑)", jd.note)
    must_have = set()
    for kw in req_keywords_from_note:
        k = kw.strip()
        if not k:
            continue
        # 'CRA/监查' 拆开成 'CRA' 和 '监查'，任一命中即可
        alts = [a.strip() for a in re.split(r"[/、,，;；\s]+", k) if a.strip()]
        any_hit = any(a in text for a in alts)
        if any_hit:
            hits.append(f"命中必备：{k}")
        else:
            misses.append(f"缺少{k}经验（JD备注必备）")
            must_have.add(k)

    # ----- 2) 业务关键词命中 -----
    business_kws = _business_keywords(jd.name, jd.requirements)
    for kw in business_kws:
        if kw in text:
            hits.append(f"命中：{kw}")

    # ----- 3) 学历判断 -----
    edu_rank_need = _parse_required_education(jd.requirements)
    cand_rank = _edu_to_rank(cand.education)
    edu_fail = False
    if edu_rank_need > 0:
        if cand_rank == 0:
            misses.append(f"未识别学历（JD 要求：{_rank_to_label(edu_rank_need)}）")
            return _verdict_info_incomplete("学历未识别", hits, misses)
        if cand_rank < edu_rank_need:
            misses.append(f"学历偏低：{cand.education or '未填'} < 要求 {_rank_to_label(edu_rank_need)}")
            edu_fail = True

    # ----- 4) 经验年限 -----
    years_need = _parse_required_years(jd.requirements)
    years_fail = False
    if years_need > 0:
        if cand.years_of_experience < 0:
            misses.append(f"未识别工作年限（JD 要求：{years_need} 年以上）")
            return _verdict_info_incomplete("经验年限未识别", hits, misses)
        if cand.years_of_experience < years_need:
            misses.append(f"经验不足：{cand.years_of_experience} 年 < 要求 {years_need} 年")
            years_fail = True

    # ----- 5) 决策 -----
    # 必备条件全部未命中 → 不合适
    if must_have:
        return MatchResult(
            verdict="不合适",
            score=_score_from_hits(hits, misses, penalty=40),
            reason="; ".join([m for m in misses if "JD备注" in m][:2]),
            hits=hits,
            misses=misses,
        )

    # 学历硬性不达标 → 不合适 或 待定（看备注）
    if edu_fail:
        # JD1 备注特别说明："如果职位要求都符合，但是学历是专科，可以按待定处理"
        if "专科" in jd.note and "可以按待定" in jd.note:
            return MatchResult(
                verdict="待定",
                score=_score_from_hits(hits, misses, penalty=15),
                reason="学历偏低（专科），但 JD 备注允许按待定处理",
                hits=hits,
                misses=misses,
            )
        return MatchResult(
            verdict="不合适",
            score=_score_from_hits(hits, misses, penalty=25),
            reason=f"学历不达标（{_rank_to_label(edu_rank_need)}）",
            hits=hits,
            misses=misses,
        )

    if years_fail:
        return MatchResult(
            verdict="不合适",
            score=_score_from_hits(hits, misses, penalty=20),
            reason=f"工作年限不达标（{years_need} 年+）",
            hits=hits,
            misses=misses,
        )

    # 命中≥5 + 无硬失败 → 合适
    if len(hits) >= 5:
        return MatchResult(
            verdict="合适",
            score=_score_from_hits(hits, misses, penalty=0),
            reason=f"命中 {len(hits)} 项关键条件",
            hits=hits,
            misses=misses,
        )
    # 命中 2-4 → 待定
    if len(hits) >= 2:
        return MatchResult(
            verdict="待定",
            score=_score_from_hits(hits, misses, penalty=10),
            reason=f"命中 {len(hits)} 项关键条件，建议人工复核",
            hits=hits,
            misses=misses,
        )

    # 命中太少 → 信息不足
    return _verdict_info_incomplete("关键词命中过少", hits, misses)


def _verdict_info_incomplete(reason: str, hits: list[str], misses: list[str]) -> MatchResult:
    return MatchResult(
        verdict="信息不足",
        score=_score_from_hits(hits, misses, penalty=20),
        reason=reason + ("；" + "; ".join(misses[:2]) if misses else ""),
        hits=hits,
        misses=misses,
    )


def _score_from_hits(hits: list[str], misses: list[str], penalty: int = 0) -> float:
    base = min(100, 50 + len(hits) * 7)
    return max(0, min(100, base - len(misses) * 12 - penalty))


def _extract_keywords(text: str) -> list[str]:
    """通用：拆出 2-8 字短语，仅兜底用，业务关键词见 _business_keywords"""
    if not text:
        return []
    candidates = re.findall(r"[\u4e00-\u9fa5A-Za-z][\u4e00-\u9fa5A-Za-z0-9-]{1,7}", text)
    stop = set([
        "以及", "或者", "以上", "以下", "相关", "具有", "具备", "具有的",
        "熟悉", "掌握", "能够", "负责", "参与", "包括", "工作", "经验",
        "能力", "要求", "优先", "考虑", "良好", "较强", "优先考虑",
    ])
    out: list[str] = []
    seen = set()
    for c in candidates:
        if c in stop or c in seen:
            continue
        seen.add(c)
        out.append(c)
        if len(out) >= 10:
            break
    return out


# 业务关键词词典（每条都是招聘场景真正有区分度的关键词）
_BUSINESS_KW_GROUPS: dict[str, list[str]] = {
    # 临床类
    "CRA": ["CRA", "临床监查员", "监查员", "Clinical Research Associate", "Monitor"],
    "CRC": ["CRC", "临床协调员", "Clinical Research Coordinator"],
    "SSU": ["SSU", "Site Start Up", "中心启动", "机构立项"],
    "GCP": ["ICH-GCP", "GCP", "中国GCP", "药物临床试验质量管理规范"],
    "临床试验": ["临床试验", "II期", "III期", "III期临床", "II期临床", "I期临床"],
    "药物警戒": ["PV", "药物警戒", "Pharmacovigilance"],
    "注册申报": ["注册申报", "IND", "NDA", "BE研究"],
    "伦理审查": ["伦理", "伦理委员会", "伦理批件", "机构立项"],
    # 制药生产类
    "GMP": ["GMP", "cGMP"],
    "FDA认证": ["FDA", "FDA认证"],
    "EMA认证": ["EMA", "CEP"],
    "原料药": ["原料药", "API"],
    "发酵": ["发酵", "菌种选育", "菌种"],
    "提取纯化": ["提取", "纯化", "精制"],
    # 财经法务类
    "信披": ["信息披露", "信披", "定期报告", "临时公告"],
    "证券事务": ["证券事务", "证券事务代表", "董事会秘书", "董秘", "投资者关系"],
    "A股H股": ["A股", "H股", "两地上市", "上市规则"],
    # 管理类
    "生产管理": ["生产管理", "生产运营", "产能", "工艺优化", "技术革新"],
    "EHS": ["EHS", "安全环保", "HSE"],
    "成本管控": ["成本管控", "降本增效", "成本控制"],
    # 数据分析
    "PK": ["PK", "药代动力学", "Pharmacokinetic"],
    "PopPK": ["PopPK", "群体药代动力学", "群体药动学"],
    "建模": ["建模", "NONMEM", "Phoenix", "Monolix"],
    # 学历
    "医学": ["医学", "临床医学"],
    "药学": ["药学", "药剂学", "药理学", "临床药学"],
    "化学": ["化学", "应用化学", "化学工程"],
    "生物工程": ["生物工程", "生物技术", "生物制药"],
    "制药工程": ["制药工程", "制药"],
    "公共卫生": ["公共卫生", "预防医学"],
    "护理学": ["护理", "护理学"],
    "财务金融": ["财务", "金融", "会计", "经济学", "MBA", "EMBA"],
    "法律": ["法律", "法学", "律师资格"],
    "英语": ["英语", "CET-6", "CET6", "TEM", "雅思", "托福", "TOEFL", "IELTS"],
}


def _business_keywords(jd_name: str, jd_req: str) -> list[str]:
    """根据 JD 名称 / 要求挑出业务关键词（命中即用）"""
    text = (jd_name + " " + jd_req).lower()
    # 把 jd_name、req 切成短语
    ngrams = set(_extract_keywords(jd_name + " " + jd_req))

    out: list[str] = []
    # 1) 直接把 jd_name 和需求短语作为业务关键词（命中即加分）
    for ng in ngrams:
        if ng not in out:
            out.append(ng)
        if len(out) >= 15:
            break

    # 2) 业务词典匹配：把 jd_name 中出现的术语展开它的同义词到候选
    for term, syns in _BUSINESS_KW_GROUPS.items():
        if term in text or term in jd_name:
            for s in syns:
                if s not in out:
                    out.append(s)
                if len(out) >= 20:
                    break

    return out[:20]


def _parse_required_education(req: str) -> int:
    """从 '本科及以上' / '硕士及以上' 等描述中提取所需最低学历等级"""
    if "博士及以上" in req:
        return 4
    if "硕士及以上" in req or "研究生及以上" in req:
        return 3
    if "本科及以上" in req:
        return 2
    if "大专及以上" in req or "专科及以上" in req:
        return 1
    if "博士" in req:
        return 4
    if "硕士" in req or "研究生" in req:
        return 3
    if "本科" in req:
        return 2
    if "专科" in req or "大专" in req:
        return 1
    return 0


def _rank_to_label(rank: int) -> str:
    return {4: "博士", 3: "硕士", 2: "本科", 1: "专科"}.get(rank, "未知")


def _parse_required_years(req: str) -> float:
    m = re.search(r"(\d+)\s*年以上", req)
    if m:
        return float(m.group(1))
    m = re.search(r"(\d+)\s*-\s*(\d+)\s*年", req)
    if m:
        return float(m.group(1))
    return 0.0


def _parse_required_majors(req: str) -> list[str]:
    """从 JD 要求中提取专业要求关键词"""
    majors = []
    major_kws = [
        "临床医学", "医学", "药学", "药理学", "药剂学", "临床药学",
        "公共卫生", "护理", "护理学", "化学", "化学工程", "生物工程",
        "生物技术", "制药工程", "制药", "药事管理", "财务", "金融",
        "法律", "法学", "会计", "经济", "管理",
    ]
    for m in major_kws:
        if m in req and m not in majors:
            majors.append(m)
    # 去重：如果有"临床医学"就不单独列出"医学"
    if "临床医学" in majors:
        majors = [m for m in majors if m != "医学"]
    return majors[:5]


# ============================================================
# LLM 匹配
# ============================================================

def match_by_llm(cand: CandidateInfo, jd: JD, cfg: dict) -> MatchResult:
    """调用 OpenAI 兼容协议的大模型做语义匹配"""
    import requests

    if not cfg.get("api_key"):
        raise ValueError("LLM 已开启但未配置 API Key（请填 config.json → llm.api_key）")

    base = cfg.get("base_url", "https://api.openai.com/v1").rstrip("/")
    model = cfg.get("model", "gpt-4o-mini")
    headers = {
        "Authorization": f"Bearer {cfg['api_key']}",
        "Content-Type": "application/json",
    }

    sys_prompt = (
        "你是资深招聘评估专家。给定一个JD和一个候选人的简历，"
        "你需要判断该候选人是否值得推荐给HR。"
        "请严格只输出 JSON，不要输出任何其它文字或代码块标记。"
        "JSON 字段：\n"
        "  verdict: 必须是 '合适' | '待定' | '不合适' | '信息不足' 之一\n"
        "  score: 0-100 的整数\n"
        "  reason: 30字以内的中文判定理由\n"
        "  hits: list[string]，命中的关键条件（5-15字）\n"
        "  misses: list[string]，缺失或不达标的条件（5-15字）\n"
        "  ai_summary: 一句话评估，格式如'本科药学专业，相关经验8年，综合评分72分'；若有知名公司/团队管理/显著亮点，用分号追加（如'…；曾任职辉瑞，具备团队管理经验'），普通亮点不赘述\n"
        "  concerns: list[string]，简历注意点（5-15字）\n"
        "  重要约束：期望城市与JD城市不一致（异地）绝不能作为判定'不合适'或'待定'的依据；"
        "只要专业、经验、资质符合岗位硬性要求即可判'合适'。城市差异最多只能作为一条中性备注，不得影响 verdict。\n"
    )

    user_prompt = (
        f"## 岗位JD\n城市: {jd.city}\n岗位: {jd.name}\n\n"
        f"### 岗位职责\n{jd.description}\n\n"
        f"### 岗位要求\n{jd.requirements}\n\n"
        f"### 备注/筛选规则\n{jd.note or '无'}\n\n"
        f"## 候选人简历\n"
        f"姓名: {cand.name or '未识别'}\n"
        f"目前岗位: {cand.current_position or '未识别'}\n"
        f"目前公司: {cand.current_company or '未识别'}\n"
        f"期望城市: {cand.expected_city or '未识别'}\n"
        f"学历: {cand.education or '未识别'}\n"
        f"专业: {cand.major or '未识别'}\n"
        f"工作年限: {cand.years_of_experience if cand.years_of_experience >= 0 else '未识别'}\n"
        f"技能关键词: {','.join(cand.skills) or '无'}\n"
        f"简历正文:\n{cand.raw_text or '(空)'}\n"
    )

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": sys_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.1,
        "timeout": cfg.get("timeout_sec", 30),
    }

    resp = requests.post(
        f"{base}/chat/completions",
        headers=headers,
        json=payload,
        timeout=cfg.get("timeout_sec", 30),
    )
    resp.raise_for_status()
    data = resp.json()
    content = data["choices"][0]["message"]["content"].strip()

    # 兼容推理型模型（如 MiniMax-M2.7）：去掉 <think>...</think> 思考块
    if "</think>" in content:
        content = content.split("</think>", 1)[1].strip()

    # 去掉可能的代码块标记
    content = content.strip("`").strip()
    if content.startswith("json"):
        content = content[4:].strip()
    parsed = json.loads(content)
    result = MatchResult(
        verdict=parsed.get("verdict", "信息不足"),
        score=float(parsed.get("score", 0)),
        reason=str(parsed.get("reason", ""))[:200],
        hits=[str(h) for h in parsed.get("hits", [])][:10],
        misses=[str(m) for m in parsed.get("misses", [])][:10],
    )
    # LLM 直接输出的结构化评估（summary 已含特别亮点 + concerns）
    if parsed.get("ai_summary"):
        result.ai_assessment = {
            "summary": str(parsed.get("ai_summary", ""))[:220],
            "concerns": [str(c) for c in parsed.get("concerns", [])][:5],
        }
    return result


# ============================================================
# 入口
# ============================================================

def match(cand: CandidateInfo, jd: JD, llm_cfg: dict | None = None) -> MatchResult:
    if llm_cfg and llm_cfg.get("enabled") and llm_cfg.get("api_key"):
        try:
            result = match_by_llm(cand, jd, llm_cfg)
        except Exception as e:
            # LLM 失败时回退到规则
            result = match_by_rules(cand, jd)
            result.reason = "[LLM失败→已回退到规则] " + result.reason + f" ({e.__class__.__name__})"
    else:
        result = match_by_rules(cand, jd)

    # 构建两段式 AI 评估（规则版，不依赖 LLM API）
    # 若 LLM 已提供 ai_assessment 则保留，否则用规则版
    if not result.ai_assessment:
        try:
            result.ai_assessment = build_ai_assessment(cand, jd, result)
        except Exception:
            result.ai_assessment = {
                "summary": f"综合评分{int(round(result.score))}分",
                "concerns": result.misses[:3] or ["暂无"],
            }
    return result


if __name__ == "__main__":
    # 简单自测
    jd = JD(key="1.临床监查员CRA", seq="1", name="临床监查员CRA", city="全国",
            description="负责临床监查", requirements="本科及以上医学或药学；1-4年以上I期药物临床工作经验；ICH-GCP经验",
            note="1、没有CRA/监查经验的完全不考虑")
    cand = CandidateInfo(
        name="张三", current_position="临床监查员", current_company="某CRO",
        education="本科", major="药学", years_of_experience=3.0,
        skills=["CRA", "GCP"], raw_text="在XX公司担任临床监查员2年，熟悉ICH-GCP，参与多项III期临床试验")
    print(match(cand, jd))
