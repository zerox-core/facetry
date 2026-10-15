import { useEffect } from 'react'
import type { Phase, QuestionPatch, Section } from '../types'
import { Chip } from './Chip'
import { kindLabels } from './PdfViewer'
import { QuestionCard } from './QuestionCard'

type Props = {
  section: Section
  /** 板块序号（与 PDF 标记一致，1 起） */
  index: number
  qIndex: Map<string, number>
  phase: Phase
  onPatch: (patch: QuestionPatch) => void
  onRemove: (questionId: string) => void
  onClose: () => void
}

/** 窄屏（<lg）点标记弹出的底部抽屉：完整题目卡，评分/编辑/备注与右侧面板一致 */
export function SectionSheet({ section, index, qIndex, phase, onPatch, onRemove, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-[#1d2939]/50" onClick={onClose} />
      <div className="ws-paper ws-sheet-up absolute inset-x-0 bottom-0 flex max-h-[82vh] flex-col rounded-t-2xl" role="dialog" aria-modal="true">
        <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-slate-200" aria-hidden="true" />
        <div className="flex shrink-0 items-center gap-2 px-5 pb-3 pt-3">
          <span className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full bg-[#1d2939] text-[11px] font-semibold text-white tabular-nums">
            {index}
          </span>
          <h3 className="min-w-0 flex-1 truncate text-base font-semibold text-slate-900">{section.title}</h3>
          <Chip tone="blue">{kindLabels[section.kind] || '简历经历'}</Chip>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="shrink-0 cursor-pointer text-slate-400 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M6 6l12 12 M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-6">
          {section.questions.length ? (
            section.questions.map((q) => (
              <QuestionCard
                key={q.id}
                q={q}
                index={qIndex.get(q.id) || 0}
                phase={phase}
                onPatch={onPatch}
                onRemove={() => onRemove(q.id)}
                onHover={() => {}}
              />
            ))
          ) : (
            <p className="py-8 text-center text-sm text-slate-400">该板块暂无问题</p>
          )}
        </div>
      </div>
    </div>
  )
}
