"""诊断 Chrome 调试端口的真实连通性。

退出码：
  0 = 一切就绪（http + websocket 都通）
  1 = Chrome 调试端口完全不可达
  2 = HTTP 通但 websocket 拒连（最常见：少了 --remote-allow-origins=*）
"""
import socket
import sys
import urllib.request

import websocket  # websocket-client


def check() -> int:
    socket.setdefaulttimeout(2)
    # 1) HTTP
    try:
        v = urllib.request.urlopen("http://127.0.0.1:9222/json/version", timeout=2).read()
        print("[HTTP] Chrome 调试端口可达。返回摘要:", v[:120].decode("utf-8", errors="ignore"))
    except Exception as e:
        print("[HTTP] 无法连接 Chrome 调试端口:", e)
        print("       → 请先关闭所有 Chrome 窗口，再执行：")
        print("          chrome.exe --remote-debugging-port=9222 --remote-allow-origins=*")
        return 1

    # 2) WS handshake —— 直接连 /devtools/browser 端口测试
    # 注意：只能传一次 Origin（origin=），重复传会被 Chrome 用逗号拼接后判定不匹配。
    try:
        ws = websocket.create_connection(
            "ws://127.0.0.1:9222/devtools/browser",
            timeout=3,
            origin="http://127.0.0.1:9222",
        )
        ws.close()
        print("[WS] websocket 握手成功。Chrome 已完全就绪 ✓")
        return 0
    except Exception as e:
        print("[WS] HTTP 通但 websocket 被拒:", e)
        print("       → 你的 Chrome 启动时少了 --remote-allow-origins=* 参数。")
        print("       → 关闭所有 Chrome 后，重新执行：")
        print("          chrome.exe --remote-debugging-port=9222 --remote-allow-origins=*")
        return 2


if __name__ == "__main__":
    sys.exit(check())
