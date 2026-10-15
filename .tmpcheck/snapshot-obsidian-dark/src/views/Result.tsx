import { useEffect, useState } from 'react'
import type React from 'react'
import { buildReviewFor, can, commit, confirmReview, currentUser, findC, pickedOf, rooms } from '../store'
import type { Go } from '../App'
import { Btn, Card, Chip, Empty, Modal, SectionHead } from './ui'

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
const verdictCls: Record<string, string> = { 推荐: 'bg-success/15 text-success', 待定: 'bg-base-content/10 text-base-content/70', 不推荐: 'bg-warning/15 text-warning' }

/** 数据条进场：挂载后从 0 过渡到目标宽度（配合 .motion-meter 的 600ms 档），不让数值硬跳 */
function useGrown() {
  const [grown, setGrown] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setGrown(true))
    return () => cancelAnimationFrame(id)
  }, [])
  return grown
}

/** 结果分析：每场面试结束后的复盘。报告以评分与备注为准，会话记录只作为补充。
 *  提交后评分与结论不可修改，但综合评价报告可以随时重新生成（第二天回来也可以）。 */
export default function Result({ cid, go }: { cid: string; go: Go }) {
  const c = findC(cid)
  const room = rooms[cid]
  // hooks 必须在条件返回之前（findC / rooms 都可能取不到）
  const [askConfirm, setAskConfirm] = useState(false)
  const [askRegen, setAskRegen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [regening, setRegening] = useState(false)
  const [msg, setMsg] = useState('')
  const grown = useGrown()
  // 找不到候选人、或本场没有任何面试间记录时给可读空态，不静默展示其他数据
  if (!c || !room) return (
    <Card className="ws-rise">
      <Empty
        title="这场面试还没有记录"
        hint={`没有找到候选人 ${cid} 的面试间记录：可能尚未进入面试间，或该候选人已被来源库标记失效。`}
        action={<Btn className="mt-2" variant="ghost" onClick={() => go('back')}>返回{go.from}</Btn>}
      />
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
  const canConfirm = can('evaluation:submit')

  // 报告只基于已保存的评分与记录重建，不改动任何面试结果；重新生成会回到「AI 草稿 · 待人工确认」
  const regen = () => {
    if (regening) return
    setRegening(true)
    setMsg('')
    setTimeout(() => {
      const r = buildReviewFor(cid)
      if (r) { room.review = r; commit(); setMsg('已重新生成 AI 草稿，需再次人工确认后才作为面评结论。') }
      else setMsg('生成失败：本场没有可用的评分与记录，请先在面试间完成评分。')
      setRegening(false)
    }, 400)
  }
  // 人工确认 AI 面评草稿（FR-B3）：确认后才作为正式面评结论，并记录确认人与确认时间
  const doConfirm = () => {
    if (confirming) return
    setConfirming(true)
    setMsg('')
    const r = confirmReview(cid, currentUser.name)
    setConfirming(false)
    setAskConfirm(false)
    if (!r) setMsg('确认失败：本场评价记录已失效，请先重新生成综合评价后再确认。')
  }

  return (
    <div className="space-y-9">
      <div className="ws-rise flex flex-wrap items-end justify-between gap-5">
        <div>
          <button onClick={() => go('back')} className="motion-pop cursor-pointer rounded text-sm text-base-content/60 hover:text-base-content">← {go.from}</button>
          <h1 className="mt-2 flex items-center gap-4 text-2xl font-semibold text-base-content">{c.name} · 结果分析{room.verdict && <span className={`rounded px-2 py-0.5 text-sm font-medium ${verdictCls[room.verdict] ?? 'bg-base-content/10 text-base-content/70'}`}>{room.verdict}</span>}</h1>
          <p className="mt-1 text-sm text-base-content/60">{c.role} · {c.round} · {c.slot}{room.savedAt && ` · 最后保存 ${room.savedAt}`}</p>
        </div>
        <div className="flex gap-3">
          <Btn variant="ghost" onClick={() => go('room', cid)}>查看面试记录</Btn>
          <Btn onClick={() => go('analysis', cid)}>候选人分析</Btn>
        </div>
      </div>

      <div className="ws-rise stagger grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-base-300 ring-1 ring-base-300 md:grid-cols-5" style={{ '--i': 1 } as React.CSSProperties}>
        {[['用时', mmss(room.sec), ''], ['题目覆盖', `${rated.length}/${qs.length}`, '题'], ['平均分', rated.length ? avg.toFixed(1) : '–', '/ 5'], ['要点命中', total ? `${Math.round((hit / total) * 100)}` : '–', '%'], ['会话记录', String(talk.length), '条']].map(([k, v, u], i) => (
          <div key={k} className="bg-base-100 px-5 py-4" style={{ '--i': Math.min(i, 7) } as React.CSSProperties}>
            <div className="text-sm text-base-content/60">{k}</div>
            <div className="mt-1 text-[26px] font-semibold tabular-nums text-base-content">{v}<span className="ml-1 text-sm font-normal text-base-content/50">{u}</span></div>
          </div>
        ))}
      </div>

      <div className="grid gap-7 lg:grid-cols-[1.4fr_1fr]">
        <section className="ws-rise" style={{ '--i': 2 } as React.CSSProperties}>
          <SectionHead title="逐题表现" sub="条形为得分，细线为用时" />
          <Card className="stagger divide-y divide-base-300">
            {rows.map(({ q, i, r }) => {
              const s = r?.score ?? 0
              return (
                <div key={q.id} className="grid grid-cols-[56px_1fr_64px] items-center gap-5 px-5 py-3.5" style={{ '--i': Math.min(i, 7) } as React.CSSProperties}>
                  <span className="text-xs tabular-nums text-base-content/50">第 {i + 1} 题</span>
                  <div className="min-w-0">
                    <div className="truncate text-sm text-base-content"><span className="mr-2 text-base-content/60">{q.topic}</span>{q.q}</div>
                    <div className="mt-2 h-1.5 rounded-full bg-base-content/10"><div className={`motion-meter h-full origin-left rounded-full ${s && s === low && low <= 2 ? 'bg-warning' : 'bg-secondary'}`} style={{ width: grown ? `${(s / 5) * 100}%` : '0%' }} /></div>
                    <div className="mt-1 h-px bg-base-content/10"><div className="motion-meter h-px bg-base-content/50" style={{ width: grown ? `${((r?.secs ?? 0) / maxSec) * 100}%` : '0%' }} /></div>
                  </div>
                  <span className="text-right text-sm tabular-nums text-base-content">{s ? `${s} 分` : <span className="text-base-content/50">未评</span>}<span className="block text-[11px] text-base-content/50">{mmss(r?.secs ?? 0)}</span></span>
                </div>
              )
            })}
          </Card>
        </section>

        <div className="space-y-7">
          <section className="ws-rise" style={{ '--i': 3 } as React.CSSProperties}>
            <SectionHead title="能力分布" sub="按考察方向取均分" />
            <Card className="stagger space-y-4 px-5 py-4">
              {topics.length ? topics.map(([t, v], i) => (
                <div key={t} className="grid grid-cols-[88px_1fr_32px] items-center gap-4 text-sm" style={{ '--i': Math.min(i, 7) } as React.CSSProperties}>
                  <span className="truncate text-base-content/70">{t}</span>
                  <div className="h-2 rounded-full bg-base-content/10"><div className="motion-meter h-full rounded-full bg-secondary" style={{ width: grown ? `${(v / 5) * 100}%` : '0%' }} /></div>
                  <span className="text-right tabular-nums text-base-content">{v.toFixed(1)}</span>
                </div>
              )) : <p className="py-4 text-center text-sm text-base-content/50">暂无评分</p>}
            </Card>
          </section>

          <section className="ws-rise" style={{ '--i': 4 } as React.CSSProperties}>
            <SectionHead title="会话记录" sub="补充材料，不计入评分" />
            <Card className="px-5 py-4">
              {talk.length ? (
                <>
                  <div className="flex h-2 overflow-hidden rounded-full bg-base-content/10">
                    <div className="motion-meter bg-secondary" style={{ width: grown ? `${(me / talk.length) * 100}%` : '0%' }} />
                    <div className="motion-meter bg-accent" style={{ width: grown ? `${(cand / talk.length) * 100}%` : '0%' }} />
                  </div>
                  <div className="mt-2 flex justify-between text-xs text-base-content/60"><span>面试官 {me} 条</span><span>候选人 {cand} 条{!room.shared && !cand && ' · 未分享面试间'}</span></div>
                  <ul className="stagger mt-4 space-y-3.5">
                    {talk.slice(-4).map((t, i) => (
                      <li key={t.id} className="text-sm leading-6" style={{ '--i': Math.min(i, 7) } as React.CSSProperties}><span className="mr-2 text-xs tabular-nums text-base-content/50">{t.t}</span><span className="text-base-content/60">{t.who}：</span><span className="text-base-content">{t.kind === 'file' ? `[文件] ${t.file?.name}` : t.text}</span></li>
                    ))}
                  </ul>
                </>
              ) : <p className="py-4 text-center text-sm text-base-content/50">本场没有会话记录</p>}
            </Card>
          </section>
        </div>
      </div>

      <section className="ws-rise" style={{ '--i': 5 } as React.CSSProperties}>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-semibold text-base-content">综合评价</h2>
              {rv && <Chip tone={rv.draft ? 'warning' : 'success'}>{rv.draft ? 'AI 草稿 · 待人工确认' : '已人工确认'}</Chip>}
            </div>
            <p className="mt-0.5 text-sm text-base-content/60">
              {rv
                ? rv.draft
                  ? `生成于 ${rv.at} · 由 AI 依据评分与记录辅助生成，未经人工确认前不作为面评结论`
                  : `生成于 ${rv.at} · ${rv.confirmedBy ?? '—'} 于 ${rv.confirmedAt ?? '—'} 人工确认`
                : '基于已保存的评分与记录生成（产出为 AI 草稿，需人工确认），面试结束后任何时间都可以回来生成'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {rv?.draft && (
              <Btn
                variant="accent"
                className="!h-9 !px-3.5"
                onClick={() => setAskConfirm(true)}
                disabled={!canConfirm}
                title={canConfirm ? '确认为正式面评结论并记录确认人与时间' : `当前角色（${currentUser.role}）无面评确认权限`}
              >
                人工确认
              </Btn>
            )}
            <Btn variant={rv ? 'ghost' : 'accent'} className="!h-9 !px-3.5" onClick={() => { if (rv) setAskRegen(true); else regen() }} loading={regening} disabled={regening}>
              {rv ? '重新生成报告' : '生成综合评价'}
            </Btn>
          </div>
        </div>
        {msg && <p role="status" className="mb-3 rounded-lg border border-base-300 bg-base-200 px-4 py-2 text-sm leading-6 text-base-content/70">{msg}</p>}
        <Card className={`px-6 py-5 ${rv ? (rv.draft ? 'border-warning/60' : 'border-success/40') : ''}`}>
          {rv ? (
            <div className="space-y-5 text-sm leading-7 text-base-content/80">
              <p className="text-base-content">{rv.overall}</p>
              <div className="grid gap-5 md:grid-cols-3">
                {([['优势', rv.strengths], ['不足', rv.weaknesses], ['下一步', rv.nextSteps]] as const).map(([k, l]) => (
                  <div key={k}><div className="text-xs text-base-content/60">{k}</div><ul className="mt-1 space-y-2">{l.length ? l.map((x) => <li key={x}>· {x}</li>) : <li className="text-base-content/50">—</li>}</ul></div>
                ))}
              </div>
              <p className="rounded-lg bg-base-200 px-3 py-2">建议：{rv.suggestion}</p>
              {rv.draft ? (
                <p className="rounded-lg border border-warning/50 bg-warning/10 px-3 py-2 text-xs leading-5 text-base-content/70">
                  这是 AI 辅助草稿，尚未经人工确认：请核对上方证据后点「人工确认」，确认前不得作为最终面评结论，也不得据此发起录取审批。
                </p>
              ) : (
                <p className="text-xs text-base-content/60">已由 {rv.confirmedBy ?? '—'} 于 {rv.confirmedAt ?? '—'} 人工确认，可作为面评结论核对后进入后续流程。</p>
              )}
            </div>
          ) : <p className="whitespace-pre-line text-sm leading-7 text-base-content/80">{room.summary || '还没有生成报告——点击右上角「生成综合评价」即可基于本场记录生成一份 AI 草稿，草稿需人工确认后才生效。'}</p>}
        </Card>
      </section>

      {/* 重新生成会覆盖现有报告（已确认的结论会回到待确认）：二次确认后再重建 */}
      <Modal
        open={askRegen}
        onClose={() => setAskRegen(false)}
        title="重新生成综合评价报告？"
        sub={rv && !rv.draft ? '当前报告已人工确认，重新生成后会回到「待人工确认」' : '当前报告会被覆盖，且无法撤销'}
        footer={
          <>
            <Btn variant="ghost" onClick={() => setAskRegen(false)}>保留现有报告</Btn>
            <Btn variant="accent" onClick={() => { setAskRegen(false); regen() }}>覆盖并重新生成</Btn>
          </>
        }
      >
        <p className="text-sm leading-6 text-base-content/70">重新生成只依据已保存的评分、备注与会话记录，不改动面试结果；报告内容会被替换，需要再次人工确认后才作为面评结论。</p>
      </Modal>

      {/* AI 面评草稿的人工确认（FR-B3）：确认后记录确认人与确认时间，防重复点击 */}
      <Modal
        open={askConfirm}
        onClose={() => { if (!confirming) setAskConfirm(false) }}
        title="确认 AI 综合评价草稿"
        sub="FR-B3：AI 辅助生成的评价必须经人工确认后才作为面评结论"
        footer={
          <>
            <Btn variant="ghost" disabled={confirming} onClick={() => setAskConfirm(false)}>取消</Btn>
            <Btn variant="accent" loading={confirming} onClick={doConfirm}>确认并保存</Btn>
          </>
        }
      >
        <p className="text-sm leading-6 text-base-content/70">
          确认后报告标记为「已人工确认」，并记录确认人（{currentUser.name}）与确认时间，可作为面评结论使用；报告内容仍可重新生成，重新生成后会回到「待人工确认」。
        </p>
        <p className="mt-2 text-xs leading-5 text-base-content/50">AI 只依据评分、备注与会话记录提供辅助证据，不会自动作录用决定，也不触发审批。</p>
      </Modal>
    </div>
  )
}
