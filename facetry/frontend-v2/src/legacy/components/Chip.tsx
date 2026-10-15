import type { ReactNode } from 'react'

type Tone = 'slate' | 'emerald' | 'amber' | 'ink' | 'blue'

const tones: Record<Tone, string> = {
  slate: 'bg-slate-100 text-slate-600',
  emerald: 'bg-emerald-50 text-emerald-700',
  amber: 'bg-amber-50 text-amber-700',
  ink: 'bg-[#1d2939] text-white',
  blue: 'bg-blue-50 text-blue-600',
}

export function Chip({ children, tone = 'slate', className = '' }: { children: ReactNode; tone?: Tone; className?: string }) {
  return <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs ${tones[tone]} ${className}`}>{children}</span>
}
