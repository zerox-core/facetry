import logging

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import DATA_DIR, get_settings

logger = logging.getLogger("facetry.db")


class Base(DeclarativeBase):
    pass


def build_database_url() -> str:
    s = get_settings()
    if s.database_url:
        return s.database_url
    if s.mysql_host:
        return (
            f"mysql+pymysql://{s.mysql_user}:{s.mysql_password}"
            f"@{s.mysql_host}:{s.mysql_port}/{s.mysql_database}?charset=utf8mb4"
        )
    # 开发便利回退：未配置 MYSQL_HOST 时使用本地 sqlite 文件
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    logger.warning("MYSQL_HOST 未配置，业务库回退为 sqlite 文件 %s（仅限开发使用）", DATA_DIR / "facetry-dev.db")
    return f"sqlite:///{(DATA_DIR / 'facetry-dev.db').as_posix()}"


DATABASE_URL = build_database_url()

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=280,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
)

if DATABASE_URL.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def _sqlite_fk(dbapi_conn, _record):
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA foreign_keys=ON")
        cur.close()

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db():
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()
