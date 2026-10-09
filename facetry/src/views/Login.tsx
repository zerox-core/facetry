import { useEffect, useState } from 'react'
import { api } from '../api'
import { Btn } from '../components/ui'
import LoginShowcase from './LoginShowcase'

export default function Login() {
  const [err, setErr] = useState('')
  const [feishuBusy, setFeishuBusy] = useState(false)
  const [feishuErr, setFeishuErr] = useState('')
  // 登录卡平时藏在简历纸背后，只露出一枚书签；点击后从纸后抽出
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [])

  // 飞书回调失败时后端重定向回 /?login_error=...：显示并从地址栏清除
  useEffect(() => {
    const e = new URLSearchParams(location.search).get('login_error')
    if (e) {
      setErr(e)
      history.replaceState(null, '', location.pathname)
    }
  }, [])

  // 飞书 OAuth：先确认后端已配置，再整页跳转授权
  const feishuLogin = async () => {
    setFeishuBusy(true)
    setFeishuErr('')
    try {
      const s = await api.status()
      if (s.feishu) {
        window.location.href = '/api/auth/feishu'
        return
      }
      setFeishuErr('飞书登录未配置，请联系管理员')
    } catch (e) {
      setFeishuErr(e instanceof Error ? e.message : '网络异常，请稍后重试')
    }
    setFeishuBusy(false)
  }

  const body = (
    <>
          <h2 className="text-xl font-semibold text-slate-900">登录</h2>
          <p className="mt-1 text-sm text-slate-500">使用飞书账号登录简历评审工作台</p>
          {err && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{err}</p>}

          <div className="mt-6">
            <p className="text-center text-sm text-slate-600">使用<span className="font-medium text-slate-900">飞书账号</span>授权登录，点击按钮跳转飞书确认即可</p>
            {feishuErr && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{feishuErr}</p>}
            <Btn className="mt-5 w-full justify-center" disabled={feishuBusy} onClick={() => void feishuLogin()}>
              <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden><path d="M3 5.5 10.5 3l6.5 6-6.5 8L3 14.5z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
              {feishuBusy ? '正在跳转飞书…' : '使用飞书登录'}
            </Btn>
          </div>
    </>
  )

  return (
    <div className="login-desk relative flex min-h-screen flex-col overflow-hidden px-6 text-white sm:px-10">
      <header className="relative z-30 flex h-16 shrink-0 items-center gap-2">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#fffdf9] p-0.5"><img src="/logo.png" alt="知马" className="h-full w-full object-contain" /></span>
        <span className="text-lg font-semibold">知马</span>
        <span className="ml-1 rounded px-1.5 py-0.5 text-xs text-slate-300 ring-1 ring-white/15">简历评审工作台</span>
        <button onClick={() => setOpen(!open)} className="ml-auto hidden h-9 cursor-pointer rounded-lg bg-amber-400 px-5 text-sm font-semibold text-[#1d2939] transition hover:bg-amber-300 md:block">{open ? '收起登录' : '登录'}</button>
      </header>

      {/* 大屏：桌面舞台。简历纸居中，登录卡藏在纸后，点击书签抽出 */}
      <main className="relative hidden flex-1 flex-col items-center justify-center py-6 md:flex" onClick={() => open && setOpen(false)}>
        <div className={`text-center transition-all duration-500 ${open ? '-translate-x-[100px] lg:-translate-x-[180px]' : ''}`}>
          <h1 className="text-[32px] font-semibold leading-tight tracking-tight lg:text-[40px]">每一次评审，都从读懂简历开始</h1>
          <p className="mt-3 text-[15px] text-slate-400">
            导入简历，自动标出亮点与疑点，生成追问并记录评分。
            <button onClick={(e) => { e.stopPropagation(); setOpen(true) }} className="ml-3 inline-flex h-8 cursor-pointer items-center rounded-full bg-amber-400 px-4 text-sm font-semibold text-[#1d2939] transition hover:bg-amber-300">登录开始使用 →</button>
          </p>
        </div>

        <div className="relative mt-10 w-[640px] origin-top scale-[0.58] lg:scale-[0.84] xl:scale-100">
          {/* 今日面试：压在纸下的一角 */}
          <div className={`absolute -left-44 top-10 hidden w-60 -rotate-[5deg] rounded-md bg-[#f3efe6] p-4 pr-10 text-slate-700 shadow-[0_20px_40px_-18px_rgba(0,0,0,0.6)] transition-all duration-500 xl:block ${open ? '-translate-x-[200px] opacity-0' : ''}`} aria-hidden>
            <div className="text-xs text-slate-500">最近评审 · 10 月 8 日</div>
            {[['潘鑫宇', 'AI-agent 开发'], ['曾浩男', 'AI 管培生']].map(([n, r]) => (
              <div key={n} className="mt-2.5 flex items-center gap-2.5 text-[13px]"><span className="font-medium">{n}</span><span className="text-xs text-slate-400">{r}</span></div>
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
      <main className="relative flex flex-1 items-center justify-center py-8 md:hidden">
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
