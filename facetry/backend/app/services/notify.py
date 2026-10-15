"""通知通道：SMTP 邮件 + 短信适配层 stub。
模板内容配置化：MAIL_TEMPLATE_INTERVIEW 环境变量，占位符 {name}/{position}/{time}/{location}。"""
import asyncio
import logging
import smtplib
from email.header import Header
from email.mime.text import MIMEText
from email.utils import formataddr

from ..core.config import get_settings

logger = logging.getLogger("facetry.notify")

DEFAULT_INTERVIEW_TEMPLATE = (
    "【面试通知】{name}您好，您应聘的{position}岗位面试时间定于{time}，"
    "地点/方式：{location}。请准时参加，如有变动请联系 HR。"
)


def render_template(template: str, **kwargs) -> str:
    out = template or DEFAULT_INTERVIEW_TEMPLATE
    for k, v in kwargs.items():
        out = out.replace("{" + k + "}", str(v or ""))
    return out


def _send_smtp(to_addr: str, subject: str, body: str) -> None:
    s = get_settings()
    msg = MIMEText(body, "plain", "utf-8")
    msg["Subject"] = Header(subject, "utf-8")
    msg["From"] = formataddr((str(Header("人才招聘工作台", "utf-8")), s.mail_username))
    msg["To"] = to_addr
    with smtplib.SMTP_SSL(s.mail_smtp_host, s.mail_smtp_port or 465, timeout=30) as smtp:
        if s.mail_password:
            smtp.login(s.mail_username, s.mail_password)
        smtp.sendmail(s.mail_username, [to_addr], msg.as_string())


async def send_email(to_addr: str, subject: str, body: str) -> dict:
    """返回 {state: sent|failed|skipped, error}"""
    s = get_settings()
    if not s.smtp_configured:
        return {"state": "skipped", "error": "邮件通道未配置"}
    if not to_addr:
        return {"state": "skipped", "error": "未提供收件地址"}
    try:
        await asyncio.to_thread(_send_smtp, to_addr, subject, body)
        return {"state": "sent", "error": ""}
    except Exception as e:
        logger.error("邮件发送失败: %s", e)
        return {"state": "failed", "error": f"邮件发送失败：{e}"}


async def send_sms(phone: str, params: dict) -> dict:
    """短信适配层 stub：SMS_PROVIDER 未配置时 skipped；服务商接入后在此处分发"""
    s = get_settings()
    if not s.sms_provider:
        return {"state": "skipped", "error": "短信通道未配置"}
    if not phone:
        return {"state": "skipped", "error": "未提供手机号"}
    # TODO(待确认)：短信服务商接口（阿里云/腾讯云等）确认后按 provider 分发实现
    return {"state": "skipped", "error": f"短信服务商 {s.sms_provider} 适配未实现"}
