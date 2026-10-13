"""猎聘网企业端驱动（https://lpt.liepin.com）

职责：
  - 抓「收到简历 / 未处理」列表
  - 抓详情页候选人字段
  - 在页面上点「通过筛选 / 不合适」按钮
  - 解析 / 抓取 / 操作的所有 JS 字符串集中在此
"""
from __future__ import annotations

import time

# 列表页抓取 JS：抓 li[data-url] 卡片
LIEPIN_LIST_JS = r"""
(function() {
  // 猎聘「收到简历 / 未处理」真实结构：
  //   <ul> 下挂 <li class="...manager-resume-card-item-new resume-item-wrap-<hash>_<idx>">
  //   每条 li 带 data-url（详情页完整链接）与 data-applyid，卡片内无 <a> 标签。
  function getItemNodes() {
    var sels = [
      'li[class*="resume-item-wrap"]',
      'li[class*="manager-resume-card-item-new"]',
      'li[class*="resume-card-item"]',
      '.resume-item', '.candidate-item', '.apply-item'
    ];
    for (var i = 0; i < sels.length; i++) {
      var nodes = document.querySelectorAll(sels[i]);
      if (nodes && nodes.length) return Array.prototype.slice.call(nodes);
    }
    return [];
  }
  var nodes = getItemNodes();
  var items = nodes.slice(0, 50).map(function(el, i) {
    var detailUrl = el.getAttribute('data-url') || '';
    var applyId = el.getAttribute('data-applyid') || el.getAttribute('data-apply-id') || '';
    var text = (el.innerText || '').replace(/\s+/g, ' ').trim();
    return {
      idx: i,
      href: detailUrl,
      apply_id: applyId,
      text: text.substring(0, 600),
      classes: el.className
    };
  });
  return { items: items, total: nodes.length };
})();
"""


# 详情页抓取 JS：抽取候选人字段
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
  var name = (document.title||'').trim();
  if (!name) name = pickText(['[class*="user-name"]','.resume-name','.name-box .name','h1.name','[class*="candidate-name"]']);
  var cityList = ['上海','北京','广州','深圳','珠海','杭州','南京','成都','武汉','西安','苏州','天津','重庆','青岛','厦门','宁波','合肥','郑州','沈阳','大连','济南','福州','南昌','昆明','贵阳','南宁','海口','兰州','太原','石家庄','哈尔滨','长春','呼和浩特','乌鲁木齐','银川','西宁','拉萨','长沙','无锡','常州','佛山','东莞','中山','惠州','嘉兴','绍兴','金华','台州','温州','烟台','潍坊','南通','徐州','唐山','扬州','湖州','洛阳','南阳','襄阳','宜昌','衡阳','岳阳','绵阳','德阳','遵义','包头','大庆','宁德','赣州','上饶','宜春','九江','汕头','湛江','柳州','桂林','三亚','泸州','宜宾','南充','宝鸡','天水',
  '镇江','淮安','盐城','泰州','连云港','宿迁','舟山','衢州','丽水','马鞍山','芜湖','蚌埠','安庆','黄山','阜阳','宿州','六安','亳州','池州','宣城','泉州','莆田','漳州','三明','南平','龙岩','景德镇','萍乡','新余','鹰潭','吉安','抚州','淄博','枣庄','东营','济宁','泰安','威海','日照','临沂','德州','聊城','滨州','菏泽','开封','平顶山','安阳','新乡','焦作','许昌','漯河','商丘','周口','驻马店','信阳','黄石','十堰','荆州','荆门','孝感','黄冈','咸宁','随州','湘潭','邵阳','常德','益阳','郴州','永州','怀化','娄底','江门','肇庆','梅州','汕尾','河源','阳江','清远','潮州','揭阳','云浮','茂名','韶关','北海','钦州','贵港','玉林','自贡','攀枝花','广元','遂宁','内江','乐山','眉山','广安','达州','雅安','资阳','安顺','毕节','铜仁','曲靖','玉溪','咸阳','渭南','延安','汉中','榆林','保定','廊坊','邯郸','秦皇岛','沧州','衡水','邢台','张家口','承德','大同','阳泉','临汾','运城','赤峰','通辽','鄂尔多斯','鞍山','抚顺','本溪','丹东','锦州','营口','盘锦','吉林','四平','通化','齐齐哈尔','牡丹江','佳木斯'];
  // ---- 期望城市：只从详情页「求职意向」段抓取 ----
  // 猎聘详情页「求职意向」块结构：求职意向 / 期望职位 / 期望薪资 / 期望城市 / 期望行业
  // 严禁回退到"按 cityList 顺序全文搜索"——那会把正文里工作经历/项目所在的城市
  // （如某段经历在北京的医院）误当成期望城市。取不到就留空。
  var expectedCity = '';
  var _ji = full.indexOf('求职意向');
  if (_ji >= 0) {
    var _seg = full.substring(_ji, _ji + 160);
    // 期望城市通常排在「期望薪资」之后；有薪资则从薪资之后开始找，避免误取期望职位名里带的城市
    var _searchSeg = _seg;
    var _payM = _seg.match(/[\d.]+\s*[-~至]\s*[\d.]+\s*(?:千|万|k|K)/i);
    if (_payM && _payM.index >= 0) { _searchSeg = _seg.substring(_payM.index + _payM[0].length); }
    // 在窗口内取「位置最靠前」的城市（而非按 cityList 名单顺序）
    var _bestIdx = -1, _bestCity = '';
    for (var _i = 0; _i < cityList.length; _i++) {
      var _idx = _searchSeg.indexOf(cityList[_i]);
      if (_idx >= 0 && (_bestIdx < 0 || _idx < _bestIdx)) { _bestIdx = _idx; _bestCity = cityList[_i]; }
    }
    // 薪资之后没找到，退回整个「求职意向」窗口再找一次
    if (!_bestCity && _searchSeg !== _seg) {
      _bestIdx = -1;
      for (var _j = 0; _j < cityList.length; _j++) {
        var _idx2 = _seg.indexOf(cityList[_j]);
        if (_idx2 >= 0 && (_bestIdx < 0 || _idx2 < _bestIdx)) { _bestIdx = _idx2; _bestCity = cityList[_j]; }
      }
    }
    if (/(全国|不限)/.test(_searchSeg.substring(0, 40))) { expectedCity = '全国'; }
    else if (_bestCity) { expectedCity = _bestCity; }
  }
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
  function looksLikeEntity(s){
    if(!s) return false;
    s = s.trim();
    if(s.length > 50) return false;
    if(/[：；。！？、]/.test(s)) return false;
    if(/^\d+[、.．]/.test(s)) return false;
    if(/(本人|本人于|我本人|我的|我于)/.test(s)) return false;
    if(/(公司|集团|研究院?|研究所|中心|科技|医药|制药|生物|大学|学院|医院|银行|保险|证券|有限|股份|工厂|药厂|局|部门|站|协会|事务所|管委会|实验室)/.test(s)) return true;
    if(/(经理|总监|主管|专员|工程师|代表|顾问|科学家|研究员|助理|总裁|总经理|主任|科长|部长|CRA|CRC|PM|SPM|负责人|BP|分析师|出纳|会计|医师|药师)/i.test(s)) return true;
    return s.length <= 20;
  }
  var DATE_RE = /^\s*\d{4}[\.\-\/]\d{1,2}\s*[-~至到]\s*(\d{4}[\.\-\/]\d{1,2}|至今|现在|今)/;
  function parseWorkExps(text){
    var headers = ['工作经历','工作信息','工作经验','主要工作经历','职业经历','工作履历'];
    var workText = text;
    for (var h=0; h<headers.length; h++){
      var re = new RegExp(headers[h] + '\\s*([\\s\\S]*?)(教育经历|项目经历|在校经历|自我评价|技能培训|语言能力|个人技能|证书|基本信息|个人优势|$)');
      var mm = text.match(re);
      if(mm){ workText = mm[1]; break; }
    }
    var lines = workText.split(/\n/).map(function(x){return x.trim();}).filter(function(x){return x;});
    var blocks = [], cur = [];
    for (var i=0;i<lines.length;i++){
      if(DATE_RE.test(lines[i]) && cur.length){ blocks.push(cur.join('\n')); cur=[]; }
      cur.push(lines[i]);
    }
    if(cur.length) blocks.push(cur.join('\n'));
    if(blocks.length===0){
      blocks = workText.split(/\n\s*\n+/).map(function(b){return b.trim();}).filter(function(b){return b;});
    }
    var noiseRe = /查看全部|展开全部|收起|更多|加载|暂无|该段经历来自附件|未填写职责业绩|已整合附件简历|索要简历后可查看|该用户未填写|^(今天|昨天|前天|\d{1,2}天前)|应聘职位|期望城市|期望薪资|目前薪资|求职状态|到岗时间|所在行业|联系方式|手机号码|邮箱/;
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
      var parts = splitParts(nonTime[0]);
      if(parts){
        company = cleanBracket(parts[0]);
        if(parts.length>1) position = cleanBracket(parts[1]);
      } else {
        company = cleanBracket(nonTime[0]||'');
        if(nonTime.length>1) position = cleanBracket(nonTime[1]||'');
      }
      if(!looksLikeEntity(company)) company='';
      if(!looksLikeEntity(position)) position='';
      if(company||position) exps.push({company: company, position: position, period: period, raw: b});
    }
    return exps;
  }
  var workExps = parseWorkExps(full);
  var firstExp = workExps[0] || {};
  var currentPosition = firstExp.position || '';
  var currentCompany = firstExp.company || '';
  if(!currentCompany || !currentPosition){
    var m = full.match(/(?:目前任职于|目前就职于|现就职于|任职于|就职于|目前于)\s*([^\s，,。；;]+?)\s*[,，]\s*([^\s，,。；;]+?)(?:[，,。；;]|$)/);
    if(m){
      if(!currentCompany && looksLikeEntity(m[1])) currentCompany = m[1];
      if(!currentPosition && looksLikeEntity(m[2])) currentPosition = m[2];
    }
  }
  var eduBlocks = pickAll(['[class*="education"] li','.resume-education li','.education-item','[class*="edu"] li']);
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


# 操作按钮 JS：按文字找按钮（精确优先 → 包含兜底）
LIEPIN_FIND_AND_CLICK_JS = r"""
(function(texts, doClick){
  const nodes = Array.from(document.querySelectorAll(
    'button, a[role="button"], a[class*="btn"], span[class*="btn"], div[class*="btn"], li[class*="btn"]'
  ));
  let exact = null, partial = null;
  for (const el of nodes){
    const t = (el.innerText || el.textContent || '').replace(/\s+/g,' ').trim();
    if (!t || t.length > 16) continue;
    if (!exact){
      for (const k of texts){ if (t === k){ exact = el; break; } }
    }
    if (!partial){
      for (const k of texts){ if (t.indexOf(k) >= 0){ partial = el; break; } }
    }
    if (exact) break;
  }
  const target = exact || partial;
  if (!target){
    return {found:false};
  }
  const res = {
    found:true,
    text:(target.innerText || target.textContent || '').trim(),
    exact: !!exact,
    tag: target.tagName.toLowerCase()
  };
  if (doClick){
    try { target.click(); res.clicked = true; }
    catch(e){ res.clicked = false; res.error = e.toString(); }
  } else {
    res.clicked = false;
    res.dryRun = true;
  }
  return res;
})
"""


# 诊断 JS：探页面选择器命中
LIEPIN_DIAGNOSE_JS = r"""
(function(){
  function cnt(sel){ try { return document.querySelectorAll(sel).length; } catch(e){ return -1; } }
  var sels = ['.resume-item','.candidate-item','.apply-item','.apply-list-item',
    '.position-apply-item','.resume-card','.list-item','[data-resume-id]',
    '[data-candidate-id]','[data-id]','li[class*="resume"]','li[class*="apply"]',
    'li[class*="item"]','div[class*="resume"]','div[class*="apply"]','div[class*="item"]',
    'a[href*="resume"]','a[href*="candidate"]','a[href*="apply"]'];
  var hits = {};
  sels.forEach(function(s){ var c = cnt(s); if (c > 0) hits[s] = c; });
  var body = (document.body && document.body.innerText) ? document.body.innerText : '';
  var links = [];
  try {
    links = Array.prototype.slice.call(document.querySelectorAll('a[href]'))
      .filter(function(a){ return /resume|candidate|apply|position/i.test(a.href); })
      .slice(0, 12).map(function(a){ return a.href; });
  } catch(e) {}
  return {
    url: location.href,
    title: document.title,
    bodyLen: body.length,
    bodyHead: body.substring(0, 600),
    selectorHits: hits,
    resumeLikeLinks: links
  };
})()
"""


class LiepinDriver:
    """猎聘网企业端驱动"""

    code = "liepin"
    display_name = "猎聘网"
    url_match = "liepin.com"
    stream_top = False
    LIST_URL = "https://lpt.liepin.com/resume/apply"

    def is_at_list_page(self, url: str) -> bool:
        return "resume/apply" in (url or "").lower()

    def acquire_tab(self, cdp, emit) -> tuple:
        """获取一个猎聘'收到简历'页面 tab。找不到时自动新建"""
        target_url = self.LIST_URL
        tabs = [t for t in cdp.list_tabs() if self.url_match in (t.url or "").lower()]
        if tabs:
            for t in tabs:
                if self.is_at_list_page(t.url or ""):
                    emit("info", f"已连接（简历列表页）：{t.title} | {t.url}")
                    return t, t.url
            emit("warn",
                 f"已连接猎聘页（但似乎不是简历列表）：{tabs[0].title} | {tabs[0].url}；"
                 f"若扫描到 0 份，请在该 Chrome 切到「收到简历 → 未处理」页面")
            return tabs[0], tabs[0].url

        emit("warn", f"未找到猎聘页面，正在自动打开 {target_url} ...")
        try:
            cdp.create_target(target_url)
        except Exception as e:
            raise ConnectionError(
                f"自动打开猎聘页面失败：{e}。请手动打开 {target_url} 后再扫描"
            )
        deadline = time.time() + 18
        tab = None
        while time.time() < deadline:
            time.sleep(0.6)
            for t in [x for x in cdp.list_tabs() if self.url_match in (x.url or "").lower()]:
                if self.is_at_list_page(t.url or "") or "about:" not in (t.url or "").lower():
                    tab = t
                    break
            if tab:
                break
        if not tab:
            raise ConnectionError(
                f"自动打开猎聘页面超时，请手动打开 Chrome 并访问 {target_url} 后再扫描。"
            )
        time.sleep(2)
        return tab, (tab.url if tab else "")

    def navigate_to_list_if_needed(self, cdp, current_url: str, emit):
        """若不在列表页，导航回去"""
        if self.is_at_list_page(current_url or ""):
            return
        emit("info", {"message": "当前不在简历列表页，正在导航到列表页..."})
        cdp.send("Page.navigate", {"url": self.LIST_URL})
        for _ in range(30):
            time.sleep(0.5)
            try:
                if cdp.evaluate("document.readyState") == "complete":
                    break
            except Exception:
                continue
        time.sleep(2)

    def wait_for_spa(self, cdp):
        """等 SPA 异步加载完成"""
        for _ in range(40):
            time.sleep(0.5)
            try:
                if cdp.evaluate("document.readyState") == "complete":
                    break
            except Exception:
                continue
        time.sleep(3)

    def fetch_list(self, cdp) -> dict:
        return cdp.evaluate(LIEPIN_LIST_JS, timeout=30) or {"items": [], "total": 0}

    def diagnostics_probe_js(self) -> str:
        return LIEPIN_DIAGNOSE_JS

    def open_detail(self, cdp, item, wait_ms: int = 1500) -> str:
        """打开详情页（list 中已带 href），等待 DOM 更新；返回跳转后地址栏的最终 URL"""
        cdp.send("Page.navigate", {"url": item.href})
        for _ in range(30):
            time.sleep(0.5)
            try:
                ready = cdp.evaluate("document.readyState")
                if ready == "complete":
                    break
            except Exception:
                continue
        time.sleep(wait_ms / 1000.0)
        try:
            final_url = cdp.evaluate("location.href")
            if isinstance(final_url, str) and final_url.startswith("http"):
                return final_url
        except Exception:
            pass
        return item.href

    def fetch_detail(self, cdp) -> dict:
        return cdp.evaluate(LIEPIN_DETAIL_JS, timeout=30) or {}

    def apply_action(self, cdp, verdict: str, cfg: dict, dry_run: bool, item=None) -> dict:
        """在猎聘详情页上点「通过筛选 / 不合适」"""
        import json as _json
        aa = cfg.get("auto_action", {}) or {}
        reject_texts = aa.get("button_reject_texts") or ["不合适"]
        pass_texts = aa.get("button_pass_texts") or ["通过筛选", "通过"]
        confirm_texts = aa.get("confirm_texts") or ["确认", "确定", "提交", "是"]

        if verdict == "不合适":
            action, texts = "不合适", reject_texts
        else:
            action, texts = "通过筛选", pass_texts

        res = self._call(cdp, texts, do_click=not dry_run, timeout=12)
        if not res.get("found"):
            return {
                "ok": False, "action": action, "dry_run": dry_run,
                "reason": "button_not_found", "searched": texts,
            }
        if dry_run:
            return {
                "ok": True, "dry_run": True, "action": action,
                "matched": res.get("text"), "exact": res.get("exact"),
            }
        if not res.get("clicked"):
            return {
                "ok": False, "action": action, "dry_run": False,
                "reason": "click_failed", "matched": res.get("text"),
                "error": res.get("error"),
            }
        time.sleep(0.9)
        modal = self._call(cdp, confirm_texts, do_click=True, timeout=6)
        modal_confirmed = bool(modal.get("found") and modal.get("clicked"))
        return {
            "ok": True, "action": action, "dry_run": False,
            "matched": res.get("text"),
            "modal": {
                "confirmed": modal_confirmed,
                "text": modal.get("text") if modal_confirmed else None,
            },
        }

    def _call(self, cdp, texts, do_click: bool, timeout: float = 12) -> dict:
        import json as _json
        js = LIEPIN_FIND_AND_CLICK_JS + "(" + _json.dumps(texts, ensure_ascii=False) + (",true)" if do_click else ",false)")
        try:
            return cdp.evaluate(js, timeout=timeout) or {}
        except Exception as e:
            return {"found": False, "error": str(e)}
