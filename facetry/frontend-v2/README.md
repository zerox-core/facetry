# 知马招聘工作台 · 新版前端

从用户提供的「知马招聘工作台-源码.zip」移入业务页面，接入本项目的 Python / FastAPI 后端。压缩包中的原型说明用于理解设计，没有沿用其中“仅模拟数据、不接后端”的限制。

## 保留与替换

- `src/legacy/views/Login.tsx`、`LoginShowcase.tsx`、`src/legacy/index.css` 和 `public/` 从原前端复制，保留原登录首页及交互。
- `src/App.jsx`、`Views.jsx`、`Modals.jsx`、`UI.jsx` 为新版招聘业务页面。原型 CSS 限定在 `.app` 内，避免影响登录首页。
- `src/legacy/api.ts` 沿用现有接口，补充登录过期处理；`adapters.mjs` 映射真实业务对象，不加载原型的虚构候选人。
- 旧前端仍在 `../src`。面试助手、评审、题库、管理和原版工作台在新版“工作工具”内继续使用。
- 根目录 `npm run dev` / `build` 默认使用新版，`npm run dev:legacy` / `build:legacy` 使用原前端。两个版本构建均输出 `../dist`，以后一次构建为准。
- Docker 构建也默认包含新版前端。

## 本地运行

在 `facetry` 目录中执行：

```powershell
npm install
python -m pip install -r backend/requirements.txt
npm run server
```

另一个终端执行 `npm run dev`。后端先读取旧服务的 `server/.env`，再读取 `backend/.env`（后者覆盖前者，进程环境变量优先），复用已有的模型/飞书环境配置。前端代理优先使用 `API_PROXY_TARGET`，然后依次采用进程 `APP_PORT` / `PORT`、`backend/.env` 中的 `APP_PORT`，最后回退到 8080。

可显式指定代理：

```powershell
$env:API_PROXY_TARGET = 'http://127.0.0.1:18080'
npm run dev
```

也可以在本目录 `npm install` 后独立运行 `npm run dev` / `build`。`npm run server:legacy` 保留原 Node 服务；新版的招聘接口需要 Python 服务，不能代理至旧 Node 服务。

## 已接入的操作

| 页面 | 后端行为 |
| --- | --- |
| 人才与简历 | 读取全部候选人、筛选、简历正文、原附件链接、阶段更新、所有跟进记录、关联岗位、后台初筛与结果轮询 |
| 岗位与 JD | 创建/编辑 JD 模板、创建/编辑岗位、岗位状态、岗位 JD 版本与关联人数 |
| 面试安排 | 创建、改期、取消、标记完成、会议链接、通知状态、失败通知重发 |
| 面试评价 | 按具体岗位和面试轮次保存草稿/确认评价，查看已确认内容 |
| 录取流程 | 创建申请、双侧审批状态与错误、历史记录、查询最新状态、撤销申请 |

JD 模板通过 `/api/jds` 保存；选用模板创建岗位时，将内容复制进 `/api/positions` 的独立 JD。编辑岗位 JD 产生后端版本，历史匹配保留原版本。模板修改不会隐式覆盖既有岗位。

候选人列表原来只返回两个岗位匹配，本次改为返回全部摘要，避免多岗位筛选遗漏候选人。

## 外部服务的实际边界

页面展示后端返回的状态。飞书 OAuth / 日程 / 审批、模型、来源库和邮件需要在后端配置。现有后端的 BPM 仍为 mock，短信为 stub，飞书审批未配置时也使用 mock；新版会显示模拟实例与异常，不能视为已完成真实外部系统对接。

未配置来源库时禁用新版的来源库同步按钮，避免后端默认生成演示候选人。原始数据仍由现有采集/来源库流程入库。

旧 Node SQLite 与 Python MySQL 是不同的存储；本次没有迁移或覆盖旧数据库、旧文件和既有配置。旧 `server/config.json` 中的回调地址等设置若未写入环境变量，应在 `backend/.env` 中配置对应的 `FEISHU_REDIRECT_URI` 等字段。

## 验证

```powershell
npm run test:v2
python frontend-v2/tests/backend_integration.py
npm run build
```

`backend_integration.py` 使用临时 SQLite，明确跳过 `backend/.env`，覆盖认证、JD/岗位版本、多岗位关联、跟进、约面幂等、改期、不同轮次面评、录取刷新/撤销。不会连接真实通知与审批服务。

隔离浏览器联调：

```powershell
python frontend-v2/tests/serve_backend.py
```

在另一终端将 `API_PROXY_TARGET` 设为 `http://127.0.0.1:18085` 后启动前端。该服务仅监听本机，使用临时数据库和明确标记的虚构数据。
