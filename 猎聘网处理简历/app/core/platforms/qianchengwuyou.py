"""前程无忧（51job 企业端 ehire.51job.com）驱动

真实 DOM 结构（2026-08 实测，企业端「人才管理 → 待处理」）：
  - 列表容器：div.item.virtual_list（虚拟滚动，当前可见约 50 条）
  - 每条卡片：
      div.item.virtual_list
        div.el-card
          div.card
            div.expect        -> "2小时前 投递了 临床监查员CRA（北京）(A196404)（北京..."
            section.e
              div.userinfo    -> span.name(姓名) / 34岁 17年 本科 北京
              div.userbutton
                div.option
                  div.option-menu -> div.text = "合适" / "不合适"   （操作按钮）
  - 点击卡片（非按钮区）会在「新标签页」打开详情：
      https://ehire.51job.com/Revision/talent/resume/detail?resumeId=...&jobId=...&fromModule=talentManagement
    详情页直接渲染在 body，含 工作经历 / 教育经历 / 个人优势 等段落。
  - 因此本驱动采用「流式顶部处理」模型（stream_top=True）：
      每次重新抓取列表 -> 取最上方「未处理」卡片 -> 真实点击打开详情新标签
      -> 读详情 -> 评估 -> 切回列表标签 -> 点该卡片的 合适/不合适 -> 关闭详情标签。
"""
from __future__ import annotations

import json
import time
import urllib.parse as _up
from typing import Optional

# 列表抓取 JS：返回 {items:[{href,text,apply_id,extra}], total}
# 关键：从每张卡片的 Vue 实例（__vue__.$props.source）提取 userid(resumeId)/jobid，
#      构造真实详情 URL —— 不再依赖"点击卡片开新标签"（虚拟列表只渲染前几张，
#      点击/滚动方案脆弱）。详情 URL 直接用于 Page.navigate 导航（类似猎聘）。
QCWY_LIST_JS = r"""
(() => {
  const cards = Array.from(document.querySelectorAll('div.item.virtual_list'));
  const items = [];
  const detailBase = 'https://ehire.51job.com/Revision/talent/resume/detail?';
  for (let i = 0; i < Math.min(50, cards.length); i++) {
    const card = cards[i];
    const text = (card.innerText || '').replace(/\s+/g, ' ').trim();
    const nameEl = card.querySelector('span.name');
    const name = nameEl ? nameEl.innerText.trim() : '';
    // 跳过空壳卡片（虚拟列表未渲染的占位）
    if (!name || text.length < 20) continue;
    // 从 Vue 实例提取 userid(resumeId)/jobid（数据在组件 props.source 里）
    let userid = '', jobid = '';
    let node = card;
    while (node) {
      if (node.__vue__) {
        const src = (node.__vue__.$props || {}).source;
        try {
          const s = typeof src === 'string' ? JSON.parse(src) : src;
          if (s) { userid = s.userid || ''; jobid = s.jobid || ''; }
        } catch (e) {}
        break;
      }
      node = node.parentElement;
    }
    let href = '';
    if (userid && jobid) {
      href = detailBase + 'resumeId=' + userid + '&jobId=' + jobid + '&fromModule=talentManagement';
    }
    items.push({
      href: href,
      text: text,
      apply_id: name,
      extra: { name: name, userid: userid, jobid: jobid, cardText: text.slice(0, 2500) }
    });
  }
  return { items: items, total: items.length };
})();
"""

# 在列表里按姓名定位卡片并滚动到可视区域
# 注意：只在卡片完全不在视口时才滚动（block:'nearest'），避免把列表强制滚回顶部、
#       破坏虚拟列表已加载的滚动进度（否则扫描几张后就只有前3张卡片有数据）
QCWY_SCROLL_JS = r"""
(() => {
  const name = __NAME__;
  const cards = Array.from(document.querySelectorAll('div.item.virtual_list'));
  for (const c of cards) {
    const nm = c.querySelector('span.name');
    if (nm && nm.innerText.trim() === name) {
      const r = c.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      // 卡片完全在视口内（top>=0 且 bottom<=vh）→ 不滚动，保持当前滚动位置
      if (!(r.top >= 0 && r.bottom <= vh)) {
        c.scrollIntoView({ block: 'nearest' });
      }
      return { ok: true };
    }
  }
  return { ok: false };
})();
"""

# 在列表里按姓名定位卡片，返回中心点坐标（用于真实鼠标点击打开详情）
QCWY_RECT_JS = r"""
(() => {
  const name = __NAME__;
  const cards = Array.from(document.querySelectorAll('div.item.virtual_list'));
  for (const c of cards) {
    const nm = c.querySelector('span.name');
    if (nm && nm.innerText.trim() === name) {
      const r = c.getBoundingClientRect();
      return { ok: true, x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
    }
  }
  return { ok: false };
})();
"""

# 详情页抓取 JS（在详情新标签内执行）：返回与 parse_detail_js 兼容的结构
# 额外抽取：目前岗位/目前公司（工作经历第一段）、期望城市（求职意向段）
QCWY_DETAIL_JS = r"""
(() => {
  const full = (document.body.innerText || '').replace(/\s+/g, ' ').trim();
  const name = (document.title || '').trim();

  // 城市清单（用于从求职意向里识别期望城市）
  const cityList = ['上海','北京','广州','深圳','珠海','杭州','南京','成都','武汉','西安','苏州','天津','重庆','青岛','厦门','宁波','合肥','郑州','沈阳','大连','济南','福州','南昌','昆明','贵阳','南宁','海口','兰州','太原','石家庄','哈尔滨','长春','呼和浩特','乌鲁木齐','银川','西宁','拉萨','长沙','无锡','常州','佛山','东莞','中山','惠州','嘉兴','绍兴','金华','台州','温州','烟台','潍坊','南通','徐州','唐山','扬州','湖州','洛阳','南阳','襄阳','宜昌','衡阳','岳阳','绵阳','德阳','遵义','包头','大庆','宁德','赣州','上饶','宜春','九江','汕头','湛江','柳州','桂林','三亚','泸州','宜宾','南充','宝鸡','天水'];

  // ---- 期望城市：从「求职意向」段取最早出现的城市（求职意向城市排在窗口最前，
  //      避免误命中后面「目前公司所在城市」，如 润东医药研发（上海）有限公司）----
  let expectedCity = '';
  const ji = full.indexOf('求职意向');
  if (ji >= 0) {
    const seg = full.substring(ji, ji + 90);
    let bestIdx = -1, bestCity = '';
    for (const c of cityList) {
      const idx = seg.indexOf(c);
      if (idx >= 0 && (bestIdx < 0 || idx < bestIdx)) { bestIdx = idx; bestCity = c; }
    }
    if (bestCity) expectedCity = bestCity;
  }
  // 兜底：从"期望城市/意向城市"等字段标签取
  if (!expectedCity) {
    const m = full.match(/(?:期望城市|意向城市|期望工作地|期望地区|期望地点|期望工作城市)[:：\s]*([^\n，,。；;]{1,30})/);
    if (m) {
      const v = m[1].replace(/(不限|全国|暂无|未知|无).*$/, '').trim();
      if (/(不限|全国)/.test(v)) expectedCity = '全国';
      else for (const c of cityList) { if (v.indexOf(c) !== -1) { expectedCity = c; break; } }
    }
  }

  // ---- 工作经历第一段：目前公司 / 目前岗位 ----
  // 仅当真正定位到「工作经历」段时才提取岗位/公司；无工作经历则留空，
  // 避免误把导航栏/正文里的公司名当成「目前公司」（如企业端顶部的「丽珠集团GZ」）
  let workText = full;
  let hasWorkExp = false;
  for (const h of ['工作经历','工作经验','工作信息']) {
    const re = new RegExp(h + '\\s*([\\s\\S]*?)(教育经历|项目经验|个人优势|求职意向|技能|证书|语言能力|$)');
    const mm = full.match(re);
    if (mm) { workText = mm[1]; hasWorkExp = true; break; }
  }
  const COMPANY_RE = /([^\s/]+(?:有限公司|股份有限公司|责任公司|集团公司|集团|医院|大学|学院|研究所|研究院|药厂|工厂|中心|局|银行|保险|证券|股份公司|科技公司|科技有限公司|有限责任公司))/;
  let position = '';
  let company = '';
  // 仅在有工作经历段时解析目前岗位/公司；无工作经历则保持空（用户定版要求：岗位/公司留空）
  if (hasWorkExp) {
    // 解析 "岗位经验 X-Y 公司 职位 行业 时间 ..." 结构
    const pe = workText.match(/岗位经验\s+([^-（）()\s]+)\s*-\s*([^-（）()\s]+)\s+([\s\S]*)/);
    if (pe) {
      const cat = pe[1];
      const rest = pe[3];
      const cm = rest.match(COMPANY_RE);
      if (cm) {
        company = cm[1].trim();
        const idx = rest.indexOf(company) + company.length;
        const after = rest.slice(idx).trim();
        const tok = (after.split(/\s+/)[0] || '').trim();
        if (tok && !/[\d/（）()年月至今]/.test(tok) && !tok.includes('制') && !tok.includes('药')) {
          position = tok;
        } else {
          position = cat;
        }
      } else {
        position = cat;
      }
    } else {
      const cm = workText.match(COMPANY_RE);
      if (cm) {
        company = cm[1].trim();
        const idx = workText.indexOf(company) + company.length;
        const after = workText.slice(idx).trim();
        const tok = (after.split(/\s+/)[0] || '').trim();
        if (tok && !/[\d/（）()年月至今]/.test(tok) && !tok.includes('制') && !tok.includes('药')) {
          position = tok;
        }
      }
    }
    // 兜底：公司后仍有未取到的职位词
    if (!position && company) {
      const idx = workText.indexOf(company);
      if (idx >= 0) {
        const after = workText.slice(idx + company.length).trim();
        const pm = after.match(/^([\u4e00-\u9fa5A-Za-z·.\-]{2,20}?)\s/);
        if (pm) position = pm[1].trim();
      }
    }
  }

  // ---- 教育 ----
  let edu = '';
  const em = full.match(/(本科|硕士|研究生|博士|专科|大专)/);
  if (em) edu = em[1];

  return {
    name: name,
    full_text: full.substring(0, 8000),
    url: location.href,
    title: name,
    current_position: position,
    current_company: company,
    expected_city: expectedCity,
    education_block: edu,
    has_work_exp: hasWorkExp,
    work_exps: (hasWorkExp && (company || position)) ? [{ company: company, position: position, period: '', raw: '' }] : []
  };
})();
"""

# 在列表里按姓名定位卡片，点击其 合适/不合适 操作按钮（div.option-menu > div.text）
QCWY_CLICK_ACTION_JS = r"""
(() => {
  const name = __NAME__;
  const btn = __BTN__;
  const cards = Array.from(document.querySelectorAll('div.item.virtual_list'));
  let card = null;
  for (const c of cards) {
    const nm = c.querySelector('span.name');
    if (nm && nm.innerText.trim() === name) { card = c; break; }
  }
  if (!card) return { ok: false, reason: 'card_not_found' };
  card.scrollIntoView({ block: 'center' });
  const menus = Array.from(card.querySelectorAll('div.option-menu'));
  const m = menus.find(x => (x.innerText || '').includes(btn));
  if (!m) return { ok: false, reason: 'button_not_found', action: btn };
  m.click();
  return { ok: true, action: btn, matched: btn };
})();
"""

# 处理可能的二次确认弹窗（不合适时常见），点击可见的 确定/提交/确认
QCWY_CONFIRM_JS = r"""
(() => {
  const texts = ['确定', '提交', '确认', '是'];
  const btns = Array.from(document.querySelectorAll('button, [role=button], .el-button'));
  for (const b of btns) {
    const t = (b.innerText || '').trim();
    if (texts.includes(t)) {
      const r = b.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) { try { b.click(); return { ok: true, text: t }; } catch (e) {} }
    }
  }
  return { ok: false };
})();
"""

# 详情页点 合适/不合适 按钮（详情页「人才状态」区有 btn_item 按钮，如猎聘一样在详情页操作）
QCWY_DETAIL_CLICK_JS = r"""
(() => {
  const btn = __BTN__;
  // 优先：详情页状态按钮区（btn_wrap / status_btn_list / btn_item）
  const candidates = Array.from(document.querySelectorAll(
    'div.btn_item, div.status_btn_list > div, div.btn_wrap > div, [class*=operate] [class*=btn]'
  ));
  for (const el of candidates) {
    const t = (el.innerText || '').trim();
    if (t === btn) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        try { el.click(); return { ok: true, matched: t, inDetail: true }; } catch (e) { return { ok: false, error: String(e) }; }
      }
    }
  }
  // 兜底：页面任意叶子元素文字精确匹配
  const all = Array.from(document.querySelectorAll('div, span, button, li'));
  for (const el of all) {
    const t = (el.innerText || '').trim();
    if (t === btn && el.children.length === 0) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        try { el.click(); return { ok: true, matched: t }; } catch (e) {}
      }
    }
  }
  return { ok: false, reason: 'button_not_found' };
})();
"""

# 详情页按钮定位（dry_run 用）
QCWY_DETAIL_LOCATE_JS = r"""
(() => {
  const btn = __BTN__;
  const els = Array.from(document.querySelectorAll('div.btn_item, div.status_btn_list > div, div.btn_wrap > div'));
  for (const el of els) {
    const t = (el.innerText || '').trim();
    if (t === btn) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return { ok: true, matched: t };
    }
  }
  return { ok: false };
})();
"""

# 仅定位（列表卡片，保留兼容旧调用）
QCWY_LOCATE_JS = r"""
(() => {
  const name = __NAME__;
  const cards = Array.from(document.querySelectorAll('div.item.virtual_list'));
  for (const c of cards) {
    const nm = c.querySelector('span.name');
    if (nm && nm.innerText.trim() === name) {
      const menus = Array.from(c.querySelectorAll('div.option-menu'));
      const hasPass = menus.some(x => (x.innerText || '').includes('合适'));
      const hasRej = menus.some(x => (x.innerText || '').includes('不合适'));
      return { ok: true, hasPass, hasRej };
    }
  }
  return { ok: false };
})();
"""

QCWY_DIAGNOSE_JS = r"""
(() => {
  const cards = Array.from(document.querySelectorAll('div.item.virtual_list'));
  const body = (document.body && document.body.innerText) ? document.body.innerText : '';
  const btnTexts = {};
  document.querySelectorAll('button, div.option-menu, [class*=btn]').forEach(b => {
    const t = (b.innerText || '').trim();
    if (t && t.length <= 12) btnTexts[t] = (btnTexts[t] || 0) + 1;
  });
  return {
    url: location.href,
    title: document.title,
    cardCount: cards.length,
    bodyLen: body.length,
    bodyHead: body.replace(/\s+/g, ' ').slice(0, 400),
        buttonTexts: btnTexts,
    };
})();
"""

# 滚动探针（收集阶段用）：自动探测虚拟列表的真实滚动容器并向下滚动约一个视口，
# 返回 {ok, before, after, maxScroll, clientHeight, tag}。
# 关键：不写死 .main_container——从不同入口/职位进入列表时滚动容器可能不同，
#       必须从卡片向上找最近的可滚动祖先，否则滚了也白滚（永远停在头几张）。
QCWY_SCROLL_PROBE_JS = r"""
(() => {
  function findScroll(el){
    let node = el;
    while (node && node !== document.body && node !== document.documentElement){
      const s = getComputedStyle(node);
      if ((s.overflowY==='auto'||s.overflowY==='scroll'||node.scrollHeight>node.clientHeight+4) && node.clientHeight>0){
        return node;
      }
      node = node.parentElement;
    }
    return null;
  }
  const card = document.querySelector('div.item.virtual_list');
  const sc = (card && findScroll(card)) || document.querySelector('.main_container') || document.scrollingElement;
  if(!sc) return {ok:false, reason:'no_container'};
  const before = sc.scrollTop;
  const step = Math.max(200, Math.round(sc.clientHeight*0.8));
  sc.scrollTop = before + step;
  sc.dispatchEvent(new Event('scroll'));
  return {ok:true, before:before, after:sc.scrollTop, maxScroll:sc.scrollHeight - sc.clientHeight,
          clientHeight: sc.clientHeight,
          tag:(sc.tagName||'') + (sc.className?('.'+String(sc.className).split(' ').join('.')):'')};
})();
"""


class QianchengwuyouDriver:
    """前程无忧（51job）企业端驱动"""

    code = "51job"
    display_name = "前程无忧"
    url_match = "ehire.51job.com"
    stream_top = True
    LIST_URL = "https://ehire.51job.com/Revision/talent/management"

    def __init__(self):
        # 主列表标签 ID：扫描期间主列表标签只读（不导航/不刷新/不操作），
        # 详情全部在独立新标签中打开，读完关闭 —— 主列表永不变坏
        self._list_tab_id: Optional[str] = None
        # 列表页真实地址（含 51job 的 rt 等会话参数）：回列表/恢复标签时原样导航回去，
        # 否则丢 rt 会导致 待处理 列表空白（只看到已操作后的 0 条）
        self._list_url: str = ""

    def is_at_list_page(self, url: str) -> bool:
        return "talent/management" in (url or "").lower()

    # ---------------- 标签页管理 ----------------
    def _open_fresh_list_tab(self, cdp):
        """通过 HTTP PUT /json/new 创建全新标签并导航到列表页。
        51job SPA 状态脆弱：旧标签一旦主列表区不渲染（bodyLen~670、无 span.name），
        无法用 CDP 刷新恢复，只能开全新标签。"""
        import urllib.request
        from urllib.parse import quote
        try:
            new_url = f"http://{cdp.host}:{cdp.port}/json/new?url=" + quote(self._list_url_or_default(), safe="")
            req = urllib.request.Request(new_url, method="PUT")
            data = json.loads(urllib.request.urlopen(req, timeout=10).read())
            new_id = data.get("id", "")
        except Exception:
            return None
        # 只认「新开」的那个标签：旧标签即使 URL 已是列表页也可能是崩坏的空壳，
        # 不能因为它 is_at_list_page 为真就返回它（否则恢复会连回坏页面）。
        deadline = time.time() + 25
        while time.time() < deadline:
            time.sleep(0.6)
            for t in cdp.list_tabs():
                if t.tab_id == new_id:
                    return t
        return None

    def _open_detail_tab(self, cdp, url: str):
        """通过 HTTP PUT /json/new 创建独立详情标签（主列表标签不受影响）。
        返回详情标签；失败返回 None。"""
        import urllib.request
        from urllib.parse import quote
        try:
            new_url = f"http://{cdp.host}:{cdp.port}/json/new?url=" + quote(url, safe="")
            req = urllib.request.Request(new_url, method="PUT")
            data = json.loads(urllib.request.urlopen(req, timeout=10).read())
            new_id = data.get("id", "")
        except Exception:
            return None
        deadline = time.time() + 20
        while time.time() < deadline:
            time.sleep(0.5)
            for t in cdp.list_tabs():
                if t.tab_id == new_id and "resume/detail" in (t.url or ""):
                    return t
        return None

    def acquire_tab(self, cdp, emit) -> tuple:
        tabs = [t for t in cdp.list_tabs() if self.url_match in (t.url or "").lower()]
        chosen = None
        # 找「人才管理页」标签
        for t in tabs:
            if self.is_at_list_page(t.url or ""):
                try:
                    cdp.connect(t)
                    n = cdp.evaluate("document.querySelectorAll('span.name').length") or 0
                    body_len = cdp.evaluate("(document.body.innerText||'').length") or 0
                    if (isinstance(n, int) and n > 0) or (isinstance(body_len, int) and body_len >= 1000):
                        chosen = t
                        emit("info", f"已连接（人才管理页）：{t.title} | {t.url}")
                        break
                except Exception:
                    pass
        # 兜底：用现有的 51job 标签
        if not chosen and tabs:
            chosen = tabs[0]
            try:
                cdp.connect(chosen)
            except Exception:
                pass
        if not chosen:
            raise ConnectionError(f"请手动打开 {self.LIST_URL} 后再扫描")
        self._list_tab_id = chosen.tab_id
        self._list_url = chosen.url or ""
        return chosen, chosen.url

    def capture_current_list_url(self, cdp):
        """记录当前列表标签的真实地址（含 ?rt= 等会话参数）。
        在每次处理前调用，保证「回列表页」时原样导航回去，不丢失筛选/会话上下文。"""
        try:
            u = cdp.evaluate("location.href")
            if u and "talent/management" in u:
                self._list_url = u
        except Exception:
            pass

    def _list_url_or_default(self) -> str:
        return self._list_url or self.LIST_URL

    def navigate_to_list_if_needed(self, cdp, current_url: str, emit):
        if self.is_at_list_page(current_url or ""):
            self._ensure_pending_filter(cdp)
            return
        emit("info", {"message": "当前不在人才管理页，正在导航到列表页..."})
        cdp.send("Page.navigate", {"url": self._list_url_or_default()})
        for _ in range(30):
            time.sleep(0.5)
            try:
                if cdp.evaluate("document.readyState") == "complete":
                    break
            except Exception:
                continue
        time.sleep(2)
        self._ensure_pending_filter(cdp)

    def _ensure_pending_filter(self, cdp):
        """确保停留在「待处理」筛选下（避免扫描到已处理的简历）"""
        try:
            cdp.evaluate(r"""
            (() => {
              const els = Array.from(document.querySelectorAll('*'));
              for (const el of els) {
                const t = (el.innerText || '').trim();
                if ((t === '待处理' || t.indexOf('待处理') === 0) && el.children.length <= 1) {
                  try { el.click(); return true; } catch (e) {}
                }
              }
              return false;
            })();
            """)
        except Exception:
            pass
        time.sleep(0.5)

    def wait_for_spa(self, cdp):
        for _ in range(20):
            time.sleep(0.4)
            try:
                if cdp.evaluate("document.readyState") == "complete":
                    break
            except Exception:
                continue
        time.sleep(1.2)

    # ---------------- 抓取 ----------------
    def fetch_list(self, cdp) -> dict:
        return cdp.evaluate(QCWY_LIST_JS, timeout=30) or {"items": [], "total": 0}

    def scroll_to_load_more(self, cdp, scroll_distance: int = None) -> dict:
        """滚动列表容器加载更多卡片。自动探测真实滚动容器（虚拟列表不同时期容器可能不同），
        不再写死 .main_container。返回 {ok, before, after, maxScroll}，调用方可据此判断是否真推进。"""
        try:
            info = cdp.evaluate(QCWY_SCROLL_PROBE_JS, timeout=15) or {"ok": False}
        except Exception:
            return {"ok": False}
        time.sleep(1.8)
        return info

    def collect_all_candidates(self, cdp, max_count: int = 200, max_scrolls: int = 100) -> list:
        """扫描前一次性收集「待处理」列表里的全部候选人（虚拟列表需滚动遍历加载）。
        关键改进：
          - 自动探测真实滚动容器（见 QCWY_SCROLL_PROBE_JS），不再假设 .main_container；
          - 滚到"真正底部"才停：只有连续多次"既无新卡片、scrollTop 也不再增加"才判定到底，
            避免滚动容器判断失误时早早停在头几张；
          - 每次滚动后等待 2 秒，等虚拟列表把新进入视口的卡片填充真实数据。
        返回按列表顺序去重后的候选 dict 列表（每项含 href/text/apply_id/extra.name）。
        之后扫描按此名单逐条导航到详情页处理，彻底避开"回列表后重新识别"的脆弱环节。"""
        seen: dict = {}
        no_advance_streak = 0
        stall_limit = 5
        for _ in range(max_scrolls):
            if len(seen) >= max_count:
                break
            try:
                data = cdp.evaluate(QCWY_LIST_JS, timeout=30) or {"items": []}
                items = data.get("items") or []
            except Exception:
                items = []
            before = len(seen)
            for it in items:
                href = it.get("href") or ""
                name = (it.get("extra") or {}).get("name") or ""
                if href and name and len((it.get("text") or "").strip()) > 20 and href not in seen:
                    seen[href] = it
            new_count = len(seen) - before
            # 滚动加载下一批，并判断这次滚动是否真的推进了列表
            sc = self.scroll_to_load_more(cdp)
            advanced = (sc.get("after", 0) - sc.get("before", 0)) if sc.get("ok") else 0
            if new_count == 0 and advanced <= 0:
                no_advance_streak += 1
            else:
                no_advance_streak = 0
            if no_advance_streak >= stall_limit:
                break
        return list(seen.values())

    def wait_for_list_ready(self, cdp, timeout: int = 35) -> bool:
        """等「待处理」列表真正渲染出简历卡片（含姓名）。
        51job 待处理 999+ 简历需数秒拉取，未就绪时卡片是空壳，直接扫会抓到空记录。
        检测条件：span.name > 0 或 div.card 内有实际文本内容。"""
        deadline = time.time() + timeout
        while time.time() < deadline:
            try:
                n = cdp.evaluate(
                    "(()=>{var nm=document.querySelectorAll('span.name').length;"
                    "var cards=document.querySelectorAll('div.card');"
                    "var hasContent=0;for(var i=0;i<Math.min(3,cards.length);i++)"
                    "{if((cards[i].innerText||'').trim().length>20)hasContent++;}"
                    "return nm>0?nm:hasContent;})()"
                ) or 0
            except Exception:
                n = 0
            if isinstance(n, int) and n > 0:
                return True
            time.sleep(0.8)
        return False

    def ensure_list_ready(self, cdp, timeout: int = 10) -> bool:
        """切回列表标签后确保列表有数据可抓。"""
        return self.wait_for_list_ready(cdp, timeout=timeout)

    def diagnostics_probe_js(self) -> str:
        return QCWY_DIAGNOSE_JS

    def diagnostics_scroll_test(self, cdp) -> dict:
        """诊断用：实测滚动能否推进虚拟列表。
        返回滚动前后 list_js 抓到的数量与滚动量，用以判断"只看到 3 份"是虚拟列表特性
        （正常，需滚动收集）还是滚动容器错误（需修正）。"""
        try:
            before = len((cdp.evaluate(QCWY_LIST_JS, timeout=20) or {}).get("items") or [])
            sc = cdp.evaluate(QCWY_SCROLL_PROBE_JS, timeout=15) or {"ok": False}
            time.sleep(2)
            after = len((cdp.evaluate(QCWY_LIST_JS, timeout=20) or {}).get("items") or [])
            advanced = (sc.get("after", 0) - sc.get("before", 0)) if sc.get("ok") else 0
            return {"ok": True, "before_count": before, "after_count": after,
                    "advanced": advanced, "scroll": sc}
        except Exception as e:
            return {"ok": False, "error": f"{e.__class__.__name__}: {e}"}

    # ---------------- 详情 ----------------
    def _clean_detail_url(self, url: str) -> str:
        """剥离 51job 详情 URL 里的一次性令牌（rt / time / requestId），
        否则链接会过期失效、打不开。保留 resumeId/jobId/fromModule 等稳定参数。"""
        if not url or "ehire.51job.com" not in url:
            return url or ""
        try:
            p = _up.urlparse(url)
            q = _up.parse_qs(p.query)
            for k in ("rt", "time", "requestId"):
                q.pop(k, None)
            cleaned = _up.urlunparse(p._replace(query=_up.urlencode(q, doseq=True)))
            return cleaned
        except Exception:
            return url

    def open_detail(self, cdp, item, wait_ms: int = 1500) -> str:
        """直接用 Page.navigate 导航到详情页（单标签方案）。
        列表时已从 Vue 实例提取 resumeId/jobId 构造了真实详情 URL（item.href）。
        返回详情页 URL。"""
        url = (item.href or "") if item else ""
        if "resume/detail" not in url:
            return None
        try:
            cdp.send("Page.navigate", {"url": url})
        except Exception:
            return None
        # 等待详情页渲染完成
        time.sleep(3)
        return url
        # 等详情 SPA 真正渲染出正文，且「工作经历/求职意向」段已出现并稳定
        # （避免 SPA 懒加载导致公司/职位缺失）
        deadline = time.time() + 16
        last_len = -1
        stable = 0
        while time.time() < deadline:
            try:
                snip = cdp.evaluate(
                    "(()=>{var b=document.body;var t=b?(b.innerText||'').replace(/\\s+/g,' ').trim():'';"
                    "return {len:t.length, work:(/工作经历|工作经验/.test(t)), stru:(/教育经历|求职意向|个人优势/.test(t))};})()"
                )
            except Exception:
                snip = {"len": 0, "work": False, "stru": False}
            ln = snip.get("len", 0) if isinstance(snip, dict) else 0
            has_work = snip.get("work", False) if isinstance(snip, dict) else False
            if ln > 400 and has_work:
                if ln == last_len:
                    stable += 1
                else:
                    stable = 0
                if stable >= 2:
                    break
            last_len = ln
            time.sleep(0.7)
        return url

    def _wait_detail_tab(self, cdp, wait_ms: int = 2500):
        deadline = time.time() + wait_ms / 1000.0 + 3
        while time.time() < deadline:
            time.sleep(0.6)
            for t in cdp.list_tabs():
                if "resume/detail" in (t.url or ""):
                    return t
        return None

    def fetch_detail(self, cdp) -> dict:
        return cdp.evaluate(QCWY_DETAIL_JS, timeout=30) or {}

    # ---------------- 操作 ----------------
    def apply_action(self, cdp, verdict: str, cfg: dict, dry_run: bool, item=None) -> dict:
        """在详情页点 合适/不合适（猎聘式：列表页只读不操作，避免点按钮后列表 SPA 崩坏）。
        当前 cdp 应连接在详情页（_process_stream_item 会在回列表前调用）。"""
        btn = "合适" if verdict in ("合适", "通过", "面试", "约面试", "通过筛选") else "不合适"

        if dry_run:
            res = cdp.evaluate(QCWY_DETAIL_LOCATE_JS.replace("__BTN__", json.dumps(btn, ensure_ascii=False)))
            return {
                "ok": bool(res and res.get("ok")),
                "action": btn,
                "matched": btn,
                "dry_run": True,
            }

        res = cdp.evaluate(QCWY_DETAIL_CLICK_JS.replace("__BTN__", json.dumps(btn, ensure_ascii=False)))
        if not (res and res.get("ok")):
            return {
                "ok": False, "action": btn,
                "reason": (res or {}).get("reason"), "matched": btn,
            }
        # 二次确认弹窗（不合适时常见）
        time.sleep(0.9)
        cdp.evaluate(QCWY_CONFIRM_JS)
        return {"ok": True, "action": btn, "matched": btn, "dry_run": False}

    def _close_detail_tabs(self, cdp):
        try:
            for t in cdp.list_tabs():
                if "resume/detail" in (t.url or ""):
                    try:
                        cdp.send("Target.closeTarget", {"targetId": t.tab_id})
                    except Exception:
                        pass
        except Exception:
            pass

    def _recover_list_tab(self, cdp) -> bool:
        """当前列表标签 SPA 崩坏（检测不到简历卡片）时，开一个全新标签恢复列表，
        并把 cdp 连接切换到它、关掉旧的坏标签。返回 True 表示恢复成功。
        这是 51job 唯一可靠的恢复手段（任何 CDP 刷新/导航都救不回坏页面，只能开新标签）。"""
        old_id = self._list_tab_id
        new_tab = self._open_fresh_list_tab(cdp)
        # 没真正开出新标签（或返回的是原来的坏标签）→ 放弃恢复
        if not new_tab or (old_id and new_tab.tab_id == old_id):
            return False
        try:
            cdp.connect(new_tab)
        except Exception:
            return False
        self._list_tab_id = new_tab.tab_id
        if old_id:
            try:
                cdp.send("Target.closeTarget", {"targetId": old_id})
            except Exception:
                pass
        self._ensure_pending_filter(cdp)
        return True

    def close_detail_and_return_to_list(self, cdp):
        """用 Page.navigate 导航回列表页。
        若导航后列表 SPA 崩坏（检测不到简历卡片），则开全新标签恢复，而不是直接带着坏页面继续。"""
        try:
            cdp.send("Page.navigate", {"url": self._list_url_or_default()})
        except Exception:
            pass
        # 等列表渲染；渲染成功则确保停在「待处理」
        if self.wait_for_list_ready(cdp, timeout=15):
            self._ensure_pending_filter(cdp)
            return
        # 列表崩坏 → 开新标签恢复（51job 唯一可靠手段）
        if self._recover_list_tab(cdp):
            self.wait_for_list_ready(cdp, timeout=15)
        else:
            self._ensure_pending_filter(cdp)
