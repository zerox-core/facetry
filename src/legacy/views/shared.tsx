import { useCallback, useEffect, useRef, useState } from 'react'
import { api, validateResumeFile } from '../api'
import { Chip } from '../components/Chip'
import { toast } from '../components/Toast'
import { Btn, Spinner } from '../components/ui'
import type { Bank, JobDescription, Phase, Session, SessionSummary } from '../types'

export function useSessions() {
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null)
  const [error, setError] = useState('')
  const reload = useCallback(async () => {
    try {
      setSessions(await api.listSessions())
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败，请重试')
    }
  }, [])
  useEffect(() => {
    void reload()
  }, [reload])
  return { sessions, error, reload }
}

/** 上传简历：先选岗位 JD（可跳过）→ 再选文件 → 上传；附带隐藏 file input 与 JD 选择弹窗 */
export function useUpload(onUploaded: (s: Session) => void) {
  const [uploading, setUploading] = useState(false)
  const [choosing, setChoosing] = useState(false)
  const [jds, setJds] = useState<JobDescription[] | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const jdRef = useRef('')
  const pick = useCallback(() => {
    setChoosing(true)
    if (jds === null) {
      void api
        .listJds()
        .then((r) => setJds(r.jds))
        .catch(() => setJds([]))
    }
  }, [jds])
  const chooseJd = useCallback((jdId: string) => {
    jdRef.current = jdId
    setChoosing(false)
    inputRef.current?.click()
  }, [])
  const onFile = useCallback(
    async (f?: File | null) => {
      if (!f) return
      const invalid = validateResumeFile(f)
      if (invalid) {
        toast(invalid)
        return
      }
      setUploading(true)
      try {
        const s = await api.upload(f, jdRef.current || undefined)
        toast('简历已上传，预览后即可生成问题')
        onUploaded(s)
      } catch (e) {
        toast(e instanceof Error ? e.message : '上传失败，请重试')
      } finally {
        setUploading(false)
        jdRef.current = ''
        if (inputRef.current) inputRef.current.value = ''
      }
    },
    [onUploaded],
  )
  const input = (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.txt,.png,.jpg,.jpeg"
        className="hidden"
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
      {choosing && <JdChooser jds={jds} onPick={chooseJd} onClose={() => setChoosing(false)} />}
    </>
  )
  return { uploading, pick, input }
}

/** 上传前的 JD 选择弹窗：选择岗位带出岗位信息，也可跳过留空待补 */
function JdChooser({ jds, onPick, onClose }: { jds: JobDescription[] | null; onPick: (jdId: string) => void; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-[#1d2939]/50" onClick={onClose} />
      <div className="ws-paper login-fade relative max-h-[80vh] w-full max-w-md overflow-hidden rounded-xl" role="dialog" aria-modal="true">
        <div className="flex items-center justify-between px-5 pt-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">选择面试岗位</h3>
            <p className="mt-0.5 text-xs text-slate-400">岗位信息将从 JD 带出，AI 出题也会参考该 JD</p>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭" className="cursor-pointer text-slate-400 hover:text-slate-700">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12 M18 6L6 18" /></svg>
          </button>
        </div>
        <div className="max-h-96 space-y-1.5 overflow-y-auto px-5 py-3">
          {jds === null && (
            <p className="flex items-center justify-center gap-2 py-8 text-sm text-slate-400">
              <Spinner /> 正在加载岗位…
            </p>
          )}
          {jds?.map((j) => (
            <button key={j.id} type="button" onClick={() => onPick(j.id)} className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-slate-900">{j.title}</span>
                <span className="block truncate text-xs text-slate-400">
                  {j.company || j.groupName || ''}
                  {j.tags.length ? ' · ' + j.tags.join(' · ') : ''}
                </span>
              </span>
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-slate-300" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>
            </button>
          ))}
          {jds && !jds.length && <p className="py-8 text-center text-sm text-slate-400">岗位库还没有 JD，可直接跳过</p>}
        </div>
        <div className="flex justify-between gap-2 border-t border-slate-100 px-5 py-3">
          <Btn variant="ghost" onClick={onClose}>
            取消
          </Btn>
          <Btn onClick={() => onPick('')}>暂不选择，直接上传</Btn>
        </div>
      </div>
    </div>
  )
}

export const phaseLabels: Record<Phase, string> = { prepare: '准备中', interview: '面试中', review: '已完成' }

/** 媒体查询响应式钩子：窄屏判定用 '(max-width: 1023px)'（lg 以下 = 手机 / iPad 竖屏） */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches)
    setMatches(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])
  return matches
}

// —— 题库：模块级缓存，Bank 视图与评审页选题器共享，避免重复请求 ——
let bankCache: Bank | null = null
let bankPromise: Promise<Bank> | null = null

export function invalidateBank() {
  bankCache = null
  bankPromise = null
}

export function useBank() {
  const [bank, setBank] = useState<Bank | null>(bankCache)
  const [error, setError] = useState('')
  const reload = useCallback(async (force = false) => {
    if (force) invalidateBank()
    try {
      if (bankCache) {
        setBank(bankCache)
        setError('')
        return
      }
      if (!bankPromise) bankPromise = api.getBank()
      const b = await bankPromise
      bankCache = b
      setBank(b)
      setError('')
    } catch (e) {
      bankPromise = null
      setError(e instanceof Error ? e.message : '题库加载失败，请重试')
    }
  }, [])
  useEffect(() => {
    void reload()
  }, [reload])
  return { bank, error, reload }
}

/** 「Part A · 基础题」→「基础题」，取不到时用原名 */
export const shortPartName = (name: string) => name.split('·').pop()?.trim() || name

export function PhaseChip({ phase, questionCount, jobState }: { phase: Phase; questionCount?: number; jobState?: 'analyze' | 'evaluate' | null }) {
  if (jobState) return <Chip tone="amber">{jobState === 'analyze' ? '出题中…' : '评价中…'}</Chip>
  if (questionCount === 0) return <Chip tone="amber">待生成</Chip>
  if (phase === 'review') return <Chip tone="emerald">已完成评价</Chip>
  if (phase === 'interview') return <Chip tone="blue">面试中</Chip>
  return <Chip>准备中</Chip>
}

export function ProgressBar({ scored, total }: { scored: number; total: number }) {
  if (!total) return <span className="text-xs text-slate-400">—</span>
  const pct = Math.round((scored / total) * 100)
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${pct === 100 ? 'bg-emerald-500' : 'bg-blue-600'}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-500 tabular-nums">
        {scored}/{total}
      </span>
    </div>
  )
}

export function fmtTime(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const diff = Date.now() - d.getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return '刚刚'
  if (min < 60) return `${min} 分钟前`
  const hour = Math.floor(min / 60)
  if (hour < 24) return `${hour} 小时前`
  const pad = (n: number) => String(n).padStart(2, '0')
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return sameYear ? `${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
