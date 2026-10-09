import { useEffect, useState } from 'react'
import { api } from './api'
import { ToastHost } from './components/Toast'
import { Spinner } from './components/ui'
import type { AuthUser, UserGroup } from './types'
import Admin from './views/Admin'
import Bank from './views/Bank'
import Home from './views/Home'
import Jds from './views/Jds'
import Login from './views/Login'
import Resumes from './views/Resumes'
import Review from './views/Review'

const nav: [string, string][] = [
  ['home', '工作台'],
  ['resumes', '简历库'],
  ['jds', '岗位库'],
  ['bank', '题库'],
]
const LABEL: Record<string, string> = { home: '工作台', resumes: '简历库', jds: '岗位库', bank: '题库', admin: '管理', review: '评审详情' }

/** 导航：go(v, sessionId) 进入新页并记住来源；go('back') 回到来源页。
 *  go.from 是返回目标的名称，页面上的「← xx」按钮用它 */
export type Go = ((v: string, sessionId?: string, opt?: { replace?: boolean }) => void) & { from: string }
type Entry = { view: string; sessionId: string }

export default function App() {
  const [stack, setStack] = useState<Entry[]>([{ view: 'home', sessionId: '' }])
  const { view, sessionId } = stack[stack.length - 1]
  // 服务端会话（zm_sess cookie）：启动时先问 /api/auth/me
  const [user, setUser] = useState<AuthUser | null>(null)
  const [groups, setGroups] = useState<UserGroup[]>([])
  const [authPending, setAuthPending] = useState(true)
  useEffect(() => {
    api
      .me()
      .then((r) => {
        setUser(r.user)
        setGroups(r.groups || [])
      })
      .catch(() => setUser(null))
      .finally(() => setAuthPending(false))
  }, [])
  const logout = () => {
    void api.logout().finally(() => location.reload())
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

  if (authPending) {
    return (
      <div className="ws-canvas grid min-h-screen place-items-center">
        <Spinner />
      </div>
    )
  }
  if (!user) return <Login />

  // 高亮当前入口（栈底），而不是当前页
  const tab = stack[0].view
  return (
    <div className="ws-canvas min-h-screen">
      <ToastHost />
      <header className="ws-bar sticky top-0 z-20 text-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:gap-6 sm:px-6">
          <button onClick={() => enter('home')} className="flex shrink-0 cursor-pointer items-center gap-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#fffdf9] p-0.5"><img src="/logo.png" alt="知马" className="h-full w-full object-contain" /></span>
            <span className="hidden text-base font-semibold sm:inline">知马</span>
            <span className="ml-1 hidden rounded bg-white/10 px-1.5 py-0.5 text-xs text-white/60 md:inline">简历评审</span>
          </button>
          <nav className="flex h-full flex-1 gap-1">
            {(user.isAdmin ? [...nav, ['admin', '管理'] as [string, string]] : nav).map(([k, v]) => (
              <button
                key={k}
                onClick={() => enter(k)}
                className={`relative cursor-pointer px-2 text-[13px] transition-colors duration-150 after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:origin-center after:rounded-full after:bg-amber-400 after:transition-transform after:duration-300 sm:px-3 sm:text-sm ${
                  tab === k ? 'font-medium text-white after:scale-x-100' : 'text-white/55 after:scale-x-0 hover:text-white'
                }`}
              >
                {v}
              </button>
            ))}
          </nav>
          <div className="flex shrink-0 items-center gap-3 text-sm text-white/70">
            <span className="hidden text-right leading-tight lg:block">
              <span className="block">{user.name}</span>
              <span className="block max-w-56 truncate text-xs text-white/45">
                {user.isAdmin ? '管理员' : groups[0]?.pathName || '未识别组织'}
              </span>
            </span>
            {user.avatar ? (
              <img src={user.avatar} alt={user.name} referrerPolicy="no-referrer" className="h-7 w-7 rounded-full object-cover" />
            ) : (
              <span className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white">{user.name[0]}</span>
            )}
            <button onClick={logout} className="cursor-pointer text-white/45 hover:text-white">
              退出
            </button>
          </div>
        </div>
      </header>
      <main key={view + sessionId} className="mx-auto max-w-7xl px-6 py-8">
        {view === 'home' && <Home go={go} user={user.name} />}
        {view === 'resumes' && <Resumes go={go} />}
        {view === 'jds' && <Jds go={go} />}
        {view === 'bank' && <Bank />}
        {view === 'admin' && user.isAdmin && <Admin />}
        {view === 'review' && <Review sessionId={sessionId} go={go} />}
      </main>
    </div>
  )
}
