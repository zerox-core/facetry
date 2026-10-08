import { useEffect, useRef, useState } from 'react'
import type { BankQuestion } from '../types'
import { useBank } from '../views/shared'
import { bankSearchCls, filterBank, PartCapsules } from './BankBits'
import { Chip } from './Chip'
import { Spinner } from './ui'

type Props = {
  open: boolean
  onClose: () => void
  onPick: (q: BankQuestion) => void
}

/** 从题库选题的浮层：保持打开可连续添加多题，Esc 或右上角关闭 */
export function BankPicker({ open, onClose, onPick }: Props) {
  const { bank, error, reload } = useBank()
  const [part, setPart] = useState('')
  const [search, setSearch] = useState('')
  const [added, setAdded] = useState<Set<string>>(new Set())

  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    setAdded(new Set())
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  if (!open) return null
  const list = bank ? filterBank(bank, part, search) : []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-[#1d2939]/50" onClick={onClose} />
      <div className="ws-paper login-fade relative flex max-h-[80vh] w-full max-w-xl flex-col rounded-xl" role="dialog" aria-modal="true">
        <div className="flex items-center justify-between px-5 pt-4">
          <h3 className="text-base font-semibold text-slate-900">从题库选择</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="cursor-pointer text-slate-400 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12 M18 6L6 18" /></svg>
          </button>
        </div>
        <div className="space-y-3 px-5 pt-3">
          {bank && <PartCapsules bank={bank} value={part} onChange={setPart} />}
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索标题、题干或答案…" className={`${bankSearchCls} sm:w-full`} />
        </div>
        <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto px-5 pb-5">
          {!bank && !error && (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-400">
              <Spinner /> 正在加载题库…
            </div>
          )}
          {error && (
            <div className="py-10 text-center">
              <p className="text-sm text-amber-700">{error}</p>
              <button
                type="button"
                onClick={() => void reload(true)}
                className="mt-3 cursor-pointer text-sm font-medium text-blue-600 hover:text-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                重试
              </button>
            </div>
          )}
          {bank && !list.length && <p className="py-10 text-center text-sm text-slate-400">没有匹配的题目</p>}
          {list.map((b) => {
            const isAdded = added.has(b.id)
            return (
              <div key={b.id} className="flex items-start gap-3 rounded-lg bg-slate-50 px-4 py-3">
                <Chip className="mt-0.5 shrink-0">{b.custom ? '自定义' : b.id}</Chip>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-900">{b.title || b.q}</div>
                  {b.title && <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-slate-500">{b.q}</p>}
                </div>
                <button
                  type="button"
                  disabled={isAdded}
                  onClick={() => {
                    onPick(b)
                    setAdded((s) => new Set(s).add(b.id))
                  }}
                  className={`shrink-0 cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                    isAdded ? 'cursor-default bg-emerald-50 text-emerald-600' : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {isAdded ? '✓ 已添加' : '添加'}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
