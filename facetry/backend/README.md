# FaceTry 人才招聘工作台 · Python 后端

FastAPI + Uvicorn + SQLAlchemy 2.x + Alembic，完全替代旧 Node 后端 `server/server.js`，并新增招聘业务模块（候选人 / 岗位 JD / AI 初筛 / 约面 / 面评 / 录取审批）。接口逐条对齐 `design/api-contract-v2.md`。

## 启动

```bash
cd backend
python -m pip install -r requirements.txt

# 开发（sqlite 回退 + 演示登录）
APP_PORT=8080 ENABLE_DEMO_LOGIN=true python -m uvicorn app.main:app

# 数据库迁移（生产部署）
python -m alembic upgrade head
```

- 端口默认 `APP_PORT`（缺省 8080，与 vite proxy 对齐）；托管 `../dist` 前端产物，非 `/api`、`/files` 路径 SPA 回退 `index.html`。
- 冒烟验证：`python smoke_test.py`（需服务已启动且 `ENABLE_DEMO_LOGIN=true`、管理员为 `demo:测试`，即 `ADMIN_USERS="demo:测试"`）。

## 目录结构

```
backend/
├── app/
│   ├── main.py              # 应用装配：CORS 等价校验、静态托管、Job 执行器注册与恢复
│   ├── models.py            # SQLAlchemy ORM（旧表 JSON blob 语义 + 新业务结构化表）
│   ├── core/
│   │   ├── config.py        # pydantic-settings，全部配置来自环境变量
│   │   ├── database.py      # 引擎/会话；MYSQL_HOST 为空回退 sqlite（日志警告）
│   │   ├── deps.py          # zm_sess cookie 会话、require_user/admin/super
│   │   ├── errors.py        # {"error":"中文"} 统一错误体
│   │   └── prompts.py       # 面试助手 4 条提示词（逐字迁移）+ AI 初筛提示词
│   ├── services/
│   │   ├── perm.py          # 组共享权限 canViewScoped/canEditScoped、组织架构缓存
│   │   ├── jobs.py          # 内存注册表 + jobs 表持久化，重启恢复 running 任务
│   │   ├── llm.py           # OpenAI 兼容调用，网络/解析各重试一次，超时 600s
│   │   ├── assistant.py     # analyze/evaluate 两阶段执行器（等价旧逻辑）
│   │   ├── bank_store.py    # 题库 load/save/ensureSeeds/resolvePart + 种子数据
│   │   ├── jds_store.py     # 共享 JD 库
│   │   ├── feishu.py        # token 缓存、OAuth、组织架构、日历事件、审批实例
│   │   ├── storage.py       # MinIO / 本地磁盘回退（backend/data/files/）
│   │   ├── source.py        # 来源库只读适配层 + 演示数据生成器
│   │   ├── screening.py     # AI 初筛（LLM + 硬规则兜底 + 本地关键词降级）
│   │   ├── notify.py        # SMTP 邮件 + 短信 stub
│   │   ├── bpm.py           # BPM mock 适配层
│   │   ├── feedback.py      # 面评 AI 草稿
│   │   └── serializers.py   # 契约第 2 节响应形状
│   └── routers/             # auth / sessions / files(jobs) / bank / jds / admin /
│                            # candidates / positions / interviews / offers / todos
├── alembic/                 # 迁移（含初始迁移 init）
├── smoke_test.py            # 冒烟脚本（26 项断言）
└── requirements.txt
```

## 配置

全部来自环境变量（模板见根目录 `.env.example`），代码零硬编码连接串/密钥。要点：

- **业务库**：`DATABASE_URL` 直接覆盖 > `MYSQL_*` 拼装（pymysql）> sqlite 回退 `data/facetry-dev.db`（日志警告，仅开发）。
- **会话**：`zm_sess` HttpOnly Cookie，30 天，随机 token 存 auth 表；管理员名单 `ADMIN_USERS` / `SUPER_ADMIN_USERS`（逗号分隔用户 id）+ 数据库 meta（首个飞书用户自动成为管理员）。
- **LLM**：`LLM_BASE_URL/LLM_API_KEY/LLM_MODEL`，未配置时 AI 初筛走本地规则降级，面试助手任务报错 503。

## 外部服务降级行为（未配置时绝不崩溃）

| 服务 | 未配置时行为 |
| --- | --- |
| 飞书 OAuth | `/api/auth/feishu` 报 503「未配置飞书应用」；其余功能不受影响 |
| 飞书日历 | 约面创建后 `interview.notify.feishu.state=skipped` |
| 飞书审批 | 未配置 `FEISHU_APPROVAL_CODE` 时 offer 飞书侧走 mock 推进（实例号 `MOCK-FS-*`） |
| MinIO | 回退本地磁盘 `data/files/`，启动日志警告；`/files/{name}` 权限校验不变 |
| SMTP | `interview.notify.email.state=skipped`；模板 `MAIL_TEMPLATE_INTERVIEW` 留空用内置默认 |
| 短信 | 适配层 stub，`state=skipped`（服务商待确认） |
| BPM | mock 适配层：流程号 `MOCK-BPM-*`，refresh 按时间推进 submitted→processing→approved |
| 来源库 | `SOURCE_DB_*` 未配置时 `POST /api/admin/sync` 生成 10 个医药行业演示候选人（channel=demo/演示数据）；幂等 `(channel, sourceId)` 唯一约束 |
| LLM | 初筛走本地关键词规则（结论标注「规则版」）；analyze/evaluate 报「大模型接口未配置」 |

## 待确认事项（代码内以 TODO/适配层隔离）

1. **来源库表结构**：`services/source.py` 顶部 `SOURCE_TABLE` / `FIELD_MAP` 为约定值，待采集侧（影刀）提供样例后调整；当前仅实现 mysql 类型。
2. **AI 初筛提示词**：契约第 5 节要求逐字采用《简历比对的业务流程与提示词》，该文档原文未随任务提供，`core/prompts.py` 中 `SCREEN_SYS` / `SCREEN_USER_TMPL` 按契约摘要撰写，拿到原文后逐字替换。
3. **飞书审批控件映射**：`services/feishu.py` `create_approval_instance` 的 form 控件为通用占位（candidate/position/note），待业务方确认审批定义后配置化。
4. **BPM 接入方式**（开放 API / 数据库 / 其他）未定：`services/bpm.py` 的 submit/refresh/cancel 为 mock，接口形状即真实接入点。
5. **短信服务商**：`services/notify.py` `send_sms` 为 stub，确认服务商后按 provider 分发。
6. **审批串并联关系**：当前 overall 汇总规则为「全部通过=approved；退回/拒绝/撤销/异常优先暴露」，两套审批的必经节点与最终结论来源待 HR 确认后配置化。
