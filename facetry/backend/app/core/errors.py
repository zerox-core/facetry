"""统一错误：HTTP 状态码语义与旧 Node 后端一致，错误体 {"error": "中文提示"}"""

from fastapi import Request
from fastapi.responses import JSONResponse


class AppError(Exception):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.message = message
        self.status = status


def fail(message: str, status: int = 400) -> AppError:
    return AppError(message, status)


async def app_error_handler(_request: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(status_code=exc.status, content={"error": exc.message})


async def unhandled_error_handler(_request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(status_code=500, content={"error": "服务处理失败，请重试"})
