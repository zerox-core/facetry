import type React from 'react'
import { useState, useEffect } from 'react'
import { candidates, positions, TODAY } from '../data'
import { approvals, runningRoomId, triggerSourceDbSync } from '../store'
import type { Go } from '../App'

// ── 规范统一的微型科技 SVG 图标库（统一 14~16px，细线条，现代专业） ──
const Icon = {
  Activity: () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  ),
  Users: () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  Calendar: () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="4" rx="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  ),
  Clock: () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  CheckCircle: () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  ArrowUpRight: () => (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="7" y1="17" x2="17" y2="7" /><polyline points="7 7 17 7 17 17" />
    </svg>
  ),
  Refresh: ({ spinning }: { spinning?: boolean }) => (
    <svg className={`w-3.5 h-3.5 ${spinning ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" /><path d="M16 21h5v-5" />
    </svg>
  ),
  Bot: () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" /><path d="M2 14h2" /><path d="M20 14h2" /><path d="M15 13v2" /><path d="M9 13v2" />
    </svg>
  ),
  Radar: () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19.07 4.93a10 10 0 0 0-14.14 0" /><path d="M16.24 7.76a6 6 0 0 0-8.48 0" /><line x1="12" y1="12" x2="12" y2="2" /><circle cx="12" cy="12" r="1" />
    </svg>
  ),
  Building: () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="16" height="20" x="4" y="2" rx="2" /><line x1="9" x2="9.01" y1="6" y2="6" /><line x1="15" x2="15.01" y1="6" y2="6" /><line x1="9" x2="9.01" y1="10" y2="10" /><line x1="15" x2="15.01" y1="10" y2="10" /><line x1="9" x2="9.01" y1="14" y2="14" /><line x1="15" x2="15.01" y1="14" y2="14" /><path d="M9 18h6v4H9z" />
    </svg>
  ),
  Send: () => (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  ),
}

// ── 现场采音波形：14 根柱子，各自的周期（780~1400ms）与相位（0~330ms）都不同 ──
// 高度是柱子的「静态基准高度」：动画只叠一层 scaleY，所以动画被
// prefers-reduced-motion 降级（全局规则把 duration 压到 0.01ms）后，
// 剩下的仍是一段高低起伏、可读的波形轮廓，而不是一条直线。
const WAVE_BARS = [
  { h: 26, dur: 900, delay: 0 },
  { h: 52, dur: 1150, delay: 90 },
  { h: 78, dur: 780, delay: 220 },
  { h: 44, dur: 1320, delay: 60 },
  { h: 92, dur: 1020, delay: 300 },
  { h: 60, dur: 860, delay: 150 },
  { h: 34, dur: 1240, delay: 240 },
  { h: 70, dur: 960, delay: 30 },
  { h: 100, dur: 1400, delay: 180 },
  { h: 48, dur: 820, delay: 270 },
  { h: 82, dur: 1180, delay: 120 },
  { h: 38, dur: 1060, delay: 330 },
  { h: 66, dur: 900, delay: 210 },
  { h: 30, dur: 1280, delay: 75 },
]

const LIVE_WAVE_CSS = `
@keyframes bento-live-wave { 0%, 100% { transform: scaleY(0.45) } 50% { transform: scaleY(1) } }
.bento-live-wave-bar {
  transform-origin: center;
  animation-name: bento-live-wave;
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
}
@media (prefers-reduced-motion: reduce) {
  .bento-live-wave-bar { animation: none !important; }
}
`

type Props = {
  go: Go
  onSwitchView?: () => void
}

export default function ColorBentoDashboard({ go, onSwitchView }: Props) {
  const [time, setTime] = useState(new Date())
  const [syncToast, setSyncToast] = useState('')
  const [isSyncing, setIsSyncing] = useState(false)
  const [aiMessage, setAiMessage] = useState('')
  const [aiHistory, setAiHistory] = useState([
    {
      who: 'ai',
      text: '已检视候选人全库：今日有 2 场重点现场考场待进行；商业化大前端 HC 紧迫，建议优先完成王磊的初筛复核并安排复试。',
    },
  ])

  // 时钟指针实时走动
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // 图表进场进度 0 → 1（600ms 缓出）：柱高/环图/进度条与数字同步从 0 过渡到目标值。
  // 尊重 prefers-reduced-motion：直接到位，不做滚动。
  const [enterP, setEnterP] = useState(0)
  useEffect(() => {
    if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setEnterP(1)
      return
    }
    let raf = 0
    let t0 = 0
    const step = (now: number) => {
      if (!t0) t0 = now
      const t = Math.min(1, (now - t0) / 600)
      setEnterP(1 - (1 - t) ** 3)
      if (t < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [])

  const entered = enterP > 0
  /** 数字滚动：目标值 × 进场进度（默认整数，d 为小数位） */
  const roll = (v: number, d = 0) => (v * enterP).toFixed(d)

  const seconds = time.getSeconds()
  const minutes = time.getMinutes()
  const hours = time.getHours() % 12
  const secDeg = seconds * 6
  const minDeg = minutes * 6 + seconds * 0.1
  const hourDeg = hours * 30 + minutes * 0.5

  // 核心功能真实数据筛选
  const pendingScreen = candidates.filter((c) => c.status === '新入库' || c.status === '筛选中')
  const pendingSchedule = candidates.filter((c) => c.status === '待联系' || c.status === '约面中')
  const pendingReview = candidates.filter((c) => c.status === '面评中')
  const pendingApproval = approvals.filter((a) => a.finalStatus === 'processing' || a.finalStatus === 'partial')
  const totalTodo = pendingScreen.length + pendingSchedule.length + pendingReview.length + pendingApproval.length

  // 当前激活的现场考场
  const activeRoomCid = runningRoomId()
  const activeRoomCandidate = activeRoomCid ? candidates.find((c) => c.id === activeRoomCid) : null

  // ── 现场考场条的真实数据：全部取自 data.ts 的约面场次（scheduleDetail） ──
  const roomSessions = candidates
    .filter((c) => c.scheduleDetail?.type === 'offline' && c.scheduleDetail.status === 'scheduled')
    .map((c) => ({ cid: c.id, name: c.name, d: c.scheduleDetail! }))
    .sort((a, b) => a.d.slot.localeCompare(b.d.slot))
  const roomToday = roomSessions.filter((s) => s.d.slot.startsWith(TODAY))
  const roomQueue = roomToday.length ? roomToday : roomSessions // 今日无现场场次时退化为「最近一场」
  const roomHead = roomQueue[0]
  const roomWaiting = roomQueue.length
  const roomInterviewers = new Set(roomQueue.map((s) => s.d.interviewer)).size
  const roomLoad = roomInterviewers ? roomQueue.length / roomInterviewers : 0
  const roomNoticeDone = roomQueue.filter((s) => s.d.noticeStatus === 'sent' || s.d.noticeStatus === 'confirmed').length
  const roomOnTime = roomQueue.length ? Math.round((roomNoticeDone / roomQueue.length) * 100) : 100

  // 今日场次通知确认率（≈ 准时率）：让卡片上的百分比同样来自数据而非写死
  const todaySessions = candidates.filter((c) => c.scheduleDetail?.status === 'scheduled' && c.scheduleDetail.slot.startsWith(TODAY))
  const todayNotified = todaySessions.filter((c) => c.scheduleDetail!.noticeStatus === 'sent' || c.scheduleDetail!.noticeStatus === 'confirmed').length
  const todayOnTime = todaySessions.length ? Math.round((todayNotified / todaySessions.length) * 100) : 100

  const handleSync = () => {
    setIsSyncing(true)
    setTimeout(() => {
      const res = triggerSourceDbSync()
      setIsSyncing(false)
      setSyncToast(`影刀来源库抓取成功：新增 ${res.newCount} 条高匹配简历，${res.ignoredCount} 条已存在跳过`)
      setTimeout(() => setSyncToast(''), 3500)
    }, 600)
  }

  const handleSendAi = () => {
    if (!aiMessage.trim()) return
    const text = aiMessage.trim()
    setAiHistory((prev) => [
      ...prev,
      { who: 'user', text },
      {
        who: 'ai',
        text: `已为你智能解析「${text}」：已联动后台影刀流水线与飞书日程，正在匹配标尺特征库，建议直接进入候选人大池进行批量调度。`,
      },
    ])
    setAiMessage('')
  }

  return (
    <div className="h-full flex flex-col justify-between overflow-hidden gap-3.5 pb-1 select-none">
      <style>{LIVE_WAVE_CSS}</style>
      {/* ──────────────── 1. 顶部超薄状态与全域跳转控制栏 ──────────────── */}
      <div className="shrink-0 flex items-center justify-between gap-4 px-4 py-1 rounded-2xl bg-base-100 border border-base-300 text-base-content shadow-lg">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent" />
            </span>
            <span className="text-sm font-black tracking-tight">AI 智能招聘指挥中枢</span>
            <span className="badge badge-xs bg-base-content/10 text-base-content/70 border-0 font-medium">Bento v2.0</span>
          </div>
          <span className="text-base-content/20">|</span>
          <div className="hidden sm:flex items-center gap-3 text-xs text-base-content/70">
            <span className="flex items-center gap-2 text-success font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
              影刀自动化流水线监听中
            </span>
            <span className="text-base-content/30">·</span>
            <span>
              待处理总待办: <strong className="text-base-content font-bold tabular-nums">{roll(totalTodo)}</strong> 项
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {syncToast && (
            <span className="text-xs text-success font-medium animate-pulse hidden md:inline">
              ✓ {syncToast}
            </span>
          )}
          <button
            onClick={handleSync}
            className="btn btn-xs rounded-full bg-base-content/5 hover:bg-base-content/10 text-base-content border-base-content/15 gap-2 cursor-pointer motion-pop"
            title="刷新拉取影刀落库数据"
          >
            <Icon.Refresh spinning={isSyncing} />
            <span>拉取影刀落库</span>
          </button>
          <button
            onClick={() => go('candidates')}
            className="btn btn-xs rounded-full bg-primary hover:bg-primary/90 text-primary-content border-0 font-bold gap-2 shadow-md cursor-pointer motion-pop"
          >
            <span>全池调度</span>
            <Icon.ArrowUpRight />
          </button>
          {onSwitchView && (
            <button
              onClick={onSwitchView}
              className="btn btn-xs btn-ghost rounded-full text-base-content/60 hover:text-base-content text-xs motion-pop"
            >
              列表待办
            </button>
          )}
        </div>
      </div>

      {/* ──────────────── 2. 核心 Bento 单屏自适应网格 (上下两排严格配比，无滚动) ──────────────── */}
      <div className="flex-1 min-h-0 grid grid-rows-[1.08fr_0.92fr] gap-3.5">

        {/* ══════════════ 上排（占比约 54%）：漏斗与初筛 (左7) + 考场容量与时钟 (右5) ══════════════ */}
        <div className="min-h-0 grid grid-cols-12 gap-3.5">
          {/* ---------------- 模块 1（左 7 列）：白卡吞吐漏斗（墨灰数据柱 + 荧光当前柱）+ 待初筛精选列表 ---------------- */}
          <div className="col-span-7 rounded-3xl bg-base-100 border border-base-300 p-4 text-base-content shadow-lg flex flex-col justify-between overflow-hidden relative group transition-shadow duration-300 hover:shadow-xl">
            {/* 卡片顶栏 */}
            <div className="flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-lg bg-neutral text-neutral-content">
                  <Icon.Activity />
                </div>
                <div>
                  <h2 className="text-sm font-black tracking-wider uppercase leading-tight">THROUGHPUT · 漏斗吞吐时效</h2>
                  <p className="text-[10px] text-base-content/60">影刀自动化落库 → AI 智能初筛 → 飞书约面</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="badge badge-xs bg-base-content/5 text-base-content/70 border-0">周级动态</span>
                <button
                  onClick={() => go('candidates')}
                  className="badge badge-xs bg-neutral text-neutral-content border-0 font-black cursor-pointer tabular-nums motion-pop"
                >
                  在库 {candidates.length} 人 ↗
                </button>
              </div>
            </div>

            {/* 中间区：柱状吞吐阶梯 + 2 个关键流转指标卡片 */}
            <div className="my-2 grid grid-cols-[1fr_180px] gap-4 items-end shrink-0">
              {/* 柱状模拟图：柱高用 .motion-meter 从 0 过渡，柱顶数字同步滚动且常驻可见 */}
              <div className="bg-base-content/5 rounded-2xl p-2.5 border border-base-content/10">
                <div
                  className="relative flex items-stretch justify-between gap-2 h-20 px-1 border-b border-base-content/15 pb-1"
                  role="img"
                  aria-label="近七日漏斗吞吐阶梯：初筛、约面、考场、面评、今日吞吐、审批、Offer"
                >
                  {[
                    { day: '一', val: 55, name: '初筛' },
                    { day: '二', val: 72, name: '约面' },
                    { day: '三', val: 92, name: '考场' },
                    { day: '四', val: 80, name: '面评' },
                    { day: '五', val: 100, name: '今日吞吐', active: true },
                    { day: '六', val: 40, name: '审批' },
                    { day: '日', val: 30, name: 'Offer' },
                  ].map((bar) => (
                    <div
                      key={bar.day}
                      className="flex-1 h-full flex flex-col items-center gap-1 group/bar"
                      title={`${bar.name} ${bar.val}%${bar.active ? ` · 在库 ${candidates.length} 人` : ''}`}
                    >
                      <span className="text-[9px] font-bold tabular-nums leading-none opacity-90">{roll(bar.val)}%</span>
                      <div className="w-full flex-1 min-h-0 flex flex-col justify-end">
                        <div
                          className={`w-full rounded-t motion-meter ${
                            bar.active ? 'bg-accent' : 'bg-secondary group-hover/bar:bg-secondary/70'
                          }`}
                          style={{ height: entered ? `${bar.val}%` : '0%' }}
                        />
                      </div>
                      <span className="text-[9px] font-bold opacity-80 leading-none">{bar.day}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-1.5 px-0.5">
                  <div className="flex items-center justify-between text-[10px] text-base-content/70 font-medium">
                    <span className="tabular-nums">影刀日落库峰值: 98 份/日</span>
                    <span className="tabular-nums">AI 命中率: {roll(94.2, 1)}%</span>
                  </div>
                  {/* 命中率进度条：进场从 0 撑到目标宽度 */}
                  <div
                    className="mt-1 h-1 w-full rounded-full bg-base-content/10 overflow-hidden"
                    role="progressbar"
                    aria-label="AI 初筛命中率"
                    aria-valuenow={94.2}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div className="h-full rounded-full bg-accent motion-meter" style={{ width: entered ? '94.2%' : '0%' }} />
                  </div>
                </div>
              </div>

              {/* 右侧小指标 */}
              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => go('candidates')}
                  className="w-full text-left cursor-pointer rounded-xl bg-base-content/5 p-2 border border-base-content/10 hover:bg-base-content/10 motion-pop"
                >
                  <div className="flex items-center justify-between gap-2 text-[10px] text-base-content/60">
                    <span>流转周期</span>
                    <span className="badge badge-xs bg-success text-success-content font-black tabular-nums">-2.4d</span>
                  </div>
                  <div className="text-lg font-black tracking-tight leading-tight tabular-nums">
                    {roll(3.4, 1)} <span className="text-[10px] font-normal opacity-80">天/均</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => go('candidates')}
                  className="w-full text-left cursor-pointer rounded-xl bg-base-content/5 p-2 border border-base-content/10 hover:bg-base-content/10 motion-pop"
                >
                  <div className="flex items-center justify-between gap-2 text-[10px] text-base-content/60">
                    <span>待初筛复核</span>
                    <span className="badge badge-xs bg-warning text-warning-content font-black">需确认</span>
                  </div>
                  <div className="text-lg font-black tracking-tight leading-tight tabular-nums">
                    {roll(pendingScreen.length)} <span className="text-[10px] font-normal opacity-80">人选</span>
                  </div>
                </button>
              </div>
            </div>

            {/* 下部：待初筛流水线直接展开 3 个真实人选 (支持一键下钻详情) */}
            <div className="mt-1.5 pt-2 border-t border-base-content/10 flex-1 min-h-0 flex flex-col justify-between">
              <div className="flex items-center justify-between gap-3 text-[11px] mb-1.5 font-bold">
                <span className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-neutral" />
                  新入库待初筛流水线人选（点击直接下钻）
                </span>
                <button onClick={() => go('candidates')} className="underline hover:opacity-80 text-[10px] motion-pop">
                  全池筛选 →
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3 stagger">
                {pendingScreen.slice(0, 3).map((c, i) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => go('detail', c.id)}
                    style={{ '--i': i } as React.CSSProperties}
                    className="text-left cursor-pointer rounded-xl bg-base-content/5 p-2 border border-base-content/10 hover:bg-neutral hover:text-neutral-content motion-pop group/cand"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-xs truncate">{c.name}</span>
                      <span className="badge badge-xs bg-success text-success-content font-black tabular-nums">
                        {c.match ?? 88}分
                      </span>
                    </div>
                    <div className="mt-1 text-[10px] opacity-80 truncate">{c.role}</div>
                    <div className="mt-1.5 text-[9px] line-clamp-1 opacity-70 bg-base-content/10 group-hover/cand:bg-neutral-content/10 rounded px-1">
                      {c.highlights?.[0] || '微前端高并发'}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ---------------- 模块 2（右 5 列）：考场容量（墨黑锚点卡）+ 考场时钟（白卡） ---------------- */}
          {/* 两行配比 1.07/0.93：把空间让给内容更满的考场容量卡（时钟卡有富余），
              这是间距整体放大后保证 1280×800 不裁切的补偿手段 */}
          <div className="col-span-5 grid grid-rows-[1.07fr_0.93fr] gap-3.5">
            {/* 2.1 墨黑锚点卡 · 考场负荷监控 */}
            <div className="rounded-3xl bg-neutral text-neutral-content p-3.5 shadow-lg flex flex-col justify-between overflow-hidden relative group transition-shadow duration-300 hover:shadow-xl">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-lg bg-neutral-content/10 text-neutral-content">
                    <Icon.Building />
                  </div>
                  <div>
                    <h3 className="text-xs font-black tracking-wider uppercase">VENUE CAPACITY · 考场容量</h3>
                    <p className="text-[10px] text-neutral-content/60">现场面试间与飞书连线负荷</p>
                  </div>
                </div>
                <button
                  onClick={() => go('schedule')}
                  className="badge badge-xs bg-neutral-content/10 hover:bg-neutral-content/20 text-neutral-content border-0 font-bold cursor-pointer motion-pop"
                >
                  约面排期 ↗
                </button>
              </div>

              {/* 4 组 DaisyUI radial-progress 环形刻度：--value 与数字一起 0→目标滚动
                  注：这张卡的内容正好填满行高，所以这里的纵向留白是全页唯一「主动收紧」的地方
                  （配合顶栏 py-1 一起给 1280×800 留出不裁切的安全边界） */}
              <div className="my-1 grid grid-cols-4 gap-2.5 text-center items-center stagger">
                {[
                  { label: '周一', pct: 78, tag: '已满' },
                  { label: '周二', pct: 82, tag: '饱和' },
                  { label: '周三', pct: 91, tag: '高峰', alert: true },
                  { label: '今日', pct: 88, tag: `${TODAY.slice(5)}`, current: true },
                ].map((item, i) => (
                  <div key={item.label} className="flex flex-col items-center" style={{ '--i': i } as React.CSSProperties}>
                    <div
                      className={`radial-progress text-[10px] font-bold tabular-nums ${
                        item.current ? 'text-accent' : item.alert ? 'text-warning' : 'text-neutral-content/70'
                      }`}
                      style={{
                        '--value': item.pct * enterP,
                        '--size': '2.6rem',
                        '--thickness': '3px',
                      } as React.CSSProperties}
                      role="progressbar"
                      aria-label={`${item.label} 考场容量占用`}
                      aria-valuenow={item.pct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      {roll(item.pct)}%
                    </div>
                    <span className="mt-0.5 text-[10px] font-bold">{item.label}</span>
                    <span className={`mt-0.5 text-[8px] rounded px-1 tabular-nums ${item.current ? 'bg-accent text-accent-content font-bold' : 'bg-neutral-content/10 text-neutral-content/70'}`}>
                      {item.tag}
                    </span>
                  </div>
                ))}
              </div>

              {/* 现场实录考场：① 在线状态 ② 真实指标 ③ 操作入口 + 采音波形 */}
              <div className="relative h-9 rounded-lg bg-neutral-content/10 border border-neutral-content/15 flex items-center gap-2 px-1.5 overflow-hidden">
                {/* ① 考场与在线状态（点 + 文字，不靠颜色承载信息） */}
                <div
                  className="shrink-0 flex items-center gap-2"
                  title="北京总部 · 现场实录考场，采音与 AI 转录通道在线"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
                  </span>
                  <span className="text-[9px] font-bold text-neutral-content leading-none whitespace-nowrap">实录考场 · 北京总部</span>
                  <span className="text-[8px] font-bold text-neutral-content leading-none">在线</span>
                </div>
                <span className="h-3.5 w-px bg-neutral-content/20 shrink-0" aria-hidden="true" />

                {/* ② 真实取自约面数据的指标 */}
                <div className="min-w-0 flex items-center gap-2 overflow-hidden text-neutral-content">
                  <span className="flex items-baseline gap-1 whitespace-nowrap" title={roomHead ? `下一场：${roomHead.d.slot} ${roomHead.d.round} · ${roomHead.name} · 考官 ${roomHead.d.interviewer}` : '今日暂无现场场次'}>
                    <span className="text-[8px] text-neutral-content/60">下一场</span>
                    <span className="text-[9px] font-bold tabular-nums">{roomHead ? roomHead.d.slot.slice(11, 16) : '--:--'}</span>
                  </span>
                  <span className="text-[8px] text-neutral-content/40">|</span>
                  <span className="flex items-baseline gap-1 whitespace-nowrap" title="今日现场场次候场人数（scheduleDetail.type = offline）">
                    <span className="text-[8px] text-neutral-content/60">候场</span>
                    <span className="text-[9px] font-bold tabular-nums">{roll(roomWaiting)}</span>
                    <span className="text-[8px] text-neutral-content/60">人</span>
                  </span>
                  <span className="text-[8px] text-neutral-content/40">|</span>
                  <span className="flex items-baseline gap-1 whitespace-nowrap" title="场次 ÷ 现场考官人数">
                    <span className="text-[8px] text-neutral-content/60">考官负荷</span>
                    <span className="text-[9px] font-bold tabular-nums">{roll(roomLoad, 1)}</span>
                    <span className="text-[8px] text-neutral-content/60">场/日</span>
                  </span>
                  <span className="hidden xl:flex items-center gap-2">
                    <span className="text-[8px] text-neutral-content/40">|</span>
                    <span className="flex items-baseline gap-1 whitespace-nowrap" title="现场场次通知已送达/已确认比例（取自约面 noticeStatus）">
                      <span className="text-[8px] text-neutral-content/60">准时</span>
                      <span className="text-[9px] font-bold tabular-nums">{roll(roomOnTime)}%</span>
                    </span>
                  </span>
                </div>

                {/* 采音波形：多元素不同频率/相位；静止时保留波形轮廓 */}
                <div
                  className="flex-1 min-w-[52px] h-5 flex items-center justify-center gap-[2px]"
                  role="img"
                  aria-label="现场采音波形（不同频率与相位的动态示意，减少动效时显示静态波形轮廓）"
                >
                  {WAVE_BARS.map((b, i) => (
                    <span
                      key={i}
                      className={`bento-live-wave-bar w-[2px] rounded-full ${i >= 5 && i <= 8 ? 'bg-accent' : 'bg-neutral-content/35'}`}
                      style={{ height: `${b.h}%`, animationDuration: `${b.dur}ms`, animationDelay: `${b.delay}ms` }}
                    />
                  ))}
                </div>

                {/* ③ 明确操作入口 */}
                <div className="shrink-0 flex items-center gap-2">
                  <button
                    onClick={() => go('room', activeRoomCid || roomHead?.cid || 'c1')}
                    className="btn btn-xs h-6 min-h-6 rounded-full bg-neutral-content hover:bg-neutral-content/90 text-neutral border-0 font-bold text-[9px] px-2 gap-1 shadow cursor-pointer motion-pop"
                  >
                    <span>进入面试间</span>
                    <Icon.ArrowUpRight />
                  </button>
                  <button
                    onClick={() => go('schedule')}
                    className="text-[9px] font-bold text-neutral-content/80 hover:text-neutral-content underline whitespace-nowrap cursor-pointer motion-pop"
                  >
                    查看考场
                  </button>
                </div>
              </div>
            </div>

            {/* 2.2 白卡 考场时钟与现场实况直通 */}
            <div className="rounded-3xl bg-base-100 border border-base-300 p-3.5 text-base-content shadow-lg flex items-center justify-between gap-3.5 overflow-hidden relative group transition-shadow duration-300 hover:shadow-xl">
              {/* 模拟时钟微表盘 */}
              <div className="relative w-20 h-20 shrink-0 rounded-full bg-neutral border-2 border-base-300 shadow-inner flex items-center justify-center">
                {[...Array(12)].map((_, i) => (
                  <div
                    key={i}
                    className="absolute w-0.5 h-1 bg-neutral-content/30"
                    style={{ transform: `rotate(${i * 30}deg) translateY(-34px)` }}
                  />
                ))}
                {/* 时针 */}
                <div
                  className="absolute w-1 h-5 bg-neutral-content rounded-full origin-bottom"
                  style={{ transform: `rotate(${hourDeg}deg) translateY(-50%)`, bottom: '50%' }}
                />
                {/* 分针 */}
                <div
                  className="absolute w-0.5 h-7 bg-neutral-content/80 rounded-full origin-bottom"
                  style={{ transform: `rotate(${minDeg}deg) translateY(-50%)`, bottom: '50%' }}
                />
                {/* 秒针 */}
                <div
                  className="absolute w-0.5 h-8 bg-accent rounded-full origin-bottom"
                  style={{ transform: `rotate(${secDeg}deg) translateY(-50%)`, bottom: '50%' }}
                />
                <div className="absolute w-2 h-2 rounded-full bg-accent z-10" />
              </div>

              {/* 右侧考场直通操作 */}
              <div className="flex-1 min-w-0 flex flex-col justify-between h-full py-0.5">
                <div className="flex items-center justify-between gap-2 text-[10px] font-bold">
                  <span className="flex items-center gap-1.5 text-base-content">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent animate-ping" />
                    现场考场在线中
                  </span>
                  <span
                    className="badge badge-xs bg-base-content/5 text-base-content border-0 font-bold tabular-nums"
                    title="今日场次通知已送达/已确认比例（取自约面 noticeStatus）"
                  >
                    准时率 {roll(todayOnTime)}%
                  </span>
                </div>

                <div className="truncate font-black text-xs text-base-content mt-1.5">
                  {activeRoomCandidate ? `${activeRoomCandidate.name} · ${activeRoomCandidate.role}` : 'c1 王磊 · 商业化大前端专家'}
                </div>
                <div className="text-[9px] text-base-content/60">实录模式 · AI 实时转录与智能追问</div>

                <button
                  onClick={() => go('room', activeRoomCid || 'c1')}
                  className="mt-1.5 w-full btn btn-xs rounded-lg bg-primary hover:bg-primary/90 text-primary-content border-0 font-bold gap-2 shadow cursor-pointer motion-pop"
                >
                  <span>进入考场面试间</span>
                  <Icon.ArrowUpRight />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════ 下排（占比约 46%）：渠道坐标网格 (左4) + 双轨审批中心 (中4) + AI协同舱 (右4) ══════════════ */}
        <div className="min-h-0 grid grid-cols-12 gap-3.5">

          {/* ---------------- 模块 3（左 4 列）：黑白坐标纸渠道雷达 ---------------- */}
          <div className="col-span-4 rounded-3xl bg-base-100 border border-base-300 p-3.5 text-base-content shadow-lg flex flex-col justify-between overflow-hidden relative group transition-shadow duration-300 hover:shadow-xl">
            <div className="flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-1 rounded-md bg-neutral text-neutral-content">
                  <Icon.Radar />
                </div>
                <h3 className="text-xs font-black tracking-wider uppercase text-base-content">POINTS &amp; CHANNELS</h3>
              </div>
              <button
                onClick={handleSync}
                className="badge badge-xs bg-base-content/5 text-base-content border-0 font-bold cursor-pointer hover:bg-base-content/10 motion-pop"
              >
                刷新同步 ↻
              </button>
            </div>

            {/* 科技坐标网格纸 */}
            <div className="my-2 flex-1 min-h-0 rounded-xl bg-base-200 border border-base-300 p-2.5 relative overflow-hidden flex flex-col justify-between [background-image:linear-gradient(to_right,rgba(0,0,0,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.06)_1px,transparent_1px)] [background-size:14px_14px]">
              <button
                type="button"
                onClick={() => go('candidates')}
                title="影刀流水线抓取：占渠道来源 82%"
                className="relative overflow-hidden self-start cursor-pointer flex items-center gap-2 bg-base-100 px-2 py-0.5 rounded-full shadow-sm border border-base-300 motion-pop"
              >
                {/* 占比进度：从 0 撑到 82% */}
                <span className="absolute inset-y-0 left-0 rounded-full bg-secondary/25 motion-meter" style={{ width: entered ? '82%' : '0%' }} aria-hidden="true" />
                <span className="relative h-1.5 w-1.5 rounded-full bg-secondary animate-ping" />
                <span className="relative text-[10px] font-bold text-base-content tabular-nums">影刀流水线抓取 (82%)</span>
              </button>

              <button
                type="button"
                onClick={() => go('jobs')}
                className="relative self-center my-1.5 cursor-pointer flex items-center gap-2 bg-neutral text-neutral-content px-2.5 py-1 rounded-full shadow motion-pop"
              >
                <span className="text-[10px] font-bold tabular-nums">大前端与 AI 算法专家池 (78 份就绪)</span>
              </button>

              <button
                type="button"
                onClick={() => go('candidates')}
                title="内推与定向邀约：占渠道来源 18%"
                className="relative overflow-hidden self-end cursor-pointer flex items-center gap-2 bg-base-100 px-2 py-0.5 rounded-full shadow-sm border border-base-300 motion-pop"
              >
                {/* 占比进度：从 0 撑到 18% */}
                <span className="absolute inset-y-0 left-0 rounded-full bg-success/30 motion-meter" style={{ width: entered ? '18%' : '0%' }} aria-hidden="true" />
                <span className="relative h-1.5 w-1.5 rounded-full bg-success" />
                <span className="relative text-[10px] font-bold text-base-content tabular-nums">内推与定向邀约 (18%)</span>
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 text-[10px] font-bold text-base-content/70 shrink-0">
              <span className="tabular-nums">有效渠道转化率: {roll(42.8, 1)}%</span>
              <button onClick={() => go('candidates')} className="underline hover:opacity-80 cursor-pointer motion-pop">
                查看全量渠道 →
              </button>
            </div>
          </div>

          {/* ---------------- 模块 4（中 4 列）：录取审批 · 双轨流转中枢 ---------------- */}
          <div className="col-span-4 rounded-3xl bg-base-100 p-3.5 text-base-content shadow-lg border border-base-300 flex flex-col justify-between overflow-hidden relative group transition-shadow duration-300 hover:shadow-xl">
            <div className="flex items-center justify-between gap-3 border-b border-base-content/10 pb-2 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-1 rounded-md bg-base-content/5 text-base-content">
                  <Icon.CheckCircle />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-base-content">录取审批 · 双轨中心</h3>
                  <p className="text-[9px] text-base-content/50">业务线 + HR 双边决策</p>
                </div>
              </div>
              <button
                onClick={() => go('approvals')}
                className="badge badge-xs bg-base-content/5 text-base-content border-0 font-bold cursor-pointer hover:bg-base-content/10 tabular-nums motion-pop"
              >
                待批 {roll(pendingApproval.length)} 份 ↗
              </button>
            </div>

            {/* 真实审批流单据列表 */}
            <div className="my-2 space-y-2.5 flex-1 min-h-0 overflow-hidden stagger">
              {pendingApproval.slice(0, 2).map((app, i) => (
                <button
                  key={app.id}
                  type="button"
                  onClick={() => go('approvals')}
                  style={{ '--i': i } as React.CSSProperties}
                  className="w-full text-left cursor-pointer rounded-xl bg-base-content/5 p-2 border border-base-content/5 hover:border-secondary/50 hover:bg-base-content/10 motion-pop"
                >
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="font-bold text-base-content truncate">{app.candidateName} · {app.positionName}</span>
                    <span className="badge badge-xs bg-warning/20 text-warning border-0 font-bold">
                      {app.finalStatus === 'processing' ? '审批中' : '单边通过'}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] text-base-content/60 tabular-nums">
                    <span>期望: {app.salary}</span>
                    <span className={app.feishu.status === 'approved' ? 'text-success font-medium' : 'text-base-content/60'}>
                      业务: {app.feishu.status === 'approved' ? '已批' : '待处理'}
                    </span>
                    <span className={app.bpm.status === 'approved' ? 'text-success font-medium' : 'text-base-content/60'}>
                      HR: {app.bpm.status === 'approved' ? '已批' : '待处理'}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between gap-3 pt-1.5 border-t border-base-content/10 text-[10px] shrink-0">
              <span className="text-base-content/60 tabular-nums">平均审批时效: 1.2 天</span>
              <button
                onClick={() => go('approvals')}
                className="btn btn-xs rounded-full bg-secondary hover:bg-secondary/90 text-secondary-content border-0 font-bold text-[10px] h-6 min-h-6 cursor-pointer motion-pop"
              >
                进入审批处理 →
              </button>
            </div>
          </div>

          {/* ---------------- 模块 5（右 4 列）：AI OPERATIONS LEAD 智能专家协同舱 ---------------- */}
          <div className="col-span-4 rounded-3xl bg-base-100 p-3.5 text-base-content shadow-lg border border-base-300 flex flex-col justify-between overflow-hidden relative group transition-shadow duration-300 hover:shadow-xl">
            <div className="flex items-center justify-between gap-3 border-b border-base-content/10 pb-2 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-1 rounded-md bg-neutral text-neutral-content shadow-sm">
                  <Icon.Bot />
                </div>
                <div>
                  <h3 className="text-xs font-bold tracking-tight text-base-content flex items-center gap-2">
                    AI OPERATIONS LEAD
                    <span className="badge badge-xs badge-success h-4 text-[9px]">在线</span>
                  </h3>
                  <p className="text-[9px] text-base-content/50">智能初筛与考题调度引擎</p>
                </div>
              </div>
              <button
                onClick={() => go('candidates')}
                className="text-base-content/40 hover:text-base-content cursor-pointer motion-pop"
                aria-label="在候选人大池中查看 AI 协同记录"
                title="在候选人大池中查看"
              >
                <Icon.ArrowUpRight />
              </button>
            </div>

            {/* 对话消息展示区 */}
            <div className="my-1.5 space-y-2 flex-1 min-h-0 overflow-y-auto pr-1 no-scrollbar text-xs">
              {aiHistory.slice(-2).map((msg, idx) => (
                <div key={idx} className={`chat ${msg.who === 'ai' ? 'chat-start' : 'chat-end'} text-[11px]`}>
                  <div
                    className={`chat-bubble text-[11px] p-2 leading-relaxed ${
                      msg.who === 'ai'
                        ? 'bg-base-content/5 text-base-content/90 border border-base-content/10'
                        : 'bg-primary text-primary-content font-medium'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>

            {/* 快捷跳转与操作药丸 */}
            <div className="flex items-center gap-2 shrink-0 mb-1.5">
              <button
                onClick={() => go('candidates')}
                className="btn btn-xs rounded-full bg-base-content/5 hover:bg-base-content/10 text-base-content border-0 text-[10px] h-5 min-h-5 px-2 cursor-pointer motion-pop"
              >
                候选人大池
              </button>
              <button
                onClick={() => go('schedule')}
                className="btn btn-xs rounded-full bg-base-content/5 hover:bg-base-content/10 text-base-content border-0 text-[10px] h-5 min-h-5 px-2 cursor-pointer motion-pop"
              >
                约面日历
              </button>
              <button
                onClick={() => go('jobs')}
                className="btn btn-xs rounded-full bg-base-content/5 hover:bg-base-content/10 text-base-content border-0 text-[10px] h-5 min-h-5 px-2 cursor-pointer motion-pop"
              >
                岗位标尺
              </button>
            </div>

            {/* 底部 AI 输入栏 */}
            <div className="pt-2 border-t border-base-content/10 flex items-center gap-2 shrink-0">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={aiMessage}
                  onChange={(e) => setAiMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendAi()}
                  placeholder="向 AI 提问：'分析王磊的技术疑点'…"
                  className="input input-xs w-full bg-base-content/5 border-base-content/15 text-[10px] text-base-content placeholder:text-base-content/35 rounded-full pr-6 focus:outline-none focus:border-base-content/40 h-6 min-h-6"
                />
                <button
                  onClick={handleSendAi}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-base-content/60 hover:text-base-content cursor-pointer motion-pop"
                  aria-label="发送提问"
                >
                  <Icon.Send />
                </button>
              </div>
              <button
                onClick={() => handleSendAi()}
                aria-label="语音提问"
                className="btn btn-xs rounded-full bg-primary hover:bg-primary/90 text-primary-content border-0 shadow h-6 min-h-6 px-2 text-[10px] font-bold cursor-pointer motion-pop"
              >
                语音
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  )
}
