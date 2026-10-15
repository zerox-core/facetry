import { useEffect } from 'react'
import type { ReactNode } from 'react'

type Props = {
  open: boolean
  title: string
  body?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** 二次确认弹窗：破坏性操作统一走这里，Esc 关闭 */
export function ConfirmModal({ open, title, body, confirmLabel = '确认', cancelLabel = '取消', danger, onConfirm, onCancel }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onCancel])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-[#1d2939]/50" onClick={onCancel} />
      <div className="ws-paper login-fade relative w-full max-w-sm rounded-xl p-5" role="dialog" aria-modal="true">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        {body && <div className="mt-2 text-sm text-slate-500">{body}</div>}
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="h-10 cursor-pointer rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 ws-press hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            autoFocus
            className={`h-10 cursor-pointer rounded-lg px-4 text-sm font-medium text-white ws-press focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
              danger ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
