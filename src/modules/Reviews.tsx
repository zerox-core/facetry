import { useState } from 'react'
import { Btn, Kpis, Pill, Sec, useToast } from './ui'

type Rv = { id: string; cand: string; role: string; round: string; date: string; due: string; late?: boolean; done?: boolean; others: { who: string; s: number[] ; v: string }[] }
const DIM = [['专业能力', '技术深度与问题解决'], ['系统设计', '架构与取舍能力'], ['沟通表达', '逻辑与协作'], ['岗位匹配', '经验与业务相关度'], ['潜力与稳定性', '成长性与动机']]
const LIST: Rv[] = [
  { id: 'RV-1201', cand: '周以宁', role: '产品设计负责人', round: '初面', date: '03-12 10:30', due: '超时 4h', late: true, others: [] },
  { id: 'RV-1198', cand: '许星河', role: '数据科学家', round: '终面', date: '03-12 14:00', due: '剩余 20h', others: [{ who: '张工', s: [5, 4, 4, 5, 4], v: '通过' }, { who: '陈经理', s: [4, 4, 5, 4, 5], v: '通过' }] },
  { id: 'RV-1195', cand: '唐语', role: '高级前端工程师', round: '初面', date: '03-11 11:00', due: '剩余 2h', others: [] },
  { id: 'RV-1190', cand: '林知远', role: '高级前端工程师', round: '复面', date: '03-12 10:00', due: '已提交', done: true, others: [{ who: '吴总监', s: [4, 5, 3, 4, 3], v: '待定' }] },
]
const EVID = [
  { t: '项目经历', q: '主导日活千万级应用渲染层重构，将首屏 TTI 从 3.8s 降至 1.2s，方案在 6 条业务线推广。', tag: '专业能力' },
  { t: '面试记录 14:12', q: '“我们评估过 SSR 和流式渲染，最终因为 CDN 成本和团队熟悉度选了分块预渲染。”', tag: '系统设计' },
  { t: '面试记录 14:31', q: '对跨团队推进的描述较笼统，未给出具体冲突解决案例。', tag: '沟通表达', neg: true },
  { t: '离职原因', q: '希望从纯技术岗转向技术管理，看重团队规模与业务成长空间。', tag: '潜力与稳定性' },
]

interface ReviewsProps {
  navTo?: (mod: string, params?: Record<string, any>) => void
  initialCand?: string
}

export default function Reviews({ navTo, initialCand }: ReviewsProps) {
  const [list, setList] = useState(LIST)
  const found = initialCand ? list.find(r => r.cand.includes(initialCand)) : null
  const [sel, setSel] = useState(found ? found.id : LIST[1].id)
  const [sc, setSc] = useState<Record<string, number[]>>({})
  const [verdict, setVerdict] = useState<Record<string, string>>({})
  const [hl, setHl] = useState<string | null>(null)
  const toast = useToast()
  const cur = list.find(r => r.id === sel)!
  const mine = sc[cur.id] ?? [0, 0, 0, 0, 0]
  const filled = mine.filter(Boolean).length
  const avg = filled ? mine.reduce((a, b) => a + b, 0) / filled : 0
  const setS = (d: number, v: number) => setSc(s => ({ ...s, [cur.id]: mine.map((x, i) => i === d ? v : x) }))

  return (
    <div className="h-full flex flex-col min-h-0">
      <Kpis items={[
        { k: '待我评审', v: list.filter(r => !r.done).length, d: '1 条已超时', s: [2, 3, 4, 3, 5, 4, 3], warn: true },
        { k: '本周已提交', v: 11, d: '团队第 2', s: [4, 6, 7, 8, 9, 10, 11] },
        { k: '平均提交时长', v: '6.2', u: '小时', d: 'SLA 24 小时', s: [9, 8, 8, 7, 7, 6, 6] },
        { k: '评分一致性', v: '0.82', d: '与团队均值偏差小', s: [70, 74, 78, 76, 80, 81, 82] },
        { k: '我的通过率', v: '46', u: '%', d: '团队 41%', s: [40, 42, 45, 44, 47, 45, 46] },
      ]} />
      <div className="flex-1 min-h-0 p-5 pt-3.5 flex gap-4">
        <section className="panel rounded-[6px] w-[280px] shrink-0 flex flex-col">
          <div className="h-11 px-4 border-b border-line flex items-center bg-paper/60"><span className="w-[3.5px] h-3.5 bg-amber rounded-full mr-2.5" /><span className="text-[13px] font-semibold text-ink">待评审</span><span className="ml-auto font-mono text-[11px] text-ink/40">{list.length} 项</span></div>
          <ul className="flex-1 overflow-y-auto">{list.map(r => (
            <li key={r.id}><button onClick={() => setSel(r.id)} className={`relative w-full text-left px-4 py-3 border-b border-[#ece8de] cursor-pointer transition-colors ${r.id === sel ? 'bg-amber-soft/80 shadow-xs' : 'hover:bg-[#f9f7f1]'}`}>
              {r.id === sel && <span className="absolute left-0 inset-y-0 w-[3.5px] bg-amber shadow-[1px_0_4px_rgba(215,166,42,0.4)]" />}
              <div className="flex items-center gap-1.5"><span className="font-semibold text-[13px] text-ink">{r.cand}</span><span className="text-[11.5px] text-ink/50 font-medium">{r.round}</span><span className="ml-auto">{r.done ? <Pill t="green">已提交</Pill> : r.late ? <Pill t="red">{r.due}</Pill> : <Pill t="amber" dot={false}>{r.due}</Pill>}</span></div>
              <div className="mt-1 text-[11.5px] text-ink/50 flex"><span>{r.role}</span><span className="ml-auto font-mono text-[11px]">{r.date}</span></div>
            </button></li>))}
          </ul>
        </section>

        {/* document + evidence */}
        <section key={cur.id} className="panel rise rounded-[6px] flex-1 min-w-0 flex flex-col">
          <div className="px-6 py-4 border-b border-line bg-paper flex items-center gap-3.5">
            <h2 className="font-serif text-[24px] font-bold text-ink">{cur.cand}</h2><span className="text-[13px] text-ink/65 font-medium">{cur.role} · {cur.round} · {cur.date}</span>
            <div className="ml-auto flex gap-2"><Btn>简历原文</Btn><Btn>面试录音</Btn></div>
          </div>
          <div className="flex-1 overflow-y-auto grid grid-cols-[1fr_260px]">
            <div className="border-r border-line">
              <Sec t="证据摘录" extra="点击评分维度可高亮对应证据">
                <ul className="space-y-2.5">{EVID.map((e, i) => { const on = !hl || hl === e.tag; return (
                  <li key={i} className={`relative p-3.5 rounded-[5px] border transition-all duration-200 ${on ? 'opacity-100' : 'opacity-35'} ${hl === e.tag ? 'border-amber bg-amber-soft/50 shadow-sm ring-1 ring-amber/30' : 'border-[#e5e0d4] bg-[#fffefa] shadow-2xs hover:shadow-xs'}`}>
                    <span className={`absolute left-0 inset-y-2 w-1 rounded-r-full ${e.neg ? 'bg-[#c0604f]' : 'bg-amber'}`} />
                    <div className="flex items-center gap-2 pl-2 text-[11px] text-ink/50"><span className="font-mono font-medium">{e.t}</span><span className="ml-auto"><Pill t={e.neg ? 'red' : 'amber'} dot={false}>{e.tag}</Pill></span></div>
                    <p className="mt-1.5 pl-2 text-[13px] leading-relaxed text-ink/85 font-normal">{e.q}</p>
                  </li>) })}</ul>
              </Sec>
              <Sec t="面试官笔记"><textarea placeholder="记录关键观察，支持 @ 引用证据…" className="w-full h-28 border border-line rounded-[4px] bg-paper p-3 text-[12.5px] outline-none focus:border-amber focus:ring-1 focus:ring-amber/20 resize-none shadow-2xs placeholder:text-ink/35" /></Sec>
            </div>
            <div className="bg-[#fcfbfa]">
              <Sec t="其他面试官" extra={`${cur.others.length} 份`}>
                {cur.others.length ? cur.others.map(o => <div key={o.who} className="py-2.5 border-b border-dashed border-line/80 last:border-0"><div className="flex items-center"><span className="font-semibold text-[12.5px] text-ink">{o.who}</span><span className="ml-auto"><Pill t={o.v === '通过' ? 'green' : 'amber'} dot={false}>{o.v}</Pill></span></div><div className="mt-1.5 flex gap-[3px]">{o.s.map((x, i) => <span key={i} title={DIM[i][0]} className="flex-1 h-5 rounded-[2px] flex items-center justify-center font-mono text-[10px] font-medium" style={{ background: x >= 4 ? '#f6ecd0' : '#eceae3', color: x >= 4 ? '#8a6410' : undefined }}>{x}</span>)}</div></div>)
                  : <p className="text-[12px] text-ink/45 leading-relaxed py-3">你是第一位评审人，提交后可查看他人评分。</p>}
              </Sec>
              <Sec t="评分分布">
                {DIM.map((d, i) => { const pts = [...cur.others.map(o => o.s[i]), ...(mine[i] ? [mine[i]] : [])]; return (
                  <div key={d[0]} className="mb-3"><div className="text-[11.5px] font-medium text-ink/65 mb-1.5">{d[0]}</div><div className="relative h-4"><span className="absolute top-1/2 inset-x-0 h-px bg-line" />{[1, 2, 3, 4, 5].map(n => <span key={n} className="absolute top-1 w-px h-2.5 bg-[#d6d1c4]" style={{ left: `${(n - 1) * 25}%` }} />)}
                    {pts.map((p, j) => <span key={j} className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-paper shadow-2xs ${j === pts.length - 1 && mine[i] ? 'bg-amber shadow-sm ring-1 ring-amber/50' : 'bg-[#5b6876]'}`} style={{ left: `${(p - 1) * 25}%` }} />)}</div></div>) })}
                <div className="flex gap-4 text-[11px] text-ink/50 mt-3 pt-2 border-t border-dashed border-line"><span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full bg-amber inline-block" />我的评分</span><span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full bg-[#5b6876] inline-block" />他人评分</span></div>
              </Sec>
            </div>
          </div>
        </section>

        {/* form */}
        <aside className="panel-elevated rounded-[6px] w-[360px] shrink-0 flex flex-col">
          <div className="px-5 py-4 border-b border-line bg-paper flex items-end justify-between"><div><div className="text-[11.5px] text-ink/50 font-medium">评审表 · {cur.round}</div><div className="font-serif text-[34px] font-bold leading-none tnum mt-1 text-ink">{avg ? avg.toFixed(1) : '—'}<span className="text-[12px] font-sans font-normal text-ink/45 ml-1">/ 5.0</span></div></div><span className="text-[12px] text-ink/50 font-medium tnum bg-[#f5f3ec] px-2.5 py-1 rounded-[3px]">{filled} / 5 已评</span></div>
          <div className="flex-1 overflow-y-auto">
            {DIM.map((d, i) => (
              <div key={d[0]} onMouseEnter={() => setHl(d[0])} onMouseLeave={() => setHl(null)} className="px-5 py-3 border-b border-[#ece8de] hover:bg-[#faf8f4] transition-colors">
                <div className="flex items-baseline"><span className="text-[13px] font-semibold text-ink">{d[0]}</span><span className="ml-2 text-[11px] text-ink/45">{d[1]}</span></div>
                <div className="mt-2 grid grid-cols-5 border border-line rounded-[4px] overflow-hidden shadow-2xs">
                  {[1, 2, 3, 4, 5].map(n => <button key={n} disabled={cur.done} onClick={() => setS(i, n)} className={`h-8 text-[13px] font-mono border-r border-line last:border-0 transition-colors cursor-pointer ${mine[i] === n ? 'bg-base text-amber font-bold shadow-xs' : mine[i] > n ? 'bg-amber-soft/70 font-medium' : 'bg-paper hover:bg-[#f3f1eb]'}`}>{n}</button>)}
                </div>
              </div>
            ))}
            <div className="px-5 py-4">
              <div className="text-[13px] font-semibold text-ink mb-2">结论</div>
              <div className="grid grid-cols-3 gap-2.5">{[['通过', 'green'], ['待定', 'amber'], ['不通过', 'red']].map(([v]) => <button key={v} disabled={cur.done} onClick={() => setVerdict(x => ({ ...x, [cur.id]: v }))} className={`h-9 rounded-[4px] text-[13px] border font-semibold transition-all cursor-pointer shadow-2xs ${verdict[cur.id] === v ? (v === '通过' ? 'bg-[#e3f0df] border-[#3f7a3a] text-[#3f7a3a] shadow-xs' : v === '待定' ? 'bg-amber-soft border-amber text-[#8a6410] shadow-xs' : 'bg-[#f6e3df] border-[#a8483a] text-[#a8483a] shadow-xs') : 'border-line bg-paper hover:bg-[#f5f3ec]'}`}>{v}</button>)}</div>
              <textarea placeholder="综合评语（必填，不少于 20 字）" className="mt-3.5 w-full h-24 border border-line rounded-[4px] bg-paper p-3 text-[12.5px] outline-none focus:border-amber focus:ring-1 focus:ring-amber/20 resize-none shadow-2xs placeholder:text-ink/35" />
            </div>
          </div>
          <div className="shrink-0 border-t border-line p-4 flex gap-2.5 bg-[#faf8f3]">
            {cur.done ? (
              <>
                <Btn primary className="flex-1 h-9 text-[13px] font-semibold" onClick={() => navTo && navTo('offers', { candName: cur.cand })}>
                  去发起 Offer 审批 →
                </Btn>
                <Btn className="h-9" onClick={() => navTo && navTo('talent')}>返回人才库</Btn>
              </>
            ) : (
              <>
                <Btn primary className="flex-1 h-9 text-[13px] font-semibold" disabled={filled < 5 || !verdict[cur.id]} onClick={() => {
                  setList(l => l.map(r => r.id === cur.id ? { ...r, done: true, due: '已提交' } : r))
                  toast(`${cur.cand} 面评已提交成功！`)
                }}>
                  提交面评
                </Btn>
                <Btn className="h-9" onClick={() => toast('草稿已保存')}>存草稿</Btn>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
