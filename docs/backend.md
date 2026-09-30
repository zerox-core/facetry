# Facetry 后端开发文档

> 目标读者：负责后端的同学。前端目前是纯演示版：数据保存在 `localStorage`（`src/store.ts`），双方实时同步走 `BroadcastChannel`。本文档定义要替换掉的全部能力，接口字段与前端类型一一对应，前端改成接真实接口时尽量不动 UI。
>
> 约定：REST + JSON，路径前缀 `/api/v1`；时间统一用 ISO 8601（UTC），前端负责本地化；ID 使用字符串（建议 ULID）；分页参数为 `?cursor=&limit=`。

---

## 1. 总体架构

```
浏览器（面试官工作台 / 候选人面试间）
   │  HTTPS REST            │  WebSocket（信令 + 会话事件）   │  WebRTC（音视频）
   ▼                        ▼                                ▼
 API 服务 ───────────── 实时服务 ─────────────────── SFU / TURN
   │                        │
   ├─ PostgreSQL（业务数据）  ├─ Redis（在线状态、房间状态、pub/sub）
   ├─ 对象存储（简历、会话附件、录音）
   └─ 异步任务队列 ──► 简历解析 Worker / LLM Worker / ASR Worker
```

| 模块 | 职责 | 对应前端 |
|---|---|---|
| 认证 | 飞书扫码 / 账号密码登录，企业内使用 | `Login.tsx` |
| 候选人与简历 | 上传、解析、结构化、标注亮点与风险 | `Candidates.tsx`、`ResumeDoc.tsx` |
| 分析与题目 | 生成候选人分析、推荐面试题、题库 | `Interviewer.tsx`、`Bank.tsx` |
| 面试间 | 计时、逐题记录、评分、草稿自动保存 | `Offline.tsx` |
| 实时会话 | 分享链接、候选人入场、语音转写、文字与文件 | `Join.tsx`、`live.tsx`、`voice.ts` |
| 评价与报告 | 综合评价生成、提交结论、导出、结果分析 | `Offline.tsx` 结束页、`Result.tsx` |

---

## 2. 数据模型

字段名与前端保持一致（camelCase 出入参，数据库可用 snake_case）。

### 2.1 users（面试官 / 管理员）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | string | |
| name | string | |
| feishuOpenId | string? | 飞书登录绑定 |
| role | `interviewer` \| `hr` \| `admin` | |
| orgId | string | 租户隔离 |

### 2.2 candidates
对应 `data.ts` 中的 `candidates[]`。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | string | |
| name, role, exp, edu, source | string | |
| match | int 0–100 | 岗位匹配度 |
| status | `待面试` \| `待评价` \| `已评价` | 建议后端存枚举 `pending/to_review/reviewed`，由前端映射 |
| slot | datetime | 面试时间（前端目前是“今天 14:30”这种展示串） |
| round | string | 一面 / 二面 … |
| interviewerId | string | |
| summary | string | 分析摘要 |
| skills | `{k: string, v: int}[]` | 技能雷达 |
| highlights / risks | string[] | 亮点 / 待核实项 |

### 2.3 resumes
| 字段 | 类型 | 说明 |
|---|---|---|
| candidateId | string | 1:1 |
| fileKey | string | 对象存储键 |
| file, contact | string | 文件名、脱敏联系方式 |
| sections | `{title, lines: ResumeLine[]}[]` | 结构化正文 |

`ResumeLine = { text, mark?: 'hi' \| 'risk', ref?: number, q?: string[] }`：`mark` 表示亮点或风险，`q` 关联推荐题 id，用来在简历上点击一行跳转到对应题目。

### 2.4 questions
| 字段 | 类型 | 说明 |
|---|---|---|
| id, candidateId? | string | 为空时属于题库 |
| topic, diff(`基础/中等/较难`), basis | string | basis 为出题依据，例如“简历：LCP 4.2s → 1.8s” |
| q, answer, flag | string | 题干、参考答案、减分信号 |
| points, follow | string[] | 考察要点、追问 |
| source | `ai` \| `manual` \| `bank` | |
| picked | bool | 是否纳入本场面试（替代前端的 `picks`） |

### 2.5 interviews（面试间，对应前端 `Room`）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | string | 一场面试一条记录；前端目前以 candidateId 当房间 id |
| candidateId, interviewerId | string | |
| state | `scheduled` \| `live` \| `paused` \| `ended` \| `submitted` | |
| sec | int | 累计用时，以服务端为准 |
| recs | `Record<questionId, Rec>` | 逐题记录 |
| verdict | `推荐录用` \| `待定` \| `不推荐` | |
| summary, obs | string | 自动总结、整体观察 |
| review | Review? | 综合评价 |
| shared | bool | 是否已分享面试间 |
| shareToken | string? | 见 §4 |
| savedAt, submittedAt | datetime | |

`Rec = { score?: 1–5, hit: string[], asked: string[], tags: string[], note: string, secs: int }`

`Review = { overall, strengths[], weaknesses[], nextSteps[], suggestion, evidence: questionId[], at }`

### 2.6 talks（会话记录，对应前端 `Talk`）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | string | 客户端生成，用于去重（前端 `uid()`） |
| interviewId | string | |
| who | `面试官` \| `候选人` | |
| kind | `voice` \| `text` \| `file` | |
| text | string | 转写文本 / 消息 / 文件名 |
| t | datetime | 前端展示 `HH:mm:ss` |
| file | `{name, size, key, mime}`? | 取代前端 dataURL，改用对象存储 |
| asrConfidence | float? | 仅 voice |

**会话记录只作为补充材料，不参与评分**。报告生成可以引用会话内容，但不能改变分数。

### 2.7 evaluations / history
提交评价后生成，对应 `history[]`：`{ id: 'R-xxxx', cid, name, role, date, score, dur, verdict }`，可以由 interviews 视图派生，不必单独建表。

---

## 3. REST 接口

### 3.1 认证
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/auth/feishu/qrcode` | 返回 `{ qrUrl, state }`，前端轮询或走 WS 等待扫码 |
| GET | `/auth/feishu/poll?state=` | `{ status: 'waiting'\|'scanned'\|'ok'\|'expired', token? }` |
| POST | `/auth/login` | `{ account, password }` → `{ token, user }` |
| POST | `/auth/logout` | |
| GET | `/me` | 当前用户 |

使用 HttpOnly Cookie 或 Bearer Token 均可，但候选人端**不走这套认证**（见 §4）。

### 3.2 候选人与简历
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/candidates?status=&q=` | 列表 |
| GET | `/candidates/:id` | 详情，包含 skills/highlights/risks |
| POST | `/candidates/import` | multipart 上传简历，返回 `{ candidateId, jobId }` |
| GET | `/jobs/:jobId` | 解析进度 `{ status, progress, error? }` |
| PATCH | `/candidates/:id` | 改面试时间 `slot`、轮次等 |
| GET | `/candidates/:id/resume` | 结构化简历 + 文件临时下载地址 |

上传校验要和前端一致：`pdf / docx / txt / png / jpg`，不超过 20MB，否则返回 `400 { code: 'FILE_TYPE' | 'FILE_SIZE' }`。

### 3.3 题目
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/candidates/:id/questions` | 推荐题（含 picked） |
| PUT | `/candidates/:id/questions/picked` | `{ ids: string[] }` |
| POST | `/candidates/:id/questions` | 手动加题 `{ q, topic, points?, follow? }` |
| POST | `/candidates/:id/questions/regenerate` | 异步重新出题，返回 jobId |
| GET/POST/PATCH/DELETE | `/bank/questions` | 题库 CRUD（管理员） |

### 3.4 面试间
| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/interviews` | `{ candidateId }` → 创建或返回当场面试 |
| GET | `/interviews/:id` | 完整 Room |
| PATCH | `/interviews/:id` | 草稿自动保存，允许传部分字段 `{ recs?, obs?, summary?, verdict?, sec? }`；带 `If-Match: <version>` 做乐观锁 |
| POST | `/interviews/:id/start` \| `/pause` \| `/resume` \| `/end` | 状态流转，服务端记录计时 |
| POST | `/interviews/:id/review` | 异步生成综合评价 → jobId，结果写回 `review` |
| POST | `/interviews/:id/submit` | `{ verdict }`，提交后记录锁定，只读 |
| GET | `/interviews/:id/export?format=md\|pdf` | 导出，附录包含会话记录 |
| GET | `/interviews/:id/result` | 结果分析聚合数据，见 §3.6 |

前端目前每次改动都会立即保存。接后端时 PATCH 请做 **800ms 防抖**，失败则在本地排队重试；提交之后 PATCH 返回 `409 LOCKED`。

### 3.5 会话记录
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/interviews/:id/talks?cursor=` | 历史会话 |
| POST | `/interviews/:id/talks` | `{ id, who, kind, text }`，按 id 幂等 |
| POST | `/interviews/:id/attachments` | 先拿上传预签名 `{ name, size, mime }` → `{ key, uploadUrl }` |

附件限制：图片 ≤ 10MB，其他文件 ≤ 20MB；需要做 MIME 白名单和病毒扫描。图片预览通过带签名的临时 URL 下发。

### 3.6 结果分析聚合 `GET /interviews/:id/result`
```json
{
  "candidate": { "id": "c1", "name": "林晓", "role": "前端工程师（高级）", "round": "二面" },
  "verdict": "推荐录用",
  "metrics": { "sec": 1860, "rated": 5, "total": 6, "avg": 3.8, "hitRate": 0.67, "talks": 42 },
  "questions": [{ "id": "q1", "topic": "性能优化", "q": "…", "score": 4, "secs": 420 }],
  "topics": [{ "topic": "性能优化", "avg": 4.0 }],
  "talkStats": { "interviewer": 20, "candidate": 22, "shared": true },
  "talkExcerpt": [ /* 最近 4 条 Talk */ ],
  "review": { /* Review */ }
}
```
计算口径要和 `Result.tsx` 保持一致：
- 只统计已评分的题；未评分的题不算 0 分。
- 命中率 = 所有题已命中要点数之和 ÷ 所有题要点总数。

---

## 4. 分享面试间与候选人入场

1. 面试官点「分享面试间」→ `POST /interviews/:id/share`，返回 `{ url, token, expiresAt }`。
   - url 形如 `https://<host>/?join=<token>`。前端目前直接用 candidateId，接入时改成 token。
   - token 是随机 32 字节，只能用于这一场面试。有效期到面试结束后 2 小时，或者面试官「停止分享」时（`DELETE /interviews/:id/share`）立即失效。
2. 候选人打开链接 → `GET /join/:token` 获取公开信息 `{ name, role, round, interviewerName, state }`。
   - **绝不能返回**分析、评分、参考答案或减分信号。
3. 候选人进入 → `POST /join/:token/enter` 换取一个只在本场有效的 `guestToken`（JWT，scope=`candidate`，关联 interviewId），用于 WS 和上传附件。
4. 未分享时，实时服务拒绝候选人连接；面试官这边照常计时和转写自己的语音。

权限矩阵：

| 能力 | 面试官 | 候选人 |
|---|---|---|
| 读题干（当前题） | ✓ | ✓（只能看当前题） |
| 读参考答案 / 要点 / 分析 / 评分 | ✓ | ✗ |
| 发送文字、文件、语音转写 | ✓ | ✓ |
| 读会话记录 | 全部 | 只看本场，且只看入场之后的 |
| 结束面试 / 停止分享 | ✓ | ✗ |

---

## 5. 实时服务（WebSocket）

连接地址：`wss://<host>/rt?interview=<id>&token=<token>`。消息格式直接沿用前端的 `LiveMsg`，这样前端只需要把 `liveChannel()` 的底层从 BroadcastChannel 换成 WS：

```ts
type LiveMsg =
  | { type: 'state'; name; role; round; idx; total; q; ended; sec }   // 面试官 → 候选人，切题、计时时推送
  | { type: 'talk'; item: Talk }                                      // 双向；服务端落库后广播，按 item.id 去重
  | { type: 'level'; who; on: boolean }                                // 说话状态，驱动声波动效，不落库
  | { type: 'join' | 'leave' | 'hello' }                              // 在线状态
```
服务端要负责的事：
- 鉴权：候选人只能发 `talk`、`level`、`join/leave`；只有面试官能发 `state`。
- `talk` 先落库再广播；`level` 限流为每连接 10 次/秒。
- 在线状态存在 Redis 中，心跳 15 秒，超过 45 秒没有心跳就广播 `leave`。
- 新连接接入后，服务端主动下发一次最新的 `state` 和最近 50 条 `talk`（前端目前靠发 `hello` 触发，接后端后改为服务端推送）。
- 有多个实例时，用 Redis pub/sub 按 interviewId 分频道。

### 5.1 音视频
- 采用 WebRTC。两人面试可以先做 P2P + TURN，后续需要录制时再升级为 SFU（LiveKit 或 mediasoup）。
- 信令复用上面这条 WS，新增 `{type:'rtc', sdp|ice}` 消息。
- 前端目前只做了本地预览，还没有推流；接入 SFU 后，候选人的画面显示在面试官顶栏或会话面板（UI 待定）。

---

## 6. 语音转写（ASR）

前端目前使用浏览器自带的 Web Speech API（只在 Chrome/Edge 可用，也会受网络影响），正式版改为服务端转写：

- **方案**：客户端采集 16kHz PCM（AudioWorklet），通过 WS 二进制帧推流 → 实时服务转发给 ASR（可选阿里云、讯飞或自建 FunASR/Whisper）。
- **回传**：中间结果 `{type:'asr', who, interim: string}`，前端显示为虚线气泡；句子结束时返回最终结果，转成 `talk`（kind=`voice`）落库并广播。
- **角色区分**：按连接区分说话人，面试官和候选人各自一路音频，不需要做声纹分离。
- **未分享**：只有面试官这一路音频。
- **录音存档**：可选，默认关闭。开启时必须在候选人入场页明确告知（前端入场页已写“你的发言会实时转写成文字”，存录音时文案要同步更新）。

---

## 7. AI / 异步任务

| 任务 | 触发 | 输入 | 输出 |
|---|---|---|---|
| 简历解析 | 上传后 | 文件 | resumes.sections、contact 脱敏 |
| 候选人分析 | 解析完成 | 结构化简历 + 岗位 JD | summary、skills、highlights、risks、match、ResumeLine.mark |
| 出题 | 分析完成 / 手动重新生成 | 分析结果 + 题库 | questions（basis 必须引用简历原文） |
| 综合评价 | 面试官点击生成 | recs、obs、题目，以及会话记录（仅作补充） | Review |

要求：
- 所有 LLM 输出都用 JSON Schema 约束，并做服务端校验，不合格就重试，最多 2 次。
- **综合评价只依据已评分的题和面试官记录**。`evidence` 必须是真实存在的 questionId；**不自动给出录用决定**，只给 suggestion，由面试官决定 verdict。
- 会话记录进入 prompt 时要标注“补充材料”，并截断到最近 N 条或 token 上限。
- 任务状态统一走 `/jobs/:id`，完成后通过 WS 推 `{type:'job', id, status}` 给面试官。

---

## 8. 安全与合规

- 简历和会话都属于个人信息：传输全程 TLS，数据库字段层面加密联系方式，对象存储私有，下载一律用临时签名 URL（不超过 10 分钟）。
- 多租户：所有查询都带 `orgId`；候选人的 guestToken 只能访问所属的那一场面试。
- 审计日志：记录查看简历、导出、提交评价、分享和停止分享的操作。
- 数据保留：会话记录和附件默认保留 180 天（可配置），候选人可以申请删除。
- 演示数据：仓库里 `简历/`、`面试评价报告/` 目录含真实个人信息，**不要**用来做种子数据或测试，请使用 `src/data.ts` 中的假数据。

---

## 9. 错误码

响应格式：`{ code: string, message: string, detail?: any }`

| code | HTTP | 场景 |
|---|---|---|
| UNAUTHORIZED | 401 | 未登录 / token 过期 |
| FORBIDDEN | 403 | 越权，例如候选人读取评分 |
| NOT_FOUND | 404 | |
| FILE_TYPE / FILE_SIZE | 400 | 上传校验 |
| LOCKED | 409 | 已提交的面试再次修改 |
| VERSION_CONFLICT | 409 | 乐观锁冲突，前端提示“记录已在其他窗口更新” |
| SHARE_EXPIRED | 410 | 分享链接失效（候选人端显示“面试间不存在”） |
| JOB_FAILED | 500 | 异步任务失败，附带 detail |

---

## 10. 前端对接替换清单

| 前端现状 | 替换为 |
|---|---|
| `store.ts`：localStorage 读写和 `commit()` | API 客户端 + 请求缓存（如 TanStack Query）；`useStore()` 的调用处改为 hooks |
| `liveChannel()`（BroadcastChannel） | 同一签名的 WS 实现，保持 `{ send, close }` |
| `voice.ts` 中的 Web Speech | 采集 PCM 并推流，改为接收 `asr` 消息；`useVoice` 的返回值不变 |
| `readFile()` 转 dataURL | 预签名上传，`Talk.file` 改为存 key |
| `?join=<cid>` | `?join=<token>` |
| `submitEvaluation()` 写入 history | `POST /interviews/:id/submit` |
| `Result.tsx` 的本地计算 | `GET /interviews/:id/result`，口径不变 |

## 11. 建议的里程碑

1. **M1**：认证、候选人、简历上传与解析、题目的 CRUD，让工作台可以看到真实数据。
2. **M2**：面试间的草稿保存、提交、导出、结果分析。
3. **M3**：分享链接、WS 实时通道、会话记录与附件。
4. **M4**：服务端 ASR、WebRTC 音视频。
5. **M5**：LLM 分析、出题和综合评价，以及审计与数据保留策略。
