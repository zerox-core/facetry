"""探测猎聘'收到简历'页面上的操作按钮（只读，绝不点击）。
输出每个相关按钮的 tag / id / class / 文本 / 可定位的 XPath 片段。
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from app.core.cdp_client import CDPClient
from app.core.config import load_config


def main():
    cfg = load_config()
    cdp = CDPClient(host=cfg["chrome"]["host"], port=cfg["chrome"]["port"])
    if not cdp.is_reachable():
        print("Chrome 不可达")
        return
    tab = cdp.find_liepin_tab("liepin.com")
    if not tab:
        print("未找到猎聘标签页")
        return
    print(f"目标页: {tab.title} | {tab.url}")
    cdp.connect(tab)
    try:
        data = cdp.evaluate(r"""
        (function(){
          const out = [];
          const keywords = ['通过筛选','不合适','通过','不合适','拒绝','淘汰','邀请','进入面试','加入人才库','查看','简历','处理','标记为'];
          const nodes = Array.from(document.querySelectorAll('button, a[role="button"], a[class*="btn"], span[class*="btn"], div[class*="btn"], li[class*="btn"]'));
          for (const el of nodes) {
            const txt = (el.innerText || el.textContent || '').replace(/\s+/g,' ').trim();
            if (!txt) continue;
            if (txt.length > 16) continue;
            if (keywords.some(k => txt.includes(k))) {
              out.push({
                tag: el.tagName.toLowerCase(),
                id: el.id || '',
                cls: (el.className && el.className.toString) ? el.className.toString().slice(0,80) : '',
                text: txt,
                href: el.getAttribute && el.getAttribute('href') ? el.getAttribute('href').slice(0,60) : '',
                // 给一个稳健的定位线索：最近的带 data-* 或 id 的祖先
                near: (function(){
                  let p = el.parentElement;
                  for (let i=0;i<4 && p;i++){
                    const da = Array.from(p.attributes).filter(a=>a.name.startsWith('data-'));
                    if (da.length) return p.tagName.toLowerCase()+'['+da.map(a=>a.name+'="'+a.value.slice(0,20)+'"').join(',')+']';
                    if (p.id) return '#'+p.id;
                    p = p.parentElement;
                  }
                  return '';
                })()
              });
            }
          }
          // 也抓取整页里 resume 行结构线索
          const rows = Array.from(document.querySelectorAll('[data-resume-id],[data-candidate-id],[data-apply-id],tr,li,.resume-item,.apply-item,.candidate-item')).slice(0,3).map(r=>{
            return {tag:r.tagName.toLowerCase(), id:r.id||'', cls:(r.className&&r.className.toString)?r.className.toString().slice(0,60):'', da:Array.from(r.attributes).filter(a=>a.name.startsWith('data-')).map(a=>a.name+'='+a.value.slice(0,20))};
          });
          return {buttons: out, sampleRows: rows, bodyTextSnippet: (document.body.innerText||'').slice(0,200)};
        })();
        """, timeout=20)
        print(json.dumps(data, ensure_ascii=False, indent=2))
    finally:
        cdp.close()


if __name__ == "__main__":
    main()
