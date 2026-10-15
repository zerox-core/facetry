# FaceTry 人才招聘工作台 · 前后端 API 契约（V2）

> 本文件是前端 `src/` 与 Python 后端 `backend/` 的唯一对齐口径。
> 原则：**既有接口语义零破坏**（面试助手、登录、题库、管理），新业务接口全部新增。
> 错误体统一为 `{ "error": "中文提示" }`，HTTP 状态码语义与旧 Node 后端一致（400 参数 / 401 未登录 / 403 无权限 / 404 不存在 / 409 冲突 / 422 内容无效 / 502 外部服务异常 / 503 未配置）。
> 所有时间均为 ISO 8601 字符串。所有 id 为字符串。异步任务一律走 Job 轮询模式：`POST` 返回 `202 + Job`，前端轮询 `GET /api/jobs/{id}`。

## 0. 既有接口（保持不变，Python 等价实现）

- `GET /api/status` → `{ configured: boolean, feishu: boolean }`
- `GET /api/auth/feishu`（302 跳转飞书授权）、`GET /api/auth/feishu/callback`（换 token、建档、种 cookie、302 回 `/`；失败 302 回 `/?login_error=...`）
- `POST /api/auth/demo`（仅 `ENABLE_DEMO_LOGIN=true` 时可用，body `{name}`）
- `GET /api/auth/me` → `{ user: {id,name,avatar,isAdmin,isSuper}, groups: UserGroup[] }`
- `POST /api/auth/logout` → 204
- `GET /api/users` → `{ users: [{id,name,avatar,groupName}] }`
- `GET /api/sessions`、`GET/PATCH/DELETE /api/sessions/{id}`、`POST /api/sessions/{id}/analyze|evaluate`、`POST /api/upload`、`GET /api/jobs/{id}`、`GET /files/{name}` —— 语义同旧 `server/server.js`，会话字段结构同 `src/types.ts` 的 `Session`。
- `GET/POST /api/bank`、`PATCH/DELETE /api/bank/{id}`、`PATCH /api/bank/parts/{key}`、`POST /api/bank/generate`
- `GET/POST /api/jds`、`PATCH/DELETE /api/jds/{id}`（面试助手用的共享 JD 库，保留）
- `GET /api/admin/overview`、`GET /api/admin/dashboard`、`PUT /api/admin/grants`、`PUT /api/admin/admins`、`PUT /api/admin/super-admins`、`POST /api/admin/org/refresh`

Cookie 会话名 `zm_sess`（HttpOnly, SameSite=Lax, 30 天）。

## 1. 枚举

```ts
// 候选人阶段
type Stage = 'new' | 'screening' | 'contact' | 'interviewing' | 'evaluating' | 'offer' | 'done' | 'parked'
// 新入库 / 筛选中 / 待联系 / 约面中 / 面评中 / 待录取 / 已完成 / 搁置

// AI 初筛四档判定
type Verdict = '合适' | '待定' | '不合适' | '信息不足'

// 面试
type InterviewStatus = 'scheduled' | 'rescheduled' | 'canceled' | 'completed'
type InterviewMode = 'online' | 'offline'

// 单侧审批状态（飞书审批 / BPM 各自一套）
type SideState = 'pending' | 'submitted' | 'processing' | 'approved' | 'returned' | 'rejected' | 'canceled' | 'error'
// 未发起 / 已发起 / 处理中 / 通过 / 退回 / 拒绝 / 撤销 / 异常

// 附件状态
type AttachmentKind = 'original' | 'platform' | 'missing'  // 候选人原件 / 平台文件 / 缺失

// 通知状态
type NotifyState = 'pending' | 'sent' | 'failed' | 'skipped'
```

## 2. 数据模型（响应 JSON 形状）

```ts
type Candidate = {
  id: string
  name: string
  currentPosition: string
  currentCompany: string
  expectedCity: string
  education: string        // 本科 / 硕士 ...
  major: string
  yearsOfExperience: number // -1 表示未识别
  skills: string[]
  phone: string
  email: string
  channel: string          // liepin / 51job / boss / demo ...
  channelName: string      // 猎聘 / 前程无忧 / BOSS直聘 / 演示数据
  sourceId: string         // 来源库唯一标识（幂等键 source+sourceId）
  summary: string
  detailUrl: string
  stage: Stage
  ownerId: string
  ownerName: string
  nextStep: string         // 下一步动作
  attachments: { id: string; name: string; kind: AttachmentKind; url: string }[] // url 为 '' 表示缺失
  createdAt: string
  updatedAt: string
}

// 候选人列表项（列表接口返回，比详情瘦）
type CandidateRow = Candidate & {
  matches: MatchSummary[]  // 该候选人各岗位的最新匹配，一般 0-2 条
}
type MatchSummary = { id: string; positionId: string; positionTitle: string; verdict: Verdict | ''; score: number | null; screenedAt: string }

// 候选人 × 岗位 匹配（AI 初筛结论，独立于人）
type Match = {
  id: string
  candidateId: string
  positionId: string
  positionTitle: string
  verdict: Verdict
  score: number            // 0-100
  reason: string           // ≤30字
  hits: string[]
  misses: string[]
  aiSummary: string        // 一句话评估
  concerns: string[]
  jdVersion: number        // 评估时引用的 JD 版本号
  jdSnapshot: { title: string; city: string; content: string; requirements: string; note: string }
  screenedAt: string
  jobState: 'screen' | null
}

type Position = {
  id: string
  title: string
  city: string
  department: string
  status: 'open' | 'paused' | 'closed'
  jd: { version: number; content: string; requirements: string; note: string; updatedAt: string } // 当前 JD
  versions: { version: number; updatedAt: string; updatedBy: string }[]  // 详情接口才有
  stats: { total: number; byStage: Partial<Record<Stage, number>> }      // 列表接口才有
  createdAt: string
  updatedAt: string
}

type FollowUp = {
  id: string
  candidateId: string
  userId: string
  userName: string
  content: string
  nextStep: string
  createdAt: string
}

type Interview = {
  id: string
  candidateId: string
  candidateName: string
  positionId: string
  positionTitle: string
  round: string            // 一面 / 二面 / HR 面 ...
  mode: InterviewMode
  startAt: string
  endAt: string
  location: string         // 线下地点或说明
  meetingUrl: string       // 线上会议链接（飞书创建成功后有值）
  interviewers: { id: string; name: string }[]
  status: InterviewStatus
  notify: {
    email: { state: NotifyState; error: string }
    sms: { state: NotifyState; error: string }
    feishu: { state: NotifyState; eventId: string; error: string }
  }
  feedback: Feedback | null
  history: { at: string; action: string; detail: string; by: string }[]
  createdBy: string
  createdAt: string
  updatedAt: string
}

type Feedback = {
  interviewId: string
  interviewerId: string
  interviewerName: string
  scores: { dimension: string; score: number }[]  // 1-5
  note: string
  conclusion: '通过' | '待定' | '不通过' | ''
  aiDraft: string          // AI 辅助生成的评价草稿（未确认前可编辑）
  confirmedAt: string      // '' 表示未确认
  sessionId: string        // 关联的面试助手评审会话（可空）
  updatedAt: string
}

type Offer = {
  id: string
  candidateId: string
  candidateName: string
  positionId: string
  positionTitle: string
  note: string
  materials: { name: string; ok: boolean }[]  // 申请材料核对清单
  feishu: { state: SideState; instanceId: string; updatedAt: string; error: string }
  bpm: { state: SideState; processId: string; updatedAt: string; error: string }
  overall: SideState       // 汇总：全部通过=approved；任一中途态=processing；退回/拒绝/撤销/异常优先暴露
  history: { at: string; side: 'feishu' | 'bpm' | 'system'; action: string; detail: string }[]
  createdBy: string
  createdByName: string
  createdAt: string
  updatedAt: string
}
```

## 3. 新业务接口

### 3.1 待办工作台
- `GET /api/todos` →
```json
{
  "toScreen": [{ "matchId": "", "candidateId": "", "candidateName": "", "positionTitle": "", "verdict": "", "createdAt": "" }],
  "toContact": [{ "candidateId": "", "candidateName": "", "stage": "contact", "updatedAt": "" }],
  "upcomingInterviews": [Interview],
  "toFeedback": [Interview],
  "offerUpdates": [{ "offerId": "", "candidateName": "", "side": "feishu", "state": "approved", "updatedAt": "" }]
}
```
说明：`toScreen` = 我负责的、已关联岗位但未初筛或 JD 已更新的候选人；`toContact` = 阶段为「待联系」；`upcomingInterviews` = 未来 7 天我参与/创建的面试；`toFeedback` = 已结束未填面评的面试；`offerUpdates` = 近 14 天我发起的审批状态变化。

### 3.2 候选人
- `GET /api/candidates?stage=&positionId=&channel=&ownerId=&q=&verdict=&page=1&size=20` → `{ total: number, candidates: CandidateRow[] }`
- `GET /api/candidates/{id}` → `{ candidate: Candidate, matches: Match[], followups: FollowUp[], interviews: Interview[], offers: Offer[] }`
- `PATCH /api/candidates/{id}` body `{ stage?, ownerId?, nextStep? }` → `Candidate`（阶段流转记历史）
- `POST /api/candidates/{id}/followups` body `{ content, nextStep? }` → `FollowUp`（201）
- `POST /api/candidates/{id}/matches` body `{ positionId }` → `Match`（201，verdict 为空待筛）或已有未筛记录；同时自动触发初筛 Job
- `DELETE /api/candidates/{id}/matches/{matchId}` → 204
- `POST /api/matches/{id}/screen` → `202 + Job`（Job type=`screen`，幂等：同一 match 已有 running job 则返回该 job）
- `GET /api/candidates/{id}/resume-text` → `{ text: string }`（简历正文摘要，供 AI/展示）

### 3.3 岗位与 JD
- `GET /api/positions?status=&q=` → `{ positions: Position[] }`（含 stats，不含 versions）
- `POST /api/positions` body `{ title, city?, department?, jd: { content, requirements?, note? } }` → `Position`（201；JD 必填，岗位必须关联 JD）
- `GET /api/positions/{id}` → `Position`（含 versions）
- `PATCH /api/positions/{id}` body `{ title?, city?, department?, status?, jd? }` → `Position`；**提交 jd 即产生新版本**（version+1），已完成的初筛保留旧版本快照
- `DELETE /api/positions/{id}` → 204（仅无关联候选人时可删，否则 409，建议改 status=closed）
- `POST /api/positions/{id}/rescreen` → `202 + Job`（按当前 JD 版本重新初筛该岗位全部已关联候选人）

### 3.4 约面
- `GET /api/interviews?from=&to=&candidateId=&mine=1` → `{ interviews: Interview[] }`
- `POST /api/interviews` body → `201 + Interview`
```json
{
  "candidateId": "", "positionId": "", "round": "一面",
  "mode": "online", "startAt": "", "endAt": "",
  "location": "", "interviewerIds": [""],
  "notifyEmail": "", "notifySms": "",
  "idempotencyKey": ""
}
```
幂等：`candidateId+positionId+round+startAt` 或显式 `idempotencyKey` 重复 → 返回已有记录（200）。创建后异步执行：飞书日程+会议创建（未配置则 feishu.state=skipped）、候选人邮件/短信通知（未配置则 skipped，失败 failed 可重发）。
- `PATCH /api/interviews/{id}` body `{ action: 'reschedule'|'cancel'|'complete', startAt?, endAt?, reason? }` → `Interview`（改期/取消同步飞书日程，历史追加）
- `POST /api/interviews/{id}/resend` body `{ channel: 'email'|'sms' }` → `Interview`（重发通知）
- `POST /api/interviews/{id}/feedback` body `{ scores?, note?, conclusion? }` → `Feedback`（ upsert，未确认草稿 ）
- `POST /api/interviews/{id}/feedback/ai-draft` → `202 + Job`（type=`feedback_draft`，依据已填评分与备注生成草稿，不覆盖 confirmed 的）
- `POST /api/interviews/{id}/feedback/confirm` body `{ scores, note, conclusion }` → `Feedback`（人工确认落库，confirmedAt 有值）
- `POST /api/interviews/{id}/link-session` body `{ sessionId }` → `Interview`（关联面试助手评审会话）

### 3.5 录取申请（模块 C）
- `GET /api/offers?state=&q=` → `{ offers: Offer[] }`
- `POST /api/offers` body `{ candidateId, positionId, note?, materials?: [{name, ok}], idempotencyKey? }` → `201 + Offer`
  - 仅业务确认后可发起；幂等键 `candidateId+positionId+active`（已有进行中申请则 409）。
  - 发起后异步：飞书审批实例创建（`FEISHU_APPROVAL_CODE` 配置后真实发起，否则 mock 适配层推进状态）；BPM 走 mock 适配层（接入方式待定）。
- `GET /api/offers/{id}` → `Offer`
- `POST /api/offers/{id}/refresh` → `Offer`（主动查询两侧最新状态；幂等，不重复发起）
- `POST /api/offers/{id}/cancel` → `Offer`（撤销：两侧可撤则撤，否则仅标记本方取消意图并记录）

### 3.6 管理 · 集成与同步
- `GET /api/admin/integrations` →
```json
{
  "llm": { "configured": true, "model": "" },
  "feishu": { "configured": true, "calendar": true, "approval": true },
  "minio": { "configured": false, "mode": "local" },
  "smtp": { "configured": false },
  "sms": { "configured": false, "provider": "" },
  "bpm": { "mode": "mock" },
  "sourceDb": { "configured": false, "type": "", "lastSyncAt": "", "lastError": "", "lastCount": 0, "totalCandidates": 0 }
}
```
- `POST /api/admin/sync` → `202 + Job`（type=`source_sync`；来源库未配置时生成/刷新演示数据并如实标注 channel=demo）

## 4. Job 对象（轮询）

```ts
type Job = {
  id: string
  type: 'analyze' | 'evaluate' | 'screen' | 'source_sync' | 'feedback_draft' | 'rescreen'
  state: 'running' | 'done' | 'error'
  sessionId?: string   // analyze/evaluate 专用，兼容旧前端
  stage?: string       // outline / questions（analyze）
  refId?: string       // 新业务关联对象 id（matchId / offerId / interviewId）
  error?: string
}
```
`GET /api/jobs/{id}` 404 时表示任务已结束或被清理（前端按现有逻辑处理重试）。

## 5. AI 初筛提示词（逐字资产，后端 `prompts.py` 内置）

系统提示词与用户模板逐字采用《简历比对的业务流程与提示词》：
- sys：资深招聘评估专家，输出 JSON：verdict（合适/待定/不合适/信息不足）、score(0-100)、reason(≤30字)、hits、misses、ai_summary、concerns；**异地不得作为不合适/待定依据**，城市差异最多一条中性备注。
- user 模板：`## 岗位JD\n城市: {city}\n岗位: {name}\n\n### 岗位职责\n{description}\n\n### 岗位要求\n{requirements}\n\n### 备注/筛选规则\n{note or '无'}\n\n## 候选人简历\n姓名/目前岗位/目前公司/期望城市/学历/专业/工作年限/技能关键词/简历正文`（缺失字段写「未识别」）。
- 硬规则兜底：JD 备注含「没有X经验不考虑」且简历正文无对应关键词 → 无条件改判「不合适」，reason 加 `[硬规则强制]` 前缀，score ≤ 30。
- LLM 未配置或调用失败 → 本地关键词规则降级（命中要求关键词计数 + 学历/年限粗比），结论标注为规则版。
- temperature=0.1；简历正文截断 8000 字。
