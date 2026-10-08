import type React from 'react'
import { useMemo, useRef, useState } from 'react'
import { candidates, history, TODAY } from '../data'
import { slotDate, slotLabel } from '../store'
import type { Go } from '../App'
import { Btn, Card, ScoreStamp, SectionHead } from './ui'

const verdictCls: Record<string, string> = { 推荐: 'bg-emerald-50 text-emerald-700', 待定: 'bg-slate-100 text-slate-600', 不推荐: 'bg-amber-50 text-amber-700' }
const statusCls: Record<string, string> = { 待约面: 'bg-slate-100 text-slate-600', 待面试: 'bg-blue-50 text-blue-700', 待评价: 'bg-amber-50 text-amber-700', 跟进中: 'bg-emerald-50 text-emerald-700', 已结束: 'bg-slate-100 text-slate-500' }
const today = () => { const [y, m, d] = TODAY.split('-').map(Number); return new Date(y, m - 1, d) }
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
const rise = (i: number) => ({ '--i': i } as React.CSSProperties)
const WEEK = ['日', '一', '二', '三', '四', '五', '六']
const pad = (n: number) => String(n).padStart(2, '0')

export default function Home({ go }: { go: Go }) {
  const now = today()
  const scheduled = candidates.filter((c) => slotDate(c.slot))
  const nextId = scheduled.filter((c) => sameDay(slotDate(c.slot)!, now)).sort((a, b) => a.slot.localeCompare(b.slot)).find((c) => c.status === '待面试')?.id
  const todo = candidates.filter((c) => c.status === '待评价')
  const unscheduled = candidates.filter((c) => c.status === '待约面')
  const upcoming = candidates.filter((c) => c.status === '待面试').sort((a, b) => a.slot.localeCompare(b.slot))
  const after = candidates.filter((c) => ['待评价', '跟进中', '已结束'].includes(c.status))

  // —— 左侧列表默认「今日面试」，点击日历某一天切换为那一天 ——
  const [viewDay, setViewDay] = useState(TODAY)
  const viewDate = useMemo(() => { const [vy, vm, vd] = viewDay.split('-').map(Number); return new Date(vy, vm - 1, vd) }, [viewDay])
  const isTodayView = viewDay === TODAY
  const dayList = scheduled.filter((c) => sameDay(slotDate(c.slot)!, viewDate)).sort((a, b) => a.slot.localeCompare(b.slot))

  // —— 面试日程：本月日历，绿色深浅 = 当天面试场次数（GitHub 贡献图式），悬停看明细 ——
  const y = now.getFullYear(), mo = now.getMonth()
  const daysInMonth = new Date(y, mo + 1, 0).getDate()
  const leading = (new Date(y, mo, 1).getDay() + 6) % 7
  const byDay = new Map<number, typeof scheduled>()
  scheduled.forEach((c) => { const d = slotDate(c.slot)!; if (d.getFullYear() === y && d.getMonth() === mo) byDay.set(d.getDate(), [...(byDay.get(d.getDate()) ?? []), c]) })
  const heat = (n: number) =>
    n === 0 ? 'bg-slate-100/70 text-slate-400'
      : n === 1 ? 'bg-emerald-200 font-medium text-emerald-950'
        : n === 2 ? 'bg-emerald-400 font-medium text-emerald-950'
          : 'bg-emerald-600 font-semibold text-white'
  const [hover, setHover] = useState<{ day: number; left: number; top: number } | null>(null)
  const calRef = useRef<HTMLDivElement>(null)

  const weekStart = new Date(now); weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6)
  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const inWeek = (d: string) => d >= iso(weekStart) && d <= iso(weekEnd)
  const weekCount = scheduled.filter((c) => inWeek(c.slot.slice(0, 10))).length + history.filter((h) => inWeek(h.date)).length

  const todayList = scheduled.filter((c) => sameDay(slotDate(c.slot)!, now)).sort((a, b) => a.slot.localeCompare(b.slot))

  return (
    <div className="space-y-8">
      <div className="ws-rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">王磊，今天有 {todayList.length} 场面试</h1>
        </div>
        <Btn variant="ghost" onClick={() => go('candidates')}>全部候选人</Btn>
      </div>

      <div className="grid gap-px overflow-hidden ws-paper ws-rise rounded-xl bg-slate-200/70 sm:grid-cols-2 lg:grid-cols-4" style={rise(1)}>
        {[['本周面试', String(weekCount), '场'], ['待提交评价', String(todo.length), '份'], ['待约面', String(unscheduled.length), '位'], ['评价通过率', String(Math.round((history.filter((h) => h.verdict === '推荐').length / history.length) * 100)), '%']].map(([k, v, u]) => (
          <div key={k} className="bg-[#fffdf9] px-5 py-4">
            <div className="text-sm text-slate-500">{k}</div>
            <div className="mt-1 text-[28px] font-semibold tabular-nums text-slate-900">{v}<span className="ml-1 text-sm font-normal text-slate-400">{u}</span></div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <section className="ws-rise" style={rise(2)}>
          <div className="mb-4 flex items-end justify-between">
            <h2 className="text-lg font-semibold text-slate-900">{isTodayView ? '今日面试' : `${viewDate.getMonth() + 1} 月 ${viewDate.getDate()} 日 · 周${WEEK[viewDate.getDay()]}`}</h2>
            {!isTodayView && (
              <span className="flex items-center gap-3 text-sm text-slate-400">
                <button onClick={() => setViewDay(TODAY)} className="cursor-pointer text-blue-600 hover:text-blue-800">回到今天</button>
              </span>
            )}
          </div>
          <div className="ws-paper divide-y divide-slate-100 rounded-xl">
            {dayList.map((c) => {
              const next = isTodayView && c.id === nextId
              const done = c.status === '待评价'
              return (
                <div key={c.id} className="group relative grid items-center gap-4 px-5 py-4 transition-colors duration-150 hover:bg-slate-50/70 md:grid-cols-[84px_minmax(0,1fr)_auto]">
                  {next && <span className="absolute inset-y-3 left-0 w-1 rounded-r bg-amber-400" />}
                  <div>
                    <div className="text-[15px] font-semibold tabular-nums text-slate-900">{c.slot.slice(11)}</div>
                    <div className="text-xs text-slate-500">{c.round}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[15px] font-medium text-slate-900">{c.name}</span>
                      <span className="text-sm text-slate-500">{c.role}</span>
                      {next && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">下一场</span>}
                      {done && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-700">待评价</span>}
                    </div>
                    <p className="mt-1 truncate text-sm text-slate-500">匹配 {c.match}% · 亮点 {c.highlights.length} · 待核实 {c.risks.length} · {c.qs.length} 道定制题</p>
                  </div>
                  <div className="flex gap-2">
                    <Btn variant="ghost" onClick={() => go('analysis', c.id)}>简历分析</Btn>
                    <Btn variant={next ? 'accent' : 'solid'} onClick={() => go('room', c.id)}>{done ? '补填评价' : '进入面试间'}</Btn>
                  </div>
                </div>
              )
            })}
            {!dayList.length && <p className="px-5 py-8 text-center text-sm text-slate-400">{isTodayView ? '今天没有安排面试' : '这一天没有安排面试'}</p>}
          </div>
        </section>

        <section className="ws-rise" style={rise(3)}>
          <SectionHead title="面试日程" />
          <Card className="px-5 py-4">
            <div ref={calRef} className="relative">
              <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-400">
                {['一', '二', '三', '四', '五', '六', '日'].map((d) => <span key={d} className="py-1">{d}</span>)}
              </div>
              <div className="mt-1 grid grid-cols-7 gap-1">
                {Array.from({ length: leading }).map((_, i) => <span key={`x${i}`} />)}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1
                  const list = byDay.get(day) ?? []
                  const isToday = day === now.getDate()
                  const dayIso = `${y}-${pad(mo + 1)}-${pad(day)}`
                  const selected = !isToday && viewDay === dayIso
                  return (
                    <button
                      key={day}
                      onClick={() => { if (list.length) { setViewDay(dayIso); setHover(null) } }}
                      onMouseEnter={(e) => {
                        if (!list.length || !calRef.current) return
                        const r = e.currentTarget.getBoundingClientRect()
                        const p = calRef.current.getBoundingClientRect()
                        setHover({ day, left: r.left - p.left + r.width / 2, top: r.top - p.top })
                      }}
                      onMouseLeave={() => setHover(null)}
                      className={`flex h-9 items-center justify-center rounded-md text-sm tabular-nums transition-colors ${heat(list.length)} ${list.length ? 'cursor-pointer' : 'cursor-default'} ${isToday ? 'ring-2 ring-inset ring-slate-900/70' : ''} ${selected ? 'ring-2 ring-inset ring-emerald-700' : ''}`}
                    >
                      {day}
                    </button>
                  )
                })}
              </div>
              {hover && (byDay.get(hover.day)?.length ?? 0) > 0 && (
                <div className="pointer-events-none absolute z-20 w-60 -translate-x-1/2 -translate-y-full rounded-lg bg-[#1d2939] px-3.5 py-3 text-white shadow-[var(--shadow-lift)]" style={{ left: hover.left, top: hover.top - 8 }}>
                  <div className="text-xs text-white/60">{mo + 1} 月 {hover.day} 日 · 周{WEEK[new Date(y, mo, hover.day).getDay()]} · {byDay.get(hover.day)!.length} 场面试</div>
                  <ul className="mt-1.5 space-y-1.5">
                    {byDay.get(hover.day)!.map((c) => (
                      <li key={c.id} className="flex items-baseline gap-2 text-[13px] leading-5">
                        <span className="shrink-0 tabular-nums font-medium">{c.slot.slice(11)}</span>
                        <span className="min-w-0 truncate">{c.name} · {c.role}</span>
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

      <section className="ws-rise" style={rise(4)}>
        <SectionHead title="候选人进度" />
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="flex flex-col px-5 py-4">
            <div className="flex items-baseline justify-between">
              <span className="text-[15px] font-semibold text-slate-900">待约面</span>
              <span className="text-sm tabular-nums text-slate-400">{unscheduled.length}</span>
            </div>
            <p className="mt-1 text-xs text-slate-400">简历已导入，还没约面试时间</p>
            <ul className="mt-3 flex-1 space-y-2.5">
              {unscheduled.map((c) => (
                <li key={c.id} className="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50" onClick={() => go('candidates')}>
                  <div className="min-w-0"><span className="text-sm font-medium text-slate-900">{c.name}</span><span className="ml-2 text-xs text-slate-500">{c.role}</span></div>
                  <span className="shrink-0 text-xs text-slate-400">{c.source}</span>
                </li>
              ))}
              {!unscheduled.length && <li className="py-3 text-center text-sm text-slate-400">暂无 · 导入简历后出现在这里</li>}
            </ul>
            <button onClick={() => go('candidates')} className="mt-3 cursor-pointer self-start text-sm text-blue-600 hover:text-blue-800">去安排 →</button>
          </Card>

          <Card className="flex flex-col px-5 py-4">
            <div className="flex items-baseline justify-between">
              <span className="text-[15px] font-semibold text-slate-900">待面试</span>
              <span className="text-sm tabular-nums text-slate-400">{upcoming.length}</span>
            </div>
            <p className="mt-1 text-xs text-slate-400">时间已约，还未开始面试</p>
            <ul className="mt-3 flex-1 space-y-2.5">
              {upcoming.map((c) => (
                <li key={c.id} className="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50" onClick={() => go('analysis', c.id)}>
                  <div className="min-w-0"><span className="text-sm font-medium text-slate-900">{c.name}</span><span className="ml-2 text-xs text-slate-500">{c.round}</span></div>
                  <span className="shrink-0 text-xs tabular-nums text-slate-500">{slotLabel(c.slot)}</span>
                </li>
              ))}
              {!upcoming.length && <li className="py-3 text-center text-sm text-slate-400">暂无待面试安排</li>}
            </ul>
            <button onClick={() => go('candidates')} className="mt-3 cursor-pointer self-start text-sm text-blue-600 hover:text-blue-800">全部候选人 →</button>
          </Card>

          <Card className="flex flex-col px-5 py-4">
            <div className="flex items-baseline justify-between">
              <span className="text-[15px] font-semibold text-slate-900">面后跟进</span>
              <span className="text-sm tabular-nums text-slate-400">{after.length}</span>
            </div>
            <p className="mt-1 text-xs text-slate-400">已面完：待评价 / 跟进中（二面、offer 待定）/ 已结束</p>
            <ul className="mt-3 flex-1 space-y-2.5">
              {after.map((c) => (
                <li key={c.id} className="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50" onClick={() => (c.status === '待评价' ? go('room', c.id) : go('result', c.id))}>
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-slate-900">{c.name}</span>
                    <span className={`ml-2 rounded px-1.5 py-0.5 text-xs ${statusCls[c.status]}`}>{c.status}</span>
                    {c.status === '跟进中' && <span className="ml-1.5 text-xs text-slate-400">待确认后续安排</span>}
                  </div>
                  <span className="shrink-0 text-xs text-blue-600">{c.status === '待评价' ? '去评价' : '看结果'}</span>
                </li>
              ))}
              {!after.length && <li className="py-3 text-center text-sm text-slate-400">暂无已面试的候选人</li>}
            </ul>
          </Card>
        </div>
      </section>

      <section className="ws-rise" style={rise(5)}>
        <SectionHead title="近期评价" sub={`共 ${history.length} 条`} />
        <Card>
          <table className="w-full text-left text-sm">
            <thead><tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500">
              <th className="px-5 py-2.5 font-medium">候选人</th><th className="font-medium">岗位</th><th className="hidden font-medium md:table-cell">面试日期</th><th className="hidden font-medium md:table-cell">用时</th><th className="font-medium">结论</th><th className="px-5 text-right font-medium">得分</th>
            </tr></thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id} onClick={() => h.cid && go('result', h.cid)} className={`${h.cid ? 'cursor-pointer' : ''} border-b border-slate-100 last:border-0 hover:bg-slate-50 ${h.date === TODAY ? 'bg-blue-50/40' : ''}`}>
                  <td className="px-5 py-3.5 font-medium text-slate-900">{h.name}<span className="ml-2 text-xs font-normal tabular-nums text-slate-400">{h.id}</span>{h.date === TODAY && <span className="ml-2 rounded bg-blue-600 px-1.5 py-0.5 text-[11px] font-normal text-white">今天</span>}</td>
                  <td className="text-slate-600">{h.role}</td>
                  <td className="hidden tabular-nums text-slate-500 md:table-cell">{h.date}</td>
                  <td className="hidden tabular-nums text-slate-500 md:table-cell">{h.dur}</td>
                  <td><span className={`rounded px-2 py-0.5 text-xs ${verdictCls[h.verdict]}`}>{h.verdict}</span></td>
                  <td className="px-5 text-right"><ScoreStamp score={h.score} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>
    </div>
  )
}
