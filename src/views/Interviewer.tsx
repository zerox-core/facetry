import { useState } from 'react'
import { bank } from '../data'
import { addQuestion, findC, pickedOf, setPicked as savePicked } from '../store'
import type { Go } from '../App'
import { Btn } from './ui'
import ResumeDoc from './ResumeDoc'

const TOPICS = ['技术深挖', '项目细节', '简历核实', '行为面试']
const field = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm leading-6 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'

type Props = { cid: string; go: Go }

export default function Interviewer({ cid, go }: Props) {
  const c = findC(cid)
  const picked = pickedOf(cid)
  const setPicked = (v: string[]) => savePicked(cid, v)
  const [hover, setHover] = useState<string>()
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState({ q: '', topic: TOPICS[0], points: '', follow: '' })
  const add = (text: string, topic: string, points: string[] = [], follow: string[] = []) => addQuestion(cid, text, topic, points, follow)
  const submit = () => {
    if (!draft.q.trim()) return
    const lines = (v: string) => v.split('\n').map((x) => x.trim()).filter(Boolean)
    add(draft.q.trim(), draft.topic, lines(draft.points), lines(draft.follow))
    setDraft({ q: '', topic: draft.topic, points: '', follow: '' })
    setAdding(false)
  }
  const used = new Set(c.qs.map((q) => q.q))
  const toggle = (id: string) => setPicked(picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id])

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5 ws-rise">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{c.name} · {c.role}</h1>
          <p className="mt-1.5 text-[15px] text-slate-500">{c.slot} · {c.round}　·　岗位匹配 {c.match}%　·　已生成 {c.qs.length} 道题，勾选本场要问的</p>
        </div>
        <div className="flex gap-2">
          <Btn variant="ghost" onClick={() => go('back')}>返回{go.from}</Btn>
          <Btn variant="accent" onClick={() => go('room', cid)}>进入面试间（{picked.length} 题）</Btn>
        </div>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="ws-rise [--i:1] ws-paper overflow-hidden rounded-xl lg:sticky lg:top-20 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
          <ResumeDoc c={c} active={hover} />
        </div>

        <div className="space-y-10">
          <section>
            <h2 className="text-lg font-semibold text-slate-900">分析结论</h2>
            <p className="mt-3 text-[15px] leading-7 text-slate-700">{c.summary}</p>
            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              <div>
                <h3 className="flex items-center gap-2 text-[15px] font-medium text-slate-900"><span className="h-2 w-2 rounded-full bg-emerald-500" />亮点</h3>
                <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-600">{c.highlights.map((h) => <li key={h}>{h}</li>)}</ul>
              </div>
              <div>
                <h3 className="flex items-center gap-2 text-[15px] font-medium text-slate-900"><span className="h-2 w-2 rounded-full bg-amber-500" />需要核实</h3>
                <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-600">{c.risks.map((h) => <li key={h}>{h}</li>)}</ul>
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold text-slate-900">本场题目</h2>
              <span className="text-sm text-slate-500">已选 {picked.length} / {c.qs.length}</span>
            </div>
            <ul className="mt-3 divide-y divide-slate-100 ws-paper rounded-xl">
              {c.qs.map((q, i) => {
                const on = picked.includes(q.id)
                return (
                  <li key={q.id} onMouseEnter={() => setHover(q.id)} onMouseLeave={() => setHover(undefined)}>
                    <label className="flex cursor-pointer gap-4 px-5 py-4 hover:bg-slate-50">
                      <input type="checkbox" checked={on} onChange={() => toggle(q.id)} className="mt-1 h-4 w-4 shrink-0 accent-blue-600" />
                      <div className="min-w-0">
                        <p className={`text-[15px] leading-6 ${on ? 'text-slate-900' : 'text-slate-400'}`}><span className="mr-2 tabular-nums text-slate-400">{i + 1}.</span>{q.q}</p>
                        <p className="mt-1 text-sm text-slate-500">{q.basis === '面试官手动添加' && <span className="mr-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">手动</span>}{q.topic} · {q.basis}</p>
                      </div>
                    </label>
                  </li>
                )
              })}
            </ul>

            {adding ? (
              <div className="mt-3 login-fade ws-paper rounded-xl p-5">
                <div className="flex items-baseline justify-between">
                  <h3 className="text-[15px] font-semibold text-slate-900">添加题目</h3>
                  <button onClick={() => setAdding(false)} className="cursor-pointer text-sm text-slate-500 hover:text-slate-900">取消</button>
                </div>
                <textarea autoFocus value={draft.q} onChange={(e) => setDraft({ ...draft, q: e.target.value })} rows={2} placeholder="输入要问的问题…" className={`mt-3 resize-none text-[15px] ${field}`} />
                <div className="mt-3 flex flex-wrap gap-2">
                  {TOPICS.map((t) => (
                    <button key={t} onClick={() => setDraft({ ...draft, topic: t })} className={`cursor-pointer rounded-full border px-3 py-1 text-sm transition ${draft.topic === t ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600 hover:border-slate-400'}`}>{t}</button>
                  ))}
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <textarea value={draft.points} onChange={(e) => setDraft({ ...draft, points: e.target.value })} rows={3} placeholder={'考察要点（选填，每行一条）'} className={`resize-none ${field}`} />
                  <textarea value={draft.follow} onChange={(e) => setDraft({ ...draft, follow: e.target.value })} rows={3} placeholder={'追问（选填，每行一条）'} className={`resize-none ${field}`} />
                </div>
                <div className="mt-4 flex justify-end"><Btn onClick={submit}>加入本场</Btn></div>
                <div className="mt-5 border-t border-slate-100 pt-4">
                  <div className="text-sm text-slate-500">或从团队题库选择</div>
                  <ul className="mt-2 space-y-1">
                    {bank.filter((b) => !used.has(b.q)).slice(0, 5).map((b) => (
                      <li key={b.q}>
                        <button onClick={() => add(b.q, b.cat === '综合' ? '行为面试' : '技术深挖')} className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">
                          <span>{b.q}</span><span className="shrink-0 text-blue-600">+ 添加</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <button onClick={() => setAdding(true)} className="mt-3 w-full cursor-pointer rounded-xl border border-dashed border-slate-300 py-3 text-sm font-medium text-slate-600 transition hover:border-slate-400 hover:bg-white hover:text-slate-900">+ 手动添加题目</button>
            )}
            <p className="mt-3 text-sm text-slate-400">鼠标移到题目上，左侧简历会标出出题依据。</p>
          </section>
        </div>
      </div>
    </div>
  )
}
