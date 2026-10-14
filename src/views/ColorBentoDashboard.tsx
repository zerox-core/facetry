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

  // 当前激活的现场考场
  const activeRoomCid = runningRoomId()
  const activeRoomCandidate = activeRoomCid ? candidates.find((c) => c.id === activeRoomCid) : null

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
    <div className="h-full flex flex-col justify-between overflow-hidden gap-2.5 pb-1 select-none">
      {/* ──────────────── 1. 顶部超薄状态与全域跳转控制栏 (高度约 40px) ──────────────── */}
      <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-2 rounded-2xl bg-[#14151b] border border-white/10 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF5A36] opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#FF5A36]" />
            </span>
            <span className="text-sm font-black tracking-tight">AI 智能招聘指挥中枢</span>
            <span className="badge badge-xs bg-white/10 text-white/70 border-0 font-medium">Bento v2.0</span>
          </div>
          <span className="text-white/20">|</span>
          <div className="hidden sm:flex items-center gap-2 text-xs text-white/70">
            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              影刀自动化流水线监听中
            </span>
            <span className="text-white/30">·</span>
            <span>待处理总待办: <strong className="text-white font-bold">{pendingScreen.length + pendingSchedule.length + pendingReview.length + pendingApproval.length}</strong> 项</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {syncToast && (
            <span className="text-xs text-emerald-400 font-medium animate-pulse hidden md:inline">
              ✓ {syncToast}
            </span>
          )}
          <button
            onClick={handleSync}
            className="btn btn-xs rounded-full bg-white/10 hover:bg-white/20 text-white border-white/15 gap-1.5 cursor-pointer active:scale-95 transition-all"
            title="刷新拉取影刀落库数据"
          >
            <Icon.Refresh spinning={isSyncing} />
            <span>拉取影刀落库</span>
          </button>
          <button
            onClick={() => go('candidates')}
            className="btn btn-xs rounded-full bg-[#FF5A36] hover:bg-[#F14925] text-white border-0 font-bold gap-1 shadow-md cursor-pointer active:scale-95 transition-all"
          >
            <span>全池调度</span>
            <Icon.ArrowUpRight />
          </button>
          {onSwitchView && (
            <button
              onClick={onSwitchView}
              className="btn btn-xs btn-ghost rounded-full text-white/60 hover:text-white text-xs"
            >
              列表待办
            </button>
          )}
        </div>
      </div>

      {/* ──────────────── 2. 核心 Bento 单屏自适应网格 (上下两排严格配比，无滚动) ──────────────── */}
      <div className="flex-1 min-h-0 grid grid-rows-[1.08fr_0.92fr] gap-2.5">

        {/* ══════════════ 上排（占比约 54%）：漏斗与初筛 (左7) + 考场容量与时钟 (右5) ══════════════ */}
        <div className="min-h-0 grid grid-cols-12 gap-2.5">
          {/* ---------------- 模块 1（左 7 列）：珊瑚橙吞吐漏斗 + 待初筛精选列表 ---------------- */}
          <div className="col-span-7 rounded-3xl bg-gradient-to-br from-[#FF5A36] to-[#EE4420] p-4 text-white shadow-xl flex flex-col justify-between overflow-hidden relative group hover:shadow-2xl transition-all duration-300">
            {/* 卡片顶栏 */}
            <div className="flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-black/20 text-white">
                  <Icon.Activity />
                </div>
                <div>
                  <h2 className="text-sm font-black tracking-wider uppercase leading-tight">THROUGHPUT · 漏斗吞吐时效</h2>
                  <p className="text-[10px] text-white/80">影刀自动化落库 → AI 智能初筛 → 飞书约面</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="badge badge-xs bg-black/20 text-white border-0">周级动态</span>
                <button
                  onClick={() => go('candidates')}
                  className="badge badge-xs bg-white text-[#FF5A36] border-0 font-black cursor-pointer hover:scale-105 transition-transform"
                >
                  在库 {candidates.length} 人 ↗
                </button>
              </div>
            </div>

            {/* 中间区：柱状吞吐阶梯 + 2 个关键流转指标卡片 */}
            <div className="my-1.5 grid grid-cols-[1fr_180px] gap-3 items-end shrink-0">
              {/* 柱状模拟图 */}
              <div className="bg-black/15 rounded-2xl p-2.5 border border-white/10">
                <div className="relative flex items-end justify-between gap-2 h-20 px-1 border-b border-white/20 pb-1">
                  {[
                    { day: '一', val: 55, label: '初筛' },
                    { day: '二', val: 72, label: '约面' },
                    { day: '三', val: 92, label: '考场' },
                    { day: '四', val: 80, label: '面评' },
                    { day: '五', val: 100, active: true, count: `${candidates.length}人` },
                    { day: '六', val: 40, label: '审批' },
                    { day: '日', val: 30, label: 'Offer' },
                  ].map((bar) => (
                    <div key={bar.day} className="flex-1 flex flex-col items-center gap-0.5 group/bar relative">
                      {bar.active && (
                        <div className="absolute -top-5 whitespace-nowrap bg-black text-white text-[9px] font-bold py-0.2 px-1.5 rounded-full shadow border border-white/20">
                          {bar.count}
                        </div>
                      )}
                      <div
                        className={`w-full rounded-t transition-all duration-300 ${
                          bar.active ? 'bg-white shadow-[0_0_12px_rgba(255,255,255,0.8)]' : 'bg-white/40 hover:bg-white/70'
                        }`}
                        style={{ height: `${bar.val}%` }}
                      />
                      <span className="text-[9px] font-bold opacity-80">{bar.day}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-1 flex items-center justify-between text-[10px] text-white/85 px-0.5 font-medium">
                  <span>影刀日落库峰值: 98份/日</span>
                  <span>AI 命中率: 94.2%</span>
                </div>
              </div>

              {/* 右侧小指标 */}
              <div className="space-y-1.5">
                <div
                  onClick={() => go('candidates')}
                  className="cursor-pointer rounded-xl bg-black/20 p-2 border border-white/10 hover:bg-black/30 transition-all active:scale-95"
                >
                  <div className="flex items-center justify-between text-[10px] text-white/80">
                    <span>流转周期</span>
                    <span className="badge badge-xs bg-emerald-400 text-black font-black">-2.4d</span>
                  </div>
                  <div className="text-lg font-black tracking-tight leading-tight">3.4 <span className="text-[10px] font-normal opacity-80">天/均</span></div>
                </div>

                <div
                  onClick={() => go('candidates')}
                  className="cursor-pointer rounded-xl bg-black/20 p-2 border border-white/10 hover:bg-black/30 transition-all active:scale-95"
                >
                  <div className="flex items-center justify-between text-[10px] text-white/80">
                    <span>待初筛复核</span>
                    <span className="badge badge-xs bg-white text-[#FF5A36] font-black">需确认</span>
                  </div>
                  <div className="text-lg font-black tracking-tight leading-tight">{pendingScreen.length} <span className="text-[10px] font-normal opacity-80">人选</span></div>
                </div>
              </div>
            </div>

            {/* 下部：待初筛流水线直接展开 3 个真实人选 (支持一键下钻详情) */}
            <div className="mt-1 pt-1.5 border-t border-white/15 flex-1 min-h-0 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[11px] mb-1 font-bold">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                  新入库待初筛流水线人选（点击直接下钻）
                </span>
                <button onClick={() => go('candidates')} className="underline hover:opacity-80 text-[10px]">
                  全池筛选 →
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {pendingScreen.slice(0, 3).map((c) => (
                  <div
                    key={c.id}
                    onClick={() => go('detail', c.id)}
                    className="cursor-pointer rounded-xl bg-black/20 p-2 border border-white/10 hover:bg-white hover:text-[#1d1d1f] transition-all duration-200 group/cand active:scale-95"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs truncate">{c.name}</span>
                      <span className="badge badge-xs bg-emerald-400 text-black font-black">
                        {c.score ?? 88}分
                      </span>
                    </div>
                    <div className="mt-0.5 text-[10px] opacity-80 truncate">{c.role}</div>
                    <div className="mt-1 text-[9px] line-clamp-1 opacity-70 bg-black/10 group-hover/cand:bg-black/5 rounded px-1">
                      {c.tags?.[0] || '微前端高并发'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ---------------- 模块 2（右 5 列）：考场容量 (长春花紫) + 准时罗盘 (鼠尾草灰绿) ---------------- */}
          <div className="col-span-5 grid grid-rows-[1.05fr_0.95fr] gap-2.5">
            {/* 2.1 长春花紫 考场负荷监控 */}
            <div className="rounded-3xl bg-gradient-to-br from-[#6366F1] to-[#4F46E5] p-3.5 text-white shadow-xl flex flex-col justify-between overflow-hidden relative group hover:shadow-2xl transition-all duration-300">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-black/20 text-white">
                    <Icon.Building />
                  </div>
                  <div>
                    <h3 className="text-xs font-black tracking-wider uppercase">VENUE CAPACITY · 考场容量</h3>
                    <p className="text-[10px] text-white/80">现场面试间与飞书连线负荷</p>
                  </div>
                </div>
                <button
                  onClick={() => go('schedule')}
                  className="badge badge-xs bg-black/20 hover:bg-black/40 text-white border-0 font-bold cursor-pointer"
                >
                  约面排期 ↗
                </button>
              </div>

              {/* 4 组 DaisyUI radial-progress 环形刻度进度圈 */}
              <div className="my-1 grid grid-cols-4 gap-1.5 text-center items-center">
                {[
                  { label: '周一', pct: 78, tag: '已满' },
                  { label: '周二', pct: 82, tag: '饱和' },
                  { label: '周三', pct: 91, tag: '高峰', alert: true },
                  { label: '今日', pct: 88, tag: `${TODAY.slice(5)}`, current: true },
                ].map((item) => (
                  <div key={item.label} className="flex flex-col items-center">
                    <div
                      className={`radial-progress text-[10px] font-bold transition-all ${
                        item.current ? 'text-white' : item.alert ? 'text-amber-300' : 'text-white/80'
                      }`}
                      style={{
                        '--value': item.pct,
                        '--size': '2.6rem',
                        '--thickness': '3px',
                      } as React.CSSProperties}
                      role="progressbar"
                    >
                      {item.pct}%
                    </div>
                    <span className="mt-0.5 text-[10px] font-bold">{item.label}</span>
                    <span className={`text-[8px] rounded px-1 ${item.current ? 'bg-white text-[#6366F1] font-bold' : 'bg-black/20 text-white/70'}`}>
                      {item.tag}
                    </span>
                  </div>
                ))}
              </div>

              {/* 动态波浪趋势 */}
              <div className="relative h-9 rounded-lg bg-black/20 overflow-hidden flex items-end px-2">
                <svg className="w-full h-8" viewBox="0 0 300 40" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="waveBentoMini" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ffffff" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#ffffff" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>
                  <path d="M0,28 Q50,8 100,22 T200,12 T300,6 L300,40 L0,40 Z" fill="url(#waveBentoMini)" />
                  <path d="M0,28 Q50,8 100,22 T200,12 T300,6" fill="none" stroke="#ffffff" strokeWidth="2" />
                </svg>
                <div className="absolute inset-x-2 bottom-0.5 flex items-center justify-between text-[9px] text-white/90">
                  <span>现场实录考场 (北京总办)</span>
                  <span>考官均负荷: 4.2场/日</span>
                </div>
              </div>
            </div>

            {/* 2.2 鼠尾草灰绿 考场时钟与现场实况直通 */}
            <div className="rounded-3xl bg-gradient-to-br from-[#A8BFA4] to-[#8FA98A] p-3.5 text-[#1c2e1b] shadow-xl flex items-center justify-between overflow-hidden relative group hover:shadow-2xl transition-all duration-300">
              {/* 模拟时钟微表盘 */}
              <div className="relative w-20 h-20 shrink-0 rounded-full bg-[#f8faf7] border-2 border-[#1c2e1b]/20 shadow-inner flex items-center justify-center">
                {[...Array(12)].map((_, i) => (
                  <div
                    key={i}
                    className="absolute w-0.5 h-1 bg-[#1c2e1b]/30"
                    style={{ transform: `rotate(${i * 30}deg) translateY(-34px)` }}
                  />
                ))}
                {/* 时针 */}
                <div
                  className="absolute w-1 h-5 bg-[#1c2e1b] rounded-full origin-bottom"
                  style={{ transform: `rotate(${hourDeg}deg) translateY(-50%)`, bottom: '50%' }}
                />
                {/* 分针 */}
                <div
                  className="absolute w-0.5 h-7 bg-[#1c2e1b]/80 rounded-full origin-bottom"
                  style={{ transform: `rotate(${minDeg}deg) translateY(-50%)`, bottom: '50%' }}
                />
                {/* 秒针 */}
                <div
                  className="absolute w-0.5 h-8 bg-[#FF5A36] rounded-full origin-bottom"
                  style={{ transform: `rotate(${secDeg}deg) translateY(-50%)`, bottom: '50%' }}
                />
                <div className="absolute w-2 h-2 rounded-full bg-[#FF5A36] border border-white z-10" />
              </div>

              {/* 右侧考场直通操作 */}
              <div className="flex-1 ml-3.5 min-w-0 flex flex-col justify-between h-full py-0.5">
                <div className="flex items-center justify-between text-[10px] font-bold">
                  <span className="flex items-center gap-1 text-emerald-900">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-ping" />
                    现场考场在线中
                  </span>
                  <span className="badge badge-xs bg-black/10 text-[#1c2e1b] border-0 font-bold">准时率 98.6%</span>
                </div>

                <div className="truncate font-black text-xs text-[#1c2e1b] mt-0.5">
                  {activeRoomCandidate ? `${activeRoomCandidate.name} · ${activeRoomCandidate.role}` : 'c1 王磊 · 商业化大前端专家'}
                </div>
                <div className="text-[9px] text-[#1c2e1b]/70">实录模式 · AI 实时转录与智能追问</div>

                <button
                  onClick={() => go('room', activeRoomCid || 'c1')}
                  className="mt-1 w-full btn btn-xs rounded-lg bg-[#1c2e1b] hover:bg-black text-white border-0 font-bold gap-1 shadow cursor-pointer active:scale-95 transition-all"
                >
                  <span>进入考场面试间</span>
                  <Icon.ArrowUpRight />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════ 下排（占比约 46%）：渠道坐标网格 (左4) + 双轨审批中心 (中4) + AI协同舱 (右4) ══════════════ */}
        <div className="min-h-0 grid grid-cols-12 gap-2.5">

          {/* ---------------- 模块 3（左 4 列）：冰蓝科技坐标纸雷达 ---------------- */}
          <div className="col-span-4 rounded-3xl bg-gradient-to-br from-[#7CD7F3] to-[#5BC5E7] p-3.5 text-[#0f2938] shadow-xl flex flex-col justify-between overflow-hidden relative group hover:shadow-2xl transition-all duration-300">
            <div className="flex items-center justify-between shrink-0">
              <div className="flex items-center gap-1.5">
                <div className="p-1 rounded-md bg-black/10 text-[#0f2938]">
                  <Icon.Radar />
                </div>
                <h3 className="text-xs font-black tracking-wider uppercase text-[#0f2938]">POINTS & CHANNELS</h3>
              </div>
              <button
                onClick={handleSync}
                className="badge badge-xs bg-black/15 text-[#0f2938] border-0 font-bold cursor-pointer hover:bg-black/25"
              >
                刷新同步 ↻
              </button>
            </div>

            {/* 科技坐标网格纸 */}
            <div className="my-1.5 flex-1 min-h-0 rounded-xl bg-white/45 border border-white/70 p-2.5 relative overflow-hidden flex flex-col justify-between [background-image:linear-gradient(to_right,rgba(0,0,0,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.06)_1px,transparent_1px)] [background-size:14px_14px]">
              <div
                onClick={() => go('candidates')}
                className="cursor-pointer relative flex items-center gap-1 self-start bg-white/95 px-2 py-0.5 rounded-full shadow-sm border border-white hover:scale-105 transition-transform"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-[#FF5A36] animate-ping" />
                <span className="text-[10px] font-bold text-[#0f2938]">影刀流水线抓取 (82%)</span>
              </div>

              <div
                onClick={() => go('jobs')}
                className="cursor-pointer relative self-center my-0.5 flex items-center gap-1.5 bg-[#0f2938] text-white px-2.5 py-1 rounded-full shadow hover:scale-105 transition-transform"
              >
                <span className="text-[10px]">⚡</span>
                <span className="text-[10px] font-bold">大前端与 AI 算法专家池 (78份就绪)</span>
              </div>

              <div
                onClick={() => go('candidates')}
                className="cursor-pointer relative flex items-center gap-1 self-end bg-white/95 px-2 py-0.5 rounded-full shadow-sm border border-white hover:scale-105 transition-transform"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                <span className="text-[10px] font-bold text-[#0f2938]">内推与定向邀约 (18%)</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-[10px] font-bold text-[#0f2938]/90 shrink-0">
              <span>有效渠道转化率: 42.8%</span>
              <button onClick={() => go('candidates')} className="underline hover:opacity-80">
                查看全量渠道 →
              </button>
            </div>
          </div>

          {/* ---------------- 模块 4（中 4 列）：录取审批 · 双轨流转中枢 ---------------- */}
          <div className="col-span-4 rounded-3xl bg-[#16171f] p-3.5 text-white shadow-xl border border-white/10 flex flex-col justify-between overflow-hidden relative group hover:shadow-2xl transition-all duration-300">
            <div className="flex items-center justify-between border-b border-white/10 pb-2 shrink-0">
              <div className="flex items-center gap-1.5">
                <div className="p-1 rounded-md bg-purple-500/20 text-purple-400">
                  <Icon.CheckCircle />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white">录取审批 · 双轨中心</h3>
                  <p className="text-[9px] text-white/50">业务线 + HR 双边决策</p>
                </div>
              </div>
              <button
                onClick={() => go('approvals')}
                className="badge badge-xs bg-purple-500/20 text-purple-300 border-0 font-bold cursor-pointer hover:bg-purple-500/30"
              >
                待批 {pendingApproval.length} 份 ↗
              </button>
            </div>

            {/* 真实审批流单据列表 */}
            <div className="my-1.5 space-y-1.5 flex-1 min-h-0 overflow-hidden">
              {pendingApproval.slice(0, 2).map((app) => (
                <div
                  key={app.id}
                  onClick={() => go('approvals')}
                  className="cursor-pointer rounded-xl bg-white/[0.04] p-2 border border-white/5 hover:border-purple-400/50 hover:bg-white/[0.08] transition-all active:scale-95"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-white truncate">{app.name} · {app.role}</span>
                    <span className="badge badge-xs bg-amber-400/20 text-amber-300 border-0 font-bold">
                      {app.finalStatus === 'processing' ? '审批中' : '单边通过'}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[10px] text-white/60">
                    <span>期望: {app.expectedSalary}</span>
                    <span className="text-purple-300 font-medium">业务: {app.bizTrack.status === 'approved' ? '✓已批' : '待处理'}</span>
                    <span className="text-pink-300 font-medium">HR: {app.hrTrack.status === 'approved' ? '✓已批' : '待处理'}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-white/10 text-[10px] shrink-0">
              <span className="text-white/60">平均审批时效: 1.2 天</span>
              <button onClick={() => go('approvals')} className="btn btn-xs rounded-full bg-purple-600 hover:bg-purple-700 text-white border-0 font-bold text-[10px] h-6 min-h-6">
                进入审批处理 →
              </button>
            </div>
          </div>

          {/* ---------------- 模块 5（右 4 列）：AI OPERATIONS LEAD 智能专家协同舱 ---------------- */}
          <div className="col-span-4 rounded-3xl bg-[#1c1d24] p-3.5 text-white shadow-xl border border-white/10 flex flex-col justify-between overflow-hidden relative group hover:shadow-2xl transition-all duration-300">
            <div className="flex items-center justify-between border-b border-white/10 pb-2 shrink-0">
              <div className="flex items-center gap-1.5">
                <div className="p-1 rounded-md bg-gradient-to-tr from-violet-500 to-indigo-600 text-white shadow-sm">
                  <Icon.Bot />
                </div>
                <div>
                  <h3 className="text-xs font-bold tracking-tight text-white flex items-center gap-1.5">
                    AI OPERATIONS LEAD
                    <span className="badge badge-xs badge-success h-4 text-[9px]">在线</span>
                  </h3>
                  <p className="text-[9px] text-white/50">智能初筛与考题调度引擎</p>
                </div>
              </div>
              <button onClick={() => go('candidates')} className="text-white/40 hover:text-white cursor-pointer" title="全屏查看">
                <Icon.ArrowUpRight />
              </button>
            </div>

            {/* 对话消息展示区 */}
            <div className="my-1 space-y-1 flex-1 min-h-0 overflow-y-auto pr-1 no-scrollbar text-xs">
              {aiHistory.slice(-2).map((msg, idx) => (
                <div key={idx} className={`chat ${msg.who === 'ai' ? 'chat-start' : 'chat-end'} text-[11px]`}>
                  <div
                    className={`chat-bubble text-[11px] p-2 leading-relaxed ${
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

            {/* 快捷跳转与操作药丸 */}
            <div className="flex items-center gap-1 shrink-0 mb-1">
              <button
                onClick={() => go('candidates')}
                className="btn btn-xs rounded-full bg-white/10 hover:bg-white/20 text-white border-0 text-[10px] h-5 min-h-5 px-2"
              >
                ⚡ 候选人大池
              </button>
              <button
                onClick={() => go('schedule')}
                className="btn btn-xs rounded-full bg-white/10 hover:bg-white/20 text-white border-0 text-[10px] h-5 min-h-5 px-2"
              >
                📅 约面日历
              </button>
              <button
                onClick={() => go('jobs')}
                className="btn btn-xs rounded-full bg-white/10 hover:bg-white/20 text-white border-0 text-[10px] h-5 min-h-5 px-2"
              >
                📋 岗位标尺
              </button>
            </div>

            {/* 底部 AI 输入栏 */}
            <div className="pt-1.5 border-t border-white/10 flex items-center gap-1.5 shrink-0">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={aiMessage}
                  onChange={(e) => setAiMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendAi()}
                  placeholder="向 AI 提问：'分析王磊的技术疑点'…"
                  className="input input-xs w-full bg-white/5 border-white/15 text-[10px] text-white placeholder:text-white/35 rounded-full pr-6 focus:outline-none focus:border-white/40 h-6 min-h-6"
                />
                <button
                  onClick={handleSendAi}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-white/60 hover:text-white cursor-pointer"
                >
                  <Icon.Send />
                </button>
              </div>
              <button
                onClick={() => handleSendAi()}
                className="btn btn-xs btn-circle bg-[#FF5A36] hover:bg-[#EE4420] text-white border-0 shadow h-6 w-6 min-h-6"
              >
                🎙️
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  )
}
