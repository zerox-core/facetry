import { useEffect, useState } from 'react'
import Dashboard from './modules/Dashboard'
import Talent from './modules/Talent'
import Interviews from './modules/Interviews'
import Reviews from './modules/Reviews'
import Offers from './modules/Offers'
import Jobs from './modules/Jobs'
import Bank from './modules/Bank'
import Assist from './modules/Assist'
import Admin from './modules/Admin'
import LoginModal from './modules/LoginModal'
import CommandPalette from './modules/CommandPalette'

export interface ModItem {
  id: string
  k: string
  c: React.ComponentType<any>
  n?: number
}

const MODS: ModItem[] = [
  { id: 'dashboard', k: '工作台', c: Dashboard },
  { id: 'talent', k: '人才库', c: Talent },
  { id: 'interviews', k: '面试', c: Interviews, n: 6 },
  { id: 'reviews', k: '面评', c: Reviews, n: 3 },
  { id: 'offers', k: 'Offer', c: Offers, n: 2 },
  { id: 'jobs', k: '岗位与 JD', c: Jobs },
  { id: 'bank', k: '智能题库', c: Bank },
  { id: 'assist', k: '面试副驾', c: Assist },
  { id: 'admin', k: '系统设置', c: Admin },
]

export default function App() {
  const [activeMod, setActiveMod] = useState('dashboard')
  const [navParams, setNavParams] = useState<Record<string, any>>({})
  const [toast, setToast] = useState<string | null>(null)
  const [showLogin, setShowLogin] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [currentUser, setCurrentUser] = useState('王璐 · HR')

  useEffect(() => {
    let t: number
    const h = (e: Event) => {
      setToast((e as CustomEvent).detail)
      clearTimeout(t)
      t = window.setTimeout(() => setToast(null), 2200)
    }
    window.addEventListener('toast', h)
    return () => window.removeEventListener('toast', h)
  }, [])

  // 监听全局快捷键 ⌘K / Ctrl+K
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setShowSearch(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  // 跨模块通用跳转调度器
  const handleNavigate = (modId: string, params?: Record<string, any>) => {
    const target = MODS.find(m => m.id === modId)
    if (target) {
      setActiveMod(target.id)
      setNavParams(params || {})
    }
  }

  const currentModObj = MODS.find(m => m.id === activeMod) || MODS[0]
  const ModComponent = currentModObj.c

  return (
    <div className="h-full flex flex-col bg-canvas text-ink">
      {/* 顶部全局导航栏 */}
      <header className="h-[52px] shrink-0 bg-base text-white/70 flex items-center px-5 gap-6 shadow-[0_2px_10px_rgba(0,0,0,0.18)] z-30 select-none">
        {/* Logo 品牌区 */}
        <div
          onClick={() => handleNavigate('dashboard')}
          className="flex items-center gap-2.5 cursor-pointer hover:opacity-95 transition-opacity"
        >
          <span className="w-7 h-7 rounded-[3px] bg-amber text-base font-serif font-black flex items-center justify-center text-[14px] shadow-sm">
            知
          </span>
          <span className="text-paper font-semibold text-[14px] tracking-wide font-serif-brand">
            知马 · 人才招聘工作台
          </span>
        </div>

        {/* 顶部导航 Tabs */}
        <nav className="flex h-full overflow-x-auto no-scrollbar">
          {MODS.map((x) => {
            const isActive = x.id === activeMod
            return (
              <button
                key={x.id}
                onClick={() => handleNavigate(x.id)}
                className={`relative px-3.5 h-full text-[13px] font-medium transition-colors cursor-pointer whitespace-nowrap flex items-center ${isActive ? 'text-paper font-semibold' : 'text-white/65 hover:text-white'}`}
              >
                <span>{x.k}</span>
                {x.n && (
                  <span className="ml-1.5 text-[10px] px-1.5 py-0.2 rounded-full bg-amber text-base font-bold leading-none">
                    {x.n}
                  </span>
                )}
                {isActive && (
                  <span className="absolute inset-x-2.5 bottom-0 h-[2.5px] bg-amber rounded-t-sm" />
                )}
              </button>
            )
          })}
        </nav>

        {/* 右侧搜索、筛选与用户登录区 */}
        <div className="ml-auto flex items-center gap-4">
          {/* 全局搜索触发器 */}
          <div
            onClick={() => setShowSearch(true)}
            className="relative cursor-pointer group"
          >
            <div className="w-64 h-8 bg-white/[.08] group-hover:bg-white/[.12] border border-white/10 group-hover:border-amber/50 rounded-[4px] pl-8 pr-12 text-[12px] text-paper flex items-center transition-all">
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 absolute left-2.5 top-[9px] text-white/40 group-hover:text-amber transition-colors" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
              </svg>
              <span className="text-white/40">全局搜索 候选人/岗位/题库</span>
              <kbd className="absolute right-2 top-[6px] font-mono text-[10px] text-white/40 bg-white/10 px-1 py-0.5 rounded-[2px]">
                ⌘K
              </kbd>
            </div>
          </div>

          <span className="hidden lg:inline-block text-[11px] text-white/55 bg-white/[.06] px-2.5 py-1 rounded-[3px] border border-white/5 font-mono">
            2025 Q1 校社招
          </span>

          {/* 用户信息与飞书扫码登录入口 */}
          <div
            onClick={() => setShowLogin(true)}
            title="点击切换用户或重新扫码登录"
            className="flex items-center gap-2 pl-1 cursor-pointer hover:opacity-85 transition-opacity"
          >
            <span className="w-7 h-7 rounded-full bg-[#3b4856] text-[12px] font-semibold flex items-center justify-center text-paper ring-1 ring-white/20">
              {currentUser[0] || '王'}
            </span>
            <span className="text-[12.5px] text-paper/90 font-medium whitespace-nowrap">
              {currentUser}
            </span>
          </div>
        </div>
      </header>

      {/* 模块主视图区域 */}
      <main key={activeMod} className="flex-1 min-h-0 rise">
        <ModComponent navTo={handleNavigate} {...navParams} />
      </main>

      {/* 底部浮动 Toast 消息 */}
      {toast && (
        <div className="rise fixed bottom-6 left-1/2 -translate-x-1/2 bg-base text-paper text-[13px] px-5 py-2.5 rounded-[4px] shadow-2xl flex items-center gap-2.5 z-50 border border-white/10">
          <span className="w-2 h-2 rounded-full bg-amber shadow-[0_0_8px_rgba(215,166,42,0.8)]" />
          <span>{toast}</span>
        </div>
      )}

      {/* 飞书扫码登录演示弹窗 */}
      <LoginModal
        open={showLogin}
        onClose={() => setShowLogin(false)}
        onSuccess={(name) => setCurrentUser(name)}
      />

      {/* 全局 ⌘K 快速命令与搜索面板 */}
      <CommandPalette
        open={showSearch}
        onClose={() => setShowSearch(false)}
        onNavigate={handleNavigate}
      />
    </div>
  )
}
