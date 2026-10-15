import json
import re

from ..core.errors import fail


def clip(value, max_len: int = 2000) -> str:
    return value[:max_len] if isinstance(value, str) else ""


def norm_text(s) -> str:
    return re.sub(r"\s+", "", str(s or "")).lower()


def parse_result(content):
    """解析 LLM 返回的 JSON；容忍 markdown 包裹"""
    if isinstance(content, dict):
        return content
    try:
        return json.loads(content)
    except Exception:
        pass
    m = re.search(r"\{[\s\S]*\}", str(content))
    try:
        return json.loads(m.group(0)) if m else None
    except Exception:
        raise fail("模型返回的格式不完整，请重试", 502)
