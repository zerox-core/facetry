import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import Talent from './modules/Talent'
import Interviews from './modules/Interviews'
import Reviews from './modules/Reviews'
import Offers from './modules/Offers'
import Jobs from './modules/Jobs'
import Login from './legacy/views/Login'
import { api } from './legacy/api'
import type { MeResponse } from './legacy/types'

const Bank = lazy(() => import('./legacy/views/Bank'))
const Admin = lazy(() => import('./legacy/views/Admin'))
const Assist = lazy(() => import('./legacy/views/Assist'))

const BASE_MODS = [
  { k: '人才库', c: Talent },
  { k: '面试', c: Interviews, n: 6 },
  { k: '面评', c: Reviews, n: 3 },
  { k: 'Offer', c: Offers, n: 2 },
  { k: '岗位与 JD', c: Jobs },
]

export function App() {
  const [auth, setAuth] = useState<MeResponse | null>(null)
  const [authPending, setAuthPending] = useState(true)
  const [authError, setAuthError] = useState('')

  const checkAuth = useCallback(async () => {
    setAuthPending(true)
    setAuthError('')
    try {
      const me = await api.me()
      setAuth(me)
    } catch (e: any) {
      if (e.status !== 401) {
        setAuthError(e.message || '连接后端服务失败')
      } else {
        setAuth(null)
      }
    } finally {
      setAuthPending(false)
    }
  }, [])

  useEffect(() => {
    void checkAuth()
    const onUnauthorized = () => setAuth(null)
    window.addEventListener('facetry:unauthorized', onUnauthorized)
    return () => window.removeEventListener('facetry:unauthorized', onUnauthorized)
  }, [checkAuth])

  if (authPending) {
    return (
      <div className="h-full flex items-center justify-center bg-canvas text-ink/60 font-sans text-[13px]">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber pulse" />
          <span>正在连接知马招聘工作台…</span>
        </div>
      </div>
    )
  }

  if (authError) {
    return (
      <div className="h-full flex items-center justify-center bg-canvas text-ink font-sans">
        <div className="panel p-6 rounded-lg text-center max-w-sm">
          <p className="text-[13px] text-[#a8483a] font-medium mb-3">{authError}</p>
          <button
            onClick={() => void checkAuth()}
            className="h-8 px-4 rounded bg-amber text-base font-semibold text-[12.5px] cursor-pointer hover:brightness-105"
          >
            重试连接
          </button>
        </div>
      </div>
    )
  }

  if (!auth?.user) {
    return <Login onLogin={() => void checkAuth()} />
  }

  return (
    <Workspace
      auth={auth}
      onLogout={async () => {
        try {
          await api.logout()
        } catch {
          // ignore logout network errors
        }
        setAuth(null)
      }}
    />
  )
}

function Workspace({ auth, onLogout }: { auth: MeResponse; onLogout: () => void }) {
  const { user } = auth
  const [m, setM] = useState(0)
  const [toast, setToast] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  // 管理员账号可切换题库与管理模块
  const mods = user.isAdmin
    ? [
        ...BASE_MODS,
        { k: '题库管理', c: Bank },
        { k: '系统设置', c: Admin },
      ]
    : BASE_MODS

  useEffect(() => {
    let t: number
    const h = (e: Event) => {
      setToast((e as CustomEvent).detail)
      clearTimeout(t)
      t = window.setTimeout(() => setToast(null), 1800)
    }
    window.addEventListener('toast', h)
    return () => window.removeEventListener('toast', h)
  }, [])

  const currentMod = mods[m] || mods[0]
  const Mod = currentMod.c

  return (
    <div className="h-full flex flex-col bg-canvas text-ink font-sans select-none">
      {/* 顶部深色工作台导航栏 */}
      <header className="h-[52px] shrink-0 bg-base text-white/70 flex items-center px-5 gap-7 shadow-[0_2px_10px_rgba(0,0,0,0.18)] z-30">
        <div className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-[3px] bg-amber text-base font-serif font-black flex items-center justify-center text-[14px] shadow-sm">
            知
          </span>
          <span className="text-paper font-semibold text-[14px] tracking-wide">知马 · 人才招聘工作台</span>
        </div>

        <nav className="flex h-full">
          {mods.map((x, i) => (
            <button
              key={x.k}
              onClick={() => setM(i)}
              className={`relative px-4 h-full text-[13px] font-medium transition-colors cursor-pointer ${
                i === m ? 'text-paper font-semibold' : 'text-white/65 hover:text-white'
              }`}
            >
              {x.k}
              {x.n ? (
                <span className="ml-1.5 text-[10.5px] px-1.5 py-0.5 rounded-full bg-amber text-base font-bold leading-none">
                  {x.n}
                </span>
              ) : null}
              {i === m && <span className="absolute inset-x-3 bottom-0 h-[2.5px] bg-amber rounded-t-sm" />}
            </button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-5">
          <div className="relative">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="全局搜索 候选人 / 岗位 / 编号"
              className="w-72 h-8 bg-white/[.08] hover:bg-white/[.11] focus:bg-white/[.14] border border-white/10 focus:border-amber/60 rounded-[4px] pl-8 pr-9 text-[12.5px] text-paper placeholder:text-white/35 outline-none transition-all"
            />
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 absolute left-2.5 top-[9px] text-white/40" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <kbd className="absolute right-2 top-[6.5px] font-mono text-[10px] text-white/40 bg-white/10 px-1 py-0.5 rounded-[2px]">
              ⌘K
            </kbd>
          </div>

          <span className="text-[11.5px] text-white/55 bg-white/[.06] px-2.5 py-1 rounded-[3px] border border-white/5">
            2026 Q4 校社招
          </span>

          <div className="flex items-center gap-2.5 pl-1">
            <span className="w-7 h-7 rounded-full bg-[#3b4856] text-[12px] font-medium flex items-center justify-center text-paper ring-1 ring-white/15">
              {(user.name || '用')[0]}
            </span>
            <span className="text-[12.5px] text-paper/90 font-medium">
              {user.name || '用户'} · {user.isAdmin ? '管理员' : 'HR'}
            </span>
            <button
              onClick={onLogout}
              title="退出登录"
              className="ml-1 text-[11.5px] text-white/40 hover:text-white/80 cursor-pointer transition-colors"
            >
              退出
            </button>
          </div>
        </div>
      </header>

      {/* 业务模块主视图 */}
      <div key={m} className="flex-1 min-h-0 rise">
        <Suspense fallback={<div className="p-8 text-center text-ink/50">正在加载页面…</div>}>
          <Mod />
        </Suspense>
      </div>

      {/* 底部悬浮轻提示 */}
      {toast && (
        <div className="rise fixed bottom-6 left-1/2 -translate-x-1/2 bg-base text-paper text-[13px] px-5 py-2.5 rounded-[4px] shadow-2xl flex items-center gap-2.5 z-50 border border-white/10">
          <span className="w-2 h-2 rounded-full bg-amber shadow-[0_0_8px_rgba(215,166,42,0.8)]" />
          {toast}
        </div>
      )}
    </div>
  )
}
export default App
