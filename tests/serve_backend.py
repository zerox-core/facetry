"""Isolated local integration fixture. Never loads backend/.env or existing databases.

Run from facetry: python frontend-v2/tests/serve_backend.py
"""
from pathlib import Path
import sys
import tempfile

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))
import app.core.config as config

preview_dir = Path(tempfile.mkdtemp(prefix="facetry-v2-preview-"))
values = {name: field.default for name, field in config.Settings.model_fields.items()}
values.update(database_url="sqlite:///" + (preview_dir / "test.db").as_posix(),
              app_port=18085, enable_demo_login=True, admin_users="demo:演示用户", secret_key="isolated-local-preview")
settings = config.Settings(_env_file=None, **values)
config.get_settings = lambda: settings

from app.main import app
from app.core.database import Base, engine, SessionLocal
from app.models import CandidateRow, PositionRow, MatchRow, iso_now

Base.metadata.create_all(engine)
now = iso_now()
with SessionLocal() as db:
    db.add(PositionRow(id="preview-position", title="前端工程师", city="珠海", department="研发部", status="open",
                       jdContent="负责招聘工作台的 React 前端开发与接口接入。", jdRequirements="React TypeScript 本科 3年",
                       jdVersion=1, jdUpdatedAt=now, createdAt=now, updatedAt=now))
    for cid, name, linked in [("preview-linked", "示例候选人", True), ("preview-unlinked", "未关联候选人", False)]:
        db.add(CandidateRow(id=cid, name=name, currentPosition="前端工程师", currentCompany="示例科技", expectedCity="珠海",
                            education="本科", major="计算机科学", yearsOfExperience=4, skills=["React", "TypeScript"],
                            channel="fixture", channelName="测试来源", sourceId=cid, summary="仅用于新版前端本地联调的虚构数据。",
                            resumeText="工作经历\n示例科技 · 前端工程师\n负责 React 招聘产品开发，使用 TypeScript 接入后端 API。\n教育经历\n本科 · 计算机科学",
                            stage="new", ownerId="demo:演示用户", ownerName="演示用户", createdAt=now, updatedAt=now))
        if linked:
            db.add(MatchRow(id="preview-match",candidateId=cid,positionId="preview-position",score=82,verdict="合适",
                            aiSummary="测试匹配：具有 React 开发经验。",hits=["React", "TypeScript"],jdVersion=1,
                            jdSnapshot={"title":"前端工程师"},screenedAt=now,createdAt=now,updatedAt=now))
    db.commit()

if __name__ == "__main__":
    import uvicorn
    print(f"Isolated fixture DB: {preview_dir}", flush=True)
    uvicorn.run(app, host="127.0.0.1", port=18085)
