import { useEffect, useRef, useState } from 'react'

// 登录页中央：一份可以动手的简历。默认自动演示「导入 → 标注 → 追问 → 记录」，一旦点击就交给用户操作
const STEPS = ['导入简历', '自动标注', '生成追问', '现场记录']
// 每步停留 = 该步动画时长 + 约 0.4s 停顿，动画本身保持原速，只压缩步骤之间的空等
const DURS = [900, 1500, 1800, 2900]

const LINES = [
  { text: '主导双十一大促性能优化，首屏由 8.2s 压到 0.3s', mark: 'hi' as const },
  { text: '一人维护 108 个微服务，自称「全年零宕机」' },
  { text: '精通 43 门编程语言，含自创的「锤语言」', mark: 'risk' as const },
]
const TONE = {
  hi: { hl: '#d1fae5', dot: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200', t: '亮点' },
  risk: { hl: '#fde68a', dot: 'bg-amber-500', chip: 'bg-amber-50 text-amber-700 ring-amber-200', t: '待核实' },
}
const POINTS = ['说清三门语言的差异', '给出时间复杂度', '现场写一段锤语言']

export default function LoginShowcase() {
  const [step, setStep] = useState(0)
  const [paused, setPaused] = useState(false)
  // 动手模式：用户接管后停止自动播放
  const [manual, setManual] = useState(false)
  const [hover, setHover] = useState<number | null>(null)
  const [asked, setAsked] = useState(false)
  const [checks, setChecks] = useState<number[]>([])
  const [score, setScore] = useState<number | null>(null)
  // 动手模式下「现场记录」需单独展开，与生成追问分成两步
  const [rec, setRec] = useState(false)
  // 每行经历的纵向位置，用于让页边批注与对应行对齐
  const lineRefs = useRef<(HTMLLIElement | null)[]>([])
  const [tops, setTops] = useState<number[]>([150, 186, 222])

  useEffect(() => {
    if (paused || manual) return
    const t = setTimeout(() => setStep((s) => (s + 1) % STEPS.length), DURS[step])
    return () => clearTimeout(t)
  }, [step, paused, manual])

  // 纸张可能在首帧不可见（offsetTop 为 0），因此随步骤重新测量并保底
  useEffect(() => {
    const next = lineRefs.current.map((el, i) => (el && el.offsetTop > 0 ? el.offsetTop : 150 + i * 36))
    setTops((prev) => (prev.join() === next.join() ? prev : next))
  }, [step, manual])
  // 追问便签放在待核实那一行下方，避免遮住页边概要和标题
  const noteTop = Math.max(tops[2] + 34, 170)
  // 进入现场记录时便签向下展开，同时整体上移，保证展开后仍完整留在纸面内
  const NOTE_LIFT = 72

  const takeOver = () => {
    if (manual) return
    setManual(true)
    setAsked(step >= 2)
    setRec(step >= 3)
    setChecks(step >= 3 ? [0, 1] : [])
    setScore(step >= 3 ? 4 : null)
  }
  const replay = () => { setManual(false); setAsked(false); setRec(false); setChecks([]); setScore(null); setStep(0) }
  const jump = (i: number) => { replay(); setStep(i) }

  const marked = manual || step >= 1
  const showNote = manual ? asked : step >= 2
  const recording = manual ? asked && rec : step >= 3
  const current = manual ? (rec ? 3 : asked ? 2 : 1) : step

  return (
    <div className="w-full">
      <div
        className="login-paper relative text-slate-900"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => { setPaused(false); setHover(null) }}
        onPointerDown={takeOver}
      >
        {/* 回形针 */}
        <svg viewBox="0 0 24 60" className="pointer-events-none absolute -top-5 left-12 h-14 w-6 text-blue-600" aria-hidden>
          <path d="M8 44V12a5 5 0 0 1 10 0v34a8 8 0 0 1-16 0V16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>

        <div className="grid grid-cols-[minmax(0,1fr)_184px]">
          {/* 正文 */}
          <div className="relative overflow-hidden px-7 pb-6 pt-7">
            <div className="flex items-start gap-4">
              <Avatar />
              <div className="min-w-0 flex-1 pt-1">
                <div className="text-xl font-semibold text-slate-900">钱多多</div>
                <div className="mt-1 text-sm text-slate-500">宇宙级全栈工程师 · 12 年 · 火星（可远程）</div>
                <div className="mt-1.5 text-xs text-slate-400">期望薪资：面议，但希望配一台咖啡机</div>
              </div>
            </div>
            <div className="mt-5 border-t border-slate-100 pt-4 text-xs text-slate-400">工作经历 · 2012 — 至今</div>
            <ul className="mt-3 space-y-2.5">
              {LINES.map((l, i) => {
                const tone = l.mark && TONE[l.mark]
                const on = marked && !!tone
                const lit = hover === i || (!manual && step >= 2 && l.mark === 'risk')
                const dim = !manual && step >= 2 && l.mark !== 'risk'
                return (
                  <li
                    key={i}
                    ref={(el) => { lineRefs.current[i] = el }}
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                    onClick={() => l.mark === 'risk' && setAsked(true)}
                    className={`-mx-2 flex gap-2.5 rounded-md px-2 py-1.5 text-[14px] leading-6 transition-all duration-300 ${dim ? 'opacity-40' : ''} ${lit ? 'bg-slate-50' : ''} ${l.mark === 'risk' ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <span className={`mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full transition-colors duration-300 ${on ? tone.dot : 'bg-slate-200'}`} style={{ transitionDelay: on && !manual ? `${i * 200}ms` : '0ms' }} />
                    <span className="text-slate-700">
                      <span
                        className="bg-no-repeat transition-[background-size] duration-700 ease-out"
                        style={{ backgroundImage: tone ? `linear-gradient(${tone.hl},${tone.hl})` : undefined, backgroundPosition: '0 90%', backgroundSize: on ? '100% 0.45em' : '0% 0.45em', transitionDelay: on && !manual ? `${i * 200}ms` : '0ms' }}
                      >{l.text}</span>
                    </span>
                  </li>
                )
              })}
            </ul>
            <div className="mt-5 text-xs text-slate-400">项目经历</div>
            <div className="mt-2 text-[13px] leading-6 text-slate-600">
              <div><span className="font-medium text-slate-800">月球基地前端控制台</span><span className="ml-2 text-xs text-slate-400">2023 — 2024 · 唯一负责人</span></div>
              <div className="text-slate-500">在断网环境下独立完成开发，据本人称「已被航天局借鉴」</div>
            </div>
            <div className="mt-4 text-xs text-slate-400">技能</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {['React', '43 门语言', '徒手写编译器', '通宵', '摸鱼（已戒）'].map((t) => <span key={t} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{t}</span>)}
            </div>
            {!manual && step === 0 && <div className="login-scan pointer-events-none absolute inset-x-6 h-6 border-b-2 border-blue-500/50 bg-blue-50/60" />}
          </div>

          {/* 页边：标注标签与追问便签 */}
          <div className="relative border-l border-dashed border-slate-200 bg-slate-50/40">
            {/* 页边顶部：分析概要，一开始就有内容 */}
            <div className="px-4 pt-7">
              <div className="flex items-baseline justify-between text-xs text-slate-400"><span>{marked ? '分析概要' : '解析中…'}</span><span>批注</span></div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-semibold tabular-nums text-slate-900">{marked ? 82 : '--'}</span>
                <span className="text-xs text-slate-400">岗位匹配度</span>
              </div>
              <div className="mt-2 flex gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />亮点 {marked ? 4 : '-'}</span>
                <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" />待核实 {marked ? 2 : '-'}</span>
              </div>
              {/* 分项评估：填满概要与行内批注之间的空档 */}
              <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-2.5">
                {[['技术深度', 88], ['项目真实度', 46], ['表达能力', 92]].map(([k, v], i) => (
                  <div key={k} className="flex items-center gap-2 text-[11px] text-slate-500">
                    <span className="w-[60px] shrink-0">{k}</span>
                    <span className="h-1 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <span className={`block h-full rounded-full transition-[width] duration-700 ease-out ${Number(v) < 60 ? 'bg-amber-400' : 'bg-blue-500'}`} style={{ width: marked ? `${v}%` : '0%', transitionDelay: marked && !manual ? `${i * 150}ms` : '0ms' }} />
                    </span>
                    <span className="w-5 text-right tabular-nums text-slate-700">{marked ? v : '-'}</span>
                  </div>
                ))}
              </div>
            </div>
            {showNote && (
              <div className="login-fade absolute -right-6 left-3 rotate-[0.6deg] rounded-md bg-amber-50 p-3.5 shadow-[0_10px_24px_-14px_rgba(120,80,0,0.45)] ring-1 ring-amber-200/80 transition-[top] duration-300 ease-[cubic-bezier(.2,.7,.2,1)]" style={{ top: recording ? Math.max(noteTop - NOTE_LIFT, 190) : noteTop }}>
                <span className="login-draw absolute right-full top-4 h-px w-12 origin-right bg-amber-400" />
                <div className="text-[11px] text-amber-700">第 5 题 · 简历核实</div>
                <p className="mt-1 text-[13px] font-medium leading-5 text-slate-900">请用你最熟悉的三门语言，分别实现一个 LRU 缓存？</p>
                {manual && asked && !rec && (
                  <button type="button" onClick={() => setRec(true)} className="login-fade mt-2.5 flex w-full cursor-pointer items-center justify-center gap-1 rounded border border-dashed border-amber-300 py-1 text-xs text-amber-700 transition-colors hover:bg-amber-100">开始现场记录 ↓</button>
                )}
                {/* 现场记录：常驻于追问卡内，通过 grid 行高 0fr → 1fr 向下展开 */}
                <div className={`grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(.2,.7,.2,1)] ${recording ? 'grid-rows-[1fr] opacity-100' : 'pointer-events-none grid-rows-[0fr] opacity-0'}`} aria-hidden={!recording}>
                  <div className="min-h-0 overflow-hidden">
                  <div className="mt-2.5 space-y-1.5 border-t border-amber-200/70 pt-2.5">
                    {POINTS.map((p, i) => {
                      const done = checks.includes(i)
                      return (
                        <button key={p} type="button" onClick={() => setChecks(done ? checks.filter((c) => c !== i) : [...checks, i])} className="flex w-full cursor-pointer items-center gap-2 text-left text-xs text-slate-600">
                          <span
                            className={`grid h-3.5 w-3.5 shrink-0 place-items-center rounded-[3px] border text-[9px] ${manual ? (done ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 text-transparent') : `border-slate-300 text-transparent ${recording ? 'login-check' : ''}`}`}
                            style={manual ? undefined : { animationDelay: i < 2 ? `${500 + i * 450}ms` : '99s' }}
                          >✓</span>{p}
                        </button>
                      )
                    })}
                    <div className="flex gap-1 pt-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button key={n} type="button" onClick={() => setScore(n)} className={`h-6 flex-1 cursor-pointer rounded text-[11px] transition ${manual ? (score === n ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-100') : `bg-white text-slate-500 ${n === 4 && recording ? 'login-pick' : ''}`}`}>{n}</button>
                      ))}
                    </div>
                  </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        {/* 纸张底部：步骤进度 + 提示，与正文同宽对齐 */}
        <div className="flex h-12 items-center justify-between gap-4 border-t border-slate-100 px-7 text-[13px]" onPointerDown={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-4">
            {STEPS.map((s, i) => (
              <button key={s} type="button" onClick={() => jump(i)} className={`flex cursor-pointer items-center gap-1.5 transition-colors ${i === current ? 'font-medium text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${i === current ? 'bg-blue-600' : i < current ? 'bg-slate-400' : 'bg-slate-300'}`} />{s}
              </button>
            ))}
          </div>
          {manual
            ? <button type="button" onClick={replay} className="cursor-pointer text-slate-500 hover:text-slate-900">↺ 重新演示</button>
            : <span className="text-slate-400">试试：点击标黄的一行</span>}
        </div>
      </div>
    </div>
  )
}

// 手绘动漫风头像：像一张贴在简历上的证件照
function Avatar() {
  return (
    <div className="shrink-0 -rotate-2 rounded-[3px] bg-white p-1 shadow-[0_1px_2px_rgba(0,0,0,0.15),0_6px_14px_-6px_rgba(0,0,0,0.35)] ring-1 ring-slate-200">
      <svg viewBox="0 0 80 96" className="h-[84px] w-[70px]" aria-label="候选人头像（手绘）">
        <rect width="80" height="96" fill="#dbe7f3" />
        <path d="M6 96c2-16 14-24 34-24s32 8 34 24z" fill="#334d70" stroke="#1d2939" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M33 70l7 8 7-8" fill="#fff" stroke="#1d2939" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M22 44c0-14 8-22 18-22s18 8 18 22c0 13-8 24-18 24S22 57 22 44z" fill="#fde7d6" stroke="#1d2939" strokeWidth="1.6" />
        <path d="M17 44c-3-18 7-32 23-32 17 0 27 12 24 31l-5-9-4 7-3-10-6 8-4-9-5 9-4-8-5 10z" fill="#2b2d42" stroke="#1d2939" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M36 10l3-7 3 8" fill="#2b2d42" stroke="#1d2939" strokeWidth="1.4" strokeLinejoin="round" />
        <ellipse cx="32.5" cy="46" rx="3.6" ry="4.6" fill="#1d2939" />
        <ellipse cx="47.5" cy="46" rx="3.6" ry="4.6" fill="#1d2939" />
        <circle cx="33.8" cy="44.4" r="1.3" fill="#fff" />
        <circle cx="48.8" cy="44.4" r="1.3" fill="#fff" />
        <path d="M28 39.5c2-1.6 5-1.8 7-.6M45 38.9c2-1.2 5-1 7 .6" fill="none" stroke="#1d2939" strokeWidth="1.4" strokeLinecap="round" />
        <ellipse cx="28" cy="53" rx="3" ry="1.6" fill="#f9a8a8" opacity="0.7" />
        <ellipse cx="52" cy="53" rx="3" ry="1.6" fill="#f9a8a8" opacity="0.7" />
        <path d="M36 57c2.5 2.4 5.5 2.4 8 0" fill="none" stroke="#1d2939" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M62 30l3-5M66 34l5-2M60 25l1-5" stroke="#f59e0b" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </div>
  )
}
