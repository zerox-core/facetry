import logging
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import urlparse

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse

from .core.config import get_settings
from .core.database import Base, engine
from .core.errors import AppError, app_error_handler, unhandled_error_handler
from .routers import admin, auth, bank, candidates, files, interviews, jds, offers, positions, sessions, todos
from .services import assistant, jobs as jobsvc, screening, source

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("facetry.main")

DIST_DIR = Path(__file__).resolve().parent.parent.parent / "dist"

MIME = {".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript",
        ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".ico": "image/x-icon",
        ".webp": "image/webp", ".woff": "font/woff", ".woff2": "font/woff2", ".map": "application/json",
        ".pdf": "application/pdf", ".png": "image/png", ".jpg": "image/jpeg", ".txt": "text/plain; charset=utf-8"}


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # 开发便利：直接建表；生产走 alembic upgrade head
    Base.metadata.create_all(engine)
    jobsvc.register_executor("analyze", assistant.execute_analyze)
    jobsvc.register_executor("evaluate", assistant.execute_evaluate)
    jobsvc.register_executor("screen", screening.execute_screen)
    jobsvc.register_executor("rescreen", screening.execute_rescreen)
    jobsvc.register_executor("feedback_draft", screening.execute_feedback_draft)
    jobsvc.register_executor("source_sync", source.execute_source_sync)
    jobsvc.restore_jobs()
    logger.info("FaceTry 后端已启动（端口 %s）", get_settings().app_port)
    yield


app = FastAPI(title="FaceTry 人才招聘工作台", lifespan=lifespan)
app.add_exception_handler(AppError, app_error_handler)
app.add_exception_handler(Exception, unhandled_error_handler)


@app.middleware("http")
async def origin_check(request: Request, call_next):
    """等价旧逻辑：只允许同源或 localhost/127.0.0.1 的 Origin"""
    origin = request.headers.get("origin")
    if origin:
        host = ""
        try:
            host = urlparse(origin).hostname or ""
        except Exception:
            pass
        same_origin = origin == f"http://{request.headers.get('host')}" or origin == f"https://{request.headers.get('host')}"
        if not same_origin and host not in ("localhost", "127.0.0.1"):
            return JSONResponse(status_code=403, content={"error": "不允许跨来源请求"})
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
    return response


for r in (auth.router, sessions.router, bank.router, jds.router, admin.router,
          candidates.router, positions.router, interviews.router, offers.router, todos.router, files.router):
    app.include_router(r)


@app.get("/{path:path}", include_in_schema=False)
async def static_files(path: str):
    """托管前端构建产物 ../dist，非 /api、/files 路径 SPA 回退 index.html"""
    from .core.errors import fail
    if path.startswith("api/") or path.startswith("files/"):
        raise fail("接口不存在", 404)
    target = (DIST_DIR / path).resolve() if path else DIST_DIR / "index.html"
    try:
        if not target.is_relative_to(DIST_DIR):
            raise fail("文件不存在", 404)
    except AttributeError:
        if not str(target).startswith(str(DIST_DIR)):
            raise fail("文件不存在", 404)
    if not target.is_file():
        target = DIST_DIR / "index.html"
    if not target.is_file():
        raise fail("前端尚未构建（缺少 dist/index.html）", 404)
    return FileResponse(target, media_type=MIME.get(target.suffix, "application/octet-stream"),
                        headers={"X-Content-Type-Options": "nosniff", "Cache-Control": "no-cache"})


if __name__ == "__main__":
    import uvicorn
    s = get_settings()
    uvicorn.run("app.main:app", host=s.app_host, port=s.app_port)
