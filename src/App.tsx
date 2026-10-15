import { useEffect, useState } from 'react'
import Talent from './modules/Talent'
import Interviews from './modules/Interviews'
import Reviews from './modules/Reviews'
import Offers from './modules/Offers'
import Jobs from './modules/Jobs'

const MODS = [
  { k: '人才库', c: Talent }, { k: '面试', c: Interviews, n: 6 }, { k: '面评', c: Reviews, n: 3 },
  { k: 'Offer', c: Offers, n: 2 }, { k: '岗位与 JD', c: Jobs },
]

export default function App() {
  const [m, setM] = useState(0)
  const [toast, setToast] = useState<string | null>(null)
  useEffect(() => {
    let t: number
    const h = (e: Event) => { setToast((e as CustomEvent).detail); clearTimeout(t); t = window.setTimeout(() => setToast(null), 1800) }
    window.addEventListener('toast', h); return () => window.removeEventListener('toast', h)
  }, [])
  const Mod = MODS[m].c
  return (
    <div className="h-full flex flex-col">
      <header className="h-[52px] shrink-0 bg-base text-white/70 flex items-center px-5 gap-7 shadow-[0_2px_10px_rgba(0,0,0,0.18)] z-30">
        <div className="flex items-center gap-2.5"><span className="w-7 h-7 rounded-[3px] bg-amber text-base font-serif font-black flex items-center justify-center text-[14px] shadow-sm">知</span><span className="text-paper font-semibold text-[14px] tracking-wide">知马 · 人才招聘工作台</span></div>
        <nav className="flex h-full">{MODS.map((x, i) => (
          <button key={x.k} onClick={() => setM(i)} className={`relative px-4 h-full text-[13px] font-medium transition-colors cursor-pointer ${i === m ? 'text-paper font-semibold' : 'text-white/65 hover:text-white'}`}>
            {x.k}{x.n && <span className="ml-1.5 text-[10.5px] px-1.5 py-0.5 rounded-full bg-amber text-base font-bold leading-none">{x.n}</span>}
            {i === m && <span className="absolute inset-x-3 bottom-0 h-[2.5px] bg-amber rounded-t-sm" />}
          </button>))}
        </nav>
        <div className="ml-auto flex items-center gap-5">
          <div className="relative"><input placeholder="全局搜索 候选人 / 岗位 / 编号" className="w-72 h-8 bg-white/[.08] hover:bg-white/[.11] focus:bg-white/[.14] border border-white/10 focus:border-amber/60 rounded-[4px] pl-8 pr-9 text-[12.5px] text-paper placeholder:text-white/35 outline-none transition-all" /><svg viewBox="0 0 24 24" className="w-3.5 h-3.5 absolute left-2.5 top-[9px] text-white/40" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg><kbd className="absolute right-2 top-[6.5px] font-mono text-[10px] text-white/40 bg-white/10 px-1 py-0.5 rounded-[2px]">⌘K</kbd></div>
          <span className="text-[11.5px] text-white/55 bg-white/[.06] px-2.5 py-1 rounded-[3px] border border-white/5">2025 Q1 校社招</span>
          <div className="flex items-center gap-2.5 pl-1"><span className="w-7 h-7 rounded-full bg-[#3b4856] text-[12px] font-medium flex items-center justify-center text-paper ring-1 ring-white/15">王</span><span className="text-[12.5px] text-paper/90 font-medium">王璐 · HR</span></div>
        </div>
      </header>
      <div key={m} className="flex-1 min-h-0 rise"><Mod /></div>
      {toast && <div className="rise fixed bottom-6 left-1/2 -translate-x-1/2 bg-base text-paper text-[13px] px-5 py-2.5 rounded-[4px] shadow-2xl flex items-center gap-2.5 z-50 border border-white/10"><span className="w-2 h-2 rounded-full bg-amber shadow-[0_0_8px_rgba(215,166,42,0.8)]" />{toast}</div>}
    </div>
  )
}
