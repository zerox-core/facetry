# Facetry — AI 面试工作台（前端 Mockup）

一个 AI 面试平台的**纯前端交互原型**，用 Figma Make 生成并手工调整。面向面试官的工作台 + 候选人面试间的完整双端流程，全部演示数据内置在浏览器本地，无需后端即可完整体验。

## 功能概览

**面试官端**（本地登录后进入）：

- **工作台**：今日面试日程、待办与快捷入口
- **总览**：历史面试记录、评分与结论统计
- **候选人**：候选人列表，含匹配度、轮次、来源；支持模拟简历导入
- **候选人分析**：简历逐段标注（亮点 / 风险），并据此生成**定制面试题**——每题带考察点、参考答案、追问与红旗信号
- **题库**：按方向分类的热门面试题
- **面试间**：独占全屏的现场记录页，实时记录与打分
- **结果分析**：面试后的评分拆解与结论页

**候选人端**：通过分享链接 `?join=<候选人id>` 直接进入面试间，无需登录，也看不到任何后台信息。

## 技术栈

- React 19 + TypeScript
- Vite 8（`@vitejs/plugin-react`）
- Tailwind CSS v4（`@tailwindcss/vite`，无单独配置文件）
- 状态与演示数据：`src/store.ts` + `src/data.ts`，持久化在 localStorage（顶栏可一键「重置演示数据」）

## 本地运行

```bash
pnpm install
pnpm dev        # 默认 8443 端口（PORT 环境变量可覆盖）
pnpm build      # 生产构建
pnpm preview    # 预览构建产物
```

工具链版本见 `.mise.toml`（Node 22 + pnpm 10.34.3）。

## 项目结构

```
index.html          Vite HTML 壳
vite.config.ts      Vite + React + Tailwind v4 配置（含 Figma Make 插件与 @ 别名）
src/
  main.tsx          入口，挂载 App
  App.tsx           顶层路由/导航（页面栈），登录态与 join 链接分发
  store.ts          全局状态与演示数据重置
  data.ts           内置演示数据：候选人、简历标注、定制题、题库、历史记录
  voice.ts          语音相关逻辑
  views/            各页面：Home / Overview / Candidates / Bank / Interviewer /
                    Offline(面试间) / Result / Login / Join / ResumeDoc / ui(共享组件)
docs/
  design-system.md  设计系统（主题、色彩、排版、组件、动效）
  backend.md        后端契约（数据模型、REST/WS API、分享链接、ASR、AI 任务）
plans/              方案与规划文档
```

## 说明

- 本项目是 Mockup：无真实后端与 AI 调用，`docs/backend.md` 是计划中的后端契约。
- UI 规范以 `docs/design-system.md` 为准；共享组件在 `src/views/ui.tsx`，设计令牌在 `src/index.css`。
