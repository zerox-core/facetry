import type React from 'react'
import { useMemo, useRef, useState } from 'react'
import type { Go } from '../App'
import { Btn, Card, ScoreStamp, SectionHead } from '../components/ui'
import type { SessionSummary } from '../types'
import { fmtTime, PhaseChip, ProgressBar, useSessions, useUpload } from './shared'

const hour = new Date().getHours()
const greet = hour < 6 ? '夜深了' : hour < 12 ? '早上好' : hour < 18 ? '下午好' : '晚上好'

const rise = (i: number) => ({ '--i': i } as React.CSSProperties)
const WEEK = ['日', '一', '二', '三', '四', '五', '六']
const pad = (n: number) => String(n).padStart(2, '0')
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

const isPending = (s: SessionSummary) => s.questionCount === 0
const isScoring = (s: SessionSummary) => s.questionCount > 0 && !s.hasEvaluation
const isDone = (s: SessionSummary) => s.hasEvaluation

export default function Home({ go, user }: { go: Go; user: string }) {
  const { sessions, error, reload } = useSessions()
  const { uploading, pick, input } = useUpload((s) => go('review', s.id))

  const all = sessions || []
  const pending = all.filter(isPending)
  const scoring = all.filter(isScoring)
  const done = all.filter(isDone)

  // —— 问候副标题：有待办就给出可执行的数量，否则保留诗意的一句 ——
  const todoParts = [
    pending.length ? `${pending.length} 份简历待生成问题` : '',
    scoring.length ? `${scoring.length} 份待完成评价` : '',
  ].filter(Boolean)
  const subtitle = todoParts.length ? todoParts.join(' · ') : '好问题，就在字里行间。'

  // —— 左侧「最近更新」：默认最近 6 份；点击日历某天则过滤为当天更新的 ——
  const [viewDay, setViewDay] = useState('') // '' = 最近
  const viewDate = useMemo(() => {
    const [vy, vm, vd] = viewDay.split('-').map(Number)
    return viewDay ? new Date(vy, vm - 1, vd) : null
  }, [viewDay])
  const isRecentView = !viewDay
  const dayList = viewDate ? all.filter((s) => s.updatedAt && sameDay(new Date(s.updatedAt), viewDate)) : []
  const listSessions = isRecentView ? all.slice(0, 6) : dayList

  // —— 本月活跃：GitHub 贡献图式热力，热度 = 当天更新过的简历份数 ——
  const now = new Date()
  const y = now.getFullYear()
  const mo = now.getMonth()
  const daysInMonth = new Date(y, mo + 1, 0).getDate()
  const leading = (new Date(y, mo, 1).getDay() + 6) % 7
  const byDay = new Map<number, SessionSummary[]>()
  for (const s of all) {
    if (!s.updatedAt) continue
    const d = new Date(s.updatedAt)
    if (d.getFullYear() === y && d.getMonth() === mo) byDay.set(d.getDate(), [...(byDay.get(d.getDate()) ?? []), s])
  }
  const heat = (n: number) =>
    n === 0
      ? 'bg-slate-100/70 text-slate-400'
      : n === 1
        ? 'bg-emerald-200 font-medium text-emerald-950'
        : n === 2
          ? 'bg-emerald-400 font-medium text-emerald-950'
          : 'bg-emerald-600 font-semibold text-white'
  const [hover, setHover] = useState<{ day: number; left: number; top: number } | null>(null)
  const calRef = useRef<HTMLDivElement>(null)

  const statCards: [string, number][] = [
    ['简历总数', all.length],
    ['待生成问题', pending.length],
    ['评分中', scoring.length],
    ['已完成评价', done.length],
  ]

  // 空态：只有问候 + 上传引导
  if (sessions && sessions.length === 0) {
    return (
      <div className="space-y-8">
        {input}
        <div className="ws-rise" style={rise(0)}>
          <h1 className="text-2xl font-semibold text-slate-900">
            {greet}，{user}
          </h1>
          <p className="mt-1 text-sm text-slate-500">好问题，就在字里行间。</p>
        </div>
        <Card className="ws-rise flex flex-col items-center px-6 py-16 text-center" style={rise(1)}>
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-blue-50 text-blue-600">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 3h8l4 4v14H6z M14 3v5h4 M9 12h6 M9 16h5" />
            </svg>
          </span>
          <h3 className="mt-4 text-base font-semibold text-slate-900">还没有简历</h3>
          <p className="mt-1 text-sm text-slate-500">上传第一份简历，AI 会把面试问题标注在原文旁边。</p>
          <Btn variant="accent" className="mt-6" onClick={pick} disabled={uploading}>
            {uploading ? '上传中…' : '上传简历'}
          </Btn>
          <p className="mt-3 text-xs text-slate-400">支持 PDF、Word、TXT 或图片，最大 20 MB</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {input}
      <div className="ws-rise flex flex-wrap items-end justify-between gap-4" style={rise(0)}>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            {greet}，{user}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
        <Btn variant="accent" onClick={pick} disabled={uploading}>
          {uploading ? '上传中…' : '上传简历'}
        </Btn>
      </div>

      {error && (
        <Card className="ws-rise px-5 py-4" style={rise(1)}>
          <div className="flex items-center justify-between">
            <p className="text-sm text-amber-700">{error}</p>
            <Btn variant="ghost" className="h-8 px-3 text-xs" onClick={() => void reload()}>
              重试
            </Btn>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map(([label, value], i) => (
          <Card key={label} className="ws-rise px-5 py-4" style={rise(i + 1)}>
            <div className="text-xs font-medium text-slate-500">{label}</div>
            <div className="mt-2 text-[28px] font-semibold leading-8 text-slate-900 tabular-nums">{sessions ? value : '—'}</div>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <section className="ws-rise" style={rise(5)}>
          <div className="mb-4 flex items-end justify-between">
            <h2 className="text-lg font-semibold text-slate-900">
              {isRecentView ? '最近更新' : `${viewDate!.getMonth() + 1} 月 ${viewDate!.getDate()} 日 · 周${WEEK[viewDate!.getDay()]}`}
            </h2>
            {!isRecentView && (
              <button
                onClick={() => setViewDay('')}
                className="cursor-pointer text-sm text-blue-600 hover:text-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                回到最近
              </button>
            )}
          </div>
          <div className="ws-paper divide-y divide-slate-100 rounded-xl">
            {listSessions.map((s) => (
              <div
                key={s.id}
                onClick={() => go('review', s.id)}
                className="grid cursor-pointer items-center gap-2 px-5 py-4 transition-colors duration-150 hover:bg-slate-50/70 md:grid-cols-[minmax(0,1fr)_auto_auto]"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-medium text-slate-900">{s.name || '待解析'}</span>
                    <span className="truncate text-sm text-slate-500">{s.role || '—'}</span>
                    <PhaseChip phase={s.phase} questionCount={s.questionCount} />
                  </div>
                  <p className="mt-1 truncate text-xs text-slate-400">{s.fileName}</p>
                </div>
                <ProgressBar scored={s.scoredCount} total={s.questionCount} />
                <span className="text-xs text-slate-400 tabular-nums md:text-right">{fmtTime(s.updatedAt)}</span>
              </div>
            ))}
            {!listSessions.length && (
              <p className="px-5 py-8 text-center text-sm text-slate-400">{isRecentView ? '还没有简历' : '这一天没有简历活动'}</p>
            )}
          </div>
        </section>

        <section className="ws-rise" style={rise(6)}>
          <SectionHead title="本月活跃" />
          <Card className="px-5 py-4">
            <div ref={calRef} className="relative">
              <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-400">
                {['一', '二', '三', '四', '五', '六', '日'].map((d) => (
                  <span key={d} className="py-1">
                    {d}
                  </span>
                ))}
              </div>
              <div className="mt-1 grid grid-cols-7 gap-1">
                {Array.from({ length: leading }).map((_, i) => (
                  <span key={`x${i}`} />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1
                  const list = byDay.get(day) ?? []
                  const isToday = day === now.getDate()
                  const dayIso = `${y}-${pad(mo + 1)}-${pad(day)}`
                  const selected = !isToday && viewDay === dayIso
                  return (
                    <button
                      key={day}
                      onClick={() => {
                        if (list.length) {
                          setViewDay(dayIso)
                          setHover(null)
                        }
                      }}
                      onMouseEnter={(e) => {
                        if (!list.length || !calRef.current) return
                        const r = e.currentTarget.getBoundingClientRect()
                        const p = calRef.current.getBoundingClientRect()
                        setHover({ day, left: r.left - p.left + r.width / 2, top: r.top - p.top })
                      }}
                      onMouseLeave={() => setHover(null)}
                      className={`flex h-9 items-center justify-center rounded-md text-sm tabular-nums transition-colors ${heat(list.length)} ${
                        list.length ? 'cursor-pointer' : 'cursor-default'
                      } ${isToday ? 'ring-2 ring-inset ring-slate-900/70' : ''} ${selected ? 'ring-2 ring-inset ring-emerald-700' : ''}`}
                    >
                      {day}
                    </button>
                  )
                })}
              </div>
              {hover && (byDay.get(hover.day)?.length ?? 0) > 0 && (
                <div
                  className="pointer-events-none absolute z-20 w-60 -translate-x-1/2 -translate-y-full rounded-lg bg-[#1d2939] px-3.5 py-3 text-white shadow-[var(--shadow-lift)]"
                  style={{ left: hover.left, top: hover.top - 8 }}
                >
                  <div className="text-xs text-white/60">
                    {mo + 1} 月 {hover.day} 日 · 周{WEEK[new Date(y, mo, hover.day).getDay()]} · {byDay.get(hover.day)!.length} 份简历更新
                  </div>
                  <ul className="mt-1.5 space-y-1.5">
                    {byDay.get(hover.day)!.map((s) => (
                      <li key={s.id} className="min-w-0 truncate text-[13px] leading-5">
                        {s.name || '待解析'} · {s.role || '岗位待定'}
                      </li>
                    ))}
                  </ul>
                  <div className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-[#1d2939]" />
                </div>
              )}
            </div>
            <div className="mt-3 flex items-center justify-end gap-1.5 text-xs text-slate-400">
              少
              <span className="h-2.5 w-2.5 rounded-sm bg-slate-100" />
              <span className="h-2.5 w-2.5 rounded-sm bg-emerald-200" />
              <span className="h-2.5 w-2.5 rounded-sm bg-emerald-400" />
              <span className="h-2.5 w-2.5 rounded-sm bg-emerald-600" />
              多
            </div>
          </Card>
        </section>
      </div>

      <section className="ws-rise" style={rise(7)}>
        <SectionHead title="评审进度" />
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="flex flex-col px-5 py-4">
            <div className="flex items-baseline justify-between">
              <span className="text-[15px] font-semibold text-slate-900">待生成</span>
              <span className="text-sm tabular-nums text-slate-400">{pending.length}</span>
            </div>
            <p className="mt-1 text-xs text-slate-400">简历已上传，还没有生成面试问题</p>
            <ul className="mt-3 flex-1 space-y-2.5">
              {pending.map((s) => (
                <li
                  key={s.id}
                  className="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                  onClick={() => go('review', s.id)}
                >
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-slate-900">{s.name || '待解析'}</span>
                    <span className="ml-2 text-xs text-slate-500">{s.role || '—'}</span>
                  </div>
                  <span className="shrink-0 text-xs text-blue-600">去生成</span>
                </li>
              ))}
              {!pending.length && <li className="py-3 text-center text-sm text-slate-400">暂无 · 上传简历后出现在这里</li>}
            </ul>
            <button
              onClick={() => go('resumes')}
              className="mt-3 cursor-pointer self-start text-sm text-blue-600 hover:text-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              去简历库 →
            </button>
          </Card>

          <Card className="flex flex-col px-5 py-4">
            <div className="flex items-baseline justify-between">
              <span className="text-[15px] font-semibold text-slate-900">评分中</span>
              <span className="text-sm tabular-nums text-slate-400">{scoring.length}</span>
            </div>
            <p className="mt-1 text-xs text-slate-400">问题已生成，评分进行中</p>
            <ul className="mt-3 flex-1 space-y-2.5">
              {scoring.map((s) => (
                <li
                  key={s.id}
                  className="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                  onClick={() => go('review', s.id)}
                >
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-slate-900">{s.name || '待解析'}</span>
                    <span className="ml-2 text-xs tabular-nums text-slate-500">
                      {s.scoredCount}/{s.questionCount}
                    </span>
                  </div>
                  <ProgressBar scored={s.scoredCount} total={s.questionCount} />
                </li>
              ))}
              {!scoring.length && <li className="py-3 text-center text-sm text-slate-400">暂无进行中的评分</li>}
            </ul>
          </Card>

          <Card className="flex flex-col px-5 py-4">
            <div className="flex items-baseline justify-between">
              <span className="text-[15px] font-semibold text-slate-900">已完成</span>
              <span className="text-sm tabular-nums text-slate-400">{done.length}</span>
            </div>
            <p className="mt-1 text-xs text-slate-400">已生成综合评价</p>
            <ul className="mt-3 flex-1 space-y-2.5">
              {done.map((s) => (
                <li
                  key={s.id}
                  className="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                  onClick={() => go('review', s.id)}
                >
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-slate-900">{s.name || '待解析'}</span>
                    <span className="ml-2 text-xs text-slate-500">{s.role || '—'}</span>
                  </div>
                  {s.avgScore !== null && <ScoreStamp score={s.avgScore} />}
                </li>
              ))}
              {!done.length && <li className="py-3 text-center text-sm text-slate-400">暂无已完成的评价</li>}
            </ul>
          </Card>
        </div>
      </section>

      {done.length > 0 && (
        <section className="ws-rise" style={rise(8)}>
          <SectionHead title="近期评价" sub={`共 ${done.length} 条`} />
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500">
                    <th className="px-5 py-2.5 font-medium">候选人</th>
                    <th className="font-medium">岗位</th>
                    <th className="font-medium">平均得分</th>
                    <th className="hidden font-medium md:table-cell">评价摘要</th>
                    <th className="px-5 text-right font-medium">更新</th>
                  </tr>
                </thead>
                <tbody>
                  {done.map((s) => (
                    <tr
                      key={s.id}
                      onClick={() => go('review', s.id)}
                      className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50"
                    >
                      <td className="px-5 py-3.5 font-medium text-slate-900">{s.name || '待解析'}</td>
                      <td className="text-slate-600">{s.role || '—'}</td>
                      <td>{s.avgScore !== null ? <ScoreStamp score={s.avgScore} /> : <span className="text-xs text-slate-400">—</span>}</td>
                      <td className="hidden max-w-72 truncate text-slate-500 md:table-cell">{s.suggestion || '—'}</td>
                      <td className="px-5 text-right text-slate-400 tabular-nums">{fmtTime(s.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </section>
      )}
    </div>
  )
}
