import { useState } from 'react'
import { bank, bankCats, candidates } from '../data'
import { addBankCat, addBankItem, addQuestion, slotLabel } from '../store'
import { Btn, SectionHead } from './ui'

const DIFFS = ['基础', '中等', '较难']
// 录入表单：文字端正清晰（标签 slate-600 中字重，输入正文 slate-900）
const field = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
const lab = 'text-xs font-medium text-slate-600'

const DRAFT_KEY = 'facetry-bank-draft'
type Draft = { cat: string; tag: string; diff: string; q: string; points: string; answer: string; follow: string; flag: string }
const loadStash = (): Draft | null => {
  try {
    const s = localStorage.getItem(DRAFT_KEY)
    return s ? (JSON.parse(s) as Draft) : null
  } catch {
    return null
  }
}

export default function Bank() {
  const [cat, setCat] = useState('全部')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<string>() // 展开答案的题目 id
  const [menu, setMenu] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const [addingCat, setAddingCat] = useState(false)
  const [newCat, setNewCat] = useState('')
  const [entering, setEntering] = useState(false)
  const [draft, setDraft] = useState<Draft>({ cat: bankCats[0], tag: '基础', diff: '中等', q: '', points: '', answer: '', follow: '', flag: '' })
  const [stash, setStash] = useState<Draft | null>(loadStash) // 暂存：只保留最近一道题

  const targets = candidates.filter((c) => c.status === '待面试')
  const say = (t: string) => { setToast(t); setTimeout(() => setToast(''), 2400) }
  const add = (cid: string, b: (typeof bank)[number]) => {
    addQuestion(cid, { q: b.q, topic: b.cat === '综合' ? '行为面试' : '技术深挖', diff: b.diff, basis: `题库 · ${b.cat}`, points: b.points, answer: b.answer, follow: b.follow, flag: b.flag })
    setMenu(null)
    say(`已加入 ${candidates.find((c) => c.id === cid)!.name} 的本场题目`)
  }
  const list = bank.filter((b) => (cat === '全部' || b.cat === cat) && (!q || b.q.includes(q) || b.answer.includes(q)))
  const lines = (v: string) => v.split('\n').map((x) => x.trim()).filter(Boolean)
  const submitCat = () => { addBankCat(newCat); if (newCat.trim()) setCat(newCat.trim()); setNewCat(''); setAddingCat(false) }
  const hasContent = !!(draft.q.trim() || draft.answer.trim() || draft.points.trim() || draft.follow.trim() || draft.flag.trim())
  const clearStash = () => { localStorage.removeItem(DRAFT_KEY); setStash(null) }
  const stashIt = () => {
    if (!hasContent) return
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
    setStash(draft)
    say('已暂存，下次打开可继续填写')
  }
  const restoreStash = () => {
    if (!stash) return
    setDraft({ ...stash })
    clearStash()
    say('已载入暂存内容')
  }
  const submitItem = () => {
    if (!draft.q.trim() || !draft.answer.trim()) return say('题目与参考答案是必填项')
    addBankItem({ cat: draft.cat, q: draft.q.trim(), tag: draft.tag, diff: draft.diff, points: lines(draft.points), answer: draft.answer.trim(), follow: lines(draft.follow), flag: draft.flag.trim() })
    setDraft({ ...draft, q: '', points: '', answer: '', follow: '', flag: '' })
    clearStash()
    setEntering(false)
    setCat(draft.cat)
    say('已录入题库')
  }

  return (
    <div>
      <div className="flex items-end justify-between">
        <SectionHead title="团队题库" />
        <Btn variant="accent" className="mb-4" onClick={() => setEntering(!entering)}>{entering ? '收起录入' : '录入题目'}</Btn>
      </div>

      {entering && (
        <div className="login-fade mb-5 ws-paper rounded-xl p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-[15px] font-semibold text-slate-900">录入一道题</h3>
            <span className="text-xs text-slate-400">暂存只保留最近一道题，再次暂存会覆盖</span>
          </div>
          {stash && (
            <div className="mt-3 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50/70 px-3.5 py-2.5 text-sm">
              <span className="min-w-0 flex-1 truncate text-amber-900">
                有 1 条暂存的题目{stash.q.trim() ? `：${stash.q.trim().slice(0, 30)}${stash.q.trim().length > 30 ? '…' : ''}` : ''}
              </span>
              <button onClick={restoreStash} className="shrink-0 cursor-pointer font-medium text-blue-600 hover:text-blue-800">继续填写</button>
              <button onClick={clearStash} className="shrink-0 cursor-pointer text-slate-400 hover:text-slate-700">丢弃</button>
            </div>
          )}
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className={lab}>分类
              <select value={draft.cat} onChange={(e) => setDraft({ ...draft, cat: e.target.value })} className={`mt-1 h-10 ${field}`}>
                {bankCats.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className={lab}>难度
              <select value={draft.diff} onChange={(e) => setDraft({ ...draft, diff: e.target.value })} className={`mt-1 h-10 ${field}`}>
                {DIFFS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
            <label className={lab}>标签
              <input value={draft.tag} onChange={(e) => setDraft({ ...draft, tag: e.target.value })} placeholder="如：基础 / 设计 / 案例" className={`mt-1 h-10 ${field}`} />
            </label>
          </div>
          <textarea autoFocus value={draft.q} onChange={(e) => setDraft({ ...draft, q: e.target.value })} rows={2} placeholder="题目（必填）" className={`mt-3 resize-none text-[15px] ${field}`} />
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <textarea value={draft.points} onChange={(e) => setDraft({ ...draft, points: e.target.value })} rows={3} placeholder={'考察要点（选填，每行一条）'} className={`resize-none ${field}`} />
            <textarea value={draft.follow} onChange={(e) => setDraft({ ...draft, follow: e.target.value })} rows={3} placeholder={'追问（选填，每行一条）'} className={`resize-none ${field}`} />
          </div>
          <textarea value={draft.answer} onChange={(e) => setDraft({ ...draft, answer: e.target.value })} rows={3} placeholder="参考答案 / 期望回答（必填）" className={`mt-3 resize-none ${field}`} />
          <input value={draft.flag} onChange={(e) => setDraft({ ...draft, flag: e.target.value })} placeholder="减分信号（选填）：什么样的回答要警惕" className={`mt-3 ${field}`} />
          <div className="mt-4 flex items-center justify-end gap-2.5">
            <Btn variant="ghost" onClick={stashIt} className={hasContent ? '' : 'pointer-events-none opacity-40'}>暂存</Btn>
            <Btn variant="accent" onClick={submitItem}>存入题库</Btn>
          </div>
        </div>
      )}

      <div className="flex gap-5">
        {/* 分类：按岗位组织，可自定义（一位面试官常面多个岗位） */}
        <aside className="w-40 shrink-0">
          <ul className="ws-rise [--i:1] ws-paper rounded-xl py-1.5 text-sm">
            {['全部', ...bankCats].map((c) => {
              const n = c === '全部' ? bank.length : bank.filter((b) => b.cat === c).length
              return (
                <li key={c}>
                  <button onClick={() => setCat(c)} className={`flex w-full cursor-pointer items-center justify-between px-4 py-2 transition-colors ${cat === c ? 'font-medium text-slate-900' : 'text-slate-500 hover:text-slate-900'}`}>
                    <span className="flex items-center gap-2">{cat === c && <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />}{c}</span>
                    <span className="tabular-nums text-xs text-slate-400">{n}</span>
                  </button>
                </li>
              )
            })}
          </ul>
          {addingCat ? (
            <div className="login-fade mt-2 ws-paper rounded-xl p-2">
              <input autoFocus value={newCat} onChange={(e) => setNewCat(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submitCat()} placeholder="分类名，如：测试" className="h-8 w-full rounded-md border border-slate-200 px-2 text-sm outline-none focus:border-blue-600" />
              <div className="mt-1.5 flex justify-end gap-2 text-xs">
                <button onClick={() => { setAddingCat(false); setNewCat('') }} className="cursor-pointer text-slate-400 hover:text-slate-700">取消</button>
                <button onClick={submitCat} className="cursor-pointer font-medium text-blue-600 hover:text-blue-800">添加</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAddingCat(true)} className="mt-2 w-full cursor-pointer rounded-xl border border-dashed border-slate-300 py-2 text-sm text-slate-500 transition hover:border-slate-400 hover:bg-white hover:text-slate-900">+ 新建分类</button>
          )}
        </aside>

        <div className="min-w-0 flex-1">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索题目或答案…" className="ws-rise [--i:1] h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-600 sm:w-72" />
          <ol className="ws-rise [--i:2] mt-3 space-y-3">
            {list.map((b) => {
              const expanded = open === b.id
              return (
                <li key={b.id} className="ws-paper rounded-xl px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <button onClick={() => setOpen(expanded ? undefined : b.id)} className="min-w-0 flex-1 cursor-pointer text-left">
                      <div className="text-[15px] font-medium text-slate-900">{b.q}</div>
                      <div className="mt-1 text-xs text-slate-500">{b.cat} · {b.tag} · {b.diff} · {b.hot} 次团队使用</div>
                    </button>
                    <div className="flex shrink-0 items-center gap-2">
                      <button onClick={() => setOpen(expanded ? undefined : b.id)} className="cursor-pointer text-sm text-slate-500 hover:text-slate-900">{expanded ? '收起' : '答案'}</button>
                      <div className="relative">
                        <button onClick={() => setMenu(menu === b.id ? null : b.id)} className="cursor-pointer ws-press rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50">加入本场题目</button>
                        {menu === b.id && (
                          <div className="absolute right-0 z-10 mt-1 w-60 login-fade rounded-lg bg-white py-1 shadow-[var(--shadow-lift)]">
                            <div className="px-3 py-1.5 text-xs text-slate-400">选择候选人（待面试）</div>
                            {targets.map((c) => {
                              const has = c.qs.some((x) => x.q === b.q)
                              return (
                                <button key={c.id} disabled={has} onClick={() => add(c.id, b)} className="flex w-full cursor-pointer items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-default disabled:text-slate-300 disabled:hover:bg-white">
                                  <span>{c.name}<span className="ml-2 text-xs text-slate-400">{slotLabel(c.slot)}</span></span>{has && <span className="text-xs">已添加</span>}
                                </button>
                              )
                            })}
                            {!targets.length && <div className="px-3 py-2 text-xs text-slate-400">暂无待面试的候选人</div>}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  {expanded && (
                    <div className="login-fade mt-4 space-y-3 border-t border-slate-100 pt-4 text-sm leading-6">
                      {!!b.points.length && (
                        <div>
                          <div className="text-xs font-medium text-slate-500">考察要点</div>
                          <ul className="mt-1 space-y-1 text-slate-700">{b.points.map((p) => <li key={p}>· {p}</li>)}</ul>
                        </div>
                      )}
                      <div>
                        <div className="text-xs font-medium text-slate-500">参考答案</div>
                        <p className="mt-1 text-slate-700">{b.answer}</p>
                      </div>
                      {!!b.follow.length && (
                        <div>
                          <div className="text-xs font-medium text-slate-500">追问</div>
                          <ul className="mt-1 space-y-1 text-slate-700">{b.follow.map((f) => <li key={f}>· {f}</li>)}</ul>
                        </div>
                      )}
                      {b.flag && <p className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-amber-900"><b className="font-medium">减分信号</b>　{b.flag}</p>}
                    </div>
                  )}
                </li>
              )
            })}
            {!list.length && <li className="ws-paper rounded-xl px-5 py-10 text-center text-sm text-slate-400">这个分类下还没有题目，点右上角「录入题目」添加</li>}
          </ol>
        </div>
      </div>
      {toast && <div className="fixed bottom-6 left-1/2 z-30 -translate-x-1/2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm text-white shadow-lg">{toast}</div>}
    </div>
  )
}
