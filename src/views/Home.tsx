import type React from 'react'
import { candidates, history } from '../data'
import type { Go } from '../App'
import { Btn, Card, ScoreStamp, SectionHead } from './ui'

const verdictCls: Record<string, string> = { 推荐: 'bg-emerald-50 text-emerald-700', 待定: 'bg-slate-100 text-slate-600', 不推荐: 'bg-amber-50 text-amber-700' }

export default function Home({ go }: { go: Go }) {
  const today = candidates.filter((c) => c.slot.startsWith('今天') && c.status === '待面试')
  const todo = candidates.filter((c) => c.status === '待评价')
  return (
    <div className="space-y-8">
      <div className="ws-rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">王磊，今天有 {today.length} 场面试</h1>
          <p className="mt-1.5 text-[15px] text-slate-500">9 月 30 日 周三 · {todo.length} 份评价待提交</p>
        </div>
        <Btn variant="ghost" onClick={() => go('candidates')}>全部候选人</Btn>
      </div>

      <div className="grid gap-px overflow-hidden ws-paper ws-rise rounded-xl bg-slate-200/70 sm:grid-cols-2 lg:grid-cols-4">
        {[['本周面试', String(7 + history.filter((h) => h.date >= '2026-09-28').length), '场'], ['待提交评价', String(todo.length), '份'], ['平均用时', '31', '分钟'], ['评价通过率', String(Math.round((history.filter((h) => h.verdict === '推荐').length / history.length) * 100)), '%']].map(([k, v, u]) => (
          <div key={k} className="bg-[#fffdf9] px-5 py-4">
            <div className="text-sm text-slate-500">{k}</div>
            <div className="mt-1 text-[28px] font-semibold tabular-nums text-slate-900">{v}<span className="ml-1 text-sm font-normal text-slate-400">{u}</span></div>
          </div>
        ))}
      </div>

      <section className="ws-rise" style={{ '--i': 2 } as React.CSSProperties}>
        <SectionHead title="面试日程" sub="简历已同步并完成分析" />
        <div className="ws-paper divide-y divide-slate-100 rounded-xl">
          {candidates.filter((c) => c.slot.includes(' ') && c.status !== '已评价').map((c, i, arr) => {
            const next = !arr.slice(0, i).some((x) => x.status === '待面试') && c.status === '待面试'
            const done = c.status === '待评价'
            return (
              <div key={c.id} className="group relative grid items-center gap-4 px-5 py-4 transition-colors duration-150 hover:bg-slate-50/70 md:grid-cols-[96px_minmax(0,1fr)_auto]">
                {next && <span className="absolute inset-y-3 left-0 w-1 rounded-r bg-amber-400" />}
                <div>
                  <div className="text-[15px] font-semibold tabular-nums text-slate-900">{c.slot.split(' ')[1]}</div>
                  <div className="text-xs text-slate-500">{c.slot.split(' ')[0]} · {c.round}</div>
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
        </div>
      </section>

      <section className="ws-rise" style={{ '--i': 3 } as React.CSSProperties}>
        <SectionHead title="近期评价" sub={`共 ${history.length} 条`} />
        <Card>
          <table className="w-full text-left text-sm">
            <thead><tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500">
              <th className="px-5 py-2.5 font-medium">候选人</th><th className="font-medium">岗位</th><th className="hidden font-medium md:table-cell">面试日期</th><th className="hidden font-medium md:table-cell">用时</th><th className="font-medium">结论</th><th className="px-5 text-right font-medium">得分</th>
            </tr></thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id} onClick={() => h.cid && go('result', h.cid)} className={`${h.cid ? 'cursor-pointer' : ''} border-b border-slate-100 last:border-0 hover:bg-slate-50 ${h.date === '2026-09-30' ? 'bg-blue-50/40' : ''}`}>
                  <td className="px-5 py-3.5 font-medium text-slate-900">{h.name}<span className="ml-2 text-xs font-normal tabular-nums text-slate-400">{h.id}</span>{h.date === '2026-09-30' && <span className="ml-2 rounded bg-blue-600 px-1.5 py-0.5 text-[11px] font-normal text-white">今天</span>}</td>
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
