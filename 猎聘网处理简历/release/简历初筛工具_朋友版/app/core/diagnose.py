"""诊断脚本：dump 猎聘网页面 DOM 结构到 logs/

运行：python -m app.core.diagnose
会同时输出一份"特征清单"到 logs/liepin_dom_*.txt
"""
import json
import time
from pathlib import Path

from .cdp_client import CDPClient

ROOT = Path(__file__).resolve().parent.parent.parent
LOGS = ROOT / "logs"


def dump_dom():
    cdp = CDPClient()
    if not cdp.is_reachable():
        print("[!] Chrome 调试端口不可达。请先用：")
        print("    chrome.exe --remote-debugging-port=9222")
        return
    tab = cdp.find_liepin_tab(url_match="liepin.com")
    if not tab:
        print("[!] 未找到猎聘页面（请先在 Chrome 里打开 https://lpt.liepin.com）")
        return

    print(f"[+] 连接 Tab: {tab.title} | {tab.url}")
    cdp.connect(tab)

    # 1) 顶层信息
    info = cdp.evaluate("""
        ({
          url: location.href,
          title: document.title,
          bodyClass: document.body.className,
          bodyId: document.body.id
        })
    """)
    print("[+] 页面信息:", json.dumps(info, ensure_ascii=False, indent=2))

    # 2) dump 列表项结构 - 通用探测
    sample = cdp.evaluate("""
        (function() {
          // 尝试多种选择器定位"一条简历"
          const selectors = [
            '[data-resume-id]', '[data-candidate-id]', '[data-id]',
            '.resume-item', '.candidate-item', '.apply-item', '.apply-list-item',
            '.position-apply-item', '.resume-card', '.list-item',
            'li[class*="resume"]', 'li[class*="apply"]', 'li[class*="item"]',
            'div[class*="resume"]', 'div[class*="apply"]', 'div[class*="item"]'
          ];
          const found = {};
          for (const sel of selectors) {
            const nodes = document.querySelectorAll(sel);
            if (nodes.length > 0) {
              found[sel] = Array.from(nodes).slice(0, 3).map(n => n.outerHTML.substring(0, 600));
            }
          }
          return found;
        })()
    """)
    out = LOGS / f"liepin_dom_{int(time.time())}.txt"
    LOGS.mkdir(parents=True, exist_ok=True)
    out.write_text(
        f"# URL: {info['url']}\n# Title: {info['title']}\n\n"
        f"# 选择器命中 (前3条 HTML 截断 600 字符)\n\n{json.dumps(sample, ensure_ascii=False, indent=2)}\n",
        encoding="utf-8",
    )
    print(f"[+] 结构写入: {out}")
    # 简要打印
    keys = list((sample or {}).keys())
    print(f"[+] 命中 {len(keys)} 个选择器: {keys[:8]}{'...' if len(keys) > 8 else ''}")

    # 3) 列出可能的"操作按钮"
    actions = cdp.evaluate("""
        (function() {
          const buttons = Array.from(document.querySelectorAll('button, a[role="button"], a[class*="btn"]'));
          const interesting = buttons.filter(b => {
            const text = (b.innerText || '').trim();
            return text && text.length < 12 && /通过|筛选|合适|不合适|查看|简历|处理|拒绝|淘汰|同意|邀请|下载/i.test(text);
          });
          return interesting.slice(0, 20).map(b => ({
            text: (b.innerText || '').trim(),
            tag: b.tagName,
            className: b.className,
            id: b.id,
            href: b.href || null,
            // 让用户能直接对应位置
            rect: b.getBoundingClientRect().toJSON()
          }));
        })()
    """)
    actions_path = LOGS / f"liepin_actions_{int(time.time())}.txt"
    actions_path.write_text(json.dumps(actions, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[+] 按钮写入: {actions_path}")
    for a in actions:
        print(f"    - [{a['tag']}] '{a['text']}' #{a['className']}")

    cdp.close()


if __name__ == "__main__":
    dump_dom()
