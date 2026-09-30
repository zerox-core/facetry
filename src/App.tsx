import { useState } from 'react'
import Home from './views/Home'
import Candidates from './views/Candidates'
import Bank from './views/Bank'
import Interviewer from './views/Interviewer'
import Offline from './views/Offline'
import Login from './views/Login'
import Join from './views/Join'
import Result from './views/Result'
import Overview from './views/Overview'
import { resetDemo, useStore } from './store'

const nav = [['home', '工作台'], ['overview', '总览'], ['candidates', '候选人'], ['bank', '题库']]
const LABEL: Record<string, string> = { home: '工作台', overview: '总览', candidates: '候选人', bank: '题库', analysis: '候选人分析', result: '结果分析', room: '面试间' }

/** 导航：go(v) 进入新页并记住来源；go('back') 回到来源页；replace 用于不该回退到的中间页（如提交后的面试间）。
 *  go.from 是返回目标的名称，页面上的「← xx」按钮用它 */
export type Go = ((v: string, cid?: string, opt?: { replace?: boolean }) => void) & { from: string }
type Entry = { view: string; cid: string }

export default function App() {
  const [stack, setStack] = useState<Entry[]>([{ view: 'home', cid: 'c1' }])
  const { view, cid } = stack[stack.length - 1]
  const setView = (v: string) => setStack([{ view: v, cid }])
  useStore()
  const [user, setUser] = useState(() => localStorage.getItem('facetry-user'))
  const login = (name: string) => { localStorage.setItem('facetry-user', name); setUser(name); setView('home') }
  const logout = () => { localStorage.removeItem('facetry-user'); setUser(null) }
  const go = ((v, id, opt) => {
    setStack((s) => {
      if (v === 'back') return s.length > 1 ? s.slice(0, -1) : [{ view: 'home', cid }]
      const e = { view: v, cid: id ?? s[s.length - 1].cid }
      return opt?.replace ? [...s.slice(0, -1), e] : [...s, e].slice(-20)
    })
    window.scrollTo(0, 0)
  }) as Go
  go.from = LABEL[stack[stack.length - 2]?.view] ?? '工作台'
  // 顶部导航是入口：点击即清空来源栈
  const enter = (v: string) => { setStack([{ view: v, cid }]); window.scrollTo(0, 0) }

  // 候选人通过分享链接 ?join=<候选人 id> 进入面试间，不需要登录，也看不到任何后台信息
  const join = new URLSearchParams(location.search).get('join')
  if (join) return <Join cid={join} />
  if (!user) return <Login onLogin={login} />

  // 面试间是唯一的现场记录页，独占全屏，不显示后台导航
  if (view === 'room') return <Offline key={cid} cid={cid} go={go} />

  // 高亮当前入口（栈底），而不是当前页
  const tab = stack[0].view
  return (
    <div className="ws-canvas min-h-screen">
      <header className="sticky top-0 z-20 ws-bar text-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-8 px-6">
          <button onClick={() => enter('home')} className="flex cursor-pointer items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-amber-400 text-sm font-bold text-[#1d2939]">F</span>
            <span className="text-base font-semibold">Facetry</span>
            <span className="ml-1 rounded bg-white/10 px-1.5 py-0.5 text-xs text-white/60">面试官工作台</span>
          </button>
          <nav className="flex h-full flex-1 gap-1">
            {nav.map(([k, v]) => (
              <button key={k} onClick={() => enter(k)} className={`relative cursor-pointer px-3 text-sm transition-colors duration-150 after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:origin-center after:rounded-full after:bg-amber-400 after:transition-transform after:duration-300 ${tab === k ? 'font-medium text-white after:scale-x-100' : 'text-white/55 after:scale-x-0 hover:text-white'}`}>{v}</button>
            ))}
          </nav>
          <div className="flex items-center gap-3 text-sm text-white/70">
            <button onClick={() => confirm('清空导入的候选人、题目与面试记录，恢复初始演示数据？') && resetDemo()} className="hidden cursor-pointer text-white/45 hover:text-white md:inline">重置演示数据</button>
            <span className="hidden h-4 w-px bg-white/15 md:inline" />
            <span className="hidden sm:inline">技术部 · {user}</span>
            <button onClick={logout} title="退出登录" className="group relative grid h-8 w-8 cursor-pointer place-items-center rounded-full bg-white/10 text-white hover:bg-white/20">{user[0]}</button>
            <button onClick={logout} className="cursor-pointer text-white/45 hover:text-white">退出</button>
          </div>
        </div>
      </header>
      <main key={view} className="mx-auto max-w-7xl px-6 py-8">
        {view === 'home' && <Home go={go} />}
        {view === 'overview' && <Overview go={go} />}
        {view === 'candidates' && <Candidates go={go} />}
        {view === 'bank' && <Bank />}
        {view === 'analysis' && <Interviewer key={cid} cid={cid} go={go} />}
        {view === 'result' && <Result key={cid} cid={cid} go={go} />}
      </main>
    </div>
  )
}
