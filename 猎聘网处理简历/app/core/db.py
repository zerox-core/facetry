"""SQLite 数据访问层"""
import json
import sqlite3
import threading
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

_LOCK = threading.Lock()


def get_conn(db_path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    return conn


def init_db(db_path: Path) -> None:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    schema_path = Path(__file__).resolve().parent.parent / "data" / "schema.sql"
    sql = schema_path.read_text(encoding="utf-8")
    with _LOCK, get_conn(db_path) as conn:
        conn.executescript(sql)
        conn.commit()


# ---------- 扫描会话 ----------

def create_session(db_path: Path, session_id: str, platform: str) -> None:
    with _LOCK, get_conn(db_path) as conn:
        conn.execute(
            "INSERT OR IGNORE INTO scan_sessions (id, platform) VALUES (?, ?)",
            (session_id, platform),
        )
        conn.commit()


def finish_session(db_path: Path, session_id: str, stats: dict) -> None:
    with _LOCK, get_conn(db_path) as conn:
        conn.execute(
            """UPDATE scan_sessions
               SET finished_at = CURRENT_TIMESTAMP,
                   status = 'done',
                   scanned_count = ?, qualified = ?, pending = ?,
                   rejected = ?, incomplete = ?
             WHERE id = ?""",
            (
                stats.get("scanned", 0),
                stats.get("qualified", 0),
                stats.get("pending", 0),
                stats.get("rejected", 0),
                stats.get("incomplete", 0),
                session_id,
            ),
        )
        conn.commit()


def list_sessions(db_path: Path, limit: int = 30) -> list[dict]:
    with get_conn(db_path) as conn:
        rows = conn.execute(
            "SELECT * FROM scan_sessions ORDER BY started_at DESC LIMIT ?",
            (limit,),
        ).fetchall()
        return [dict(r) for r in rows]


# ---------- 候选人 ----------

def insert_candidate(db_path: Path, c: dict) -> int:
    with _LOCK, get_conn(db_path) as conn:
        cur = conn.execute(
            """INSERT INTO candidates (
                scan_session_id, scanned_at, platform, candidate_name,
                current_position, current_company, expected_city, applied_position, jd_key,
                verdict, score, reason, hits, misses, detail_json, page_url
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                c["scan_session_id"],
                c.get("scanned_at"),
                c["platform"],
                c.get("candidate_name"),
                c.get("current_position"),
                c.get("current_company"),
                c.get("expected_city"),
                c.get("applied_position"),
                c.get("jd_key"),
                c["verdict"],
                c.get("score"),
                c.get("reason"),
                json.dumps(c.get("hits", []), ensure_ascii=False),
                json.dumps(c.get("misses", []), ensure_ascii=False),
                json.dumps(c.get("detail", {}), ensure_ascii=False),
                c.get("page_url"),
            ),
        )
        conn.commit()
        return cur.lastrowid


def mark_operated(db_path: Path, candidate_id: int, verdict: str) -> None:
    with _LOCK, get_conn(db_path) as conn:
        conn.execute(
            "UPDATE candidates SET operated = 1, operated_at = CURRENT_TIMESTAMP, verdict = ? WHERE id = ?",
            (verdict, candidate_id),
        )
        conn.commit()


def update_verdict(db_path: Path, candidate_id: int, verdict: str) -> None:
    """仅更新判定标签（用于人工手动纠正 AI 误判），不影响 operated / operated_at。"""
    if verdict not in {"合适", "待定", "不合适", "信息不足"}:
        raise ValueError("verdict 非法")
    with _LOCK, get_conn(db_path) as conn:
        conn.execute(
            "UPDATE candidates SET verdict = ? WHERE id = ?",
            (verdict, candidate_id),
        )
        conn.commit()


def list_candidates(
    db_path: Path,
    verdict: Optional[str] = None,
    jd_key: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    platform: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
) -> dict:
    """返回过滤+分页后的候选人。

    返回 dict: {'rows': [...], 'total': 过滤后的总条数（用于前端算总页数）}。
    排序：id 倒序（最新扫描的在最前）。
    """
    where = "WHERE 1=1"
    params: list[Any] = []
    if verdict and verdict != "全部":
        where += " AND verdict = ?"
        params.append(verdict)
    if jd_key and jd_key != "全部岗位":
        where += " AND applied_position = ?"
        params.append(jd_key)
    if platform and platform != "全部平台":
        where += " AND platform = ?"
        params.append(platform)
    if date_from:
        where += " AND scanned_at >= ?"
        params.append(date_from)
    if date_to:
        where += " AND scanned_at <= ?"
        params.append(date_to + " 23:59:59")
    with get_conn(db_path) as conn:
        total = conn.execute(f"SELECT COUNT(*) c FROM candidates {where}", params).fetchone()["c"]
        offset = max(0, page - 1) * page_size
        rows = conn.execute(
            f"SELECT * FROM candidates {where} ORDER BY id DESC LIMIT ? OFFSET ?",
            params + [page_size, offset],
        ).fetchall()
    return {"rows": [dict(r) for r in rows], "total": total}


def delete_candidates(db_path: Path, ids: list) -> int:
    """按 id 列表批量删除候选人记录，返回实际删除行数。"""
    try:
        clean = [int(i) for i in ids if str(i).strip().isdigit()]
    except Exception:
        clean = []
    if not clean:
        return 0
    placeholders = ",".join("?" * len(clean))
    with _LOCK, get_conn(db_path) as conn:
        cur = conn.execute(
            f"DELETE FROM candidates WHERE id IN ({placeholders})", clean
        )
        conn.commit()
        return cur.rowcount
    return 0


def aggregate_stats(db_path: Path, today_only: bool = False) -> dict:
    """统计: 累计扫描 / 今日扫描 / 合适 / 待定 / 不合适 / 信息不足"""
    today_predicate = "AND date(scanned_at) = date('now','localtime')" if today_only else ""
    with get_conn(db_path) as conn:
        total = conn.execute("SELECT COUNT(*) c FROM candidates").fetchone()["c"]
        today = conn.execute(
            "SELECT COUNT(*) c FROM candidates WHERE date(scanned_at) = date('now','localtime')"
        ).fetchone()["c"]
        rows = conn.execute(
            f"SELECT verdict, COUNT(*) c FROM candidates WHERE 1=1 {today_predicate} GROUP BY verdict"
        ).fetchall()
    by_verdict = {r["verdict"]: r["c"] for r in rows}
    return {
        "total": total,
        "today": today,
        "qualified": by_verdict.get("合适", 0),
        "pending": by_verdict.get("待定", 0),
        "rejected": by_verdict.get("不合适", 0),
        "incomplete": by_verdict.get("信息不足", 0),
    }


if __name__ == "__main__":
    from app.core.config import get_db_path

    test_db = Path(__file__).resolve().parent.parent / "data" / "test.db"
    init_db(test_db)
    print("DB init ok:", test_db)
