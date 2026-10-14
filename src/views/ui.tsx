import type { ReactNode } from 'react'

export function Label({ children }: { children: ReactNode }) {
  return <div className="text-xs font-semibold text-[#6e6e73]">{children}</div>
}

export function SectionHead({ title, sub }: { no?: string; title: string; sub?: string }) {
  return (
    <div className="mb-4 flex items-end justify-between">
      <h2 className="text-xl font-bold tracking-tight text-[#1d1d1f]">{title}</h2>
      {sub && <span className="hidden text-xs text-[#6e6e73] md:block">{sub}</span>}
    </div>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`ws-paper rounded-2xl ${className}`}>{children}</div>
}

export function Btn({
  children,
  onClick,
  variant = 'solid',
  className = '',
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'solid' | 'ghost' | 'accent'
  className?: string
}) {
  const base =
    'inline-flex h-9 items-center justify-center gap-1.5 rounded-full px-4 text-xs font-medium cursor-pointer tracking-tight transition-all duration-150 select-none'

  const v =
    variant === 'solid' || variant === 'accent'
      ? 'bg-gradient-to-b from-[#2c2c2e] to-[#121214] text-white shadow-[0_2px_6px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.22)] hover:from-[#3a3a3d] hover:to-[#1c1c1f] border border-black/80 active:scale-95 font-medium'
      : 'bg-white text-[#1d1d1f] border border-black/[0.12] shadow-[0_1px_2px_rgba(0,0,0,0.04),inset_0_1px_0_#ffffff] hover:bg-black/[0.03] hover:border-black/25 active:scale-95 font-medium'

  return (
    <button onClick={onClick} className={`${base} ${v} ${className}`}>
      {children}
    </button>
  )
}

/** 统一 5 分制 */
export function ScoreStamp({ score }: { score: number }) {
  const color = score >= 4 ? 'text-emerald-600' : score >= 3.2 ? 'text-[#1d1d1f]' : 'text-amber-600'
  return (
    <span className={`text-base font-bold tabular-nums ${color}`}>
      {score.toFixed(1)}
      <span className="ml-0.5 text-xs font-normal text-[#86868b]">/5</span>
    </span>
  )
}
