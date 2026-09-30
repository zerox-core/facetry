import { useState } from 'react'
import { candidates, resumes, type ResumeLine } from '../data'

type C = (typeof candidates)[number]
type Props = {
  c: C
  /** 当前正在问的题目 id，对应段落高亮 */
  active?: string
  /** 传入后段落可点击，跳到对应题目 */
  onPick?: (qid: string) => void
  filter?: 'all' | 'hi' | 'risk' | 'none'
}

export default function ResumeDoc({ c, active, onPick, filter = 'all' }: Props) {
  const r = resumes[c.id]
  const [peek, setPeek] = useState<string | null>(null)
  const qNo = (id: string) => c.qs.findIndex((q) => q.id === id) + 1
  const note = (l: ResumeLine) => (l.mark === 'hi' ? c.highlights : c.risks)[l.ref ?? 0]

  return (
    <article className="mx-auto max-w-[640px] bg-[#fffdf9] px-12 py-10 text-slate-800">
      <header className="border-b border-slate-200 pb-6">
        <h2 className="text-[26px] font-semibold tracking-tight text-slate-900">{c.name}</h2>
        <p className="mt-2 text-sm text-slate-600">{c.role} · {c.exp} · {c.edu}</p>
        <p className="mt-0.5 text-sm text-slate-400">{r.contact}</p>
      </header>

      {r.sections.map((sec) => (
        <section key={sec.title} className="mt-8">
          <h3 className="text-[13px] font-semibold tracking-wide text-slate-400">{sec.title}</h3>
          <ul className="mt-3">
            {sec.lines.map((l) => {
              const role = /^\d{4}\./.test(l.text)
              if (role) return <li key={l.text} className="mt-4 mb-1 text-[15px] font-semibold text-slate-900 first:mt-0">{l.text}</li>

              const shown = !!l.mark && (filter === 'all' || filter === l.mark)
              const qid = l.q?.[0]
              const on = !!active && !!l.q?.includes(active)
              const open = on || peek === l.text
              const tone = l.mark === 'risk' ? 'amber' : 'emerald'
              const clickable = shown && !!onPick

              return (
                <li key={l.text} className="relative">
                  {shown && (
                    <span className={`absolute top-3 -left-6 h-2 w-2 rounded-full ${tone === 'amber' ? 'bg-amber-500' : 'bg-emerald-500'} ${on ? 'ring-4 ' + (tone === 'amber' ? 'ring-amber-100' : 'ring-emerald-100') : ''}`} />
                  )}
                  <div
                    role={clickable ? 'button' : undefined}
                    tabIndex={clickable ? 0 : undefined}
                    onClick={() => clickable && (qid ? onPick!(qid) : setPeek(peek === l.text ? null : l.text))}
                    onKeyDown={(e) => clickable && e.key === 'Enter' && qid && onPick!(qid)}
                    className={`-mx-3 rounded-lg px-3 py-1.5 text-[15px] leading-7 transition-colors ${clickable ? 'cursor-pointer' : ''} ${
                      on ? 'bg-blue-50 text-slate-900' : clickable ? 'hover:bg-slate-50' : ''
                    } ${shown && !on ? (tone === 'amber' ? 'text-slate-900' : 'text-slate-800') : !shown ? 'text-slate-600' : ''}`}
                  >
                    <span className={shown ? (tone === 'amber' ? 'shadow-[inset_0_-0.4em_0_#fde68a]' : 'shadow-[inset_0_-0.4em_0_#d1fae5]') : ''}>{l.text}</span>
                    {shown && (
                      <span className={`ml-2 inline-flex translate-y-[-1px] items-center rounded px-1.5 text-xs leading-5 ${on ? 'bg-blue-600 text-white' : tone === 'amber' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                        {qid ? `第 ${qNo(qid)} 题` : l.mark === 'risk' ? '疑点' : '亮点'}
                      </span>
                    )}
                    {shown && open && (
                      <span className={`mt-1.5 block border-l-2 pl-3 text-[13px] leading-6 ${tone === 'amber' ? 'border-amber-400 text-amber-800' : 'border-emerald-400 text-emerald-800'}`}>
                        {l.mark === 'risk' ? '待核实 · ' : '亮点 · '}{note(l)}
                      </span>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </article>
  )
}
