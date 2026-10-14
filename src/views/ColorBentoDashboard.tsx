import type React from 'react'
import { useState, useEffect } from 'react'
import { candidates, positions, TODAY } from '../data'
import { approvals, runningRoomId, triggerSourceDbSync } from '../store'
import type { Go } from '../App'

type Props = {
  go: Go
  onSwitchView?: () => void
}

export default function ColorBentoDashboard({ go, onSwitchView }: Props) {
  const [time, setTime] = useState(new Date())
  const [syncToast, setSyncToast] = useState('')
  const [activeChannel, setActiveChannel] = useState<'all' | 'yingdao' | 'boss' | 'liepin'>('all')
  const [aiMessage, setAiMessage] = useState('')
  const [aiHistory, setAiHistory] = useState([
    {
      who: 'ai',
      text: '已检视当前候选人全库：今日有 2 场重点现场考场待进行；商业化大前端岗位 HC 紧迫，建议优先完成王磊的初筛复核并安排复试。',
    },
  ])

  // 时钟指针实时转动动效
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const seconds = time.getSeconds()
  const minutes = time.getMinutes()
  const hours = time.getHours() % 12
  const secDeg = seconds * 6
  const minDeg = minutes * 6 + seconds * 0.1
  const hourDeg = hours * 30 + minutes * 0.5

  const pendingScreen = candidates.filter((c) => c.status === '新入库' || c.status === '筛选中')
  const pendingSchedule = candidates.filter((c) => c.status === '待联系')
  const pendingReview = candidates.filter((c) => c.status === '面评中')
  const pendingApproval = approvals.filter((a) => a.finalStatus === 'processing' || a.finalStatus === 'partial')

  const handleSync = () => {
    const res = triggerSourceDbSync()
    setSyncToast(`影刀来源库同步完成：新增 ${res.newCount} 条简历，跳过 ${res.ignoredCount} 条已存在`)
    setTimeout(() => setSyncToast(''), 3500)
  }

  const handleSendAi = () => {
    if (!aiMessage.trim()) return
    const text = aiMessage.trim()
    setAiHistory((prev) => [
      ...prev,
      { who: 'user', text },
      {
        who: 'ai',
        text: `已为你智能解析「${text}」：已联动后台影刀流水线与飞书日历，正在匹配标尺特征库，建议直接进入候选人大池进行批量调度。`,
      },
    ])
    setAiMessage('')
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] p-2 sm:p-4 text-[#1d1d1f]">
      {/* 顶部调色灵感与模式切换 Banner (严格还原截图上方风格标签) */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-2xl font-black tracking-tighter text-[#FF5A36]">01</span>
            <div className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-black/40">
              <span>COLOR 4-PALETTE BENTO DASHBOARD</span>
            </div>
          </div>
          <span className="hidden sm:inline-block h-4 w-px bg-black/15" />
          <div className="hidden sm:flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-[#FF5A36]" />
              <span className="font-semibold text-black/80">18% 珊瑚橙</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-[#7CD7F3]" />
              <span className="font-semibold text-black/80">13% 冰蓝</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-[#6366F1]" />
              <span className="font-semibold text-black/80">11% 长春花紫</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-[#A8BFA4]" />
              <span className="font-semibold text-black/80">9% 鼠尾草绿</span>
            </span>
          </div>
        </div>

        {/* 右上角风格 Tab 切换 (与截图右上方「配色 / 布局 / 整体效果」呼应) */}
        <div className="flex items-center gap-2">
          <div className="flex rounded-full bg-black/5 p-1 text-xs border border-black/10">
            <button
              onClick={() => onSwitchView && onSwitchView()}
              className="cursor-pointer rounded-full px-3.5 py-1 font-semibold text-white bg-[#FF5A36] shadow-sm transition-all"
            >
              四块大色看板
            </button>
            <button
              onClick={() => onSwitchView && onSwitchView()}
              className="cursor-pointer rounded-full px-3.5 py-1 text-black/70 hover:text-black transition-all"
            >
              经典列表视图
            </button>
          </div>
        </div>
      </div>

      {syncToast && (
        <div className="mb-4 alert alert-success text-xs font-medium text-emerald-900 border border-emerald-300 shadow-md">
          <span>✓ {syncToast}</span>
        </div>
      )}

      {/* 核心深色外壳控制台 (Deep Obsidian Canvas Shell) */}
      <div className="relative rounded-3xl bg-[#15161b] p-3 sm:p-5 text-white shadow-2xl border border-white/10 overflow-hidden">
        {/* 背景微网格 */}
        <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

        <div className="relative z-10 flex flex-col xl:flex-row gap-4">
          {/* 左侧浮动 Dock (Mini Vertical Navigation) */}
          <aside className="hidden xl:flex flex-col items-center justify-between py-2 px-1 rounded-2xl bg-white/[0.04] border border-white/5 w-12 shrink-0">
            <div className="flex flex-col items-center gap-3">
              <div className="avatar placeholder">
                <div className="bg-[#FF5A36] text-white rounded-full w-8 h-8 font-black text-xs shadow-md">
                  FT
                </div>
              </div>
              <button
                onClick={() => go('workbench')}
                title="总控工作台"
                className="btn btn-ghost btn-circle btn-xs text-white/70 hover:text-white hover:bg-white/10"
              >
                🏠
              </button>
              <button
                onClick={() => go('candidates')}
                title="候选人大池"
                className="btn btn-ghost btn-circle btn-xs text-white/70 hover:text-white hover:bg-white/10"
              >
                👥
              </button>
              <button
                onClick={() => go('schedule')}
                title="约面日程"
                className="btn btn-ghost btn-circle btn-xs text-white/70 hover:text-white hover:bg-white/10"
              >
                📅
              </button>
              <button
                onClick={() => go('jobs')}
                title="岗位标尺"
                className="btn btn-ghost btn-circle btn-xs text-white/70 hover:text-white hover:bg-white/10"
              >
                📋
              </button>
              <button
                onClick={() => go('approvals')}
                title="录取审批"
                className="btn btn-ghost btn-circle btn-xs text-white/70 hover:text-white hover:bg-white/10"
              >
                🏛️
              </button>
              <button
                onClick={() => go('bank')}
                title="题库考评"
                className="btn btn-ghost btn-circle btn-xs text-white/70 hover:text-white hover:bg-white/10"
              >
                💡
              </button>
            </div>

            <div className="flex flex-col items-center gap-2">
              <button
                onClick={() => go('admin')}
                title="管理后台"
                className="btn btn-ghost btn-circle btn-xs text-white/50 hover:text-white"
              >
                ⚙️
              </button>
              <div className="avatar online">
                <div className="w-7 h-7 rounded-full ring-1 ring-white/20">
                  <span className="grid h-full w-full place-items-center bg-white/20 text-[10px] font-bold">HR</span>
                </div>
              </div>
            </div>
          </aside>

          {/* 右侧主控仪表板 (Main Color Bento Grid Area) */}
          <div className="flex-1 space-y-4">
            {/* 顶栏控制带：组织选择、快速搜索、心跳与状态 */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-1">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-mono text-white/50">Dashboard /</span>
                <span className="font-semibold text-white">Smart Recruitment Bento Overview</span>
                <div className="badge badge-sm badge-outline text-emerald-400 border-emerald-400/40 gap-1 ml-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  影刀同步已就绪
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <div className="join">
                  <input
                    type="text"
                    placeholder="全域搜索候选人 / 标尺 / 单号…"
                    className="input input-xs join-item bg-white/10 border-white/15 text-white placeholder:text-white/40 focus:outline-none w-44 sm:w-56"
                  />
                  <button className="btn btn-xs join-item bg-white/15 border-white/15 text-white hover:bg-white/20">
                    🔍
                  </button>
                </div>
                <button
                  onClick={handleSync}
                  className="btn btn-xs rounded-full bg-white/10 border-white/15 text-white hover:bg-white/20 gap-1.5"
                >
                  <span className="animate-spin text-[10px]">↻</span> 影刀流水线
                </button>
                <div className="badge bg-white/10 text-white border-0 py-2.5 px-3 rounded-full font-medium">
                  🏢 商业化研发中心 · 2026秋招
                </div>
              </div>
            </div>

            {/* ══════════════ 四块大色 核心 Bento 布局 ══════════════ */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* ---------------- 1. 珊瑚橙色块 (THROUGHPUT / 吞吐量与核心漏斗) ---------------- */}
              <div className="lg:col-span-7 rounded-3xl bg-gradient-to-br from-[#FF5A36] to-[#F14925] p-5 sm:p-6 text-white shadow-xl relative overflow-hidden flex flex-col justify-between min-h-[310px]">
                {/* 顶栏：标题与分段过滤 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="grid h-6 w-6 place-items-center rounded-lg bg-black/20 text-xs">📊</span>
                    <h2 className="text-base font-black tracking-wider uppercase">THROUGHPUT</h2>
                    <span className="text-[11px] font-medium opacity-80">· 招聘漏斗吞吐时效</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="badge badge-sm bg-black/20 text-white border-0 font-medium">周级视图 ▾</span>
                    <span className="badge badge-sm bg-black/20 text-white border-0 font-medium">在招编制: 全部 ▾</span>
                  </div>
                </div>

                {/* 核心内容：左侧柱状图 + 右侧指标卡 */}
                <div className="mt-5 grid grid-cols-1 md:grid-cols-[1fr_210px] gap-6 items-end">
                  {/* 柱状模拟图 (吞吐量阶梯) */}
                  <div>
                    <div className="relative flex items-end justify-between gap-2.5 h-36 pt-6 px-2 border-b border-white/25">
                      {[
                        { day: 'Mon', val: 58, label: '初筛' },
                        { day: 'Tue', val: 72, label: '约面' },
                        { day: 'Wed', val: 95, label: '面试' },
                        { day: 'Thu', val: 80, label: '考评' },
                        { day: 'Fri', val: 100, active: true, count: `${candidates.length} 人` },
                        { day: 'Sat', val: 45, label: '审批' },
                        { day: 'Sun', val: 32, label: 'Offer' },
                      ].map((bar) => (
                        <div key={bar.day} className="flex-1 flex flex-col items-center gap-1.5 group relative">
                          {bar.active && (
                            <div className="absolute -top-7 whitespace-nowrap bg-black text-white text-[10px] font-bold py-0.5 px-2 rounded-full shadow-lg border border-white/20">
                              {bar.count}
                            </div>
                          )}
                          <div
                            className={`w-full rounded-t-lg transition-all duration-500 ${
                              bar.active
                                ? 'bg-white shadow-[0_0_15px_rgba(255,255,255,0.7)]'
                                : 'bg-white/40 hover:bg-white/70'
                            }`}
                            style={{ height: `${bar.val}%` }}
                          />
                          <span className="text-[10px] font-bold opacity-80 uppercase">{bar.day}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-white/80 px-2">
                      <span>影刀日落库峰值: 98份/日</span>
                      <span>当前待处理总待办: {pendingScreen.length + pendingSchedule.length + pendingReview.length + pendingApproval.length} 项</span>
                    </div>
                  </div>

                  {/* 右侧关键卡片指标 (与原图吞吐量数字完美对标) */}
                  <div className="space-y-3">
                    <div
                      onClick={() => go('candidates')}
                      className="cursor-pointer rounded-2xl bg-black/20 p-3.5 hover:bg-black/30 transition-all border border-white/10"
                    >
                      <div className="flex items-center justify-between text-xs text-white/80">
                        <span>在库候选人总量</span>
                        <span className="badge badge-xs bg-white text-[#FF5A36] font-bold">+7.5%</span>
                      </div>
                      <div className="mt-1 text-2xl font-black tracking-tight">{candidates.length} <span className="text-xs font-normal opacity-80">人选</span></div>
                    </div>

                    <div
                      onClick={() => go('workbench')}
                      className="cursor-pointer rounded-2xl bg-black/20 p-3.5 hover:bg-black/30 transition-all border border-white/10"
                    >
                      <div className="flex items-center justify-between text-xs text-white/80">
                        <span>全流程流转周期</span>
                        <span className="badge badge-xs bg-emerald-400 text-black font-bold">-2.4d</span>
                      </div>
                      <div className="mt-1 text-2xl font-black tracking-tight">3.4 <span className="text-xs font-normal opacity-80">天/平均流转</span></div>
                    </div>
                  </div>
                </div>

                {/* 底部快捷操作条 */}
                <div className="mt-4 pt-3 border-t border-white/15 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="badge badge-sm bg-white/25 text-white border-0">待初筛 {pendingScreen.length}</span>
                    <span className="badge badge-sm bg-white/25 text-white border-0">待约面 {pendingSchedule.length}</span>
                    <span className="badge badge-sm bg-white/25 text-white border-0">待面评 {pendingReview.length}</span>
                  </div>
                  <button onClick={() => go('candidates')} className="btn btn-xs rounded-full bg-white text-[#FF5A36] hover:bg-white/90 border-0 font-bold">
                    进入大池调度 →
                  </button>
                </div>
              </div>

              {/* ---------------- 2. 长春花紫色块 (VENUE CAPACITY / 面试间容量与流转) ---------------- */}
              <div className="lg:col-span-5 rounded-3xl bg-gradient-to-br from-[#6366F1] to-[#4F46E5] p-5 sm:p-6 text-white shadow-xl relative overflow-hidden flex flex-col justify-between min-h-[310px]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="grid h-6 w-6 place-items-center rounded-lg bg-black/20 text-xs">🏢</span>
                    <h2 className="text-base font-black tracking-wider uppercase">VENUE CAPACITY</h2>
                  </div>
                  <span className="badge badge-sm bg-black/20 text-white border-0 font-medium">考场负荷监控</span>
                </div>

                {/* 4 个环形刻度进度圈 (与原图 78%、82%、91%、88% 严格呼应) */}
                <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                  {[
                    { label: '周一', pct: 78, tag: '已满' },
                    { label: '周二', pct: 82, tag: '饱和' },
                    { label: '周三', pct: 91, tag: '高峰', alert: true },
                    { label: '今日', pct: 88, tag: `${TODAY.slice(5)}`, current: true },
                  ].map((item) => (
                    <div key={item.label} className="flex flex-col items-center">
                      <div
                        className={`radial-progress text-xs font-bold transition-all ${
                          item.current ? 'text-white' : item.alert ? 'text-amber-300' : 'text-white/80'
                        }`}
                        style={{
                          '--value': item.pct,
                          '--size': '3.4rem',
                          '--thickness': '4px',
                        } as React.CSSProperties}
                        role="progressbar"
                      >
                        {item.pct}%
                      </div>
                      <span className="mt-1.5 text-xs font-bold">{item.label}</span>
                      <span className={`text-[10px] rounded px-1.5 py-0.2 mt-0.5 ${item.current ? 'bg-white text-[#6366F1] font-bold' : 'bg-black/20 text-white/70'}`}>
                        {item.tag}
                      </span>
                    </div>
                  ))}
                </div>

                {/* 底部波浪趋势图模拟 (SVG Wave Gradient) */}
                <div className="mt-4 relative h-16 rounded-xl bg-black/15 overflow-hidden flex items-end px-1">
                  <svg className="w-full h-14" viewBox="0 0 300 60" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="waveGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#ffffff" stopOpacity="0.02" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M0,45 Q50,15 100,35 T200,20 T300,10 L300,60 L0,60 Z"
                      fill="url(#waveGrad)"
                    />
                    <path
                      d="M0,45 Q50,15 100,35 T200,20 T300,10"
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth="2.5"
                    />
                  </svg>
                  <div className="absolute inset-x-2 bottom-1.5 flex items-center justify-between text-[10px] text-white/80">
                    <span className="flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
                      现场面试间 (北京总办)
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                      飞书实时视频连线
                    </span>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="text-white/80">考官负荷均值: 4.2场/日</span>
                  <button onClick={() => go('schedule')} className="cursor-pointer text-white underline font-semibold hover:opacity-80">
                    查看完整约面日程 ↗
                  </button>
                </div>
              </div>

              {/* ---------------- 3. 冰蓝色块 (POINTS / 渠道来源网格分布) ---------------- */}
              <div className="lg:col-span-4 rounded-3xl bg-gradient-to-br from-[#7CD7F3] to-[#5BC5E7] p-5 sm:p-6 text-[#0f2938] shadow-xl relative overflow-hidden flex flex-col justify-between min-h-[320px]">
                {/* 顶栏 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="grid h-6 w-6 place-items-center rounded-lg bg-black/10 text-xs">📍</span>
                    <h2 className="text-base font-black tracking-wider uppercase text-[#0f2938]">POINTS & CHANNELS</h2>
                  </div>
                  <div className="badge badge-sm bg-black/15 text-[#0f2938] border-0 font-bold">
                    来源库雷达
                  </div>
                </div>

                {/* 科技坐标纸背景 (Grid Paper Aesthetic) */}
                <div className="my-3 flex-1 rounded-2xl bg-white/40 border border-white/60 p-4 relative overflow-hidden flex flex-col justify-between [background-image:linear-gradient(to_right,rgba(0,0,0,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.06)_1px,transparent_1px)] [background-size:16px_16px]">
                  {/* 点位气泡 1: 影刀流水线 */}
                  <div className="relative flex items-center gap-1.5 self-start bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-full shadow-md border border-white">
                    <span className="h-2 w-2 rounded-full bg-[#FF5A36] animate-ping" />
                    <span className="text-xs font-bold text-[#0f2938]">影刀自动化落库 (82%)</span>
                  </div>

                  {/* 点位气泡 2: 核心直聘平台 */}
                  <div className="relative self-center my-2 flex items-center gap-2 bg-[#0f2938] text-white px-3 py-1.5 rounded-full shadow-lg">
                    <span className="text-xs">⚡</span>
                    <div className="text-xs font-bold leading-tight">
                      <div>大前端与 AI 算法池</div>
                      <div className="text-[10px] text-white/70">78 份高匹配样本就绪</div>
                    </div>
                  </div>

                  {/* 点位气泡 3: 内部猎头与推荐 */}
                  <div className="relative flex items-center gap-1.5 self-end bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-full shadow-md border border-white">
                    <span className="h-2 w-2 rounded-full bg-emerald-600" />
                    <span className="text-xs font-bold text-[#0f2938]">团队内推直聘 (18%)</span>
                  </div>
                </div>

                {/* 底部指标 */}
                <div className="flex items-center justify-between text-xs font-semibold text-[#0f2938]/90">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveChannel('all')}
                      className={`badge badge-sm cursor-pointer ${activeChannel === 'all' ? 'bg-[#0f2938] text-white border-0' : 'bg-white/40 text-[#0f2938] border-0'}`}
                    >
                      全渠道
                    </button>
                    <button
                      onClick={() => setActiveChannel('yingdao')}
                      className={`badge badge-sm cursor-pointer ${activeChannel === 'yingdao' ? 'bg-[#0f2938] text-white border-0' : 'bg-white/40 text-[#0f2938] border-0'}`}
                    >
                      影刀RPA
                    </button>
                  </div>
                  <span className="text-[11px]">有效转化率 42.8%</span>
                </div>
              </div>

              {/* ---------------- 4. 鼠尾草灰绿色块 (OPERATIONAL TIMING / 考场时钟与准时罗盘) ---------------- */}
              <div className="lg:col-span-3 rounded-3xl bg-gradient-to-br from-[#A8BFA4] to-[#8FA98A] p-5 sm:p-6 text-[#1c2e1b] shadow-xl relative overflow-hidden flex flex-col justify-between min-h-[320px]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="grid h-6 w-6 place-items-center rounded-lg bg-black/10 text-xs">⏱️</span>
                    <h2 className="text-base font-black tracking-wider uppercase text-[#1c2e1b]">OPERATIONAL TIMING</h2>
                  </div>
                </div>

                {/* 极具设计感的模拟机械时钟表盘 (Analog Clock Instrument with Live Angles) */}
                <div className="my-2 flex flex-col items-center justify-center">
                  <div className="relative w-36 h-36 rounded-full bg-[#f8faf7] border-4 border-[#1c2e1b]/20 shadow-inner flex items-center justify-center">
                    {/* 表盘 12 个微刻度 */}
                    {[...Array(12)].map((_, i) => (
                      <div
                        key={i}
                        className="absolute w-0.5 h-2 bg-[#1c2e1b]/30"
                        style={{
                          transform: `rotate(${i * 30}deg) translateY(-60px)`,
                        }}
                      />
                    ))}

                    {/* 时针 */}
                    <div
                      className="absolute w-1.5 h-9 bg-[#1c2e1b] rounded-full origin-bottom"
                      style={{
                        transform: `rotate(${hourDeg}deg) translateY(-50%)`,
                        bottom: '50%',
                      }}
                    />

                    {/* 分针 */}
                    <div
                      className="absolute w-1 h-13 bg-[#1c2e1b]/80 rounded-full origin-bottom"
                      style={{
                        transform: `rotate(${minDeg}deg) translateY(-50%)`,
                        bottom: '50%',
                      }}
                    />

                    {/* 秒针 (珊瑚橙色高光指针) */}
                    <div
                      className="absolute w-0.5 h-15 bg-[#FF5A36] rounded-full origin-bottom shadow-sm"
                      style={{
                        transform: `rotate(${secDeg}deg) translateY(-50%)`,
                        bottom: '50%',
                      }}
                    />

                    {/* 中心转轴点 */}
                    <div className="absolute w-3 h-3 rounded-full bg-[#FF5A36] border-2 border-white shadow-xs z-10" />
                  </div>

                  <div className="mt-3 flex items-center justify-between w-full px-2 text-[11px] font-mono font-bold text-[#1c2e1b]/80">
                    <span>考场准时率: 98.6%</span>
                    <span>UTC+8 {TODAY}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#1c2e1b]/15 text-xs font-bold text-[#1c2e1b]">
                  <span>今日排期场次: 2 场待考</span>
                  <button onClick={() => go('room', 'c1')} className="underline hover:opacity-80">
                    立即开考 →
                  </button>
                </div>
              </div>

              {/* ---------------- 5. AI OPERATIONS LEAD (智能招聘专家对话协同舱 - 对标原图右下角) ---------------- */}
              <div className="lg:col-span-5 rounded-3xl bg-[#1c1d24] p-5 sm:p-6 text-white shadow-2xl border border-white/10 flex flex-col justify-between min-h-[320px]">
                <div>
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="avatar placeholder">
                        <div className="bg-gradient-to-tr from-violet-500 to-indigo-600 text-white rounded-full w-8 h-8 font-black text-xs shadow-md">
                          AI
                        </div>
                      </div>
                      <div>
                        <h2 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
                          AI OPERATIONS LEAD
                          <span className="badge badge-xs badge-success">在线</span>
                        </h2>
                        <p className="text-[10px] text-white/50">全域业务协同 · 智能初筛与考题调度引擎</p>
                      </div>
                    </div>
                    <span className="cursor-pointer text-white/40 hover:text-white">↗</span>
                  </div>

                  {/* 对话消息区 (使用 daisyUI chat 组件规范) */}
                  <div className="mt-3.5 space-y-2.5 max-h-44 overflow-y-auto pr-1">
                    {aiHistory.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`chat ${msg.who === 'ai' ? 'chat-start' : 'chat-end'} text-xs`}
                      >
                        <div
                          className={`chat-bubble text-xs leading-relaxed ${
                            msg.who === 'ai'
                              ? 'bg-white/10 text-white/90 border border-white/10'
                              : 'bg-[#FF5A36] text-white font-medium'
                          }`}
                        >
                          {msg.text}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 快捷操作胶囊按钮组 (与原图「Show staff load」等完全呼应) */}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => go('candidates')}
                      className="btn btn-xs rounded-full bg-white/10 border-white/15 text-white hover:bg-white/20"
                    >
                      ⚡ 查看候选人全池
                    </button>
                    <button
                      onClick={() => go('schedule')}
                      className="btn btn-xs rounded-full bg-white/10 border-white/15 text-white hover:bg-white/20"
                    >
                      📅 发起批量约面
                    </button>
                    <button
                      onClick={handleSync}
                      className="btn btn-xs rounded-full bg-white/10 border-white/15 text-white hover:bg-white/20"
                    >
                      🔄 同步影刀落库
                    </button>
                  </div>
                </div>

                {/* 底部 AI 多模态输入栏 */}
                <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={aiMessage}
                      onChange={(e) => setAiMessage(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendAi()}
                      placeholder="向 AI 招聘助手提问，例如：'分析王磊的技术疑点'…"
                      className="input input-sm w-full bg-white/5 border-white/15 text-xs text-white placeholder:text-white/35 rounded-full pr-8 focus:outline-none focus:border-white/40"
                    />
                    <button
                      onClick={handleSendAi}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-white/60 hover:text-white text-xs cursor-pointer"
                    >
                      ⏎
                    </button>
                  </div>
                  <button
                    onClick={() => handleSendAi()}
                    className="btn btn-sm btn-circle bg-[#FF5A36] hover:bg-[#FF4E27] text-white border-0 shadow-md"
                  >
                    🎙️
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
