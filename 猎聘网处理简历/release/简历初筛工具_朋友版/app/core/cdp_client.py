"""Chrome DevTools Protocol 客户端（简化版）
通过 http://localhost:<port>/json 列举页面 → websocket 注入 JS 执行

支持：
  - 列出所有 tab
  - 当前激活的猎聘页面
  - Runtime.evaluate：注入 JS 拿返回值
"""
from __future__ import annotations

import json
import time
from dataclasses import dataclass
from typing import Any, Optional
from urllib.request import urlopen
from urllib.error import URLError

import websocket  # websocket-client


@dataclass
class ChromeTab:
    tab_id: str
    title: str
    url: str
    websocket_url: str
    page_type: str = ""  # 'page' / 'service_worker' ...


class CDPClient:
    def __init__(self, host: str = "127.0.0.1", port: int = 9222, timeout: float = 10):
        self.host = host
        self.port = port
        self.http_base = f"http://{host}:{port}"
        self.timeout = timeout
        self._ws: Optional[websocket.WebSocket] = None
        self._msg_id = 0

    # -------- 状态探测 --------
    def is_reachable(self) -> bool:
        """检查 Chrome 调试端口是否可达"""
        try:
            urlopen(self.http_base + "/json/version", timeout=2).read()
            return True
        except Exception:
            return False

    def list_tabs(self) -> list[ChromeTab]:
        try:
            data = json.loads(urlopen(self.http_base + "/json", timeout=self.timeout).read())
        except URLError as e:
            raise ConnectionError(f"无法连接 Chrome {self.http_base}: {e}")
        return [
            ChromeTab(
                tab_id=t.get("id", ""),
                title=t.get("title", ""),
                url=t.get("url", ""),
                websocket_url=t.get("webSocketDebuggerUrl", ""),
                page_type=t.get("type", ""),
            )
            for t in data
            if t.get("type") == "page"
        ]

    def find_liepin_tab(self, url_match: str = "liepin.com") -> Optional[ChromeTab]:
        for tab in self.list_tabs():
            if url_match.lower() in (tab.url or "").lower():
                return tab
        return None

    def create_target(self, url: str) -> None:
        """通过 /devtools/browser 在 Chrome 里新建一个 page tab 并 navigate 到 url。
        用于扫描时找不到猎聘页面时自动打开，不影响用户当前标签。"""
        browser_ws = websocket.WebSocket()
        browser_ws.connect(
            f"ws://{self.host}:{self.port}/devtools/browser",
            timeout=self.timeout,
            origin=f"http://{self.host}:{self.port}",
            header=[f"Origin: http://{self.host}:{self.port}"],
        )
        try:
            msg_id = self._next_id()
            browser_ws.send(json.dumps({
                "id": msg_id,
                "method": "Target.createTarget",
                "params": {"url": url, "newWindow": False},
            }))
            start = time.time()
            while time.time() - start < self.timeout:
                raw = browser_ws.recv()
                if not raw:
                    continue
                try:
                    m = json.loads(raw)
                except Exception:
                    continue
                if m.get("id") == msg_id:
                    if "error" in m:
                        raise RuntimeError(f"createTarget error: {m['error']}")
                    return
            raise TimeoutError("createTarget 超时")
        finally:
            try:
                browser_ws.close()
            except Exception:
                pass

    def connect(self, tab: ChromeTab) -> None:
        # 新版 Chrome 强制要求 --remote-allow-origins 才能允许外部 ws 连接。
        # 启动参考: chrome.exe --remote-debugging-port=9222 --remote-allow-origins=*
        # 注意：只能传一次 Origin，重复传会被 Chrome 用逗号拼接后判定不匹配。
        origin = f"http://{self.host}:{self.port}"
        self._ws = websocket.WebSocket()
        self._ws.connect(
            tab.websocket_url,
            timeout=self.timeout,
            origin=origin,
        )
        self._msg_id = 0

    def close(self) -> None:
        if self._ws:
            try:
                self._ws.close()
            except Exception:
                pass
            self._ws = None

    # -------- 协议层 --------
    def _next_id(self) -> int:
        self._msg_id += 1
        return self._msg_id

    def send(self, method: str, params: Optional[dict] = None, timeout: float = 15) -> dict:
        assert self._ws, "未连接到任何 Tab，请先 connect(tab)"
        msg_id = self._next_id()
        payload = {"id": msg_id, "method": method, "params": params or {}}
        self._ws.send(json.dumps(payload))
        # 阻塞读直到回这条 id
        start = time.time()
        while time.time() - start < timeout:
            raw = self._ws.recv()
            if not raw:
                continue
            try:
                m = json.loads(raw)
            except Exception:
                continue
            if m.get("id") == msg_id:
                if "error" in m:
                    raise RuntimeError(f"CDP {method} error: {m['error']}")
                return m.get("result", {})
        raise TimeoutError(f"CDP {method} 超时（{timeout}s）")

    def evaluate(self, expression: str, return_by_value: bool = True, timeout: float = 15) -> Any:
        """注入 JS 表达式并返回值"""
        r = self.send(
            "Runtime.evaluate",
            {
                "expression": expression,
                "returnByValue": return_by_value,
                "awaitPromise": True,
            },
            timeout=timeout,
        )
        res = r.get("result", {})
        if res.get("subtype") == "error":
            raise RuntimeError(f"JS 错误: {res.get('description', '')}")
        return res.get("value")


# ============================================================
# 猎聘网特定工具函数（保留为向后兼容；新代码请用 app.core.platforms.liepin）
# ============================================================

# 让猎聘网页面注入的 JS 抓出核心字段
# 注：以下选择器基于猎聘网最新 web 端常见结构（"人才管理 → 求职者投递"）
# 真实环境若 DOM 不同，可在 app/core/resume_parser.py 中通过 diagnose_tabs() 自动 dump DOM 自适配
# 新代码请直接从 app.core.platforms.liepin 导入。

from .platforms.liepin import LIEPIN_LIST_JS  # noqa: F401, E402  向后兼容重导出


if __name__ == "__main__":
    c = CDPClient()
    print("Chrome reachable:", c.is_reachable())
    if c.is_reachable():
        tabs = c.list_tabs()
        print(f"Found {len(tabs)} tabs:")
        for t in tabs:
            print(f"  - [{t.page_type}] {t.title[:40]} -> {t.url[:80]}")
