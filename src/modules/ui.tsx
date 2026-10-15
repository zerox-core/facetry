import type { ReactNode } from 'react'

export const TONE = {
  gray: { fg: '#5f6b78', bg: '#eceae3' }, blue: { fg: '#2f6f9a', bg: '#e1edf5' }, amber: { fg: '#8a6410', bg: '#f6ecd0' },
  violet: { fg: '#7a4f9a', bg: '#efe6f5' }, green: { fg: '#3f7a3a', bg: '#e3f0df' }, red: { fg: '#a8483a', bg: '#f6e3df' },
}
export type Tone = keyof typeof TONE

export const Pill = ({ t, children, dot = true }: { t: Tone; children: ReactNode; dot?: boolean }) => (
  <span className="inline-flex items-center gap-1.5 px-2 h-5 rounded-[3px] text-[11.5px] font-medium whitespace-nowrap" style={{ color: TONE[t].fg, background: TONE[t].bg }}>
    {dot && <span className="w-1.5 h-1.5 rounded-full" style={{ background: TONE[t].fg }} />}{children}
  </span>
)

export const Th = ({ children, w, r }: { children?: ReactNode; w?: string; r?: boolean }) => (
  <th className={`sticky top-0 z-10 bg-[#f8f6f0] border-b border-line px-3 h-9 font-medium text-[11.5px] text-ink/55 whitespace-nowrap ${r ? 'text-right' : 'text-left'}`} style={{ width: w }}>{children}</th>
)

export const Sec = ({ t, extra, children }: { t: string; extra?: ReactNode; children: ReactNode }) => (
  <section className="border-b border-line/80 px-5 py-4">
    <div className="flex items-center mb-3"><span className="w-[3.5px] h-3.5 bg-amber rounded-full mr-2.5" /><h3 className="text-[13px] font-semibold text-ink">{t}</h3><div className="ml-auto text-[11.5px] text-ink/50">{extra}</div></div>
    {children}
  </section>
)

export function Spark({ d }: { d: number[] }) {
  const mx = Math.max(...d), mn = Math.min(...d)
  const pts = d.map((v, i) => [(i / (d.length - 1)) * 72, 21 - ((v - mn) / (mx - mn || 1)) * 18])
  return <svg viewBox="0 0 72 24" className="w-[72px] h-6"><polyline points={pts.map(p => p.join(',')).join(' ')} fill="none" stroke="#d7a62a" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" /><circle cx="72" cy={pts.at(-1)![1]} r="2.5" fill="#d7a62a" /></svg>
}

export type K = { k: string; v: ReactNode; u?: string; d: string; s: number[]; warn?: boolean }
export const Kpis = ({ items }: { items: K[] }) => (
  <div className="shrink-0 px-5 pt-3.5 pb-1 grid gap-3.5" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
    {items.map(k => (
      <div key={k.k} className="panel-card rounded-[5px] px-4 py-3 flex items-end justify-between hover:shadow-md transition-all duration-200 bg-paper">
        <div><div className="text-[11.5px] text-ink/50 font-medium">{k.k}</div><div className="font-serif text-[26px] font-bold leading-tight tnum mt-0.5 text-ink">{k.v}<span className="text-[12px] font-sans font-normal text-ink/45 ml-0.5">{k.u}</span></div><div className={`text-[11px] mt-0.5 ${k.warn ? 'text-[#a8483a] font-medium' : 'text-ink/50'}`}>{k.d}</div></div>
        <Spark d={k.s} />
      </div>
    ))}
  </div>
)

export const Tabs = ({ items, v, set, right }: { items: ReactNode[]; v: number; set: (i: number) => void; right?: ReactNode }) => (
  <div className="flex items-center h-11 px-4 border-b border-line gap-1.5 shrink-0 bg-paper/50">
    {items.map((t, i) => <button key={i} onClick={() => set(i)} className={`relative h-full px-3 text-[12.5px] transition-colors cursor-pointer ${v === i ? 'text-ink font-semibold' : 'text-ink/55 hover:text-ink'}`}>{t}{v === i && <span className="absolute inset-x-2.5 bottom-0 h-[2.5px] bg-amber rounded-t-sm" />}</button>)}
    <div className="ml-auto flex gap-2">{right}</div>
  </div>
)

export const Btn = ({ children, primary, danger, onClick, disabled, className = '' }: { children: ReactNode; primary?: boolean; danger?: boolean; onClick?: () => void; disabled?: boolean; className?: string }) => (
  <button onClick={onClick} disabled={disabled} className={`h-8 px-3.5 text-[12.5px] font-medium rounded-[4px] cursor-pointer transition-all duration-150 disabled:opacity-35 disabled:cursor-not-allowed ${primary ? 'bg-amber text-base font-semibold shadow-xs hover:shadow hover:brightness-105 active:scale-[0.99]' : danger ? 'border border-[#e6c6bf] text-[#a8483a] bg-paper hover:bg-[#f6e3df] active:scale-[0.99]' : 'border border-line bg-paper text-ink/80 hover:bg-[#f5f3ec] hover:border-[#d6d0c2] shadow-2xs active:scale-[0.99]'} ${className}`}>{children}</button>
)

export const Field = ({ k, v }: { k: string; v: ReactNode }) => <div className="min-w-0"><div className="text-[11px] text-ink/50 font-normal">{k}</div><div className="mt-1 text-[13px] font-medium text-ink truncate">{v}</div></div>

export function useToast() {
  return (m: string) => window.dispatchEvent(new CustomEvent('toast', { detail: m }))
}
