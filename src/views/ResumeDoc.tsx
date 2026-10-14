import { useState } from 'react'
import { resumes, type Candidate, type ResumeLine } from '../data'
import { Empty } from './ui'

type Props = {
  c: Candidate
  /** 当前正在问的题目 id，对应段落高亮 */
  active?: string
  /** 传入后段落可点击，跳到对应题目 */
  onPick?: (qid: string) => void
  filter?: 'all' | 'hi' | 'risk' | 'none'
}

/**
 * 简历原文（FR-A2）：原件缺失时不崩，只展示已有结构化文本；
 * 带题号的行是真正的按钮（Tab / Enter 都可触发），要点明细为空时不渲染空白的「待核实 ·」。
 */
export default function ResumeDoc({ c, active, onPick, filter = 'all' }: Props) {
  const [peek, setPeek] = useState<string | null>(null)
  const r = resumes[c.id]

  // 简历文本缺失（来源库未回传 / 附件缺失且无平台文本）：给空态，不崩溃
  if (!r) {
    return (
      <div className="mx-auto max-w-[640px] px-6 py-8">
        <Empty
          title="该候选人没有可展示的简历原文"
          hint="来源库未回传简历文本（附件可能缺失或尚未同步完成）。附件缺失只展示状态，工作台不会自动回网站补采。"
        />
      </div>
    )
  }

  const qNo = (id: string) => (c.qs ?? []).findIndex((q) => q.id === id) + 1
  const note = (l: ResumeLine): string | undefined => (l.mark === 'hi' ? c.highlights : c.risks)?.[l.ref ?? 0]

  return (
    <article className="mx-auto max-w-[640px] bg-base-100 px-12 py-10 text-base-content">
      <header className="border-b border-base-300 pb-6">
        <h2 className="text-[26px] font-semibold tracking-tight text-base-content">{c.name}</h2>
        <p className="mt-2 text-sm text-base-content/70">
          {c.role} · {c.exp} · {c.edu}
        </p>
        <p className="mt-0.5 text-sm text-base-content/50">{r.contact}</p>
        {c.attachmentType === 'missing' && (
          <p className="mt-2 text-xs text-warning">原始附件缺失：以下为来源库中的平台结构化文本，不是原件扫描件。</p>
        )}
        {c.attachmentType === 'platform' && <p className="mt-2 text-xs text-base-content/50">当前展示的是平台模板文件解析结果。</p>}
      </header>

      {r.sections.map((sec) => (
        <section key={sec.title} className="mt-8">
          <h3 className="text-[13px] font-semibold tracking-wide text-base-content/50">{sec.title}</h3>
          <ul className="mt-3">
            {sec.lines.map((l) => {
              const role = /^\d{4}\./.test(l.text)
              if (role) {
                return (
                  <li key={l.text} className="mt-4 mb-1 text-[15px] font-semibold text-base-content first:mt-0">
                    {l.text}
                  </li>
                )
              }

              const shown = !!l.mark && (filter === 'all' || filter === l.mark)
              const qid = l.q?.[0]
              const on = !!active && !!l.q?.includes(active)
              const open = on || peek === l.text
              const isRisk = l.mark === 'risk'
              const clickable = shown && !!onPick
              const noteText = shown ? note(l) : undefined

              const body = (
                <>
                  <span className={shown ? (isRisk ? 'rounded bg-warning/15 px-0.5' : 'rounded bg-success/15 px-0.5') : ''}>{l.text}</span>
                  {shown && (
                    <span
                      className={`ml-2 inline-flex translate-y-[-1px] items-center rounded px-1.5 text-xs leading-5 ${
                        on ? 'bg-neutral font-medium text-neutral-content' : isRisk ? 'bg-warning/15 text-warning' : 'bg-success/15 text-success'
                      }`}
                    >
                      {qid ? `第 ${qNo(qid)} 题` : isRisk ? '疑点' : '亮点'}
                    </span>
                  )}
                  {shown && open && (
                    <span className={`mt-1.5 block border-l-2 pl-3 text-[13px] leading-6 ${isRisk ? 'border-warning text-warning' : 'border-success text-success'}`}>
                      {noteText ? (
                        <>
                          {isRisk ? '待核实 · ' : '亮点 · '}
                          {noteText}
                        </>
                      ) : (
                        <span className="text-base-content/40">该项暂无要点明细（简历要点未标注对应条目）</span>
                      )}
                    </span>
                  )}
                </>
              )

              const rowClass = `-mx-3 block w-[calc(100%+1.5rem)] rounded-lg px-3 py-1.5 text-left text-[15px] leading-7 transition-colors ${
                clickable ? 'cursor-pointer hover:bg-base-200' : ''
              } ${on ? 'bg-base-200 font-medium text-base-content' : ''} ${
                !on && shown ? 'text-base-content' : !shown ? 'text-base-content/70' : ''
              }`

              return (
                <li key={l.text} className="relative">
                  {shown && (
                    <span
                      className={`absolute top-3 -left-6 h-2 w-2 rounded-full ${isRisk ? 'bg-warning' : 'bg-success'} ${
                        on ? `ring-4 ${isRisk ? 'ring-warning/20' : 'ring-success/20'}` : ''
                      }`}
                    />
                  )}
                  {clickable ? (
                    <button
                      type="button"
                      aria-label={qid ? `跳到第 ${qNo(qid)} 题` : `展开${isRisk ? '疑点' : '亮点'}说明`}
                      onClick={() => (qid ? onPick!(qid) : setPeek(peek === l.text ? null : l.text))}
                      className={rowClass}
                    >
                      {body}
                    </button>
                  ) : (
                    <div className={rowClass}>{body}</div>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </article>
  )
}
