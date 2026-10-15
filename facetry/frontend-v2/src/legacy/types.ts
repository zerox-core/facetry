export type Phase = 'prepare' | 'interview' | 'review'

export type UserRole = 'hr' | 'interviewer'

export type AuthUser = { id: string; name: string; avatar?: string; role?: UserRole; isAdmin?: boolean; isSuper?: boolean }

/** 飞书组织架构里的最小用户组（最深层部门） */
export type UserGroup = { id: string; name: string; pathName: string; path: string[] }

export type DirectoryUser = { id: string; name: string; avatar: string; groupName: string; role?: UserRole }

export type MeResponse = { user: AuthUser; groups: UserGroup[] }

export type Anchor = {
  lineId?: string
  page: number
  y: number
  x?: number
  quote?: string
  matched?: boolean
  manual?: boolean
} | null

export type Question = {
  id: string
  type: string
  q: string
  point: string
  followUp: string
  expected: string[]
  excluded: boolean
  score: number | null
  note: string
}

export type SectionKind = 'project' | 'experience' | 'skills' | 'education' | 'custom'

export type Section = {
  id: string
  title: string
  kind: SectionKind
  anchor: Anchor
  questions: Question[]
}

export type Evaluation = {
  overall: string
  suggestion: string
  strengths: string[]
  weaknesses: string[]
  nextSteps: string[]
  evidence: string[]
  generatedAt: string
}

export type ResumeLine = { id: string; text: string; page: number; y: number; x?: number }

export type Session = {
  id: string
  userId: string
  fileName: string
  file: string
  name: string
  role: string
  summary: string
  text: string
  sections: Section[]
  lines: ResumeLine[]
  pageCount: number
  phase: Phase
  note: string
  evaluation: Evaluation | null
  /** 上传时选择的岗位 JD（role 从 JD 带出；未选则待补充） */
  jdId?: string
  /** 被分享的用户 id 列表（仅所有者可维护） */
  shares?: string[]
  createdAt: string
  updatedAt: string
}

export type SessionSummary = Pick<
  Session,
  'id' | 'userId' | 'fileName' | 'name' | 'role' | 'summary' | 'pageCount' | 'phase' | 'createdAt' | 'updatedAt'
> & {
  questionCount: number
  scoredCount: number
  /** 非隐藏已评分题的平均分（1 位小数），无评分时为 null */
  avgScore: number | null
  hasEvaluation: boolean
  /** evaluation.suggestion 截断 200 字，无评价时为 '' */
  suggestion: string
  /** 他人分享给我的简历，值为分享者姓名；自己的简历为 '' */
  sharedBy: string
  /** 非本人且并非被分享、仅因超管权限可见 */
  viaSuper?: boolean
  /** 非本人且并非被分享、仅因组负责人权限可见 */
  viaLeader?: boolean
  /** 正在后台生成的任务类型（analyze=出题 / evaluate=评价），无则为 null */
  jobState?: 'analyze' | 'evaluate' | null
}

export type JobType = 'analyze' | 'evaluate' | 'screen' | 'source_sync' | 'feedback_draft' | 'rescreen'

export type Job = {
  id: string
  /** analyze/evaluate 专用；新业务任务无此字段 */
  sessionId?: string
  type: JobType
  state: 'running' | 'done' | 'error'
  /** analyze 任务的真实阶段：outline=识别经历 / questions=生成问题 */
  stage?: 'outline' | 'questions'
  /** 新业务关联对象 id（matchId / offerId / interviewId） */
  refId?: string
  error?: string
}

export type QuestionPatch = {
  id: string
  score?: number | null
  note?: string
  excluded?: boolean
  q?: string
  point?: string
  followUp?: string
  type?: string
  expected?: string[]
}

export type NewQuestion = {
  type?: string
  q: string
  point?: string
  followUp?: string
  expected?: string[]
}

export type SessionPatch = {
  note?: string
  phase?: Phase
  question?: QuestionPatch
  addQuestion?: { sectionId?: string; sectionTitle?: string; question: NewQuestion }
  removeQuestion?: { id: string }
  anchor?: { id: string; page: number; y: number }
  /** 仅所有者可设置：把简历分享给指定用户（用户 id 数组，整体覆盖） */
  shares?: string[]
  /** 仅所有者：关联岗位库 JD（空串取消关联；关联后 role 自动取 JD 岗位名） */
  jdId?: string
  /** 仅所有者：未匹配到现有 JD 时手动填写岗位方向 */
  role?: string
}

export type AnalyzePayload = {
  role?: string
  lines: ResumeLine[]
  pageCount: number
  images: string[]
  /** 已有题目时强制重新识别（清空旧题目与评价） */
  force?: boolean
}

export type BankPartKey = 'A' | 'B' | 'E' | 'F' | 'C' | 'D' | 'CUST'

export type BankPart = { key: BankPartKey | string; name: string; weight: number }

export type BankQuestion = {
  id: string
  part: string
  partName: string
  title: string
  q: string
  answer: string
  material?: string
  custom: boolean
  updatedAt: string
  /** 创建者；最小用户组共享范围：GLOBAL=全员，''=仅自己，其余为部门 id */
  userId?: string
  userName?: string
  groupId?: string
  groupName?: string
  /** 关联的岗位 JD（无则为通用题） */
  jdId?: string
  jdTitle?: string
  /** 当前用户是否只读（授权组 / 全局种子题对非管理员） */
  readonly?: boolean
}

export type Bank = { parts: BankPart[]; questions: BankQuestion[] }

export type BankQuestionInput = {
  part?: string
  title: string
  q: string
  answer?: string
  material?: string
  /** 关联岗位 JD id；空串表示取消关联 */
  jdId?: string
}

export type GeneratedQuestion = {
  title: string
  q: string
  answer: string
  material: string
  /** 匹配到现有分类时为分类 key；模型提议新分类时为 ''（partName 为建议名） */
  part: string
  partName?: string
  jdId?: string
  jdTitle?: string
}

/** 岗位 JD：按创建者最小用户组共享 */
export type JobDescription = {
  id: string
  title: string
  company: string
  content: string
  requirements: string
  tags: string[]
  userId: string
  userName: string
  groupId: string
  groupName: string
  createdAt: string
  updatedAt: string
  readonly?: boolean
}

export type JobDescriptionInput = {
  title: string
  company?: string
  content: string
  requirements?: string
  tags?: string[]
}

/** 组织架构部门（缓存自飞书） */
export type OrgDept = { id: string; name: string; parentId: string; path: string[]; pathName: string }

export type AdminUser = DirectoryUser & { groupName: string; isAdmin: boolean; isSuper: boolean; grants: string[] }

export type AdminOverview = { users: AdminUser[]; depts: Record<string, OrgDept>; fetchedAt: string }

export type DashboardData = {
  userCount: number
  sessions: { total: number; evaluated: number; byPhase: { prepare: number; interview: number; review: number } }
  questions: { total: number; scored: number; avgScore: number | null }
  byUser: { userId: string; name: string; sessions: number; questions: number; scored: number; evaluated: number }[]
  bank: { total: number; byGroup: { groupId: string; groupName: string; total: number; custom: number }[] }
  jds: { total: number; byGroup: { groupId: string; groupName: string; count: number }[] }
  recent: {
    id: string
    name: string
    role: string
    ownerName: string
    phase: Phase
    updatedAt: string
    questionCount: number
    scoredCount: number
    avgScore: number | null
    hasEvaluation: boolean
  }[]
}

// ══════════════ 招聘工作台 V2（api-contract-v2.md 第 1、2、4 节） ══════════════

/** 候选人阶段：新入库/筛选中/待联系/约面中/面评中/待录取/已完成/搁置 */
export type Stage = 'new' | 'screening' | 'contact' | 'interviewing' | 'evaluating' | 'offer' | 'done' | 'parked'

/** AI 初筛四档判定 */
export type Verdict = '合适' | '待定' | '不合适' | '信息不足'

export type InterviewStatus = 'scheduled' | 'rescheduled' | 'canceled' | 'completed'
export type InterviewMode = 'online' | 'offline'

/** 单侧审批状态（飞书审批 / BPM 各自一套）：未发起/已发起/处理中/通过/退回/拒绝/撤销/异常 */
export type SideState = 'pending' | 'submitted' | 'processing' | 'approved' | 'returned' | 'rejected' | 'canceled' | 'error'

/** 附件：候选人原件 / 平台文件 / 缺失 */
export type AttachmentKind = 'original' | 'platform' | 'missing'

export type NotifyState = 'pending' | 'sent' | 'failed' | 'skipped'

export type CandidateAttachment = { id: string; name: string; kind: AttachmentKind; url: string }

export type Candidate = {
  id: string
  name: string
  currentPosition: string
  currentCompany: string
  expectedCity: string
  education: string
  major: string
  /** -1 表示未识别 */
  yearsOfExperience: number
  skills: string[]
  phone: string
  email: string
  channel: string
  channelName: string
  /** 来源库唯一标识（幂等键 source+sourceId） */
  sourceId: string
  summary: string
  detailUrl: string
  stage: Stage
  ownerId: string
  ownerName: string
  /** 下一步动作 */
  nextStep: string
  /** url 为 '' 表示缺失 */
  attachments: CandidateAttachment[]
  createdAt: string
  updatedAt: string
}

export type MatchSummary = { id: string; positionId: string; positionTitle: string; verdict: Verdict | ''; score: number | null; screenedAt: string }

/** 候选人列表项（比详情瘦） */
export type CandidateRow = Candidate & { matches: MatchSummary[] }

/** 候选人 × 岗位 匹配（AI 初筛结论，独立于人） */
export type Match = {
  id: string
  candidateId: string
  positionId: string
  positionTitle: string
  verdict: Verdict
  score: number
  /** ≤30字 */
  reason: string
  hits: string[]
  misses: string[]
  /** 一句话评估 */
  aiSummary: string
  concerns: string[]
  /** 评估时引用的 JD 版本号 */
  jdVersion: number
  jdSnapshot: { title: string; city: string; content: string; requirements: string; note: string }
  screenedAt: string
  jobState: 'screen' | null
}

export type PositionJd = { version: number; content: string; requirements: string; note: string; updatedAt: string }

export type Position = {
  id: string
  title: string
  city: string
  department: string
  status: 'open' | 'paused' | 'closed'
  /** 当前 JD */
  jd: PositionJd
  /** 详情接口才有 */
  versions: { version: number; updatedAt: string; updatedBy: string }[]
  /** 列表接口才有 */
  stats: { total: number; byStage: Partial<Record<Stage, number>> }
  createdAt: string
  updatedAt: string
}

export type FollowUp = {
  id: string
  candidateId: string
  userId: string
  userName: string
  content: string
  nextStep: string
  createdAt: string
}

export type Feedback = {
  interviewId: string
  interviewerId: string
  interviewerName: string
  /** 1-5 分 */
  scores: { dimension: string; score: number }[]
  note: string
  conclusion: '通过' | '待定' | '不通过' | ''
  /** AI 辅助生成的评价草稿（未确认前可编辑） */
  aiDraft: string
  /** '' 表示未确认 */
  confirmedAt: string
  /** 关联的面试助手评审会话（可空） */
  sessionId: string
  updatedAt: string
}

export type Interview = {
  id: string
  candidateId: string
  candidateName: string
  positionId: string
  positionTitle: string
  /** 一面 / 二面 / HR 面 ... */
  round: string
  mode: InterviewMode
  startAt: string
  endAt: string
  /** 线下地点或说明 */
  location: string
  /** 线上会议链接（飞书创建成功后有值） */
  meetingUrl: string
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

export type OfferSide = { state: SideState; instanceId: string; updatedAt: string; error: string }
export type OfferBpm = { state: SideState; processId: string; updatedAt: string; error: string }

export type Offer = {
  id: string
  candidateId: string
  candidateName: string
  positionId: string
  positionTitle: string
  note: string
  /** 申请材料核对清单 */
  materials: { name: string; ok: boolean }[]
  feishu: OfferSide
  bpm: OfferBpm
  /** 汇总：全部通过=approved；任一中途态=processing；退回/拒绝/撤销/异常优先暴露 */
  overall: SideState
  history: { at: string; side: 'feishu' | 'bpm' | 'system'; action: string; detail: string }[]
  createdBy: string
  createdByName: string
  createdAt: string
  updatedAt: string
}

// —— 待办工作台 ——
export type TodoScreenItem = { matchId: string; candidateId: string; candidateName: string; positionTitle: string; verdict: Verdict | ''; createdAt: string }
export type TodoContactItem = { candidateId: string; candidateName: string; stage: Stage; updatedAt: string }
export type TodoOfferUpdate = { offerId: string; candidateName: string; side: 'feishu' | 'bpm'; state: SideState; updatedAt: string }

export type Todos = {
  /** 我负责的、已关联岗位但未初筛或 JD 已更新的候选人 */
  toScreen: TodoScreenItem[]
  /** 阶段为「待联系」 */
  toContact: TodoContactItem[]
  /** 未来 7 天我参与/创建的面试 */
  upcomingInterviews: Interview[]
  /** 已结束未填面评的面试 */
  toFeedback: Interview[]
  /** 近 14 天我发起的审批状态变化 */
  offerUpdates: TodoOfferUpdate[]
}

// —— 管理 · 集成与同步 ——
export type Integrations = {
  llm: { configured: boolean; model: string }
  feishu: { configured: boolean; calendar: boolean; approval: boolean }
  minio: { configured: boolean; mode: string }
  smtp: { configured: boolean }
  sms: { configured: boolean; provider: string }
  bpm: { mode: string }
  sourceDb: { configured: boolean; type: string; lastSyncAt: string; lastError: string; lastCount: number; totalCandidates: number }
}
