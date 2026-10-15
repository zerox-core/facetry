from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BACKEND_DIR / "data"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(BACKEND_DIR / ".env"), extra="ignore")

    # ---- 服务 ----
    app_host: str = "0.0.0.0"
    app_port: int = 8080
    app_env: str = "dev"
    secret_key: str = ""

    # ---- 业务库 ----
    # DATABASE_URL 直接覆盖（测试便利）；否则 MYSQL_HOST 非空拼 MySQL，空则回退 sqlite
    database_url: str = ""
    mysql_host: str = ""
    mysql_port: int = 3306
    mysql_user: str = ""
    mysql_password: str = ""
    mysql_database: str = ""

    # ---- 来源数据库（影刀落库，只读）----
    source_db_type: str = ""
    source_db_host: str = ""
    source_db_port: int = 0
    source_db_user: str = ""
    source_db_password: str = ""
    source_db_database: str = ""

    # ---- MinIO ----
    minio_endpoint: str = ""
    minio_access_key: str = ""
    minio_secret_key: str = ""
    minio_bucket: str = ""
    minio_secure: bool = False

    # ---- 飞书 ----
    feishu_app_id: str = ""
    feishu_app_secret: str = ""
    feishu_redirect_uri: str = ""
    feishu_approval_code: str = ""

    # ---- 通知 ----
    mail_smtp_host: str = ""
    mail_smtp_port: int = 465
    mail_username: str = ""
    mail_password: str = ""
    mail_template_interview: str = ""
    sms_provider: str = ""
    sms_access_key: str = ""
    sms_secret_key: str = ""
    sms_sign_name: str = ""
    sms_template_interview: str = ""

    # ---- LLM ----
    llm_base_url: str = ""
    llm_api_key: str = ""
    llm_model: str = ""

    # ---- 管理员（同旧 config.json 语义，逗号分隔用户 id）----
    admin_users: str = ""
    super_admin_users: str = ""

    # ---- 其他 ----
    enable_demo_login: bool = False
    base_path: str = ""

    @property
    def llm_configured(self) -> bool:
        return bool(self.llm_base_url and self.llm_api_key and self.llm_model)

    @property
    def feishu_configured(self) -> bool:
        return bool(self.feishu_app_id and self.feishu_app_secret)

    @property
    def minio_configured(self) -> bool:
        return bool(self.minio_endpoint and self.minio_access_key and self.minio_secret_key and self.minio_bucket)

    @property
    def smtp_configured(self) -> bool:
        return bool(self.mail_smtp_host and self.mail_username)

    @property
    def source_db_configured(self) -> bool:
        return bool(self.source_db_type and self.source_db_host and self.source_db_database)

    @property
    def env_admins(self) -> list[str]:
        return [s.strip() for s in self.admin_users.split(",") if s.strip()]

    @property
    def env_super_admins(self) -> list[str]:
        return [s.strip() for s in self.super_admin_users.split(",") if s.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
