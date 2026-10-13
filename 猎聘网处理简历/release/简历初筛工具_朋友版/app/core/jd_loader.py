"""JD 加载：从《职位JD汇总.xlsx》读岗位"""
from dataclasses import dataclass
from pathlib import Path

from openpyxl import load_workbook


@dataclass
class JD:
    key: str          # 唯一标识：岗位名
    seq: str         # 序号（来自 xlsx）
    name: str        # 岗位名称
    city: str        # 工作城市
    description: str  # 职位描述
    requirements: str  # 职位要求
    note: str = ""   # 备注 / 黑名单


def load_jds(xlsx_path: Path) -> list[JD]:
    if not xlsx_path.exists():
        return []
    wb = load_workbook(xlsx_path)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return []
    headers = [str(h).strip() if h else "" for h in rows[0]]
    # 列名映射
    col = {h: i for i, h in enumerate(headers)}
    out: list[JD] = []
    for r in rows[1:]:
        if not r or all(v in (None, "") for v in r):
            continue
        seq = str(r[col.get("序号", 0)] or "").strip()
        name = str(r[col.get("岗位名称", 1)] or "").strip()
        if not name:
            continue
        out.append(
            JD(
                key=f"{seq}.{name}" if seq else name,
                seq=seq,
                name=name,
                city=str(r[col.get("城市", 2)] or "").strip(),
                description=str(r[col.get("职位描述", 3)] or "").strip(),
                requirements=str(r[col.get("职位要求", 4)] or "").strip(),
                note=str(r[col.get("备注", 5)] or "").strip(),
            )
        )
    return out


if __name__ == "__main__":
    import sys

    sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
    from app.core.config import get_jd_path

    jds = load_jds(get_jd_path())
    print(f"加载 {len(jds)} 个 JD:")
    for jd in jds:
        print(f"  - {jd.key} | {jd.city}")
        if jd.note:
            print(f"    备注: {jd.note[:80]}")
