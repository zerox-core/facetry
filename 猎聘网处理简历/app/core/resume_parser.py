"""简历解析：从猎聘企业端页面 DOM 抽取候选人字段。

设计原则：
  - 多种选择器 fallback，命中即用
  - 容错性优先：抓不到字段就空，绝不抛错
  - 抽出"全部可见文本"作为 raw_text（关键词匹配 + LLM 共用）
"""
from __future__ import annotations

import re
from typing import Any

from .jd_matcher import CandidateInfo


# 注：基于猎聘企业端 https://lpt.liepin.com/resume/apply 的常见结构。
# 真实结构如不同，会在 diagnose 模式输出，再调整。
# 选择器策略：列表页用 .resume-item；详情页用 [class*=resume-detail] / .resume-detail

LIEPIN_DETAIL_JS = r"""
(function() {
  function pickText(sels){
    for (var i=0;i<sels.length;i++){
      var el = document.querySelector(sels[i]);
      if (el && el.innerText && el.innerText.trim()) return el.innerText.trim();
    }
    return '';
  }
  function pickAll(sels){
    for (var i=0;i<sels.length;i++){
      var nodes = document.querySelectorAll(sels[i]);
      var out=[];
      for (var j=0;j<nodes.length;j++){ var t=(nodes[j].innerText||'').trim(); if(t) out.push(t); }
      if (out.length) return out;
    }
    return [];
  }
  var full = (document.body && document.body.innerText) ? document.body.innerText : '';
  // 姓名：详情页标题最干净（如「何睿雪」），回退到 user-name 元素
  var name = (document.title||'').trim();
  if (!name) name = pickText(['[class*="user-name"]','.resume-name','.name-box .name','h1.name','[class*="candidate-name"]']);
  // 期望城市：正文里匹配常见城市名（命中第一个）
  var cityList = ['上海','北京','广州','深圳','珠海','杭州','南京','成都','武汉','西安','苏州','天津','重庆','青岛','厦门','宁波','合肥','郑州','沈阳','大连','济南','福州','南昌','昆明','贵阳','南宁','海口','兰州','太原','石家庄','哈尔滨','长春','呼和浩特','乌鲁木齐','银川','西宁','拉萨','长沙','无锡','常州','佛山','东莞','中山','惠州','嘉兴','绍兴','金华','台州','温州','烟台','潍坊','南通','徐州','唐山','扬州','湖州','洛阳','南阳','襄阳','宜昌','衡阳','岳阳','绵阳','德阳','遵义','包头','大庆','宁德','赣州','上饶','宜春','九江','汕头','湛江','柳州','桂林','三亚','泸州','宜宾','南充','宝鸡','天水'];
  var expectedCity = '';
  // 优先从"期望城市"字段精确提取（避免把公司所在地误当成期望城市）
  var cityFieldRe = /(?:期望城市|意向城市|期望工作地|期望地区|期望地点|期望工作城市|期望城市及地区)[:：\s]*([^\n，,。；;]{1,30})/;
  var _cfm = full.match(cityFieldRe);
  if (_cfm) {
    var _cfv = _cfm[1].trim();
    if (/(不限|全国)/.test(_cfv)) { expectedCity = '全国'; }
    else {
      _cfv = _cfv.replace(/(不限|全国|暂无|未知|无).*$/, '').trim();
      for (var i=0;i<cityList.length;i++){ if (_cfv.indexOf(cityList[i])!==-1){ expectedCity = _cfv; break; } }
      if (!expectedCity) expectedCity = _cfv;  // 兜底：原样保留（如"武汉、宜昌"未命中名单）
    }
  }
  // 兜底：正文第一个出现的城市（仅当未提取到明确期望城市时）
  if (!expectedCity) {
    for (var i=0;i<cityList.length;i++){ if (full.indexOf(cityList[i])!==-1){ expectedCity=cityList[i]; break; } }
  }
  // 工作经历解析：从正文"工作经历"段结构化提取（公司/职位/时间段）
  function splitParts(s){
    var seps = [' | ', ' · ', ' - ', '/', '｜', '｜ '];
    for (var i=0;i<seps.length;i++){
      if(s.indexOf(seps[i])!==-1){
        var ps = s.split(seps[i]).map(function(x){return x.trim();}).filter(function(x){return x;});
        if(ps.length>=2) return ps;
      }
    }
    return null;
  }
  function cleanBracket(s){ return (s||'').replace(/[（(].*$/, '').replace(/[）)].*$/,'').trim(); }
  // 实体校验：公司名/职位应是短文本，不能是长句正文
  function looksLikeEntity(s){
    if(!s) return false;
    s = s.trim();
    if(s.length > 50) return false;                                  // 过长必是正文
    if(/[：；。！？、]/.test(s)) return false;                        // 含列举/句末标点 → 正文
    if(/^\d+[、.．]/.test(s)) return false;                          // "1、" 编号列表 → 正文
    if(/(本人|本人于|我本人|我的|我于)/.test(s)) return false;       // 第一人称开头 → 正文
    // 正向信号：含机构/职位特征词，直接判定为实体
    if(/(公司|集团|研究院?|研究所|中心|科技|医药|制药|生物|大学|学院|医院|银行|保险|证券|有限|股份|工厂|药厂|局|部门|站|协会|事务所|管委会|实验室)/.test(s)) return true;
    if(/(经理|总监|主管|专员|工程师|代表|顾问|科学家|研究员|助理|总裁|总经理|主任|科长|部长|CRA|CRC|PM|SPM|负责人|BP|分析师|出纳|会计|医师|药师)/i.test(s)) return true;
    // 无正向信号但也不像正文（较短）→ 仍接受为候选实体
    return s.length <= 20;
  }
  var DATE_RE = /^\s*\d{4}[\.\-\/]\d{1,2}\s*[-~至到]\s*(\d{4}[\.\-\/]\d{1,2}|至今|现在|今)/;
  function parseWorkExps(text){
    // 1. 定位工作经历段落（兼容多种标题写法）
    var headers = ['工作经历','工作信息','工作经验','主要工作经历','职业经历','工作履历'];
    var workText = text;
    for (var h=0; h<headers.length; h++){
      var re = new RegExp(headers[h] + '\\s*([\\s\\S]*?)(教育经历|项目经历|在校经历|自我评价|技能培训|语言能力|个人技能|证书|基本信息|个人优势|$)');
      var mm = text.match(re);
      if(mm){ workText = mm[1]; break; }
    }
    // 2. 按日期段切块
    var lines = workText.split(/\n/).map(function(x){return x.trim();}).filter(function(x){return x;});
    var blocks = [], cur = [];
    for (var i=0;i<lines.length;i++){
      if(DATE_RE.test(lines[i]) && cur.length){ blocks.push(cur.join('\n')); cur=[]; }
      cur.push(lines[i]);
    }
    if(cur.length) blocks.push(cur.join('\n'));
    if(blocks.length===0){
      // 整段就是一段，或没有日期：按空行切
      blocks = workText.split(/\n\s*\n+/).map(function(b){return b.trim();}).filter(function(b){return b;});
    }
    // 噪音行过滤：UI按钮、提示语、简历元信息
    var noiseRe = /查看全部|展开全部|收起|更多|加载|暂无|该段经历来自附件|未填写职责业绩|已整合附件简历|索要简历后可查看|该用户未填写|^(今天|昨天|前天|\d{1,2}天前)|应聘职位|期望城市|期望薪资|目前薪资|求职状态|到岗时间|所在行业|联系方式|手机号码|邮箱/;
    // 栏目标题（整块仅为某个简历栏目名时跳过，避免被当成公司/职位）
    var headerRe = /^(个人优势|自我评价|教育经历|项目经历|在校经历|基本技能|语言能力|荣誉奖励?|证书|兴趣爱好|自我介绍|个人评价|求职意向|工作经历|工作信息|工作经验|职业经历|工作履历)\s*$/;
    var exps = [];
    for (var bi=0; bi<blocks.length; bi++){
      var b = blocks[bi].trim();
      if(!b) continue;
      var blines = b.split('\n').map(function(x){return x.trim();}).filter(function(x){return x;});
      if(!blines.length) continue;
      if(headerRe.test(blines[0])) continue;
      if(noiseRe.test(blines.join(' '))) continue;
      var period = '';
      for (var li=0; li<blines.length; li++){
        if(DATE_RE.test(blines[li])){ period = blines[li]; break; }
      }
      var nonTime = blines.filter(function(l){ return !DATE_RE.test(l) && !noiseRe.test(l); });
      if(!nonTime.length) continue;
      var company='', position='';
      // 同行分隔：优先取第一段=公司，第二段=职位
      var parts = splitParts(nonTime[0]);
      if(parts){
        company = cleanBracket(parts[0]);
        if(parts.length>1) position = cleanBracket(parts[1]);
      } else {
        company = cleanBracket(nonTime[0]||'');
        if(nonTime.length>1) position = cleanBracket(nonTime[1]||'');
      }
      // 拒绝把正文段落当成公司/职位
      if(!looksLikeEntity(company)) company='';
      if(!looksLikeEntity(position)) position='';
      if(company||position) exps.push({company: company, position: position, period: period, raw: b});
    }
    return exps;
  }
  var workExps = parseWorkExps(full);
  // 目前岗位/目前公司 = 工作经历第一段（最新一段）
  var firstExp = workExps[0] || {};
  var currentPosition = firstExp.position || '';
  var currentCompany = firstExp.company || '';
  // 兜底：若工作经历整段没解析出来，从全文找"目前任职/就职/于"模式
  if(!currentCompany || !currentPosition){
    var m = full.match(/(?:目前任职于|目前就职于|现就职于|任职于|就职于|目前于)\s*([^\s，,。；;]+?)\s*[,，]\s*([^\s，,。；;]+?)(?:[，,。；;]|$)/);
    if(m){
      if(!currentCompany && looksLikeEntity(m[1])) currentCompany = m[1];
      if(!currentPosition && looksLikeEntity(m[2])) currentPosition = m[2];
    }
  }
  // 教育
  var eduBlocks = pickAll(['[class*="education"] li','.resume-education li','.education-item','[class*="edu"] li']);
  // 工作经历
  var expBlocks = pickAll(['[class*="work-exp"] li','.work-experience-item','.resume-work li','[class*="experience"] li','.work-list li']);
  return {
    name: name,
    current_position: currentPosition,
    current_company: currentCompany,
    expected_city: expectedCity,
    education_block: eduBlocks.join(' | '),
    work_exps: workExps,
    experience_blocks: [],
    full_text: full.substring(0, 8000),
    url: location.href,
    title: document.title
  };
})();
"""


LIEPIN_LIST_JS = r"""
(function() {
  function getItemNodes() {
    var sels = [
      'li[class*="resume-item-wrap"]',
      'li[class*="manager-resume-card-item-new"]',
      'li[class*="resume-card-item"]',
      '.resume-item', '.candidate-item', '.apply-item'
    ];
    for (var i=0;i<sels.length;i++){
      var nodes = document.querySelectorAll(sels[i]);
      if (nodes && nodes.length) return Array.prototype.slice.call(nodes);
    }
    return [];
  }
  var nodes = getItemNodes();
  var items = nodes.slice(0,50).map(function(el, i){
    var detailUrl = el.getAttribute('data-url') || '';
    var applyId = el.getAttribute('data-applyid') || el.getAttribute('data-apply-id') || '';
    var text = (el.innerText || '').replace(/\s+/g,' ').trim();
    return {
      idx: i,
      href: detailUrl,
      text: text.substring(0, 600),
      classes: el.className,
      dataId: applyId
    };
  });
  return { items: items, total: nodes.length };
})();
"""


def parse_detail_js(cand_data: dict) -> CandidateInfo:
    """从 JS 抓到的 detail 字典构造 CandidateInfo"""
    name = (cand_data.get("name") or "").strip()
    current_position = (cand_data.get("current_position") or "").strip()
    current_company = (cand_data.get("current_company") or "").strip()
    expected_city = (cand_data.get("expected_city") or "").strip()
    edu_block = cand_data.get("education_block") or ""
    full_text = cand_data.get("full_text") or ""
    # 定版微调：候选人无工作经历时，目前岗位/目前公司强制留空，不兜底误填
    if cand_data.get("has_work_exp") is False:
        current_position = ""
        current_company = ""

    # 工作经历：优先用 JS 结构化结果
    work_experience = cand_data.get("work_exps") or []
    if not work_experience:
        for blk in (cand_data.get("experience_blocks") or [])[:5]:
            work_experience.append({"raw": blk})

    # 兜底：若 JS 没抓到 current_company 但有工作经历，取第一条公司名
    if not current_company and work_experience:
        first_company = (work_experience[0].get("company") or "").strip()
        if first_company:
            current_company = first_company
    # 兜底：若没抓到 current_position 但有工作经历，取第一条职位
    if not current_position and work_experience:
        first_pos = (work_experience[0].get("position") or "").strip()
        if first_pos:
            current_position = first_pos

    # 解析学历
    education = _parse_education(edu_block + " " + full_text)
    major = _parse_major(edu_block)

    # 解析工作年限 - 优先从全文里找
    yoe = _parse_years(full_text)

    # 提取简历正文关键词（技能）
    skills = _extract_skills(full_text)

    return CandidateInfo(
        name=name,
        current_position=current_position,
        current_company=current_company,
        expected_city=expected_city,
        education=education,
        major=major,
        years_of_experience=yoe,
        skills=skills,
        work_experience=work_experience,
        raw_text=full_text,
        resume_html=cand_data.get("full_text", ""),
    )


def parse_list_items(items: list[dict]) -> list[dict]:
    """从 list DOM 中预提取每项的（链接 + 简短文本）"""
    out = []
    for it in items:
        out.append({
            "href": it.get("href") or "",
            "preview": it.get("text", ""),
            "data_id": it.get("dataId", ""),
        })
    return out


# -------- 字段解析工具 --------

def _split_position_company(s: str) -> tuple[str, str]:
    """ '某CRO公司 临床监查员' → ('临床监查员', '某CRO公司') """
    if not s:
        return "", ""
    # 中文常见分隔：'|'、'/'、'-'、空格
    for sep in ["|", " - ", "-", "/", "    "]:
        if sep in s:
            parts = [p.strip() for p in s.split(sep) if p.strip()]
            if len(parts) >= 2:
                # 启发：一般前面是公司，后面是岗位
                return parts[-1], parts[0]
    return s, ""


_EDU_KW = ["博士", "硕士", "研究生", "本科", "专科", "大专"]


def _parse_education(text: str) -> str:
    if not text:
        return ""
    for kw in _EDU_KW:
        if kw in text:
            return kw
    return ""


_MAJOR_KW = [
    "医学", "药学", "护理", "临床", "公共卫生", "化学", "生物", "化学工程",
    "制药工程", "化工", "化学工程与工艺", "MBA", "EMBA", "计算机", "软件工程",
    "电子", "机械", "金融", "经济", "管理", "会计", "法律"
]


def _parse_major(text: str) -> str:
    if not text:
        return ""
    for m in _MAJOR_KW:
        if m in text:
            return m
    return ""


def _parse_years(text: str) -> float:
    if not text:
        return -1.0
    # 1) "X 年经验"
    m = re.search(r"(\d{1,2})\s*年(?:以上)?(?:经验|工作经历|工作经验|从医|相关)?", text)
    if m:
        return float(m.group(1))
    return -1.0


_SKILL_KW = [
    "GCP", "ICH-GCP", "CRA", "CRC", "SSU", "FDA", "EMA", "NMPA", "GMP",
    "PK", "PopPK", "PK/PD", "SAS", "R语言", "Python", "Excel", "Word", "PPT",
    "PowerPoint", "SQL", "Tableau", "PowerBI", "数据建模", "统计分析",
    "SOP", "药物警戒", "PV", "注册申报", "临床试验", "伦理审查", "机构立项",
    "受试者招募", "监查报告", "审计", "认证", "合规", "工艺优化",
    "发酵", "提取", "纯化", "菌种选育", "杂质", "收率",
]


def _extract_skills(text: str) -> list[str]:
    if not text:
        return []
    out = []
    for k in _SKILL_KW:
        if k in text and k not in out:
            out.append(k)
    return out[:12]


if __name__ == "__main__":
    # 演示
    sample = {
        "name": "张三",
        "current_position": "某CRO | 临床监查员",
        "expected_city": "北京",
        "education_block": "中国药科大学 | 本科 | 药学 | 2015-2019",
        "full_text": "张三 男 30岁 北京 期望：医药 期望薪资：20K 本科 中国药科大学 5年工作经验 CRA GCP SSU 临床监查员 SSU专员 监查员",
        "experience_blocks": [
            "2019.07-至今 XX医药 临床监查员 负责III期临床监查",
            "2017.07-2019.06 YY医院 实习 CRC",
        ],
    }
    cand = parse_detail_js(sample)
    print(cand)
    print("edu:", cand.education, "yoe:", cand.years_of_experience, "skills:", cand.skills)
