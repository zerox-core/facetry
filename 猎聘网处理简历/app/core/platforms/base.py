"""简历平台驱动抽象基类

每接入一个新平台（如 51job/Boss/智联），在 app/core/platforms/ 下新建一个文件
继承 BaseDriver，实现对应的抓取/解析/操作方法，并在 __init__.py 注册。
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional, Protocol


@dataclass
class ListItem:
    """列表页抓到的「一条简历」最小信息"""
    href: str                 # 详情页链接
    text: str = ""            # 卡片/行可见文本（用于 JD 匹配 + 预览）
    apply_id: str = ""        # 投递 ID（用于去重/日志）
    extra: dict = None        # 平台特有字段


class BaseDriver(Protocol):
    """平台驱动接口（Protocol，鸭子类型，无需继承）"""

    # ---- 元信息 ----
    code: str                  # 'liepin' / '51job' / 'boss'，全局唯一
    display_name: str          # '猎聘网' / '前程无忧'
    url_match: str             # 用于在 Chrome tab 中识别本平台页面的子串（如 'liepin.com'）
    stream_top: bool = False   # True=列表为虚拟滚动/操作后移除卡片，扫描时每次重新抓列表、处理"最上方未处理"的那条（前程无忧用）

    # ---- Chrome 标签页 ----
    def acquire_tab(self, cdp, emit) -> tuple:
        """找到一个本平台的目标 tab。
        找不到时自动 create_target；返回 (tab, final_url)
        emit(msg)  用于向 SSE 推送提示信息
        """
        ...

    def is_at_list_page(self, url: str) -> bool:
        """判断 URL 是否处于本平台的「列表/收件箱」页（用于决定是否要 navigate 回去）"""
        ...

    # ---- 抓取 ----
    def fetch_list(self, cdp) -> dict:
        """抓取列表页的简历条目。返回 {items: [ListItem...], total: int}"""
        ...

    def diagnostics_probe_js(self) -> str:
        """诊断用 JS：返回页面基本状态，便于排查 DOM 变化"""
        ...

    # ---- 详情 ----
    def open_detail(self, cdp, item: ListItem, wait_ms: int = 1500) -> str:
        """打开详情页并等待加载完成；返回最终 URL（地址栏）"""
        ...

    def fetch_detail(self, cdp) -> dict:
        """抓取详情页的候选人字段。返回 dict（与 parse_detail_js 输入兼容）"""
        ...

    # ---- 平台操作 ----
    def apply_action(self, cdp, verdict: str, cfg: dict, dry_run: bool, item=None) -> dict:
        """在页面上执行「通过/合适」或「淘汰/不合适」操作。
        item: 可选，当前处理的 ListItem（部分平台需要它来在列表里定位卡片）。
        返回 {ok, action, matched, dry_run, modal, reason...}
        """
        ...
