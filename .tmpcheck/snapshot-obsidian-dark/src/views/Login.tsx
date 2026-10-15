import { useEffect, useMemo, useState } from 'react'
import { Btn } from './ui'
import LoginShowcase from './LoginShowcase'

type Mode = 'feishu' | 'password'

// 伪二维码：固定种子生成的点阵 + 三个定位角
function QR({ dim }: { dim: boolean }) {
  const cells = useMemo(() => {
    let x = 7
    const out: [number, number][] = []
    for (let r = 0; r < 25; r++) for (let c = 0; c < 25; c++) {
      x = (x * 9301 + 49297) % 233280
      const finder = (r < 8 && c < 8) || (r < 8 && c > 16) || (r > 16 && c < 8)
      if (!finder && x / 233280 > 0.52) out.push([r, c])
    }
    return out
  }, [])
  const finder = (x: number, y: number) => (
    <g key={`${x}-${y}`}>
      <rect x={x} y={y} width={7} height={7} fill="currentColor" />
      <rect x={x + 1} y={y + 1} width={5} height={5} fill="white" />
      <rect x={x + 2} y={y + 2} width={3} height={3} fill="currentColor" />
    </g>
  )
  return (
    <svg viewBox="-1 -1 27 27" className={`h-full w-full text-slate-900 transition-opacity ${dim ? 'opacity-10' : ''}`} shapeRendering="crispEdges" aria-label="飞书登录二维码">
      {cells.map(([r, c]) => <rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} fill="currentColor" />)}
      {finder(0, 0)}{finder(18, 0)}{finder(0, 18)}
    </svg>
  )
}

export default function Login({ onLogin }: { onLogin: (name: string) => void }) {
  const [mode, setMode] = useState<Mode>('feishu')
  const [qr, setQr] = useState<'wait' | 'scanned' | 'expired'>('wait')
  const [account, setAccount] = useState('wanglei@facetry.cn')
  const [pwd, setPwd] = useState('')
  const [show, setShow] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  // 登录卡平时藏在简历纸背后，只露出一枚书签；点击后从纸后抽出
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [])

  // 二维码 60 秒过期
  useEffect(() => {
    if (mode !== 'feishu' || qr !== 'wait') return
    const t = setTimeout(() => setQr('expired'), 60000)
    return () => clearTimeout(t)
  }, [mode, qr])

  const finish = () => { setBusy(true); setTimeout(() => onLogin('王磊'), 900) }
  const scan = () => { setQr('scanned'); setTimeout(finish, 1200) }
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!account.trim()) return setErr('请输入企业邮箱或工号')
    if (pwd.length < 6) return setErr('密码至少 6 位')
    setErr('')
    finish()
  }

  const field = 'h-11 w-full rounded-lg border border-slate-200 bg-white px-3.5 text-[15px] outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'

  const body = (
    <>
          <h2 className="text-xl font-semibold text-slate-900">登录</h2>
          <p className="mt-1 text-sm text-slate-500">使用公司账号登录面试官工作台</p>

          <div className="mt-6 grid grid-cols-2 rounded-lg bg-slate-100 p-1 text-sm">
            {([['feishu', '飞书登录'], ['password', '账号密码']] as const).map(([k, t]) => (
              <button key={k} onClick={() => { setMode(k); setErr('') }} className={`h-9 cursor-pointer rounded-md transition ${mode === k ? 'bg-white font-medium text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>{t}</button>
            ))}
          </div>

          {mode === 'feishu' ? (
            <div className="mt-6">
              <div className="relative mx-auto h-44 w-44 rounded-xl border border-slate-200 p-4">
                <QR dim={qr !== 'wait'} />
                {qr === 'scanned' && (
                  <div className="absolute inset-0 grid place-items-center text-center">
                    <div><div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-emerald-600 text-lg text-white">✓</div><div className="mt-3 text-sm font-medium text-slate-900">扫码成功</div><div className="mt-0.5 text-xs text-slate-500">{busy ? '正在进入工作台…' : '请在飞书中确认登录'}</div></div>
                  </div>
                )}
                {qr === 'expired' && (
                  <button onClick={() => setQr('wait')} className="absolute inset-0 grid cursor-pointer place-items-center text-center">
                    <div><div className="text-sm font-medium text-slate-900">二维码已过期</div><div className="mt-1 text-sm text-blue-600">点击刷新</div></div>
                  </button>
                )}
              </div>
              <p className="mt-5 text-center text-sm text-slate-600">打开<span className="font-medium text-slate-900">飞书 App</span>，扫一扫登录</p>
              <div className="my-6 flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200" />或<span className="h-px flex-1 bg-slate-200" /></div>
              <Btn variant="ghost" className="w-full justify-center" onClick={finish}>
                <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden><path d="M3 5.5 10.5 3l6.5 6-6.5 8L3 14.5z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
                {busy ? '正在唤起飞书…' : '使用飞书客户端登录'}
              </Btn>
              <button onClick={scan} disabled={qr !== 'wait'} className="mt-3 w-full cursor-pointer text-center text-xs text-slate-400 hover:text-slate-600 disabled:cursor-default">演示：模拟扫码</button>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">企业邮箱 / 工号</span>
                <input value={account} onChange={(e) => setAccount(e.target.value)} autoComplete="username" className={`mt-1.5 ${field}`} placeholder="name@company.com" />
              </label>
              <label className="block">
                <span className="flex justify-between text-sm"><span className="font-medium text-slate-700">密码</span><a href="#" onClick={(e) => e.preventDefault()} className="text-slate-500 hover:text-slate-900">忘记密码</a></span>
                <span className="relative mt-1.5 block">
                  <input value={pwd} onChange={(e) => setPwd(e.target.value)} type={show ? 'text' : 'password'} autoComplete="current-password" autoFocus className={`${field} pr-14`} placeholder="至少 6 位" />
                  <button type="button" onClick={() => setShow(!show)} className="absolute inset-y-0 right-0 cursor-pointer px-3.5 text-sm text-slate-400 hover:text-slate-700">{show ? '隐藏' : '显示'}</button>
                </span>
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" defaultChecked className="h-4 w-4 accent-blue-600" />7 天内免登录</label>
              {err && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{err}</p>}
              <button type="submit" disabled={busy} className="h-11 w-full cursor-pointer rounded-lg bg-blue-600 text-[15px] font-medium text-white transition hover:bg-blue-700 disabled:bg-blue-400">{busy ? '登录中…' : '登录'}</button>
              <p className="text-center text-xs text-slate-400">演示环境：任意 6 位以上密码即可登录</p>
            </form>
          )}
    </>
  )

  return (
    <div className="login-desk relative flex min-h-screen flex-col overflow-hidden px-6 text-white sm:px-10">
      <header className="relative z-30 flex h-16 shrink-0 items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-md bg-white text-sm font-bold text-[#1d2939]">F</span>
        <span className="text-lg font-semibold">Facetry</span>
        <span className="ml-1 rounded px-1.5 py-0.5 text-xs text-slate-300 ring-1 ring-white/15">面试官工作台</span>
        <button onClick={() => setOpen(!open)} className="ml-auto hidden h-9 cursor-pointer rounded-lg bg-amber-400 px-5 text-sm font-semibold text-[#1d2939] transition hover:bg-amber-300 lg:block">{open ? '收起登录' : '登录'}</button>
      </header>

      {/* 大屏：桌面舞台。简历纸居中，登录卡藏在纸后，点击书签抽出 */}
      <main className="relative hidden flex-1 flex-col items-center justify-center py-6 lg:flex" onClick={() => open && setOpen(false)}>
        <div className={`text-center transition-all duration-500 ${open ? '-translate-x-[180px]' : ''}`}>
          <h1 className="text-[40px] font-semibold leading-tight tracking-tight">每一场面试，都从读懂简历开始</h1>
          <p className="mt-3 text-[15px] text-slate-400">
            导入简历，自动标出亮点与疑点，生成追问并现场记录。
            <button onClick={(e) => { e.stopPropagation(); setOpen(true) }} className="ml-3 inline-flex h-8 cursor-pointer items-center rounded-full bg-amber-400 px-4 text-sm font-semibold text-[#1d2939] transition hover:bg-amber-300">登录开始使用 →</button>
          </p>
        </div>

        <div className="relative mt-10 w-[640px] origin-top scale-[0.84] xl:scale-100">
          {/* 今日面试：压在纸下的一角 */}
          <div className={`absolute -left-44 top-10 w-60 -rotate-[5deg] rounded-md bg-[#f3efe6] p-4 pr-10 text-slate-700 shadow-[0_20px_40px_-18px_rgba(0,0,0,0.6)] transition-all duration-500 ${open ? '-translate-x-[200px] opacity-0' : ''}`} aria-hidden>
            <div className="text-xs text-slate-500">今日面试 · 9 月 30 日</div>
            {[['14:00', '刘一帆', '算法'], ['16:30', '何思雨', 'Java 后端']].map(([t, n, r]) => (
              <div key={n} className="mt-2.5 flex items-center gap-2.5 text-[13px]"><span className="tabular-nums text-slate-400">{t}</span><span className="font-medium">{n}</span><span className="text-xs text-slate-400">{r}</span></div>
            ))}
          </div>

          {/* 登录卡：在纸后，closed 时只露出右侧书签 */}
          <div
            onClick={(e) => { e.stopPropagation(); setOpen(true) }}
            className={`absolute right-0 top-12 z-0 w-[360px] rounded-xl bg-white px-8 pb-7 pt-8 text-slate-900 shadow-[0_2px_4px_rgba(0,0,0,0.1),0_30px_60px_-20px_rgba(0,0,0,0.55)] transition-all duration-500 ease-[cubic-bezier(.2,.8,.2,1)] ${open ? 'z-20 translate-x-[200px] rotate-[0.6deg]' : 'group cursor-pointer translate-x-0 hover:translate-x-[16px]'}`}
          >
            <span className="absolute inset-x-0 top-0 h-1 rounded-t-xl bg-amber-400" />
            {/* 书签：从纸后伸出的登录入口 */}
            <span className={`absolute left-full top-10 flex w-14 flex-col items-center gap-2 rounded-r-lg bg-amber-400 py-5 text-[15px] font-semibold text-[#1d2939] shadow-[6px_10px_24px_-10px_rgba(0,0,0,0.6)] transition-all duration-300 group-hover:bg-amber-300 ${open ? 'pointer-events-none opacity-0' : 'opacity-100'}`}>
              <span className="[writing-mode:vertical-rl] tracking-[0.2em]">登录工作台</span>
              <span className="login-nudge text-base">→</span>
            </span>
            <div className={`transition-opacity duration-300 ${open ? 'opacity-100 delay-200' : 'pointer-events-none opacity-0'}`}>
              <button onClick={(e) => { e.stopPropagation(); setOpen(false) }} className="absolute right-4 top-4 grid h-8 w-8 cursor-pointer place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="收起">✕</button>
              {body}
            </div>
          </div>

          {/* 简历纸 + 下面压着的两张 */}
          <div className={`relative z-10 transition-all duration-500 ease-[cubic-bezier(.2,.8,.2,1)] ${open ? '-translate-x-[180px] -rotate-[0.8deg]' : ''}`} onClick={(e) => e.stopPropagation()}>
            <div className="login-sheet absolute inset-0 translate-x-3 translate-y-2.5 rotate-[1.4deg]" aria-hidden />
            <div className="login-sheet absolute inset-0 -translate-x-1 translate-y-1.5 -rotate-[0.8deg]" aria-hidden />
            <LoginShowcase />
          </div>
        </div>
      </main>

      {/* 小屏：直接显示登录卡 */}
      <main className="relative flex flex-1 items-center justify-center py-8 lg:hidden">
        <div className="relative w-full max-w-[360px] rounded-xl bg-white px-8 pb-7 pt-8 text-slate-900">
          <span className="absolute inset-x-0 top-0 h-1 rounded-t-xl bg-amber-400" />
          {body}
          <p className="mt-6 border-t border-slate-100 pt-4 text-center text-xs text-slate-400">在电脑上打开，可体验简历分析演示</p>
        </div>
      </main>

      <footer className="relative flex shrink-0 flex-col gap-1 py-5 text-xs text-slate-500 sm:flex-row sm:justify-between">
        <span>仅限企业内部使用 · 候选人数据按公司信息安全规范存储</span>
        <span>登录即表示同意《内部系统使用规范》与《候选人信息保护协议》</span>
      </footer>
    </div>
  )
}
