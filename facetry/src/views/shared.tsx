import { useCallback, useEffect, useRef, useState } from 'react'
import { api, validateResumeFile } from '../api'
import { Chip } from '../components/Chip'
import { toast } from '../components/Toast'
import type { Bank, Phase, Session, SessionSummary } from '../types'

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

/** 上传简历：校验 → 上传 → 回调；附带隐藏 file input */
export function useUpload(onUploaded: (s: Session) => void) {
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const pick = useCallback(() => inputRef.current?.click(), [])
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
        const s = await api.upload(f)
        toast('简历已上传，预览后即可生成问题')
        onUploaded(s)
      } catch (e) {
        toast(e instanceof Error ? e.message : '上传失败，请重试')
      } finally {
        setUploading(false)
        if (inputRef.current) inputRef.current.value = ''
      }
    },
    [onUploaded],
  )
  const input = (
    <input
      ref={inputRef}
      type="file"
      accept=".pdf,.docx,.txt,.png,.jpg,.jpeg"
      className="hidden"
      onChange={(e) => void onFile(e.target.files?.[0])}
    />
  )
  return { uploading, pick, input }
}

export const phaseLabels: Record<Phase, string> = { prepare: '准备中', interview: '面试中', review: '已完成' }

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

export function PhaseChip({ phase, questionCount }: { phase: Phase; questionCount?: number }) {
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
