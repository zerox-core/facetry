# ---------- 前端构建 ----------
FROM harku.livzon.cn/webapp/node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --registry=https://registry.npmmirror.com
COPY index.html vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY src ./src
COPY public ./public
COPY frontend-v2 ./frontend-v2
RUN npm run build

# ---------- Python 后端依赖 ----------
ARG PY_IMAGE=harku.livzon.cn/webapp/python:3.12-slim
FROM ${PY_IMAGE} AS py-deps
WORKDIR /app/backend
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple

# ---------- 运行 ----------
FROM ${PY_IMAGE}
ENV APP_HOST=0.0.0.0 \
    APP_PORT=8080 \
    APP_ENV=prod \
    PYTHONUNBUFFERED=1
WORKDIR /app
COPY --from=py-deps /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY backend/app ./backend/app
COPY backend/alembic ./backend/alembic
COPY backend/alembic.ini ./backend/alembic.ini
COPY --from=build /app/dist ./dist
# 数据目录：开发回退（sqlite / 本地文件存储）使用；生产应配置 MySQL 与 MinIO
RUN mkdir -p /app/backend/data && useradd -r -u 1000 app && chown -R app:app /app
USER app
EXPOSE 8080
# 启动前执行数据库迁移，再启动服务
CMD ["sh", "-c", "cd backend && alembic upgrade head && python -m uvicorn app.main:app --host ${APP_HOST} --port ${APP_PORT}"]
