"""文件存储：MinIO 优先，未配置回退本地磁盘 backend/data/files/"""
import logging

from ..core.config import DATA_DIR, get_settings

logger = logging.getLogger("facetry.storage")

LOCAL_DIR = DATA_DIR / "files"
_minio_client = None


def _client():
    global _minio_client
    s = get_settings()
    if _minio_client is None and s.minio_configured:
        from minio import Minio
        _minio_client = Minio(s.minio_endpoint, access_key=s.minio_access_key,
                              secret_key=s.minio_secret_key, secure=s.minio_secure)
        try:
            if not _minio_client.bucket_exists(s.minio_bucket):
                _minio_client.make_bucket(s.minio_bucket)
                logger.info("MinIO bucket 已创建: %s", s.minio_bucket)
        except Exception as e:
            logger.warning("MinIO bucket 检查/创建失败: %s", e)
    return _minio_client


def mode() -> str:
    s = get_settings()
    if s.minio_configured:
        return "minio"
    logger.warning("MinIO 未配置，文件存储回退为本地磁盘 %s（仅限开发使用）", LOCAL_DIR)
    return "local"


def save_file(name: str, data: bytes) -> None:
    s = get_settings()
    client = _client()
    if client:
        import io
        client.put_object(s.minio_bucket, name, io.BytesIO(data), len(data))
        return
    LOCAL_DIR.mkdir(parents=True, exist_ok=True)
    (LOCAL_DIR / name).write_bytes(data)


def read_file(name: str) -> bytes | None:
    s = get_settings()
    client = _client()
    if client:
        try:
            resp = client.get_object(s.minio_bucket, name)
            try:
                return resp.read()
            finally:
                resp.close()
                resp.release_conn()
        except Exception:
            return None
    p = LOCAL_DIR / name
    return p.read_bytes() if p.is_file() else None


def delete_file(name: str) -> None:
    s = get_settings()
    client = _client()
    if client:
        try:
            client.remove_object(s.minio_bucket, name)
        except Exception:
            pass
        return
    p = LOCAL_DIR / name
    if p.is_file():
        p.unlink()
