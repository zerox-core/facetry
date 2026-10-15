import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export type SelectOption = { value: string; label: string; hint?: string }

/**
 * 统一风格的下拉选择：按钮 + 浮层列表（非原生 select），与整体 UI 一致。
 * 浮层通过 portal 挂到 body 并用 fixed 定位，不受 ws-rise 动画/transform 祖先影响，也不会被弹窗滚动容器裁剪。
 */
export function Select({
  value,
  onChange,
  options,
  placeholder = '请选择…',
  className = '',
  size = 'md',
}: {
  value: string
  onChange: (v: string) => void
  options: SelectOption[]
  placeholder?: string
  className?: string
  size?: 'sm' | 'md'
}) {
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState<{ left: number; width: number; top: number; up: boolean } | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const popRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (wrapRef.current?.contains(t) || popRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const onScroll = (e: Event) => {
      // 浮层自身滚动不关闭
      if (popRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open])

  const current = options.find((o) => o.value === value)
  const sizeCls = size === 'sm' ? 'h-7 rounded-md px-2 text-xs' : 'h-10 rounded-lg px-3 text-sm'

  const toggle = () => {
    if (!open && wrapRef.current) {
      const r = wrapRef.current.getBoundingClientRect()
      const up = r.bottom + 280 > window.innerHeight && r.top > 280
      setRect({ left: r.left, width: r.width, top: up ? r.top : r.bottom + 4, up })
    }
    setOpen(!open)
  }

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className={`flex w-full cursor-pointer items-center gap-2 border border-slate-200 bg-white transition-colors hover:border-slate-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${sizeCls}`}
      >
        <span className={`min-w-0 flex-1 truncate text-left ${current ? 'text-slate-900' : 'text-slate-400'}`}>{current ? current.label : placeholder}</span>
        <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open &&
        rect &&
        createPortal(
          <div
            ref={popRef}
            className="ws-paper login-fade fixed z-[60] max-h-64 overflow-y-auto rounded-xl p-1 shadow-[var(--shadow-lift)]"
            style={{ left: rect.left, width: rect.width, ...(rect.up ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.top }) }}
            role="listbox"
          >
            {options.map((o) => (
            <button
              key={o.value || '__empty__'}
              type="button"
              role="option"
              aria-selected={o.value === value}
              onClick={() => {
                onChange(o.value)
                setOpen(false)
              }}
              className={`flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors duration-100 ${
                o.value === value ? 'bg-blue-50 font-medium text-blue-700' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span className="min-w-0 flex-1 truncate">{o.label}</span>
              {o.hint && <span className="shrink-0 text-xs text-slate-400">{o.hint}</span>}
              {o.value === value && (
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12l4 4L19 6" />
                </svg>
              )}
            </button>
          ))}
          {!options.length && <p className="px-3 py-3 text-center text-xs text-slate-400">暂无可选项</p>}
          </div>,
          document.body,
        )}
    </div>
  )
}
