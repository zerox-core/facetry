import { useState } from 'react'
import type { NewQuestion, Question, QuestionPatch } from '../types'
import { Chip } from './Chip'
import { ConfirmModal } from './Modal'
import { ScoreDots } from './ScoreDots'
import { Btn } from './ui'

export type QuestionFormValue = {
  q: string
  type: string
  point: string
  followUp: string
  expected: string
}

const emptyForm: QuestionFormValue = { q: '', type: '经历深挖', point: '', followUp: '', expected: '' }

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none'

/** 题目编辑 / 新增共用的内联表单；expected 一行一条 */
export function QuestionForm({
  initial = emptyForm,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: QuestionFormValue
  submitLabel: string
  onSubmit: (v: QuestionFormValue) => void
  onCancel: () => void
}) {
  const [v, setV] = useState<QuestionFormValue>(initial)
  const set = (k: keyof QuestionFormValue) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value })
  return (
    <div className="space-y-3 rounded-lg bg-slate-50 p-4">
      <div>
        <div className="mb-1 text-xs font-medium text-slate-500">问题</div>
        <textarea className={inputCls} rows={2} value={v.q} onChange={set('q')} placeholder="例如：这个项目里你负责的模块是什么？" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="mb-1 text-xs font-medium text-slate-500">类型</div>
          <input className={inputCls} value={v.type} onChange={set('type')} placeholder="经历深挖" />
        </div>
        <div>
          <div className="mb-1 text-xs font-medium text-slate-500">考察点</div>
          <input className={inputCls} value={v.point} onChange={set('point')} placeholder="想验证什么能力" />
        </div>
      </div>
      <div>
        <div className="mb-1 text-xs font-medium text-slate-500">追问</div>
        <textarea className={inputCls} rows={2} value={v.followUp} onChange={set('followUp')} placeholder="回答之后可以继续问什么" />
      </div>
      <div>
        <div className="mb-1 text-xs font-medium text-slate-500">参考要点（每行一条）</div>
        <textarea className={inputCls} rows={3} value={v.expected} onChange={set('expected')} placeholder={'留意这些证据\n一行一条'} />
      </div>
      <div className="flex justify-end gap-2">
        <Btn variant="ghost" className="h-9" onClick={onCancel}>
          取消
        </Btn>
        <Btn className="h-9" disabled={!v.q.trim()} onClick={() => onSubmit(v)}>
          {submitLabel}
        </Btn>
      </div>
    </div>
  )
}

export function formToPatch(v: QuestionFormValue): NewQuestion {
  return {
    q: v.q.trim(),
    type: v.type.trim() || '经历深挖',
    point: v.point.trim(),
    followUp: v.followUp.trim(),
    expected: v.expected.split(/\r?\n/).map((s) => s.trim()).filter(Boolean),
  }
}

type CardProps = {
  q: Question
  /** 全局题号（1 起） */
  index: number
  onPatch: (patch: QuestionPatch) => void
  onRemove: () => void
  onHover: (inside: boolean) => void
}

export function QuestionCard({ q, index, onPatch, onRemove, onHover }: CardProps) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const num = `Q${String(index).padStart(2, '0')}`

  if (q.excluded) {
    return (
      <article
        id={`q-${q.id}`}
        onMouseEnter={() => onHover(true)}
        onMouseLeave={() => onHover(false)}
        className="rounded-xl bg-slate-50 px-5 py-4 opacity-60"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-400 tabular-nums">{num}</span>
          <Chip>已隐藏</Chip>
          <p className="min-w-0 flex-1 truncate text-sm text-slate-500">{q.q}</p>
          <button
            type="button"
            onClick={() => onPatch({ id: q.id, excluded: false })}
            className="shrink-0 cursor-pointer text-xs font-medium text-blue-600 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            恢复
          </button>
        </div>
      </article>
    )
  }

  return (
    <article
      id={`q-${q.id}`}
      tabIndex={0}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onKeyDown={(e) => {
        const t = e.target as HTMLElement
        if (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT') return
        const n = Number(e.key)
        if (n >= 1 && n <= 5) onPatch({ id: q.id, score: n })
      }}
      className="ws-paper scroll-mt-24 rounded-xl px-5 py-4 focus:outline-2 focus:outline-offset-2 focus:outline-blue-100"
    >
      <div
        className="flex cursor-pointer items-start gap-3"
        onClick={() => setOpen(!open)}
        role="button"
        aria-expanded={open}
      >
        <span className="mt-0.5 text-xs font-semibold text-slate-400 tabular-nums">{num}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Chip tone="blue">{q.type || '经历深挖'}</Chip>
            {q.note.trim() && <Chip tone="emerald">有笔记</Chip>}
          </div>
          <h3 className="mt-1.5 text-[15px] font-semibold leading-6 text-slate-900">{q.q}</h3>
        </div>
        <svg
          viewBox="0 0 24 24"
          className={`mt-1 h-4 w-4 shrink-0 text-slate-400 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 pl-7">
        <ScoreDots value={q.score} onChange={(score) => onPatch({ id: q.id, score })} />
        <span className="text-xs text-slate-400">按 1–5 键快速评分</span>
      </div>

      {open && !editing && (
        <div className="login-fade mt-4 space-y-3 border-t border-slate-100 pt-4 pl-7">
          {q.point && (
            <div>
              <div className="mb-1 text-xs font-medium text-slate-500">考察点</div>
              <p className="text-sm text-slate-700">{q.point}</p>
            </div>
          )}
          {q.followUp && (
            <div>
              <div className="mb-1 text-xs font-medium text-slate-500">可以继续问</div>
              <p className="text-sm text-slate-700">{q.followUp}</p>
            </div>
          )}
          {q.expected.length > 0 && (
            <div>
              <div className="mb-1 text-xs font-medium text-slate-500">留意这些证据</div>
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                {q.expected.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <div className="mb-1 text-xs font-medium text-slate-500">面试备注</div>
            <textarea
              key={q.id}
              defaultValue={q.note}
              rows={3}
              maxLength={10000}
              placeholder="记下关键回答、观察或待验证的细节…"
              onBlur={(e) => {
                if (e.target.value !== q.note) onPatch({ id: q.id, note: e.target.value })
              }}
              className={inputCls}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="cursor-pointer text-xs font-medium text-blue-600 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                编辑
              </button>
              <button
                type="button"
                onClick={() => onPatch({ id: q.id, excluded: true })}
                className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                隐藏此题
              </button>
            </div>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="cursor-pointer text-xs font-medium text-red-500 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              删除
            </button>
          </div>
        </div>
      )}

      {open && editing && (
        <div className="mt-4 border-t border-slate-100 pt-4 pl-7">
          <QuestionForm
            initial={{ q: q.q, type: q.type, point: q.point, followUp: q.followUp, expected: q.expected.join('\n') }}
            submitLabel="保存修改"
            onSubmit={(v) => {
              onPatch({ id: q.id, ...formToPatch(v) })
              setEditing(false)
            }}
            onCancel={() => setEditing(false)}
          />
        </div>
      )}

      <ConfirmModal
        open={confirming}
        title={`删除问题 ${num}？`}
        body="删除后不可恢复；如只是暂时不问，可以使用「隐藏此题」。"
        confirmLabel="删除"
        danger
        onConfirm={() => {
          setConfirming(false)
          onRemove()
        }}
        onCancel={() => setConfirming(false)}
      />
    </article>
  )
}
