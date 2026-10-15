import type { AdminOverview, AnalyzePayload, AuthUser, Bank, BankQuestion, BankQuestionInput, Candidate, CandidateRow, DashboardData, DirectoryUser, Feedback, FollowUp, GeneratedQuestion, Integrations, Interview, Job, JobDescription, JobDescriptionInput, Match, MeResponse, Offer, Position, Session, SessionPatch, SessionSummary, Stage, Todos, UserRole } from './types'

/** POST /api/interviews 的请求体 */
export type NewInterviewInput = {
  candidateId: string
  positionId: string
  round: string
  mode: 'online' | 'offline'
  startAt: string
  endAt: string
  location: string
  interviewerIds: string[]
  notifyEmail: string
  notifySms: string
  idempotencyKey: string
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, options)
  if (response.status === 204) return undefined as T
  const data = (await response.json().catch(() => ({}))) as { error?: string }
  if (!response.ok) throw new Error(data.error || `请求失败（${response.status}）`)
  return data as T
}

const json = (body: unknown): RequestInit => ({
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

export const api = {
  status: () => request<{ configured: boolean; feishu: boolean; demo?: boolean }>('api/status'),

  // 演示登录：仅后端 ENABLE_DEMO_LOGIN=true 时可用（status.demo 为 true 才展示入口）
  demoLogin: (name: string) => request<{ user: AuthUser }>('api/auth/demo', { method: 'POST', ...json({ name }) }),

  me: () => request<MeResponse>('api/auth/me'),

  logout: () => request<void>('api/auth/logout', { method: 'POST' }),

  listUsers: () => request<{ users: DirectoryUser[] }>('api/users'),

  listSessions: () => request<SessionSummary[]>('api/sessions'),

  getSession: (id: string) => request<Session>(`api/sessions/${id}`),

  patchSession: (id: string, patch: SessionPatch) =>
    request<Session>(`api/sessions/${id}`, { method: 'PATCH', ...json(patch) }),

  deleteSession: (id: string) => request<void>(`api/sessions/${id}`, { method: 'DELETE' }),

  async upload(file: File, jdId?: string): Promise<Session> {
    const qs = '?name=' + encodeURIComponent(file.name) + (jdId ? '&jd=' + encodeURIComponent(jdId) : '')
    const response = await fetch('api/upload' + qs, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: file,
    })
    const data = (await response.json().catch(() => ({}))) as { error?: string }
    if (!response.ok) throw new Error(data.error || `上传失败（${response.status}）`)
    return data as unknown as Session
  },

  analyze: (id: string, payload: AnalyzePayload) =>
    request<Job>(`api/sessions/${id}/analyze`, { method: 'POST', ...json(payload) }),

  evaluate: (id: string, force = false) =>
    request<Job>(`api/sessions/${id}/evaluate`, { method: 'POST', ...json(force ? { force: true } : {}) }),

  getJob: (id: string) => request<Job>(`api/jobs/${id}`),

  getBank: () => request<Bank>('api/bank'),

  addBankQuestion: (input: BankQuestionInput) => request<BankQuestion>('api/bank', { method: 'POST', ...json(input) }),

  updateBankQuestion: (id: string, input: Partial<BankQuestionInput>) =>
    request<BankQuestion>(`api/bank/${id}`, { method: 'PATCH', ...json(input) }),

  deleteBankQuestion: (id: string) => request<void>(`api/bank/${id}`, { method: 'DELETE' }),

  renameBankPart: (key: string, name: string) =>
    request<{ key: string; name: string }>(`api/bank/parts/${key}`, { method: 'PATCH', ...json({ name }) }),

  generateBank: (payload: { jdId?: string; jdText?: string; requirements?: string; count?: number }) =>
    request<{ questions: GeneratedQuestion[] }>('api/bank/generate', { method: 'POST', ...json(payload) }),

  listJds: () => request<{ jds: JobDescription[] }>('api/jds'),

  addJd: (input: JobDescriptionInput) => request<JobDescription>('api/jds', { method: 'POST', ...json(input) }),

  updateJd: (id: string, input: Partial<JobDescriptionInput>) =>
    request<JobDescription>(`api/jds/${id}`, { method: 'PATCH', ...json(input) }),

  deleteJd: (id: string) => request<void>(`api/jds/${id}`, { method: 'DELETE' }),

  adminOverview: () => request<AdminOverview>('api/admin/overview'),

  adminDashboard: () => request<DashboardData>('api/admin/dashboard'),

  bankGroup: (groupId: string) => request<Bank>('api/bank?group=' + encodeURIComponent(groupId)),

  jdsGroup: (groupId: string) => request<{ jds: JobDescription[] }>('api/jds?group=' + encodeURIComponent(groupId)),

  adminSetGrants: (userId: string, deptIds: string[]) =>
    request<{ userId: string; deptIds: string[] }>('api/admin/grants', { method: 'PUT', ...json({ userId, deptIds }) }),

  adminRefreshOrg: () => request<{ depts: AdminOverview['depts']; fetchedAt: string; syncedUsers?: number }>('api/admin/org/refresh', { method: 'POST' }),

  adminSetAdmin: (userId: string, admin: boolean) =>
    request<{ userId: string; admin: boolean }>('api/admin/admins', { method: 'PUT', ...json({ userId, admin }) }),

  adminSetSuper: (userId: string, isSuper: boolean) =>
    request<{ userId: string; super: boolean }>('api/admin/super-admins', { method: 'PUT', ...json({ userId, super: isSuper }) }),

  adminSetRole: (userId: string, role: UserRole) =>
    request<{ userId: string; role: UserRole }>('api/admin/roles', { method: 'PUT', ...json({ userId, role }) }),

  // ══════════════ 招聘工作台 V2（api-contract-v2.md 第 3 节） ══════════════

  todos: () => request<Todos>('api/todos'),

  listCandidates: (params: { stage?: string; positionId?: string; channel?: string; ownerId?: string; q?: string; verdict?: string; page?: number; size?: number } = {}) => {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') qs.set(k, String(v))
    const s = qs.toString()
    return request<{ total: number; candidates: CandidateRow[] }>('api/candidates' + (s ? '?' + s : ''))
  },

  getCandidate: (id: string) =>
    request<{ candidate: Candidate; matches: Match[]; followups: FollowUp[]; interviews: Interview[]; offers: Offer[] }>(`api/candidates/${id}`),

  patchCandidate: (id: string, patch: { stage?: Stage; ownerId?: string; nextStep?: string }) =>
    request<Candidate>(`api/candidates/${id}`, { method: 'PATCH', ...json(patch) }),

  addFollowUp: (id: string, body: { content: string; nextStep?: string }) =>
    request<FollowUp>(`api/candidates/${id}/followups`, { method: 'POST', ...json(body) }),

  addMatch: (id: string, positionId: string) =>
    request<Match>(`api/candidates/${id}/matches`, { method: 'POST', ...json({ positionId }) }),

  removeMatch: (id: string, matchId: string) => request<void>(`api/candidates/${id}/matches/${matchId}`, { method: 'DELETE' }),

  screenMatch: (matchId: string) => request<Job>(`api/matches/${matchId}/screen`, { method: 'POST' }),

  resumeText: (id: string) => request<{ text: string }>(`api/candidates/${id}/resume-text`),

  listPositions: (params: { status?: string; q?: string } = {}) => {
    const qs = new URLSearchParams()
    if (params.status) qs.set('status', params.status)
    if (params.q) qs.set('q', params.q)
    const s = qs.toString()
    return request<{ positions: Position[] }>('api/positions' + (s ? '?' + s : ''))
  },

  createPosition: (body: { title: string; city?: string; department?: string; jd: { content: string; requirements?: string; note?: string } }) =>
    request<Position>('api/positions', { method: 'POST', ...json(body) }),

  getPosition: (id: string) => request<Position>(`api/positions/${id}`),

  patchPosition: (id: string, body: { title?: string; city?: string; department?: string; status?: Position['status']; jd?: { content: string; requirements?: string; note?: string } }) =>
    request<Position>(`api/positions/${id}`, { method: 'PATCH', ...json(body) }),

  deletePosition: (id: string) => request<void>(`api/positions/${id}`, { method: 'DELETE' }),

  rescreenPosition: (id: string) => request<Job>(`api/positions/${id}/rescreen`, { method: 'POST' }),

  listInterviews: (params: { from?: string; to?: string; candidateId?: string; mine?: boolean } = {}) => {
    const qs = new URLSearchParams()
    if (params.from) qs.set('from', params.from)
    if (params.to) qs.set('to', params.to)
    if (params.candidateId) qs.set('candidateId', params.candidateId)
    if (params.mine) qs.set('mine', '1')
    const s = qs.toString()
    return request<{ interviews: Interview[] }>('api/interviews' + (s ? '?' + s : ''))
  },

  createInterview: (body: NewInterviewInput) => request<Interview>('api/interviews', { method: 'POST', ...json(body) }),

  patchInterview: (id: string, body: { action: 'reschedule' | 'cancel' | 'complete'; startAt?: string; endAt?: string; reason?: string }) =>
    request<Interview>(`api/interviews/${id}`, { method: 'PATCH', ...json(body) }),

  resendInterview: (id: string, channel: 'email' | 'sms') =>
    request<Interview>(`api/interviews/${id}/resend`, { method: 'POST', ...json({ channel }) }),

  saveFeedback: (id: string, body: { scores?: { dimension: string; score: number }[]; note?: string; conclusion?: string }) =>
    request<Feedback>(`api/interviews/${id}/feedback`, { method: 'POST', ...json(body) }),

  aiDraftFeedback: (id: string) => request<Job>(`api/interviews/${id}/feedback/ai-draft`, { method: 'POST' }),

  confirmFeedback: (id: string, body: { scores: { dimension: string; score: number }[]; note: string; conclusion: string }) =>
    request<Feedback>(`api/interviews/${id}/feedback/confirm`, { method: 'POST', ...json(body) }),

  linkInterviewSession: (id: string, sessionId: string) =>
    request<Interview>(`api/interviews/${id}/link-session`, { method: 'POST', ...json({ sessionId }) }),

  listOffers: (params: { state?: string; q?: string } = {}) => {
    const qs = new URLSearchParams()
    if (params.state) qs.set('state', params.state)
    if (params.q) qs.set('q', params.q)
    const s = qs.toString()
    return request<{ offers: Offer[] }>('api/offers' + (s ? '?' + s : ''))
  },

  createOffer: (body: { candidateId: string; positionId: string; note?: string; materials?: { name: string; ok: boolean }[]; idempotencyKey?: string }) =>
    request<Offer>('api/offers', { method: 'POST', ...json(body) }),

  getOffer: (id: string) => request<Offer>(`api/offers/${id}`),

  refreshOffer: (id: string) => request<Offer>(`api/offers/${id}/refresh`, { method: 'POST' }),

  cancelOffer: (id: string) => request<Offer>(`api/offers/${id}/cancel`, { method: 'POST' }),

  adminIntegrations: () => request<Integrations>('api/admin/integrations'),

  adminSync: () => request<Job>('api/admin/sync', { method: 'POST' }),
}

const MAX_SIZE = 20 * 1024 * 1024
const EXT_RE = /\.(pdf|docx|txt|png|jpe?g)$/i

/** 上传前校验，返回中文错误信息或 null */
export function validateResumeFile(file: File): string | null {
  if (!EXT_RE.test(file.name)) return '请选择 PDF、Word、TXT 或图片文件'
  if (file.size > MAX_SIZE) return '请选择 20 MB 以内的文件'
  if (file.size === 0) return '文件为空，请重新选择'
  return null
}
