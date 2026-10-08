import type React from 'react'
import { findC, pickedOf, rooms, buildReviewFor, commit } from '../store'
import type { Go } from '../App'
import { Btn, Card, SectionHead } from './ui'

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
const verdictCls: Record<string, string> = { 推荐: 'bg-emerald-50 text-emerald-700', 待定: 'bg-slate-100 text-slate-600', 不推荐: 'bg-amber-50 text-amber-700' }

/** 结果分析：每场面试结束后的复盘。报告以评分与备注为准，会话记录只作为补充。
 *  提交后评分与结论不可修改，但综合评价报告可以随时重新生成（第二天回来也可以）。 */
export default function Result({ cid, go }: { cid: string; go: Go }) {
  const c = findC(cid)
  const room = rooms[cid]
  if (!c || !room) return (
    <Card className="ws-rise px-6 py-16 text-center">
      <p className="text-slate-600">这场面试还没有记录</p>
      <Btn className="mt-4" variant="ghost" onClick={() => go('back')}>返回{go.from}</Btn>
    </Card>
  )
  const picked = pickedOf(cid)
  const qs = c.qs.filter((q) => !picked.length || picked.includes(q.id))
  const rows = qs.map((q, i) => ({ q, i, r: room.recs[q.id] }))
  const rated = rows.filter((x) => x.r?.score)
  const avg = rated.length ? rated.reduce((a, x) => a + x.r!.score!, 0) / rated.length : 0
  const hit = rows.reduce((a, x) => a + (x.r?.hit.length ?? 0), 0), total = qs.reduce((a, q) => a + q.points.length, 0)
  const maxSec = Math.max(60, ...rows.map((x) => x.r?.secs ?? 0))
  const topics = Object.entries(rated.reduce<Record<string, number[]>>((m, x) => ((m[x.q.topic] ??= []).push(x.r!.score!), m), {}))
    .map(([t, v]) => [t, v.reduce((a, b) => a + b, 0) / v.length] as const).sort((a, b) => b[1] - a[1])
  const low = rated.length ? Math.min(...rated.map((x) => x.r!.score!)) : 0
  const talk = room.talk ?? []
  const by = (w: string) => talk.filter((t) => t.who === w).length
  const cand = by('候选人'), me = by('面试官')
  const rv = room.review

  // 报告只基于已保存的评分与记录重建，不改动任何面试结果
  const regen = () => {
    const r = buildReviewFor(cid)
    if (r) { room.review = r; commit() }
  }

  return (
    <div className="space-y-8">
      <div className="ws-rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <button onClick={() => go('back')} className="cursor-pointer text-sm text-slate-500 hover:text-slate-800">← {go.from}</button>
          <h1 className="mt-2 flex items-center gap-3 text-2xl font-semibold text-slate-900">{c.name} · 结果分析{room.verdict && <span className={`rounded px-2 py-0.5 text-sm font-medium ${verdictCls[room.verdict] ?? 'bg-slate-100 text-slate-600'}`}>{room.verdict}</span>}</h1>
          <p className="mt-1 text-sm text-slate-500">{c.role} · {c.round} · {c.slot}{room.savedAt && ` · 最后保存 ${room.savedAt}`}</p>
        </div>
        <div className="flex gap-2">
          <Btn variant="ghost" onClick={() => go('room', cid)}>查看面试记录</Btn>
          <Btn onClick={() => go('analysis', cid)}>候选人分析</Btn>
        </div>
      </div>

      <div className="ws-rise grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-slate-200/70 ring-1 ring-slate-200/70 md:grid-cols-5" style={{ '--i': 1 } as React.CSSProperties}>
        {[['用时', mmss(room.sec), ''], ['题目覆盖', `${rated.length}/${qs.length}`, '题'], ['平均分', rated.length ? avg.toFixed(1) : '–', '/ 5'], ['要点命中', total ? `${Math.round((hit / total) * 100)}` : '–', '%'], ['会话记录', String(talk.length), '条']].map(([k, v, u]) => (
          <div key={k} className="bg-[#fffdf9] px-5 py-4">
            <div className="text-sm text-slate-500">{k}</div>
            <div className="mt-1 text-[26px] font-semibold tabular-nums text-slate-900">{v}<span className="ml-1 text-sm font-normal text-slate-400">{u}</span></div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="ws-rise" style={{ '--i': 2 } as React.CSSProperties}>
          <SectionHead title="逐题表现" sub="条形为得分，细线为用时" />
          <Card className="divide-y divide-slate-100">
            {rows.map(({ q, i, r }) => {
              const s = r?.score ?? 0
              return (
                <div key={q.id} className="grid grid-cols-[56px_1fr_64px] items-center gap-4 px-5 py-3.5">
                  <span className="text-xs tabular-nums text-slate-400">第 {i + 1} 题</span>
                  <div className="min-w-0">
                    <div className="truncate text-sm text-slate-800"><span className="mr-2 text-slate-500">{q.topic}</span>{q.q}</div>
                    <div className="mt-2 h-1.5 rounded-full bg-slate-100"><div className={`ws-grow h-full origin-left rounded-full ${s && s === low && low <= 2 ? 'bg-amber-400' : 'bg-[#1d2939]'}`} style={{ width: `${(s / 5) * 100}%`, '--i': i } as React.CSSProperties} /></div>
                    <div className="mt-1 h-px bg-slate-100"><div className="h-px bg-slate-400" style={{ width: `${((r?.secs ?? 0) / maxSec) * 100}%` }} /></div>
                  </div>
                  <span className="text-right text-sm tabular-nums text-slate-900">{s ? `${s} 分` : <span className="text-slate-400">未评</span>}<span className="block text-[11px] text-slate-400">{mmss(r?.secs ?? 0)}</span></span>
                </div>
              )
            })}
          </Card>
        </section>

        <div className="space-y-6">
          <section className="ws-rise" style={{ '--i': 3 } as React.CSSProperties}>
            <SectionHead title="能力分布" sub="按考察方向取均分" />
            <Card className="space-y-3 px-5 py-4">
              {topics.length ? topics.map(([t, v]) => (
                <div key={t} className="grid grid-cols-[88px_1fr_32px] items-center gap-3 text-sm">
                  <span className="truncate text-slate-600">{t}</span>
                  <div className="h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-slate-500" style={{ width: `${(v / 5) * 100}%` }} /></div>
                  <span className="text-right tabular-nums text-slate-900">{v.toFixed(1)}</span>
                </div>
              )) : <p className="py-4 text-center text-sm text-slate-400">暂无评分</p>}
            </Card>
          </section>

          <section className="ws-rise" style={{ '--i': 4 } as React.CSSProperties}>
            <SectionHead title="会话记录" sub="补充材料，不计入评分" />
            <Card className="px-5 py-4">
              {talk.length ? (
                <>
                  <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="bg-[#1d2939]" style={{ width: `${(me / talk.length) * 100}%` }} />
                    <div className="bg-slate-300" style={{ width: `${(cand / talk.length) * 100}%` }} />
                  </div>
                  <div className="mt-2 flex justify-between text-xs text-slate-500"><span>面试官 {me} 条</span><span>候选人 {cand} 条{!room.shared && !cand && ' · 未分享面试间'}</span></div>
                  <ul className="mt-4 space-y-2.5">
                    {talk.slice(-4).map((t) => (
                      <li key={t.id} className="text-sm leading-6"><span className="mr-2 text-xs tabular-nums text-slate-400">{t.t}</span><span className="text-slate-500">{t.who}：</span><span className="text-slate-800">{t.kind === 'file' ? `[文件] ${t.file?.name}` : t.text}</span></li>
                    ))}
                  </ul>
                </>
              ) : <p className="py-4 text-center text-sm text-slate-400">本场没有会话记录</p>}
            </Card>
          </section>
        </div>
      </div>

      <section className="ws-rise" style={{ '--i': 5 } as React.CSSProperties}>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">综合评价</h2>
            <p className="mt-0.5 text-sm text-slate-400">{rv ? `生成于 ${rv.at} · 评分提交后不可修改，报告可随时重新生成` : '基于已保存的评分与记录生成，面试结束后任何时间都可以回来生成'}</p>
          </div>
          <Btn variant={rv ? 'ghost' : 'accent'} className="!h-9 !px-3.5" onClick={regen}>{rv ? '重新生成报告' : '生成综合评价'}</Btn>
        </div>
        <Card className="px-6 py-5">
          {rv ? (
            <div className="space-y-4 text-sm leading-7 text-slate-700">
              <p className="text-slate-900">{rv.overall}</p>
              <div className="grid gap-4 md:grid-cols-3">
                {([['优势', rv.strengths], ['不足', rv.weaknesses], ['下一步', rv.nextSteps]] as const).map(([k, l]) => (
                  <div key={k}><div className="text-xs text-slate-500">{k}</div><ul className="mt-1 space-y-1">{l.length ? l.map((x) => <li key={x}>· {x}</li>) : <li className="text-slate-400">—</li>}</ul></div>
                ))}
              </div>
              <p className="rounded-lg bg-slate-50 px-3 py-2">建议：{rv.suggestion}</p>
            </div>
          ) : <p className="whitespace-pre-line text-sm leading-7 text-slate-700">{room.summary || '还没有生成报告——点击右上角「生成综合评价」即可基于本场记录生成。'}</p>}
        </Card>
      </section>
    </div>
  )
}
