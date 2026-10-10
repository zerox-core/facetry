export type Phase = 'prepare' | 'interview' | 'review'

export type AuthUser = { id: string; name: string; avatar?: string; isAdmin?: boolean; isSuper?: boolean }

/** 飞书组织架构里的最小用户组（最深层部门） */
export type UserGroup = { id: string; name: string; pathName: string; path: string[] }

export type DirectoryUser = { id: string; name: string; avatar: string; groupName: string }

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

export type JobType = 'analyze' | 'evaluate'

export type Job = {
  id: string
  sessionId: string
  type: JobType
  state: 'running' | 'done' | 'error'
  /** analyze 任务的真实阶段：outline=识别经历 / questions=生成问题 */
  stage?: 'outline' | 'questions'
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
