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
import Offline from './views/Offline'
import Login from './views/Login'
import Join from './views/Join'
import Result from './views/Result'
import { elapsedOf, findC, resetDemo, rooms, runningRoomId, useStore } from './store'

const nav = [
  ['workbench', '工作台'],
  ['candidates', '候选人大池'],
  ['jobs', '岗位管理'],
  ['schedule', '约面管理'],
  ['approvals', '录取审批'],
  ['bank', '题库管理'],
  ['admin', '管理后台'],
  ['overview', '数据看板(P2)'],
]

const LABEL: Record<string, string> = {
  workbench: '工作台',
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
  return (
    <div
      className="ws-rise fixed bottom-6 right-6 z-40 flex items-center gap-3 rounded-full bg-[#1d1d1f]/90 p-1.5 pl-4 text-white shadow-2xl backdrop-blur-xl border border-white/10"
      style={{ '--i': 0 } as React.CSSProperties}
    >
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
      </span>
      <div className="min-w-0 pr-1 text-left">
        <div className="text-[11px] tabular-nums text-white/60">现场考场记录中 · {mmss(elapsedOf(rooms[cid]))}</div>
        <div className="max-w-40 truncate text-xs font-medium text-white/90">
          {c.name} · {c.role}
        </div>
      </div>
      <button
        onClick={() => go('room', cid)}
        className="h-8 shrink-0 cursor-pointer rounded-full bg-gradient-to-b from-[#2c2c2e] to-[#121214] px-3.5 text-xs font-medium text-white shadow-[0_2px_6px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.22)] border border-black/80 transition-all hover:brightness-110 active:scale-95"
      >
        继续考场
      </button>
    </div>
  )
}

export type Go = ((v: string, cid?: string, opt?: { replace?: boolean }) => void) & { from: string }
type Entry = { view: string; cid: string }

export default function App() {
  const [stack, setStack] = useState<Entry[]>([{ view: 'workbench', cid: 'c1' }])
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

  return (
    <div className="ws-canvas min-h-screen">
      {/* 苹果官网风格超薄磨砂玻璃顶栏 */}
      <header className="sticky top-0 z-30 ws-bar">
        <div className="mx-auto flex h-12 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-6">
            <button onClick={() => enter('workbench')} className="group flex cursor-pointer items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-[#1d1d1f] text-[11px] font-bold text-white tracking-tighter shadow-2xs group-hover:bg-black/80 transition-colors">
                F
              </span>
              <span className="text-sm font-semibold tracking-tight text-[#1d1d1f]">FaceTry</span>
              <span className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-medium text-[#86868b]">招聘工作台</span>
            </button>

            {/* 顶栏分段导航胶囊 */}
            <nav className="hidden lg:flex items-center gap-1 overflow-x-auto">
              {nav.map(([k, label]) => {
                const on = tab === k
                return (
                  <button
                    key={k}
                    onClick={() => enter(k)}
                    className={`cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-all ${
                      on
                        ? 'bg-[#1d1d1f] text-white shadow-2xs'
                        : 'text-[#86868b] hover:text-[#1d1d1f] hover:bg-black/[0.04]'
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
              className="hidden sm:inline cursor-pointer text-[11px] text-[#86868b] hover:text-[#1d1d1f] transition-colors"
              title="一键恢复系统出厂纯净数据"
            >
              重置数据
            </button>
            <div className="flex items-center gap-2 rounded-full bg-black/[0.04] py-1 pl-2.5 pr-1.5 text-xs">
              <span className="font-medium text-[#1d1d1f]">{user}</span>
              <button
                onClick={logout}
                className="grid h-5 w-5 cursor-pointer place-items-center rounded-full text-[#86868b] hover:bg-black/10 hover:text-[#1d1d1f] transition-colors"
                title="退出登录"
              >
                ✕
              </button>
            </div>
          </div>
        </div>

        {/* 移动端/小屏顶栏导航条 */}
        <div className="lg:hidden flex items-center gap-1 px-4 pb-2 overflow-x-auto border-t border-black/[0.04] pt-1">
          {nav.map(([k, label]) => {
            const on = tab === k
            return (
              <button
                key={k}
                onClick={() => enter(k)}
                className={`whitespace-nowrap cursor-pointer rounded-full px-2.5 py-0.5 text-xs font-medium transition-all ${
                  on ? 'bg-[#1d1d1f] text-white' : 'text-[#86868b]'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
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
