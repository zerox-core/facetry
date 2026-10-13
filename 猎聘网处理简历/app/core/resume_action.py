"""在猎聘简历详情页上点击「通过筛选 / 不合适」等操作按钮。

策略：
  - 不依赖具体的 class / id（猎聘可能随时改版），改为按「按钮文字」匹配，
    优先精确匹配，其次包含匹配。
  - 支持 dry_run：只回传“将要点击哪个按钮”，不真正点击，便于首次验证。
  - 点击后若弹出二次确认框（如「确认不合适」），自动点其确认按钮。
"""
from __future__ import annotations

import json
import time
from typing import Optional

# 在页面里按文字找按钮并执行点击（或不点击）的 JS。
# 通过参数 doClick 控制是否真点；精确匹配优先于包含匹配。
_FIND_AND_CLICK_JS = r"""
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


def _call(cdp, texts: list[str], do_click: bool, timeout: float = 12) -> dict:
    js = _FIND_AND_CLICK_JS + "(" + json.dumps(texts, ensure_ascii=False) + (",true)" if do_click else ",false)")
    try:
        return cdp.evaluate(js, timeout=timeout) or {}
    except Exception as e:  # noqa: BLE001
        return {"found": False, "error": str(e)}


def apply_verdict(
    cdp,
    verdict: str,
    cfg: dict,
    dry_run: bool = True,
) -> dict:
    """根据判定结果在页面上点对应按钮。

    verdict ∈ {合适, 待定, 不合适, 信息不足}
    - 不合适        → 点「不合适」
    - 其它（合适/待定/信息不足）→ 点「通过筛选」

    返回 dict: {ok, action, matched, modal, reason...}
    """
    aa = cfg.get("auto_action", {}) or {}
    reject_texts = aa.get("button_reject_texts") or ["不合适"]
    pass_texts = aa.get("button_pass_texts") or ["通过筛选", "通过"]
    confirm_texts = aa.get("confirm_texts") or ["确认", "确定", "提交", "是"]

    if verdict == "不合适":
        action, texts = "不合适", reject_texts
    else:
        action, texts = "通过筛选", pass_texts

    res = _call(cdp, texts, do_click=not dry_run, timeout=12)
    if not res.get("found"):
        return {
            "ok": False,
            "action": action,
            "dry_run": dry_run,
            "reason": "button_not_found",
            "searched": texts,
        }

    if dry_run:
        return {
            "ok": True,
            "dry_run": True,
            "action": action,
            "matched": res.get("text"),
            "exact": res.get("exact"),
        }

    if not res.get("clicked"):
        return {
            "ok": False,
            "action": action,
            "dry_run": False,
            "reason": "click_failed",
            "matched": res.get("text"),
            "error": res.get("error"),
        }

    # 真点了主按钮，稍等让二次确认弹窗出现，再点确认
    time.sleep(0.9)
    modal = _call(cdp, confirm_texts, do_click=True, timeout=6)
    modal_confirmed = bool(modal.get("found") and modal.get("clicked"))
    return {
        "ok": True,
        "action": action,
        "dry_run": False,
        "matched": res.get("text"),
        "modal": {
            "confirmed": modal_confirmed,
            "text": modal.get("text") if modal_confirmed else None,
        },
    }
