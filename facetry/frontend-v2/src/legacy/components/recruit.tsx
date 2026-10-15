import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { api } from '../api'
import type { CandidateRow, Interview, InterviewStatus, NotifyState, SideState, Stage, Verdict } from '../types'
import { Spinner } from './ui'

export const rise = (i: number) => ({ '--i': i }) as CSSProperties

/** 表单通用样式（与 Jds/Admin 既有写法一致） */
export const field =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
export const lab = 'text-xs font-medium text-slate-600'

// —— 枚举文案 ——
export const stageLabels: Record<Stage, string> = {
  new: '新入库',
  screening: '筛选中',
  contact: '待联系',
  interviewing: '约面中',
  evaluating: '面评中',
  offer: '待录取',
  done: '已完成',
  parked: '搁置',
}
export const stageOrder: Stage[] = ['new', 'screening', 'contact', 'interviewing', 'evaluating', 'offer', 'done', 'parked']

export const interviewStatusLabels: Record<InterviewStatus, string> = {
  scheduled: '待进行',
  rescheduled: '已改期',
  canceled: '已取消',
  completed: '已完成',
}

export const sideStateLabels: Record<SideState, string> = {
  pending: '未发起',
  submitted: '已发起',
  processing: '处理中',
  approved: '通过',
  returned: '退回',
  rejected: '拒绝',
  canceled: '已撤销',
  error: '异常',
}

export const notifyLabels: Record<NotifyState, string> = { pending: '待发送', sent: '已发送', failed: '失败', skipped: '未配置' }

/** 阶段徽章：浅底深字 */
export function StageChip({ stage, className = '' }: { stage: Stage; className?: string }) {
  const tone =
    stage === 'done'
      ? 'bg-emerald-50 text-emerald-700'
      : stage === 'offer'
        ? 'bg-blue-50 text-blue-600'
        : stage === 'parked'
          ? 'bg-slate-100 text-slate-400'
          : stage === 'contact'
            ? 'bg-amber-50 text-amber-700'
            : 'bg-slate-100 text-slate-600'
  return <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs ${tone} ${className}`}>{stageLabels[stage]}</span>
}

/** AI 判定徽章：合适=emerald / 待定=amber / 不合适=red / 信息不足=slate，浅底深字 */
export function VerdictBadge({ verdict, score, size = 'sm' }: { verdict: Verdict | ''; score?: number | null; size?: 'sm' | 'lg' }) {
  const tone =
    verdict === '合适'
      ? 'bg-emerald-50 text-emerald-700'
      : verdict === '待定'
        ? 'bg-amber-50 text-amber-700'
        : verdict === '不合适'
          ? 'bg-red-50 text-red-600'
          : 'bg-slate-100 text-slate-500'
  const pad = size === 'lg' ? 'px-2.5 py-1 text-sm font-medium' : 'px-1.5 py-0.5 text-xs'
  return (
    <span className={`inline-flex items-center gap-1 rounded ${tone} ${pad}`}>
      {verdict || '未初筛'}
      {typeof score === 'number' && <span className="tabular-nums opacity-75">{score}</span>}
    </span>
  )
}

export function InterviewStatusChip({ status }: { status: InterviewStatus }) {
  const tone =
    status === 'completed'
      ? 'bg-emerald-50 text-emerald-700'
      : status === 'canceled'
        ? 'bg-slate-100 text-slate-400'
        : status === 'rescheduled'
          ? 'bg-amber-50 text-amber-700'
          : 'bg-blue-50 text-blue-600'
  return <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs ${tone}`}>{interviewStatusLabels[status]}</span>
}

/** 面试通知三色点：email / sms / feishu，悬停显示明细与错误 */
export function NotifyDots({ notify }: { notify: Interview['notify'] }) {
  const dot = (state: NotifyState) =>
    state === 'sent' ? 'bg-emerald-500' : state === 'failed' ? 'bg-red-500' : state === 'pending' ? 'bg-amber-400' : 'bg-slate-300'
  const items: [string, { state: NotifyState; error: string }][] = [
    ['邮件', notify.email],
    ['短信', notify.sms],
    ['飞书', { state: notify.feishu.state, error: notify.feishu.error }],
  ]
  return (
    <span className="group relative inline-flex items-center gap-1.5">
      {items.map(([name, n]) => (
        <span key={name} className={`h-2 w-2 rounded-full ${dot(n.state)}`} aria-hidden="true" />
      ))}
      <span className="ws-paper pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 hidden w-48 -translate-x-1/2 rounded-lg p-3 text-xs leading-5 group-hover:block">
        {items.map(([name, n]) => (
          <span key={name} className="flex items-center gap-2 py-0.5">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot(n.state)}`} />
            <span className="text-slate-700">{name}</span>
            <span className="ml-auto text-slate-400">{notifyLabels[n.state]}</span>
            {n.error && <span className="w-full truncate text-red-500">{n.error}</span>}
          </span>
        ))}
      </span>
    </span>
  )
}

/** 面试官头像组：无头像时用首字圆 */
export function AvatarStack({ users, size = 'md' }: { users: { id: string; name: string; avatar?: string }[]; size?: 'sm' | 'md' }) {
  const cell = size === 'sm' ? 'h-6 w-6 text-[10px]' : 'h-7 w-7 text-xs'
  return (
    <span className="inline-flex -space-x-1.5">
      {users.slice(0, 4).map((u) =>
        u.avatar ? (
          <img key={u.id} src={u.avatar} alt={u.name} title={u.name} referrerPolicy="no-referrer" className={`${cell} rounded-full object-cover ring-2 ring-white`} />
        ) : (
          <span key={u.id} title={u.name} className={`grid ${cell} place-items-center rounded-full bg-blue-50 font-medium text-blue-600 ring-2 ring-white`}>
            {u.name[0]}
          </span>
        ),
      )}
      {users.length > 4 && (
        <span className={`grid ${cell} place-items-center rounded-full bg-slate-100 text-slate-500 ring-2 ring-white`}>+{users.length - 4}</span>
      )}
    </span>
  )
}

// —— 审批双轨步进条 ——
const sideSteps: SideState[] = ['pending', 'submitted', 'processing', 'approved']

/** 单侧审批进度：未发起→已发起→处理中→通过；退回/拒绝/撤销/异常在末端以红/橙标出 */
export function SideTrack({ label, state, updatedAt, error, onRetry }: { label: string; state: SideState; updatedAt?: string; error?: string; onRetry?: () => void }) {
  const bad = state === 'returned' || state === 'rejected' || state === 'canceled' || state === 'error'
  const idx = sideSteps.indexOf(state)
  const fillTo = bad ? (state === 'returned' ? 2 : 1) : idx // 异常类状态展示到其进行到的位置
  const badColor = state === 'returned' ? 'bg-amber-400' : state === 'canceled' ? 'bg-slate-300' : 'bg-red-500'
  const stateText =
    state === 'approved' ? 'text-emerald-600' : bad ? (state === 'returned' ? 'text-amber-600' : state === 'canceled' ? 'text-slate-400' : 'text-red-600') : 'text-slate-500'
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2 text-xs">
        <span className="w-14 shrink-0 font-medium text-slate-600">{label}</span>
        <div className="flex flex-1 items-center">
          {sideSteps.map((s, i) => {
            const reached = i <= fillTo
            const isTip = i === fillTo
            const dotColor = !reached ? 'bg-slate-200' : bad && isTip ? badColor : isTip && state === 'approved' ? 'bg-emerald-500' : 'bg-blue-600'
            return (
              <div key={s} className="flex flex-1 items-center last:flex-none">
                <span className={`h-2 w-2 shrink-0 rounded-full ${dotColor}`} />
                {i < sideSteps.length - 1 && <span className={`h-px flex-1 ${i < fillTo ? 'bg-blue-200' : 'bg-slate-200'}`} />}
              </div>
            )
          })}
        </div>
        <span className={`shrink-0 ${stateText}`}>{sideStateLabels[state]}</span>
      </div>
      {(error || updatedAt || onRetry) && (
        <div className="mt-1 flex items-center gap-2 text-[11px] leading-4 text-slate-400">
          {updatedAt && <span className="tabular-nums">{fmtDT(updatedAt)}</span>}
          {error && <span className="truncate text-red-500">{error}</span>}
          {onRetry && (
            <button type="button" onClick={onRetry} className="shrink-0 cursor-pointer font-medium text-blue-600 hover:text-blue-800">
              重试刷新
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/** 整体汇总徽章 */
export function OverallBadge({ state }: { state: SideState }) {
  const tone =
    state === 'approved'
      ? 'bg-emerald-50 text-emerald-700'
      : state === 'returned'
        ? 'bg-amber-50 text-amber-700'
        : state === 'rejected' || state === 'error'
          ? 'bg-red-50 text-red-600'
          : state === 'canceled'
            ? 'bg-slate-100 text-slate-400'
            : 'bg-blue-50 text-blue-600'
  return <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs ${tone}`}>{sideStateLabels[state]}</span>
}

/** 空态引导 */
export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="px-5 py-12 text-center">
      <p className="text-sm text-slate-500">{title}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

// —— 时间格式化 ——
const pad = (n: number) => String(n).padStart(2, '0')

/** 「MM-DD HH:mm」（跨年带年份） */
export function fmtDT(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return `${sameYear ? '' : d.getFullYear() + '-'}${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function fmtHM(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function fmtMD(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export const weekdayLabels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

// —— 候选人搜索选择器（约面 / 录取弹窗共用） ——
export function CandidatePicker({ value, onPick, autoFocus }: { value: CandidateRow | null; onPick: (c: CandidateRow | null) => void; autoFocus?: boolean }) {
  const [kw, setKw] = useState('')
  const [list, setList] = useState<CandidateRow[] | null>(null)
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const search = (q: string) => {
    setKw(q)
    setOpen(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      api
        .listCandidates({ q: q.trim(), size: 8 })
        .then((r) => setList(r.candidates))
        .catch(() => setList([]))
    }, 300)
  }

  if (value) {
    return (
      <span className="flex h-10 w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm">
        <span className="min-w-0 flex-1 truncate font-medium text-slate-900">{value.name}</span>
        <span className="truncate text-xs text-slate-400">{[value.currentPosition, value.currentCompany].filter(Boolean).join(' @ ')}</span>
        <button type="button" aria-label="重新选择" onClick={() => { onPick(null); setKw(''); setList(null) }} className="shrink-0 cursor-pointer text-slate-400 hover:text-slate-700">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12 M18 6L6 18" /></svg>
        </button>
      </span>
    )
  }
  return (
    <div ref={wrapRef} className="relative">
      <input
        value={kw}
        autoFocus={autoFocus}
        onChange={(e) => search(e.target.value)}
        onFocus={() => kw && setOpen(true)}
        placeholder="搜索候选人姓名…"
        className={field}
      />
      {open && (
        <div className="ws-paper absolute inset-x-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-xl p-1 shadow-[var(--shadow-lift)]">
          {list === null && kw.trim() && (
            <p className="flex items-center justify-center gap-2 py-4 text-xs text-slate-400">
              <Spinner /> 搜索中…
            </p>
          )}
          {list?.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => { onPick(c); setOpen(false) }}
              className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-slate-100"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-slate-900">{c.name}</span>
                <span className="block truncate text-xs text-slate-400">{[c.currentPosition, c.currentCompany].filter(Boolean).join(' @ ') || c.channelName}</span>
              </span>
              <StageChip stage={c.stage} />
            </button>
          ))}
          {list && !list.length && <p className="py-4 text-center text-xs text-slate-400">没有匹配的候选人</p>}
          {!list && !kw.trim() && <p className="py-4 text-center text-xs text-slate-400">输入姓名开始搜索</p>}
        </div>
      )}
    </div>
  )
}
