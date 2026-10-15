import httpx

from ..core.config import get_settings
from ..core.errors import fail
from .util import parse_result


async def llm_chat(messages: list, temperature: float = 0.3) -> dict:
    """OpenAI 兼容调用；网络故障与 JSON 解析失败各自动重试一次；超时 600s"""
    s = get_settings()
    if not s.llm_configured:
        raise fail("大模型接口未配置", 503)
    url = s.llm_base_url.rstrip("/") + "/chat/completions"
    payload = {
        "model": s.llm_model,
        "messages": messages,
        "response_format": {"type": "json_object"},
        "temperature": temperature,
    }
    headers = {"Authorization": "Bearer " + s.llm_api_key}
    last_err = None
    async with httpx.AsyncClient(timeout=600) as client:
        for _attempt in range(2):
            try:
                resp = await client.post(url, json=payload, headers=headers)
            except (httpx.TimeoutException, httpx.TransportError) as e:
                msg = "模型响应超时，请稍后重试" if isinstance(e, httpx.TimeoutException) else "无法连接模型服务，请检查配置和网络"
                last_err = fail(msg, 502)
                continue
            if resp.status_code >= 400:
                err = fail(f"模型服务返回错误（{resp.status_code}），请稍后重试", 502)
                if resp.status_code >= 500:
                    last_err = err
                    continue
                raise err
            try:
                data = resp.json()
                content = data.get("choices", [{}])[0].get("message", {}).get("content")
                return parse_result(content)
            except Exception as e:
                last_err = e if hasattr(e, "status") else fail("模型返回的格式不完整，请重试", 502)
    raise last_err or fail("模型返回的格式不完整，请重试", 502)
