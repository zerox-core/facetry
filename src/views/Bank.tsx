import { useState } from 'react'
import { bank, candidates } from '../data'
import { addQuestion } from '../store'
import { SectionHead } from './ui'

export default function Bank() {
  const cats = ['全部', ...new Set(bank.map((b) => b.cat))]
  const [cat, setCat] = useState('全部')
  const [q, setQ] = useState('')
  const [menu, setMenu] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const targets = candidates.filter((c) => c.status === '待面试')
  const add = (cid: string, text: string, cat: string) => {
    addQuestion(cid, text, cat === '综合' ? '行为面试' : '技术深挖')
    setMenu(null)
    setToast(`已加入 ${candidates.find((c) => c.id === cid)!.name} 的本场题目`)
    setTimeout(() => setToast(''), 2400)
  }
  const list = bank.filter((b) => (cat === '全部' || b.cat === cat) && b.q.includes(q))
  return (
    <div>
      <SectionHead title="团队题库" sub={`${list.length} / ${bank.length} 题`} />
      <div className="ws-rise [--i:1] mt-6 flex flex-wrap items-center gap-2">
        {cats.map((c) => (
          <button key={c} onClick={() => setCat(c)} className={`cursor-pointer rounded-full border px-3 py-1 text-sm transition ${cat === c ? 'border-[#1d2939] bg-[#1d2939] text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>{c}</button>
        ))}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索题目…" className="ml-auto h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-blue-600 outline-none sm:w-64" />
      </div>
      <ol className="ws-rise [--i:2] mt-4 ws-paper rounded-xl">
        {list.map((b, i) => (
          <li key={b.q} className="group grid grid-cols-[48px_1fr_auto] items-baseline gap-4 border-b border-slate-100 px-5 py-4 last:border-0">
            <span className="text-sm tabular-nums text-slate-400">{String(i + 1).padStart(3, '0')}</span>
            <div>
              <div className="text-[15px] font-medium group-hover:text-slate-600">{b.q}</div>
              <div className="mt-1 text-xs text-slate-500">{b.cat} · {b.tag} · {b.hot} 次团队使用</div>
            </div>
            <div className="relative">
              <button onClick={() => setMenu(menu === b.q ? null : b.q)} className="cursor-pointer ws-press rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50">加入本场题目</button>
              {menu === b.q && (
                <div className="absolute right-0 z-10 mt-1 w-60 login-fade rounded-lg bg-white py-1 shadow-[var(--shadow-lift)]">
                  <div className="px-3 py-1.5 text-xs text-slate-400">选择候选人</div>
                  {targets.map((c) => {
                    const has = c.qs.some((x) => x.q === b.q)
                    return (
                      <button key={c.id} disabled={has} onClick={() => add(c.id, b.q, b.cat)} className="flex w-full cursor-pointer items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-default disabled:text-slate-300 disabled:hover:bg-white">
                        <span>{c.name}<span className="ml-2 text-xs text-slate-400">{c.slot}</span></span>{has && <span className="text-xs">已添加</span>}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
      {toast && <div className="fixed bottom-6 left-1/2 z-30 -translate-x-1/2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm text-white shadow-lg">{toast}</div>}
    </div>
  )
}
