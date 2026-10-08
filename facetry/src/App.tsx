import { useState } from 'react'
import { ToastHost } from './components/Toast'
import Bank from './views/Bank'
import Home from './views/Home'
import Login from './views/Login'
import Resumes from './views/Resumes'
import Review from './views/Review'

const nav: [string, string][] = [
  ['home', '工作台'],
  ['resumes', '简历库'],
  ['bank', '题库'],
]
const LABEL: Record<string, string> = { home: '工作台', resumes: '简历库', bank: '题库', review: '评审详情' }

/** 导航：go(v, sessionId) 进入新页并记住来源；go('back') 回到来源页。
 *  go.from 是返回目标的名称，页面上的「← xx」按钮用它 */
export type Go = ((v: string, sessionId?: string, opt?: { replace?: boolean }) => void) & { from: string }
type Entry = { view: string; sessionId: string }

export default function App() {
  const [stack, setStack] = useState<Entry[]>([{ view: 'home', sessionId: '' }])
  const { view, sessionId } = stack[stack.length - 1]
  const [user, setUser] = useState(() => localStorage.getItem('facetry-user'))
  const login = (name: string) => {
    localStorage.setItem('facetry-user', name)
    setUser(name)
    setStack([{ view: 'home', sessionId: '' }])
  }
  const logout = () => {
    localStorage.removeItem('facetry-user')
    setUser(null)
  }
  const go = ((v: string, sid?: string, opt?: { replace?: boolean }) => {
    setStack((s) => {
      if (v === 'back') return s.length > 1 ? s.slice(0, -1) : [{ view: 'home', sessionId: '' }]
      const e = { view: v, sessionId: sid ?? s[s.length - 1].sessionId }
      if (v === 'review' && e.sessionId) localStorage.setItem('facetry-last-session', e.sessionId)
      return opt?.replace ? [...s.slice(0, -1), e] : [...s, e].slice(-20)
    })
    window.scrollTo(0, 0)
  }) as Go
  go.from = LABEL[stack[stack.length - 2]?.view] ?? '工作台'
  // 顶部导航是入口：点击即清空来源栈
  const enter = (v: string) => {
    setStack([{ view: v, sessionId: '' }])
    window.scrollTo(0, 0)
  }

  if (!user) return <Login onLogin={login} />

  // 高亮当前入口（栈底），而不是当前页
  const tab = stack[0].view
  return (
    <div className="ws-canvas min-h-screen">
      <ToastHost />
      <header className="ws-bar sticky top-0 z-20 text-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-8 px-6">
          <button onClick={() => enter('home')} className="flex cursor-pointer items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-amber-400 text-sm font-bold text-[#1d2939]">F</span>
            <span className="text-base font-semibold">Facetry</span>
            <span className="ml-1 rounded bg-white/10 px-1.5 py-0.5 text-xs text-white/60">简历评审</span>
          </button>
          <nav className="flex h-full flex-1 gap-1">
            {nav.map(([k, v]) => (
              <button
                key={k}
                onClick={() => enter(k)}
                className={`relative cursor-pointer px-3 text-sm transition-colors duration-150 after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:origin-center after:rounded-full after:bg-amber-400 after:transition-transform after:duration-300 ${
                  tab === k ? 'font-medium text-white after:scale-x-100' : 'text-white/55 after:scale-x-0 hover:text-white'
                }`}
              >
                {v}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-3 text-sm text-white/70">
            <span className="hidden sm:inline">{user}</span>
            <span className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white">{user[0]}</span>
            <button onClick={logout} className="cursor-pointer text-white/45 hover:text-white">
              退出
            </button>
          </div>
        </div>
      </header>
      <main key={view + sessionId} className="mx-auto max-w-7xl px-6 py-8">
        {view === 'home' && <Home go={go} user={user} />}
        {view === 'resumes' && <Resumes go={go} />}
        {view === 'bank' && <Bank />}
        {view === 'review' && <Review sessionId={sessionId} go={go} />}
      </main>
    </div>
  )
}
