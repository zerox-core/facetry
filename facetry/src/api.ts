import type { AnalyzePayload, Bank, BankQuestion, BankQuestionInput, Job, Session, SessionPatch, SessionSummary } from './types'

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
  status: () => request<{ configured: boolean }>('/api/status'),

  listSessions: () => request<SessionSummary[]>('/api/sessions'),

  getSession: (id: string) => request<Session>(`/api/sessions/${id}`),

  patchSession: (id: string, patch: SessionPatch) =>
    request<Session>(`/api/sessions/${id}`, { method: 'PATCH', ...json(patch) }),

  deleteSession: (id: string) => request<void>(`/api/sessions/${id}`, { method: 'DELETE' }),

  async upload(file: File): Promise<Session> {
    const response = await fetch('/api/upload?name=' + encodeURIComponent(file.name), {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: file,
    })
    const data = (await response.json().catch(() => ({}))) as { error?: string }
    if (!response.ok) throw new Error(data.error || `上传失败（${response.status}）`)
    return data as unknown as Session
  },

  analyze: (id: string, payload: AnalyzePayload) =>
    request<Job>(`/api/sessions/${id}/analyze`, { method: 'POST', ...json(payload) }),

  evaluate: (id: string, force = false) =>
    request<Job>(`/api/sessions/${id}/evaluate`, { method: 'POST', ...json(force ? { force: true } : {}) }),

  getJob: (id: string) => request<Job>(`/api/jobs/${id}`),

  getBank: () => request<Bank>('/api/bank'),

  addBankQuestion: (input: BankQuestionInput) => request<BankQuestion>('/api/bank', { method: 'POST', ...json(input) }),

  updateBankQuestion: (id: string, input: Partial<BankQuestionInput>) =>
    request<BankQuestion>(`/api/bank/${id}`, { method: 'PATCH', ...json(input) }),

  deleteBankQuestion: (id: string) => request<void>(`/api/bank/${id}`, { method: 'DELETE' }),
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
