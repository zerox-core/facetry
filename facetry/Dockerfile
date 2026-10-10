# ---------- 前端构建 ----------
FROM harku.livzon.cn/webapp/node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --registry=https://registry.npmmirror.com
COPY index.html vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY src ./src
COPY public ./public
RUN npm run build

# ---------- 后端依赖（仅生产依赖） ----------
FROM harku.livzon.cn/webapp/node:22-slim AS server-deps
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev --registry=https://registry.npmmirror.com

# ---------- 运行 ----------
FROM harku.livzon.cn/webapp/node:22-slim
ENV NODE_ENV=production \
    PORT=8080 \
    SQLITE_PATH=/data/app.db
WORKDIR /app
COPY --from=server-deps /app/server/node_modules ./server/node_modules
COPY server/server.js server/prompts.js server/bank-seed.js server/config.example.json ./server/
COPY --from=build /app/dist ./dist
# 数据目录：SQLite 数据库与上传的简历附件，由平台挂载持久卷
RUN mkdir -p /data && chown -R node:node /data /app
USER node
EXPOSE 8080
CMD ["node", "server/server.js"]
