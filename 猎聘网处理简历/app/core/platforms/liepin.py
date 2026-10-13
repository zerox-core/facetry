"""猎聘网企业端驱动（https://lpt.liepin.com）

职责：
  - 抓「收到简历 / 未处理」列表
  - 抓详情页候选人字段
  - 在页面上点「通过筛选 / 不合适」按钮
  - 解析 / 抓取 / 操作的所有 JS 字符串集中在此
"""
from __future__ import annotations

import json
import random
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
  var cityList = ['上海','北京','广州','深圳','珠海','杭州','南京','成都','武汉','西安','苏州','天津','重庆','青岛','厦门','宁波','合肥','郑州','沈阳','大连','济南','福州','南昌','昆明','贵阳','南宁','海口','兰州','太原','石家庄','哈尔滨','长春','呼和浩特','乌鲁木齐','银川','西宁','拉萨','长沙','无锡','常州','佛山','东莞','中山','惠州','嘉兴','绍兴','金华','台州','温州','烟台','潍坊','南通','徐州','唐山','扬州','湖州','洛阳','南阳','襄阳','宜昌','衡阳','岳阳','绵阳','德阳','遵义','包头','大庆','宁德','赣州','上饶','宜春','九江','汕头','湛江','柳州','桂林','三亚','泸州','宜宾','南充','宝鸡','天水'];
  var expectedCity = '';
  var cityFieldRe = /(?:期望城市|意向城市|期望工作地|期望地区|期望地点|期望工作城市|期望城市及地区)[:：\s]*([^\n，,。；;]{1,30})/;
  var _cfm = full.match(cityFieldRe);
  if (_cfm) {
    var _cfv = _cfm[1].trim();
    if (/(不限|全国)/.test(_cfv)) { expectedCity = '全国'; }
    else {
      _cfv = _cfv.replace(/(不限|全国|暂无|未知|无).*$/, '').trim();
      for (var i=0;i<cityList.length;i++){ if (_cfv.indexOf(cityList[i])!==-1){ expectedCity = _cfv; break; } }
      if (!expectedCity) expectedCity = _cfv;
    }
  }
  if (!expectedCity) {
    for (var i=0;i<cityList.length;i++){ if (full.indexOf(cityList[i])!==-1){ expectedCity=cityList[i]; break; } }
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


# 按文字定位按钮并返回其在视口中的矩形（先 scrollIntoView 到可视区）。
# 返回 {found, text, exact, rect:{x,y,width,height}}，供真实鼠标点击使用。
LIEPIN_FIND_RECT_JS = r"""
(function(texts){
  function rectOf(el){ var r = el.getBoundingClientRect(); return {x:r.x, y:r.y, width:r.width, height:r.height}; }
  var nodes = Array.prototype.slice.call(document.querySelectorAll(
    'button, a[role="button"], a[class*="btn"], span[class*="btn"], div[class*="btn"], li[class*="btn"]'
  ));
  var exact = null, partial = null;
  for (var i = 0; i < nodes.length; i++){
    var el = nodes[i];
    var t = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
    if (!t || t.length > 16) continue;
    if (!exact){ for (var k = 0; k < texts.length; k++){ if (t === texts[k]){ exact = el; break; } } }
    if (!partial){ for (var k = 0; k < texts.length; k++){ if (t.indexOf(texts[k]) >= 0){ partial = el; break; } } }
    if (exact) break;
  }
  var target = exact || partial;
  if (!target) return {found:false};
  // 必须强制 instant 瞬间滚动：若站点设了 CSS scroll-behavior:smooth，
  // 平滑滚动下紧接着读 getBoundingClientRect() 会拿到滚动「前」的旧坐标，
  // 真实鼠标就会点到错误位置（表现为"点了但页面毫无反应"）。
  try { target.scrollIntoView({block:'center', behavior:'instant'}); }
  catch(e){ try { target.scrollIntoView({block:'center'}); } catch(e2){} }
  var rr = target.getBoundingClientRect();
  return {
    found:true,
    text:(target.innerText || target.textContent || '').trim(),
    exact:!!exact,
    rect:{x:rr.x, y:rr.y, width:rr.width, height:rr.height},
    vw:(window.innerWidth||0),
    vh:(window.innerHeight||0)
  };
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

    def open_detail(self, cdp, item, wait_ms: int = 1500, humanize: bool = False) -> str:
        """打开详情页（list 中已带 href），等待 DOM 更新；返回跳转后地址栏的最终 URL。
        humanize=True 时：在“阅读停留”基础上，额外做随机滚动 + 鼠标移动，模拟真人看简历。"""
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
        if humanize:
            try:
                self.human_scroll(cdp, random.randint(120, 320))
                time.sleep(random.uniform(0.4, 1.2))
                self._human_idle_mouse(cdp)
            except Exception:
                pass
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
        """在猎聘详情页上点「通过筛选 / 不合适」。
        拟人化模式(click_mode=real_mouse)下改用真实鼠标事件(Input.dispatchMouseEvent)点击，
        使按钮收到 isTrusted=true 的指针事件，规避“JS 合成点击(el.click)被风控识别为机器人”的风险。
        非拟人模式退回原有 JS 合成点击（兜底/兼容）。"""
        aa = cfg.get("auto_action", {}) or {}
        reject_texts = aa.get("button_reject_texts") or ["不合适"]
        pass_texts = aa.get("button_pass_texts") or ["通过筛选", "通过"]
        confirm_texts = aa.get("confirm_texts") or ["确认", "确定", "提交", "是"]
        lp = (cfg.get("scanner", {}) or {}).get("liepin", {}) or {}
        use_real_mouse = (lp.get("click_mode", "real_mouse") == "real_mouse") and bool(lp.get("humanize", True))

        if verdict == "不合适":
            action, texts = "不合适", reject_texts
        else:
            action, texts = "通过筛选", pass_texts

        # ----- 仅模拟：只定位按钮不点击 -----
        if dry_run:
            if use_real_mouse:
                res = self.find_button_rect(cdp, texts)
                if not res.get("found"):
                    return {"ok": False, "action": action, "dry_run": True,
                            "reason": "button_not_found", "searched": texts}
                return {"ok": True, "dry_run": True, "action": action,
                        "matched": res.get("text"), "exact": res.get("exact")}
            res = self._call(cdp, texts, do_click=False, timeout=12)
            if not res.get("found"):
                return {"ok": False, "action": action, "dry_run": True,
                        "reason": "button_not_found", "searched": texts}
            return {"ok": True, "dry_run": True, "action": action,
                    "matched": res.get("text"), "exact": res.get("exact")}

        # ----- 真实鼠标点击 (isTrusted=true) -----
        if use_real_mouse:
            res = self.find_button_rect(cdp, texts)
            if not res.get("found"):
                return {"ok": False, "action": action, "dry_run": False,
                        "reason": "button_not_found", "searched": texts}
            # 滚动稳定后再取一次坐标（二次定位）：首次 scrollIntoView 后矩形可能还没更新，
            # 直接用旧坐标点击会落空 —— 这是"点了没反应"的典型原因。
            time.sleep(0.35)
            res2 = self.find_button_rect(cdp, texts)
            if res2.get("found"):
                res = res2
            rect = res.get("rect") or {}
            vw = res.get("vw") or 0
            vh = res.get("vh") or 0
            w = rect.get("width", 0) or 0
            h = rect.get("height", 0) or 0
            cx = rect.get("x", 0) + w / 2.0
            cy = rect.get("y", 0) + h / 2.0
            # 坐标必须落在视口内，否则真实鼠标事件必然点空 —— 明确报错，绝不悄悄点空
            if w <= 0 or h <= 0 or not (0 <= cx <= vw and 0 <= cy <= vh):
                return {"ok": False, "action": action, "dry_run": False,
                        "reason": "bad_rect", "rect": rect,
                        "viewport": {"w": vw, "h": vh},
                        "error": f"按钮坐标无效或不在视口内（中心=({cx:.0f},{cy:.0f})，视口={vw}x{vh}），已跳过点击"}
            self.human_click(cdp, cx, cy, jitter_px=lp.get("mouse_jitter_px", 5))
            time.sleep(random.uniform(0.6, 1.2))
            modal = self.find_button_rect(cdp, confirm_texts)
            modal_confirmed = False
            if modal.get("found"):
                mrect = modal.get("rect") or {}
                mcx = mrect.get("x", 0) + mrect.get("width", 0) / 2.0
                mcy = mrect.get("y", 0) + mrect.get("height", 0) / 2.0
                self.human_click(cdp, mcx, mcy, jitter_px=lp.get("mouse_jitter_px", 5))
                modal_confirmed = True
            return {"ok": True, "action": action, "dry_run": False,
                    "matched": res.get("text"),
                    "modal": {"confirmed": modal_confirmed,
                              "text": modal.get("text") if modal_confirmed else None}}

        # ----- 兜底：JS 合成点击 (isTrusted=false) -----
        res = self._call(cdp, texts, do_click=True, timeout=12)
        if not res.get("found"):
            return {"ok": False, "action": action, "dry_run": False,
                    "reason": "button_not_found", "searched": texts}
        if not res.get("clicked"):
            return {"ok": False, "action": action, "dry_run": False,
                    "reason": "click_failed", "matched": res.get("text"),
                    "error": res.get("error")}
        time.sleep(0.9)
        modal = self._call(cdp, confirm_texts, do_click=True, timeout=6)
        modal_confirmed = bool(modal.get("found") and modal.get("clicked"))
        return {"ok": True, "action": action, "dry_run": False,
                "matched": res.get("text"),
                "modal": {"confirmed": modal_confirmed,
                          "text": modal.get("text") if modal_confirmed else None}}

    def _call(self, cdp, texts, do_click: bool, timeout: float = 12) -> dict:
        import json as _json
        js = LIEPIN_FIND_AND_CLICK_JS + "(" + _json.dumps(texts, ensure_ascii=False) + (",true)" if do_click else ",false)")
        try:
            return cdp.evaluate(js, timeout=timeout) or {}
        except Exception as e:
            return {"found": False, "error": str(e)}

    # ---------- 拟人化交互原语（仅猎聘网 humanize 模式使用）----------
    def find_button_rect(self, cdp, texts, timeout: float = 12) -> dict:
        """按文字定位按钮并返回其在视口中的矩形（先 scrollIntoView 到可视区）。"""
        js = LIEPIN_FIND_RECT_JS + "(" + json.dumps(texts, ensure_ascii=False) + ")"
        try:
            return cdp.evaluate(js, timeout=timeout) or {}
        except Exception as e:
            return {"found": False, "error": str(e)}

    def human_move(self, cdp, x, y, steps: int | None = None):
        """拟人化移动：从随机起点分步插值到目标，避免“瞬移”这种机器人特征。"""
        if steps is None:
            steps = random.randint(8, 16)
        sx, sy = random.randint(0, 60), random.randint(0, 60)
        for i in range(1, steps + 1):
            nx = sx + (x - sx) * i / steps
            ny = sy + (y - sy) * i / steps
            try:
                cdp.send("Input.dispatchMouseEvent",
                         {"type": "mouseMoved", "x": float(nx), "y": float(ny), "modifiers": 0})
            except Exception:
                pass
            time.sleep(random.uniform(0.008, 0.022))
        try:
            cdp.send("Input.dispatchMouseEvent",
                     {"type": "mouseMoved", "x": float(x), "y": float(y), "modifiers": 0})
        except Exception:
            pass

    def human_click(self, cdp, x, y, jitter_px: int = 5):
        """拟人化点击：移动→按下→抬起，落点带微小抖动（非像素级精准）。"""
        jx = x + random.uniform(-jitter_px, jitter_px)
        jy = y + random.uniform(-jitter_px, jitter_px)
        self.human_move(cdp, jx, jy)
        time.sleep(random.uniform(0.08, 0.22))
        try:
            cdp.send("Input.dispatchMouseEvent", {"type": "mousePressed", "x": float(jx), "y": float(jy),
                                                  "button": "left", "buttons": 1, "clickCount": 1, "modifiers": 0})
        except Exception:
            pass
        time.sleep(random.uniform(0.04, 0.12))
        try:
            cdp.send("Input.dispatchMouseEvent", {"type": "mouseReleased", "x": float(jx), "y": float(jy),
                                                  "button": "left", "buttons": 0, "clickCount": 1, "modifiers": 0})
        except Exception:
            pass
        time.sleep(random.uniform(0.1, 0.25))

    def human_scroll(self, cdp, delta_y: int, steps: int | None = None):
        """拟人化滚轮：分多步滚动，而非一次性跳变。"""
        if steps is None:
            steps = random.randint(4, 8)
        step = delta_y / steps
        for _ in range(steps):
            try:
                cdp.send("Input.dispatchMouseEvent",
                         {"type": "mouseWheel", "x": 50.0, "y": 50.0,
                          "deltaX": 0.0, "deltaY": float(step), "modifiers": 0})
            except Exception:
                pass
            time.sleep(random.uniform(0.03, 0.08))

    def _human_idle_mouse(self, cdp):
        """把鼠标随机移到视口内某点，模拟“目光/手部在页面上”的自然状态。"""
        try:
            wh = cdp.evaluate("[window.innerWidth, window.innerHeight]")
            if isinstance(wh, list) and len(wh) == 2:
                x = random.randint(int(wh[0] * 0.2), int(wh[0] * 0.8))
                y = random.randint(int(wh[1] * 0.2), int(wh[1] * 0.8))
                self.human_move(cdp, x, y)
        except Exception:
            pass
