import type { ReactNode } from 'react'

export function Label({ children }: { children: ReactNode }) {
  return <div className="text-xs font-medium text-slate-500">{children}</div>
}

export function SectionHead({ title, sub }: { no?: string; title: string; sub?: string }) {
  return (
    <div className="mb-4 flex items-end justify-between">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {sub && <span className="hidden text-sm text-slate-400 md:block">{sub}</span>}
    </div>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`ws-paper rounded-xl ${className}`}>{children}</div>
}

export function Btn({ children, onClick, variant = 'solid', className = '' }: { children: ReactNode; onClick?: () => void; variant?: 'solid' | 'ghost' | 'accent'; className?: string }) {
  const base = 'inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-medium ws-press focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 cursor-pointer'
  // accent 为琥珀色，只给每屏「现在该做的事」
  const v = variant === 'solid'
    ? 'bg-blue-600 text-white hover:bg-blue-700'
    : variant === 'accent'
      ? 'bg-amber-400 text-[#1d2939] hover:bg-amber-300'
      : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
  return <button onClick={onClick} className={`${base} ${v} ${className}`}>{children}</button>
}

/** 统一 5 分制 */
export function ScoreStamp({ score }: { score: number }) {
  const color = score >= 4 ? 'text-emerald-600' : score >= 3.2 ? 'text-slate-900' : 'text-amber-600'
  return <span className={`text-base font-semibold tabular-nums ${color}`}>{score.toFixed(1)}<span className="ml-0.5 text-xs font-normal text-slate-400">/5</span></span>
}
