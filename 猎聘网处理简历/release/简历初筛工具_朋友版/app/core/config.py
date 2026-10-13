"""程序配置加载"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent  # app/core/config.py → 项目根
CONFIG_PATH = ROOT / "config.json"


def load_config() -> dict:
    if not CONFIG_PATH.exists():
        raise FileNotFoundError(f"配置文件不存在: {CONFIG_PATH}")
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def get_db_path(cfg: dict) -> Path:
    return ROOT / cfg.get("db_path", "data/recruit.db")


def get_jd_path(cfg: dict = None) -> Path:
    """JD 文件路径，约定与程序同级"""
    return ROOT / "职位JD汇总.xlsx"


if __name__ == "__main__":
    c = load_config()
    print(json.dumps(c, ensure_ascii=False, indent=2))
