"""平台驱动注册表

使用方式：
    from app.core.platforms import get_driver, list_drivers, register_driver
    d = get_driver("猎聘网")
    items = d.fetch_list(cdp)

新增平台：在 platforms/ 下新建 xxx.py，实现驱动类后在此注册。
"""
from __future__ import annotations

from typing import Any

from .base import BaseDriver, ListItem
from .liepin import LiepinDriver
from .qianchengwuyou import QianchengwuyouDriver


# display_name -> driver instance
_REGISTRY: dict[str, BaseDriver] = {
    "猎聘网": LiepinDriver(),
    "前程无忧": QianchengwuyouDriver(),
}


def register_driver(display_name: str, driver: BaseDriver) -> None:
    """注册一个新平台驱动"""
    _REGISTRY[display_name] = driver


def get_driver(display_name: str) -> BaseDriver:
    """按展示名取驱动；找不到则抛 KeyError"""
    if display_name not in _REGISTRY:
        raise KeyError(
            f"未注册的平台驱动: {display_name!r}。"
            f"已注册: {list(_REGISTRY.keys())}"
        )
    return _REGISTRY[display_name]


def list_drivers() -> list[BaseDriver]:
    return list(_REGISTRY.values())


def get_driver_by_code(code: str) -> BaseDriver | None:
    for d in _REGISTRY.values():
        if d.code == code:
            return d
    return None


__all__ = [
    "BaseDriver",
    "ListItem",
    "register_driver",
    "get_driver",
    "get_driver_by_code",
    "list_drivers",
]
