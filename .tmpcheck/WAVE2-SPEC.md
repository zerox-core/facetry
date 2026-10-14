# WAVE 2 共享规格 · FaceTry 人才招聘工作台（前端 mockup）

> 本文件是并行页面代理的共用契约，读完后按各自任务清单施工。施工完成前不要删除本文件。

## 0. 项目与范围

- 工作区：`F:\mainshi\AI Interview Project Mockup (1)`；React 19 + Vite 8 + Tailwind CSS v4 + daisyUI 5；**纯前端 mockup，没有后端、没有 API、没有数据库**。
- 需求依据（先读这两份纯文本）：
  - `C:\Users\Lenovo\AppData\Local\Temp\facetry-docs\需求PRD文档.txt`（PRD V1.1）
  - `C:\Users\Lenovo\AppData\Local\Temp\facetry-docs\开发要求.txt`（开发要求 V1.0）
- **只做前端**：不写后端/接口/环境变量/数据库；不新增 npm 依赖。
- **冻结文件，一个字符都不要改**：`src/views/Login.tsx`、`src/views/LoginShowcase.tsx`、`src/views/Home.tsx`、`src/views/ColorBentoDashboard.tsx`（用户自己的页面）。
- **不要运行 `oxfmt` 或任何格式化器**；不要重排无关代码；不要 `git commit`。
- 只改「你的写范围」内的文件。开工前先读文件（Edit 工具要求），改动尽量贴着现有内容做，**保留与你任务无关的既有实现**（有并行改动）。

## 1. daisyUI 5 · 模式 B（用户已指定）

颜色只有一套来源：**daisyUI 语义色**。主题 `facetry` 已定义在 `src/index.css`：

| token | 值 | 含义 |
|---|---|---|
| `base-100` | `#ffffff` | 纸面 / 卡片 |
| `base-200` | `#f2f4f7` | 画布 / 凹陷层 |
| `base-300` | `#e4e7eb` | 分隔线 / 更深的底 |
| `base-content` | `#1d1d1f` | 正文（`/60`、`/50` 做次要文字） |
| `primary` | `#1d1d1f` | 品牌黑，**一屏只给最重要的那一个动作** |
| `accent` | `#b45309` | 琥珀：一屏至多一处焦点 |
| `success` / `warning` / `error` / `info` | 深绿 / 琥珀 / 深红 / 石板灰 | 语义状态 |
| `neutral` | `#2c2c2e` | 深色块 |

规则：
- 新写的颜色一律用语义类：`bg-base-100`、`bg-base-200`、`text-base-content`、`text-base-content/60`、`border-base-300`、`text-success`、`btn-primary`…；**不要**再写 `#1d1d1f`、`text-[#86868b]`、`bg-white`、`emerald-500` 这类固定值（用户的历史页面里还有，你新写的部分不要跟）。
- 圆角/阴影沿用项目令牌：卡片 `card card-border bg-base-100 shadow-[var(--shadow-paper)]`，动效 `ws-rise`。
- **禁止 v4 遗留类名**（写了等于没写）：`input-bordered`/`select-bordered`/`textarea-bordered`、`btn-group`、`card-bordered`、`card-compact`、`tabs-boxed`、`form-control`、`label-text`、`table-compact`。
- **动态类名不会被 Tailwind 扫描**：`'badge-' + tone` 无效，必须写完整字面量（用映射表把每个分支写全）。
- 组件结构是硬要求：`card` 配 `card-body`/`card-title`；`modal` 配 `modal-box`/`modal-action`；`stat` 必须放在 `stats` 里；`dropdown` 配 `dropdown-content`。
- 常用类名速查（`F:\deepseek-harness\home\skills\daisyui\references\component-classes.md` 有全表）：
  - 按钮 `btn` + `btn-primary/btn-ghost/btn-outline/btn-soft/btn-accent/btn-error` + `btn-sm` + `btn-circle`
  - 徽标 `badge badge-sm badge-soft badge-success|warning|error|info|neutral|accent|ghost`
  - 卡片 `card card-border` + `card-body`、`card-title`、`card-actions`
  - 弹窗 `modal` + `modal-box` + `modal-action`（**优先用项目封装 `Modal`，见第 4 节**）
  - 表单 `input`、`select`、`textarea`、`checkbox`、`toggle`、`radio`、`fieldset`/`label`/`fieldset-legend`
  - 导航/标签 `tabs tabs-box` + `tab` + `tab-active`；`steps`/`step`；`breadcrumbs`；`menu`
  - 数据 `table table-sm`、`stats`/`stat`/`stat-title`/`stat-value`/`stat-desc`、`progress`、`skeleton`、`status`
  - 反馈 `alert alert-soft alert-warning|success|error`、`loading loading-spinner loading-xs`、`toast toast-end`、`tooltip`
  - 结构 `join`/`join-item`、`divider`、`timeline`（`timeline-start`/`timeline-middle`/`timeline-end`）、`collapse`（`collapse-title`/`collapse-content`）、`avatar`、`kbd`
- **风格基准**：先读 `src/views/ColorBentoDashboard.tsx`（用户自己用 daisyUI 写的页面），新页面与它保持同一套语法与密度。

## 2. 数据与状态契约（`src/data.ts` / `src/store.ts`，已由核心代理完成）

**阶段枚举**（`STAGES`，来自 `src/data.ts`）：
`新入库 / 筛选中 / 待联系 / 约面中 / 面评中 / 待录取 / 已完成 / 搁置 / 已淘汰`
（旧的 `待初筛/待约面/待面试/待评价/已录取` 已全部作废，页面里若还看到就是待清理的残留。）

**`ScheduleDetail`（约面场次）**：`interviewId`、`idempotencyKey`、`slot`、`round`、`type:'online'|'offline'`、`interviewer`、`durationMin`、`status:'scheduled'|'canceled'`、`feishuCalendarStatus:'synced'|'pending'|'failed'`、`feishuMeetingUrl?`、`noticeChannel:'sms'|'email'`、`noticeStatus:'sent'|'pending'|'failed'|'confirmed'`、`noticeAttempts`、`failureReason?`、`history: ScheduleEvent[]`（`{at,by,action:'created'|'rescheduled'|'canceled'|'notice_resent'|'notice_failed',from?,to?,reason?}`）。

**`ApprovalApplication`（录取申请）**：`materials: MaterialItem[]`（`{key,name,required,status:'done'|'pending'|'missing',fileRef?}`）、`feishu`/`bpm` 两条独立的 `ApprovalTrack`（`instanceId?`/`processId?`/`status:'pending'|'approved'|'rejected'|'returned'|'canceled'`/`currentNode`/`updateTime`/`approver`/`history: ApprovalHistoryItem[]`/`retryCount`/`lastError?`）、`finalStatus: 'processing'|'approved'|'rejected'|'partial'|'returned'|'canceled'`、`idempotencyKey`。
> 聚合铁律（PRD C4）：**只有两条轨都 approved 才算整体通过**；`partial` = 单边通过，界面上绝不能显示成"已录取/已通过"。

**`Candidate`** 新增：`sourceUpdatedAt?`、`nextAction?{text,owner,dueAt}`、`stageHistory?{stage,at,by,reason?}[]`。

**store 关键导出**（以文件实际导出为准，动手前先读 `src/store.ts`；调用形态已变，旧写法会类型报错）：
- 权限：`currentUser`、`can('approval:create'|'candidate:assign'|'admin:view'|'evaluation:submit')`
- 时间：`demoNow()`、`demoClock()`、`demoToday()`（演示时间一律走它们，**不要硬编码日期、不要用 `new Date()`**）
- 约面：`schedule({cid,slot,round?,type?,interviewer?,durationMin?,channel?,by?}) → {ok:true,detail} | {ok:false,reason:'duplicate'|'not_found',existing?}`；`rescheduleSchedule(cid,newSlot,by?,reason?)`；`cancelSchedule(cid,{reason?,notifyCandidate?,by?})`；`advanceCalendarSync(cid,forceFail?)`；`resendNotice(cid,by?,forceFail?)`；`noticeQueue()`；`scheduleHistory(cid)`
- 候选人：`setStage(cid,stage,{reason?,by?})`（`updateCandidateStage` 是等价旧名）、`batchAssign(ids,name)`、`importResume(...)`
- 面评：`confirmReview(cid,by?)`；`Review` 现带 `draft`/`confirmedBy`/`confirmedAt`（AI 生成的是草稿，必须人工确认）
- 审批：`createApproval({candidateId,salary,level,onboardDate,materials?,by?}) → {ok,reason?,application?}`（`reason` 可能是 `'duplicate'|'forbidden'|'not_found'`）；`updateApprovalTrack(appId,track,status,{node?,by?,comment?})`；`retryApprovalTrack(appId,track)`；`setApprovalTrackError(appId,track,message)`；`defaultMaterials(cid)`
- 来源库：`sourceDbSync`（含 `lastError`/`failedBatch`/`canRetry`）、`triggerSourceDbSync(forceFail?)`、`simulateSyncFailure(reason?)`、`retryFailedBatch()`
- 其他：`findC/findJd/findPos` **可能返回 `undefined`**（必须兜底，不要再当它一定有值）；`slotLabel()`、`slotDate()`、`elapsedOf()`、`resetDemo()`、`useStore()`
- 幂等：`schedule` 与 `createApproval` 命中重复时会返回 `{ok:false,reason:'duplicate'}` 而不是新建——**UI 必须处理这个返回值**并提示"该时段已存在预约 / 该候选人已有在途申请单"。

## 3. 质量底线（每个页面都要满足）

1. **可访问性**：图标按钮必须有 `aria-label`；表单 `<label>` 必须与控件关联（用 `Field` 组件）；筛选按钮给 `aria-pressed`；可点击的卡片/行要么是 `<button>`，要么加 `role="button"` + `tabIndex={0}` + `onKeyDown`（Enter/Space）。
2. **弹窗**：统一用 `ui.tsx` 的 `Modal`（原生 `<dialog>`，自带焦点锁定与 Esc 关闭、点遮罩关闭），不要再手写 `ws-scrim` + `fixed inset-0` 的 div。
3. **破坏性操作**（取消面试、取消/撤销审批、下架岗位）必须二次确认并说明后果。
4. **提交类按钮**要有 `disabled`/`loading` 防重复点击；失败要给出可读原因与重试入口。
5. **空态**：列表/分组为空时给 `Empty` 组件文案，不要留白。
6. 文案中文；**不要在标签里放 emoji**（📅🔄⏳ 这类换成文字或 daisyUI 的 `status` 圆点）。
7. 日期/时间展示一律来自数据（`slot`、`at`、`updateTime`），不要写死 `'2026-10-02 14:30'`。

## 4. 共享组件（`src/views/ui.tsx`，已升级，直接用）

```tsx
<Label>小节标题</Label>
<SectionHead title="标题" sub="右侧说明" />
<Card className="p-5">…</Card>                      // card card-border bg-base-100 + 项目阴影
<Chip tone="success|warning|error|info|neutral|accent|ghost">已通过</Chip>
<Btn variant="solid|ghost|outline|accent|danger|neutral|soft|link" disabled loading type="button" ariaLabel="…">动作</Btn>
<Field label="岗位" htmlFor="pos" hint="…" error="…" required>…控件…</Field>
<Modal open={open} onClose={() => setOpen(false)} title="标题" sub="副标题" footer={<>…按钮…</>}>…内容…</Modal>
<Empty title="暂无数据" hint="说明" action={<Btn>去创建</Btn>} />
<ScoreStamp score={4.2} />
```

## 5. 自检（只做这两件，不要跑 `pnpm build`，避免多人同时写 dist）

```powershell
node .\node_modules\typescript\bin\tsc -p tsconfig.json --noEmit
```
只看**你自己文件**的报错并清零；其他文件的报错可能是别的代理正在改，忽略即可（但不要因为别人报错就去改别人的文件）。
