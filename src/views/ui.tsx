import { useEffect, useRef, type ReactNode } from 'react'

/* ───────────── 项目共享组件（daisyUI 模式 B）─────────────
   颜色一律来自 daisyUI 语义色（主题 facetry，定义在 src/index.css）；
   阴影 / 圆角 / 动效沿用项目令牌 --shadow-paper / --shadow-lift / --dur-*。
   不要再往这里写死 hex 或 Tailwind 固定色（emerald-500 这类），否则主题会分叉。 */

export function Label({ children }: { children: ReactNode }) {
  return <div className="text-xs font-semibold text-base-content/60">{children}</div>
}

export function SectionHead({ title, sub }: { no?: string; title: string; sub?: string }) {
  return (
    <div className="mb-4 flex items-end justify-between">
      <h2 className="text-xl font-bold tracking-tight text-base-content">{title}</h2>
      {sub && <span className="hidden text-xs text-base-content/60 md:block">{sub}</span>}
    </div>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card card-border bg-base-100 shadow-[var(--shadow-paper)] ${className}`}>{children}</div>
}

/* ───────────── 状态徽标：浅底 + 深字（badge-soft），语义色统一出口 ───────────── */
export type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'error' | 'info' | 'ghost'

/* 深色时代补丁已废：neutral=墨黑药丸、accent=荧光青柠实底（badge-soft 的浅字在白底不可读）。 */
const CHIP_TONE: Record<Tone, string> = {
  neutral: 'bg-neutral text-neutral-content',
  accent: 'bg-accent text-accent-content',
  success: 'badge-success',
  warning: 'badge-warning',
  error: 'badge-error',
  info: 'badge-info',
  ghost: 'badge-ghost',
}

export function Chip({
  tone = 'ghost',
  children,
  className = '',
  title,
}: {
  tone?: Tone
  children: ReactNode
  className?: string
  title?: string
}) {
  return (
    <span title={title} className={`badge badge-sm badge-soft gap-1 border-none font-medium ${CHIP_TONE[tone]} ${className}`}>
      {children}
    </span>
  )
}

/* ───────────── 按钮：胶囊形，type 默认 button（避免在 <form> 里误触发提交）───────────── */
export type BtnVariant = 'solid' | 'primary' | 'ghost' | 'outline' | 'accent' | 'danger' | 'neutral' | 'soft' | 'link'

const BTN_VARIANT: Record<BtnVariant, string> = {
  solid: 'btn-primary',
  primary: 'btn-primary',
  ghost: 'btn-ghost',
  outline: 'btn-outline border-base-300 bg-base-100 text-base-content hover:bg-base-200',
  accent: 'btn-accent',
  danger: 'btn-error',
  neutral: 'btn-neutral',
  soft: 'btn-soft',
  link: 'btn-link',
}

export function Btn({
  children,
  onClick,
  variant = 'solid',
  className = '',
  type = 'button',
  disabled = false,
  loading = false,
  title,
  ariaLabel,
}: {
  children: ReactNode
  onClick?: () => void
  variant?: BtnVariant
  className?: string
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
  loading?: boolean
  title?: string
  ariaLabel?: string
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      title={title}
      aria-label={ariaLabel}
      aria-busy={loading || undefined}
      className={`btn h-9 min-h-9 gap-1.5 rounded-full px-4 text-xs font-medium tracking-tight ${BTN_VARIANT[variant]} ${
        disabled ? 'btn-disabled' : ''
      } ${className}`}
    >
      {loading && <span className="loading loading-spinner loading-xs" aria-hidden="true" />}
      {children}
    </button>
  )
}

/* ───────────── 表单：label 与控件必须关联（htmlFor + id 由调用方配对）───────────── */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className = '',
}: {
  label: string
  htmlFor?: string
  hint?: string
  error?: string
  required?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-xs font-semibold text-base-content/60" htmlFor={htmlFor}>
        {label}
        {required && <span className="ml-0.5 text-error">*</span>}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-[11px] text-error">{error}</p>
      ) : (
        hint && <p className="mt-1 text-[11px] text-base-content/50">{hint}</p>
      )}
    </div>
  )
}

/* ───────────── 弹窗：原生 <dialog>，自带焦点锁定 / Esc 关闭 / 遮罩语义 ───────────── */
export function Modal({
  open,
  onClose,
  title,
  sub,
  children,
  footer,
  className = '',
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  sub?: ReactNode
  children: ReactNode
  footer?: ReactNode
  className?: string
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  if (!open) return null

  return (
    <dialog
      ref={ref}
      className="modal modal-open"
      aria-label={typeof title === 'string' ? title : undefined}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
    >
      <div className={`modal-box w-full max-w-lg rounded-2xl border border-base-300 bg-base-100 p-0 ${className}`}>
        <div className="flex items-start justify-between gap-3 border-b border-base-300 px-5 py-4">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-base-content">{title}</h3>
            {sub && <p className="mt-0.5 text-xs text-base-content/60">{sub}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="关闭" className="btn btn-ghost btn-sm btn-circle shrink-0">
            ✕
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="modal-action m-0 flex items-center justify-end gap-2 border-t border-base-300 px-5 py-3.5">
            {footer}
          </div>
        )}
      </div>
    </dialog>
  )
}

/* ───────────── 空态 ───────────── */
export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <div className="text-sm font-medium text-base-content/70">{title}</div>
      {hint && <div className="max-w-sm text-xs text-base-content/50">{hint}</div>}
      {action}
    </div>
  )
}

/** 统一 5 分制 */
export function ScoreStamp({ score }: { score: number }) {
  const color = score >= 4 ? 'text-success' : score >= 3.2 ? 'text-base-content' : 'text-warning'
  return (
    <span className={`text-base font-bold tabular-nums ${color}`}>
      {score.toFixed(1)}
      <span className="ml-0.5 text-xs font-normal text-base-content/50">/5</span>
    </span>
  )
}
