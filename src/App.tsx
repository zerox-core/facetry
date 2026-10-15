import type React from 'react'
import { useEffect, useState } from 'react'
import Workbench from './views/Workbench'
import Candidates from './views/Candidates'
import CandidateDetail from './views/CandidateDetail'
import Jobs from './views/Jobs'
import ScheduleManager from './views/ScheduleManager'
import Approvals from './views/Approvals'
import Bank from './views/Bank'
import Admin from './views/Admin'
import Overview from './views/Overview'
import ColorBentoDashboard from './views/ColorBentoDashboard'
import Offline from './views/Offline'
import Login from './views/Login'
import Join from './views/Join'
import Result from './views/Result'
import { elapsedOf, findC, resetDemo, rooms, runningRoomId, useStore } from './store'

const nav = [
  ['bento', '首页指挥舱'],
  ['candidates', '候选人大池'],
  ['jobs', '岗位管理'],
  ['schedule', '约面管理'],
  ['approvals', '录取审批'],
  ['bank', '题库管理'],
  ['admin', '管理后台'],
  ['workbench', '待办卡片轨'],
  ['overview', '数据看板(P2)'],
]

const LABEL: Record<string, string> = {
  bento: '首页指挥舱',
  workbench: '待办卡片轨',
  candidates: '候选人大池',
  detail: '候选人详情',
  jobs: '岗位管理',
  schedule: '约面管理',
  approvals: '录取审批',
  bank: '题库管理',
  admin: '管理后台',
  overview: '数据看板',
  analysis: '候选人详情',
  result: '结果分析',
  room: '考场面试间',
}

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

/** 后台面试悬浮入口：苹果风格精致药丸胶囊，离开面试间时平滑浮动 */
function BgRoomWidget({ go }: { go: Go }) {
  const cid = runningRoomId()
  const [, tick] = useState(0)
  useEffect(() => {
    if (!cid) return
    const t = setInterval(() => tick((x) => x + 1), 1000)
    return () => clearInterval(t)
  }, [cid])
  if (!cid) return null
  const c = findC(cid)
  if (!c) return null
  return (
    <div
      className="ws-rise fixed bottom-6 right-6 z-40 flex items-center gap-3 rounded-full bg-neutral/95 p-1.5 pl-4 text-neutral-content shadow-2xl backdrop-blur-xl"
      style={{ '--i': 0 } as React.CSSProperties}
    >
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
      </span>
      <div className="min-w-0 pr-1 text-left">
        <div className="text-[11px] tabular-nums text-neutral-content/60">现场考场记录中 · {mmss(elapsedOf(rooms[cid]))}</div>
        <div className="max-w-40 truncate text-xs font-medium text-neutral-content/90">
          {c.name} · {c.role}
        </div>
      </div>
      <button
        onClick={() => go('room', cid)}
        className="h-8 shrink-0 cursor-pointer rounded-full bg-base-100 px-3.5 text-xs font-medium text-base-content shadow-sm transition-colors hover:bg-base-300 active:scale-95"
      >
        继续考场
      </button>
    </div>
  )
}

export type Go = ((v: string, cid?: string, opt?: { replace?: boolean }) => void) & { from: string }
type Entry = { view: string; cid: string }

export default function App() {
  const [stack, setStack] = useState<Entry[]>([{ view: 'bento', cid: 'c1' }])
  const { view, cid } = stack[stack.length - 1]
  const setView = (v: string) => setStack([{ view: v, cid }])
  useStore()
  const [user, setUser] = useState(() => localStorage.getItem('facetry-user'))
  const login = (name: string) => {
    localStorage.setItem('facetry-user', name)
    setUser(name)
    setView('workbench')
  }
  const logout = () => {
    localStorage.removeItem('facetry-user')
    setUser(null)
  }
  const go = ((v, id, opt) => {
    setStack((s) => {
      if (v === 'back') return s.length > 1 ? s.slice(0, -1) : [{ view: 'workbench', cid }]
      const e = { view: v, cid: id ?? s[s.length - 1].cid }
      return opt?.replace ? [...s.slice(0, -1), e] : [...s, e].slice(-20)
    })
    window.scrollTo(0, 0)
  }) as Go
  go.from = LABEL[stack[stack.length - 2]?.view] ?? '工作台'
  const enter = (v: string) => {
    setStack([{ view: v, cid }])
    window.scrollTo(0, 0)
  }

  const join = new URLSearchParams(location.search).get('join')
  if (join) return <Join cid={join} />
  if (!user) return <Login onLogin={login} />

  // 现场考场面试间独占全屏
  if (view === 'room') return <Offline key={cid} cid={cid} go={go} />

  const tab = stack[0].view

  // 全站统一「象牙白 + 墨黑 + 荧光青柠」主题；这里只区分布局：首页指挥舱单屏锁定，其余页面自然滚动
  const isBento = view === 'bento'

  return (
    <div
      className={`bg-base-200 text-base-content ${
        isBento ? 'flex h-screen flex-col overflow-hidden' : 'min-h-screen'
      }`}
    >
      {/* 顶栏：全站统一磨砂玻璃 */}
      <header className="sticky top-0 z-30 shrink-0 border-b border-base-300 bg-base-100/85 backdrop-blur-xl">
        <div className="mx-auto flex h-13 max-w-[1780px] items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-5">
            <button
              onClick={() => enter('bento')}
              className="group flex cursor-pointer items-center gap-2.5 rounded-xl"
              aria-label="返回首页指挥舱"
            >
              <span className="grid h-7 w-7 place-items-center rounded-xl bg-neutral text-xs font-black text-neutral-content shadow-md transition-transform group-hover:scale-105">
                F
              </span>
              <div className="text-left">
                <div className="text-sm font-bold tracking-tight text-base-content">FaceTry</div>
                <div className="text-[10px] text-base-content/50">AI 智能招聘控制中枢</div>
              </div>
            </button>

            {/* 顶栏分段导航胶囊 */}
            <nav className="hidden items-center gap-1 overflow-x-auto lg:flex" aria-label="主导航">
              {nav.map(([k, label]) => {
                const on = tab === k
                return (
                  <button
                    key={k}
                    onClick={() => enter(k)}
                    aria-current={on ? 'page' : undefined}
                    className={`cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-all duration-200 ${
                      on
                        ? 'bg-accent font-bold text-accent-content shadow-sm'
                        : 'text-base-content/60 hover:bg-base-content/10 hover:text-base-content'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={resetDemo}
              className="hidden cursor-pointer text-[11px] text-base-content/50 transition-colors hover:text-base-content sm:inline"
              title="一键恢复系统出厂纯净数据"
            >
              重置数据
            </button>
            <div className="flex items-center gap-2 rounded-full border border-base-content/10 bg-base-content/10 py-0.5 pl-2.5 pr-1.5 text-xs">
              <span className="font-medium text-base-content">{user}</span>
              <button
                onClick={logout}
                className="grid h-5 w-5 cursor-pointer place-items-center rounded-full text-base-content/50 transition-colors hover:bg-base-content/20 hover:text-base-content"
                title="退出登录"
                aria-label="退出登录"
              >
                ✕
              </button>
            </div>
          </div>
        </div>

        {/* 移动端/小屏顶栏导航条 */}
        <div className="flex items-center gap-1 overflow-x-auto border-t border-base-300 px-4 pb-1.5 pt-1 lg:hidden">
          {nav.map(([k, label]) => {
            const on = tab === k
            return (
              <button
                key={k}
                onClick={() => enter(k)}
                aria-current={on ? 'page' : undefined}
                className={`cursor-pointer whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium transition-all duration-200 ${
                  on ? 'bg-accent font-bold text-accent-content' : 'text-base-content/60'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
      </header>

      {/* 主工作区：首页指挥舱 100vh 单屏锁定，其他页面自然滚动 */}
      <main
        className={`w-full ${
          isBento
            ? 'mx-auto flex min-h-0 max-w-[1780px] flex-1 flex-col overflow-hidden px-4 py-3'
            : 'mx-auto max-w-[1720px] px-4 py-8 sm:px-6 lg:px-8'
        }`}
      >
        {view === 'bento' && <ColorBentoDashboard go={go} onSwitchView={() => go('workbench')} />}
        {view === 'workbench' && <Workbench go={go} />}
        {view === 'candidates' && <Candidates go={go} />}
        {(view === 'detail' || view === 'analysis') && <CandidateDetail cid={cid} go={go} />}
        {view === 'jobs' && <Jobs go={go} />}
        {view === 'schedule' && <ScheduleManager go={go} />}
        {view === 'approvals' && <Approvals go={go} />}
        {view === 'bank' && <Bank />}
        {view === 'admin' && <Admin go={go} />}
        {view === 'overview' && <Overview go={go} />}
        {view === 'result' && <Result cid={cid} go={go} />}
      </main>

      <BgRoomWidget go={go} />
    </div>
  )
}
