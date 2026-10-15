# FaceTry 人才招聘工作台 · 独立前端工程

本分支为 **FaceTry / 知马人才招聘工作台** 的独立前端仓库分支。采用 React 19 + TypeScript + Vite 7 + Tailwind CSS 4 构建，已与后端 FastAPI 服务接口完成完全解耦与契约对齐。

---

## 快速开始

### 1. 安装依赖

推荐使用 Node.js >= 20：

```bash
npm install
```

### 2. 本地开发调试

```bash
npm run dev
```

默认启动在 `http://127.0.0.1:5173/`。

开发服务器会自动将 `/api` 和 `/files` 接口请求反向代理到后端服务（默认目标为 `http://127.0.0.1:8080`）。

若后端部署在其他端口或远程服务器，可通过环境变量指定代理地址：

```bash
# Windows PowerShell:
$env:API_PROXY_TARGET = "http://127.0.0.1:8080"
npm run dev

# Linux / macOS:
API_PROXY_TARGET=http://127.0.0.1:8080 npm run dev
```

### 3. 构建生产产物

```bash
npm run build
```

构建产物将输出至 `./dist` 目录，可直接交付 Nginx、CDN 或由后端框架静态托管。

### 4. 运行前端自动化测试

```bash
npm test
```

执行契约与业务逻辑单元测试（分页保护、数据映射适配、时间解析与安全校验）。

---

## 目录结构

```text
├── public/                 # 静态资源（Logo、Favicon、PDF.js 依赖等）
├── src/
│   ├── App.jsx             # 招聘工作台业务主框架与路由切换
│   ├── Views.jsx           # 核心业务视图（人才库、JD与岗位、约面日历、面试评价、录取流转、待办）
│   ├── Modals.jsx          # 弹窗与交互向导（创建约面、改期取消、发起录取审批等）
│   ├── UI.jsx              # 通用 UI 原子组件与业务徽标
│   ├── adapters.mjs        # 业务数据模型适配器与契约转换
│   ├── legacy/             # 登录页、原版面试助手、题库、管理后台等延续模块
│   │   ├── api.ts          # API 客户端封装与鉴权拦截
│   │   ├── types.ts        # 全量业务 TypeScript 类型定义
│   │   ├── pdf.ts          # 简历 PDF 原文渲染与文本层解析
│   │   ├── store.ts        # 状态管理
│   │   ├── views/          # 视图组件（登录、面试辅助、题库、管理等）
│   │   └── components/     # 组件库（PDF 预览器、选择器、打分器等）
│   └── main.jsx            # 前端启动挂载入口
├── tests/                  # 前端单元与契约测试集
├── index.html              # HTML 模板入口
├── vite.config.mjs         # Vite 构建与反代配置
└── package.json            # 项目依赖与运行脚本
```

---

## 业务特性

- **人才与简历管理**：多渠道候选人库、岗位关联、简历正文检索与原件 PDF 预览、AI 初筛报告联动。
- **岗位与 JD 管理**：JD 模板库、岗位 JD 版本追踪与多岗位关联。
- **面试与日程安排**：线上/线下约面排期、日历视图、改期/取消、飞书日历与邮件通知状态追踪。
- **面试评价工作台**：复用准备/面试/面评三阶段体验、逐题打分与 AI 辅助面评草稿确认。
- **录取审批与跟进**：双通道状态跟踪（飞书审批与 BPM 流程），申请全流程闭环。
