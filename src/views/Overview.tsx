import type React from 'react'
import { candidates, history } from '../data'
import { rooms } from '../store'
import type { Go } from '../App'
import { Card, SectionHead } from './ui'

const toSec = (d: string) => { const [m, s] = d.split(':').map(Number); return m * 60 + (s || 0) }
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)
const V = ['推荐', '待定', '不推荐'] as const
const vCls: Record<string, string> = { 推荐: 'bg-[#1d2939]', 待定: 'bg-slate-400', 不推荐: 'bg-slate-200' }

/** 总览：面试整体数据。全部由已有记录派生，不做预测 */
export default function Overview({ go }: { go: Go }) {
  const n = history.length
  const avg = n ? history.reduce((a, h) => a + h.score, 0) / n : 0
  const avgDur = n ? history.reduce((a, h) => a + toSec(h.dur), 0) / n / 60 : 0
  const vc = Object.fromEntries(V.map((v) => [v, history.filter((h) => h.verdict === v).length]))
  const funnel = [['待面试', candidates.filter((c) => c.status === '待面试').length], ['待评价', candidates.filter((c) => c.status === '待评价').length], ['已评价', candidates.filter((c) => c.status === '已评价').length + n]] as const
  const fmax = Math.max(1, ...funnel.map((f) => f[1]))

  // 按岗位
  const roles = Object.entries(history.reduce<Record<string, typeof history>>((m, h) => ((m[h.role] ??= []).push(h), m), {}))
    .map(([role, l]) => ({ role, n: l.length, avg: l.reduce((a, h) => a + h.score, 0) / l.length, pass: pct(l.filter((h) => h.verdict === '推荐').length, l.length) }))
    .sort((a, b) => b.n - a.n)
  const weakRole = roles.length > 1 ? roles.reduce((a, b) => (b.avg < a.avg ? b : a)).role : ''

  // 趋势：按日期升序
  const trend = [...history].sort((a, b) => a.date.localeCompare(b.date))

  // 各考察方向的均分（来自面试间逐题评分）
  const topicMap: Record<string, number[]> = {}
  for (const [cid, r] of Object.entries(rooms)) {
    const c = candidates.find((x) => x.id === cid)
    c?.qs.forEach((q) => { const s = r.recs[q.id]?.score; if (s) (topicMap[q.topic] ??= []).push(s) })
  }
  const topics = Object.entries(topicMap).map(([t, l]) => ({ t, n: l.length, avg: l.reduce((a, b) => a + b, 0) / l.length })).sort((a, b) => a.avg - b.avg)
  const talks = Object.values(rooms).reduce((a, r) => a + (r.talk?.length ?? 0), 0)
  const sharedN = Object.values(rooms).filter((r) => r.shared).length

  return (
    <div className="space-y-8">
      <div className="ws-rise">
        <h1 className="text-2xl font-semibold text-slate-900">数据总览</h1>
        <p className="mt-1 text-sm text-slate-500">截至 2026-09-30 · 基于 {n} 场已提交评价</p>
      </div>

      <div className="ws-rise grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-slate-200/70 ring-1 ring-slate-200/70 md:grid-cols-5" style={{ '--i': 1 } as React.CSSProperties}>
        {[['累计面试', String(n), '场'], ['平均得分', avg.toFixed(1), '/ 5'], ['推荐率', String(pct(vc['推荐'], n)), '%'], ['平均用时', avgDur.toFixed(0), '分钟'], ['会话记录', String(talks), `条 · ${sharedN} 场分享`]].map(([k, v, u]) => (
          <div key={k} className="bg-[#fffdf9] px-5 py-4">
            <div className="text-sm text-slate-500">{k}</div>
            <div className="mt-1 text-[28px] font-semibold tabular-nums text-slate-900">{v}<span className="ml-1 text-sm font-normal text-slate-400">{u}</span></div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section className="ws-rise" style={{ '--i': 2 } as React.CSSProperties}>
          <SectionHead title="得分走势" sub="每场综合得分，按面试日期" />
          <Card className="px-5 pb-4 pt-6">
            <div className="flex h-44 items-end gap-3">
              {trend.map((h, i) => (
                <button key={h.id} onClick={() => h.cid && go('result', h.cid)} title={`${h.name} · ${h.score}`} className={`group flex h-full flex-1 flex-col items-center justify-end gap-1.5 ${h.cid ? 'cursor-pointer' : 'cursor-default'}`}>
                  <span className="text-xs tabular-nums text-slate-500 opacity-0 transition-opacity group-hover:opacity-100">{h.score.toFixed(1)}</span>
                  <span className="ws-grow w-full max-w-10 origin-bottom rounded-t-md bg-[#1d2939]/85 transition-colors group-hover:bg-[#1d2939]" style={{ height: `${(h.score / 5) * 100}%`, '--i': i } as React.CSSProperties} />
                </button>
              ))}
            </div>
            <div className="mt-2 flex gap-3 border-t border-slate-100 pt-2">
              {trend.map((h) => <span key={h.id} className="flex-1 truncate text-center text-[11px] text-slate-400"><span className="block text-slate-600">{h.name}</span>{h.date.slice(5)}</span>)}
            </div>
          </Card>
        </section>

        <div className="space-y-6">
          <section className="ws-rise" style={{ '--i': 3 } as React.CSSProperties}>
            <SectionHead title="结论分布" />
            <Card className="px-5 py-4">
              <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100">
                {V.map((v) => <span key={v} className={vCls[v]} style={{ width: `${pct(vc[v], n)}%` }} />)}
              </div>
              <div className="mt-3 grid grid-cols-3 text-sm">
                {V.map((v) => <div key={v}><span className={`mr-1.5 inline-block h-2 w-2 rounded-sm ${vCls[v]}`} /><span className="text-slate-600">{v}</span><div className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">{vc[v]}<span className="ml-1 text-xs font-normal text-slate-400">{pct(vc[v], n)}%</span></div></div>)}
              </div>
            </Card>
          </section>
          <section className="ws-rise" style={{ '--i': 4 } as React.CSSProperties}>
            <SectionHead title="候选人进度" />
            <Card className="space-y-2.5 px-5 py-4">
              {funnel.map(([k, v]) => (
                <div key={k} className="grid grid-cols-[52px_1fr_28px] items-center gap-3 text-sm">
                  <span className="text-slate-600">{k}</span>
                  <div className="h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-slate-500" style={{ width: `${(v / fmax) * 100}%` }} /></div>
                  <span className="text-right tabular-nums text-slate-900">{v}</span>
                </div>
              ))}
            </Card>
          </section>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="ws-rise" style={{ '--i': 5 } as React.CSSProperties}>
          <SectionHead title="岗位表现" sub="均分最低的岗位标出" />
          <Card>
            <table className="w-full text-left text-sm">
              <thead><tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500"><th className="px-5 py-2.5 font-medium">岗位</th><th className="font-medium">场次</th><th className="font-medium">均分</th><th className="px-5 text-right font-medium">推荐率</th></tr></thead>
              <tbody>
                {roles.map((r) => (
                  <tr key={r.role} className="border-b border-slate-100 last:border-0">
                    <td className="px-5 py-3 font-medium text-slate-900">{r.role === weakRole && <span className="mr-2 inline-block h-3 w-0.5 translate-y-0.5 rounded bg-amber-400" />}{r.role}</td>
                    <td className="tabular-nums text-slate-600">{r.n}</td>
                    <td className="tabular-nums text-slate-900">{r.avg.toFixed(1)}</td>
                    <td className="px-5 text-right tabular-nums text-slate-600">{r.pass}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </section>

        <section className="ws-rise" style={{ '--i': 6 } as React.CSSProperties}>
          <SectionHead title="考察方向均分" sub="来自面试间逐题评分，由低到高" />
          <Card className="space-y-3 px-5 py-4">
            {topics.length ? topics.map((x) => (
              <div key={x.t} className="grid grid-cols-[96px_1fr_64px] items-center gap-3 text-sm">
                <span className="truncate text-slate-600">{x.t}</span>
                <div className="h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-slate-500" style={{ width: `${(x.avg / 5) * 100}%` }} /></div>
                <span className="text-right tabular-nums text-slate-900">{x.avg.toFixed(1)}<span className="ml-1 text-[11px] text-slate-400">×{x.n}</span></span>
              </div>
            )) : <p className="py-6 text-center text-sm text-slate-400">完成一场面试评分后，这里会显示各考察方向的表现</p>}
          </Card>
        </section>
      </div>
    </div>
  )
}
