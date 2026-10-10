import type { AdminOverview, AnalyzePayload, Bank, BankQuestion, BankQuestionInput, DashboardData, DirectoryUser, GeneratedQuestion, Job, JobDescription, JobDescriptionInput, MeResponse, Session, SessionPatch, SessionSummary } from './types'

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
  status: () => request<{ configured: boolean; feishu: boolean }>('api/status'),

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
