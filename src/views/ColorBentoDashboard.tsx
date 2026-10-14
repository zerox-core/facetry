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
  const [activeStage, setActiveStage] = useState<'all' | 'screen' | 'schedule' | 'review' | 'approval'>('all')
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

  // 核心功能板块真实数据筛选
  const pendingScreen = candidates.filter((c) => c.status === '新入库' || c.status === '筛选中')
  const pendingSchedule = candidates.filter((c) => c.status === '待联系' || c.status === '约面中')
  const pendingReview = candidates.filter((c) => c.status === '面评中')
  const pendingApproval = approvals.filter((a) => a.finalStatus === 'processing' || a.finalStatus === 'partial')

  // 现场考场运行状态
  const activeRoomCid = runningRoomId()
  const activeRoomCandidate = activeRoomCid ? candidates.find((c) => c.id === activeRoomCid) : null

  const handleSync = () => {
    const res = triggerSourceDbSync()
    setSyncToast(`影刀来源库抓取成功：新增 ${res.newCount} 条高匹配简历，${res.ignoredCount} 条已存在跳过`)
    setTimeout(() => setSyncToast(''), 4000)
  }

  const handleSendAi = () => {
    if (!aiMessage.trim()) return
    const text = aiMessage.trim()
    setAiHistory((prev) => [
      ...prev,
      { who: 'user', text },
      {
        who: 'ai',
        text: `已为你智能解析「${text}」：已联动后台影刀流水线与飞书日程，正在匹配标尺特征库，建议直接进入对应模块进行批量调度。`,
      },
    ])
    setAiMessage('')
  }

  return (
    <div className="w-full space-y-6">
      {/* 顶部状态与快速控制带 (全屏铺开) */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[#16171f] px-5 py-3.5 border border-white/10 text-white shadow-xl">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF5A36] opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[#FF5A36]" />
            </span>
            <span className="text-base font-black tracking-tight">AI 智能招聘指挥中枢</span>
            <span className="badge badge-sm bg-white/10 text-white/80 border-0 font-medium">DaisyUI Bento Edition</span>
          </div>
          <span className="hidden md:inline text-xs text-white/40">|</span>
          <div className="hidden md:flex items-center gap-2 text-xs text-white/70">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              影刀自动化流水线：监听中
            </span>
            <span className="text-white/30">·</span>
            <span>待处理待办: <strong className="text-white font-bold">{pendingScreen.length + pendingSchedule.length + pendingReview.length + pendingApproval.length}</strong> 项</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* 快捷操作组 */}
          <button
            onClick={handleSync}
            className="btn btn-sm rounded-full bg-white/10 hover:bg-white/20 text-white border-white/15 gap-1.5 cursor-pointer"
          >
            <span className="animate-spin text-xs">↻</span> 刷新影刀落库
          </button>
          <button
            onClick={() => go('candidates')}
            className="btn btn-sm rounded-full bg-[#FF5A36] hover:bg-[#F14925] text-white border-0 font-bold shadow-md cursor-pointer"
          >
            候选人大池 ↗
          </button>
          {onSwitchView && (
            <button
              onClick={onSwitchView}
              className="btn btn-sm btn-ghost rounded-full text-white/70 hover:text-white hover:bg-white/10 text-xs"
            >
              经典列表视图
            </button>
          )}
        </div>
      </div>

      {syncToast && (
        <div className="alert alert-success text-xs font-medium text-emerald-900 border border-emerald-300 shadow-lg">
          <span>✓ {syncToast}</span>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          全屏 Bento 主网络：各大核心功能板块铺开绘制
          ══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

        {/* ─────────────────────────────────────────────────────────────
            模块 1（占 7 列）：全域漏斗吞吐与 AI 初筛流水线（珊瑚橙为主色）
            ───────────────────────────────────────────────────────────── */}
        <div className="xl:col-span-7 flex flex-col gap-6">
          {/* 1.1 珊瑚橙吞吐漏斗宏观卡片 */}
          <div className="rounded-3xl bg-gradient-to-br from-[#FF5A36] to-[#F14925] p-6 text-white shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[300px]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="grid h-7 w-7 place-items-center rounded-xl bg-black/20 text-sm">📊</span>
                <div>
                  <h2 className="text-base font-black tracking-wider uppercase">THROUGHPUT · 全域招聘漏斗时效</h2>
                  <p className="text-[11px] text-white/80">影刀自动化落库 → AI 宽松初筛 → 飞书约面 → 双轨审批</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="badge badge-sm bg-black/20 text-white border-0 font-bold">周级动态</span>
                <span className="badge badge-sm bg-white text-[#FF5A36] border-0 font-black">在库 {candidates.length} 人</span>
              </div>
            </div>

            {/* 柱状漏斗梯级与关键转化指标 */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-[1fr_220px] gap-6 items-end">
              <div>
                <div className="relative flex items-end justify-between gap-3 h-32 pt-6 px-2 border-b border-white/25">
                  {[
                    { day: 'Mon', val: 55, label: '初筛' },
                    { day: 'Tue', val: 70, label: '约面' },
                    { day: 'Wed', val: 92, label: '考场' },
                    { day: 'Thu', val: 80, label: '面评' },
                    { day: 'Fri', val: 100, active: true, count: `${candidates.length} 人在库` },
                    { day: 'Sat', val: 42, label: '审批' },
                    { day: 'Sun', val: 30, label: '发Offer' },
                  ].map((bar) => (
                    <div key={bar.day} className="flex-1 flex flex-col items-center gap-1 group relative">
                      {bar.active && (
                        <div className="absolute -top-7 whitespace-nowrap bg-black text-white text-[10px] font-bold py-0.5 px-2 rounded-full shadow-lg border border-white/20">
                          {bar.count}
                        </div>
                      )}
                      <div
                        className={`w-full rounded-t-lg transition-all duration-500 ${
                          bar.active
                            ? 'bg-white shadow-[0_0_16px_rgba(255,255,255,0.7)]'
                            : 'bg-white/40 hover:bg-white/70'
                        }`}
                        style={{ height: `${bar.val}%` }}
                      />
                      <span className="text-[10px] font-bold opacity-80 uppercase">{bar.day}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-white/85 px-1 font-medium">
                  <span>影刀日落库峰值: 98份/日</span>
                  <span>有效初筛转化率: 68.4%</span>
                </div>
              </div>

              {/* 关键卡片 */}
              <div className="space-y-3">
                <div
                  onClick={() => go('candidates')}
                  className="cursor-pointer rounded-2xl bg-black/20 p-3.5 hover:bg-black/30 transition-all border border-white/10"
                >
                  <div className="flex items-center justify-between text-xs text-white/80">
                    <span>全流程流转周期</span>
                    <span className="badge badge-xs bg-emerald-400 text-black font-black">-2.4d</span>
                  </div>
                  <div className="mt-1 text-2xl font-black tracking-tight">3.4 <span className="text-xs font-normal opacity-80">天/平均流转</span></div>
                </div>

                <div
                  onClick={() => go('candidates')}
                  className="cursor-pointer rounded-2xl bg-black/20 p-3.5 hover:bg-black/30 transition-all border border-white/10"
                >
                  <div className="flex items-center justify-between text-xs text-white/80">
                    <span>AI 推荐命中率</span>
                    <span className="badge badge-xs bg-white text-[#FF5A36] font-black">94.2%</span>
                  </div>
                  <div className="mt-1 text-2xl font-black tracking-tight">{pendingScreen.length} <span className="text-xs font-normal opacity-80">人待初筛复核</span></div>
                </div>
              </div>
            </div>
          </div>

          {/* 1.2 待初筛候选人流水线实操卡片 (真实展开业务人选) */}
          <div className="rounded-3xl bg-[#16171f] p-5 text-white shadow-xl border border-white/10 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#FF5A36]" />
                <h3 className="text-sm font-bold tracking-tight text-white">新入库与待初筛流水线</h3>
                <span className="badge badge-xs bg-[#FF5A36]/20 text-[#FF5A36] border-0 font-bold">{pendingScreen.length} 人就绪</span>
              </div>
              <button onClick={() => go('candidates')} className="text-xs text-white/60 hover:text-white underline cursor-pointer">
                在大池中批量流转 →
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {pendingScreen.slice(0, 4).map((c) => (
                <div
                  key={c.id}
                  onClick={() => go('detail', c.id)}
                  className="group cursor-pointer rounded-2xl bg-white/[0.04] p-3.5 border border-white/5 hover:border-[#FF5A36]/50 hover:bg-white/[0.08] transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="avatar placeholder">
                        <div className="bg-[#FF5A36]/20 text-[#FF5A36] rounded-full w-8 h-8 font-black text-xs">
                          {c.name.slice(0, 1)}
                        </div>
                      </div>
                      <div>
                        <div className="font-bold text-sm text-white group-hover:text-[#FF5A36] transition-colors">
                          {c.name}
                        </div>
                        <div className="text-[11px] text-white/50">{c.role} · {c.exp}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="badge badge-sm bg-emerald-500/20 text-emerald-400 border-0 font-bold">
                        匹配 {c.match}分
                      </span>
                    </div>
                  </div>
                  <div className="mt-2.5 text-[11px] text-white/70 line-clamp-1 bg-black/20 rounded-lg px-2 py-1">
                    🎯 {c.skills.slice(0, 3).map((s) => s.k).join(' · ') || '全栈能力扎实，微前端经验丰富'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            模块 2（占 5 列）：约面调度、现场考场与时钟罗盘（长春花紫 + 灰绿）
            ───────────────────────────────────────────────────────────── */}
        <div className="xl:col-span-5 flex flex-col gap-6">
          {/* 2.1 长春花紫 考场负荷与排期容量 */}
          <div className="rounded-3xl bg-gradient-to-br from-[#6366F1] to-[#4F46E5] p-6 text-white shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[300px]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-xl bg-black/20 text-sm">🏢</span>
                <h2 className="text-base font-black tracking-wider uppercase">VENUE CAPACITY · 考场容量</h2>
              </div>
              <span className="badge badge-sm bg-black/20 text-white border-0 font-bold">多地考场联控</span>
            </div>

            {/* 4 组 DaisyUI radial-progress 环形刻度进度圈 */}
            <div className="mt-3 grid grid-cols-4 gap-2 text-center">
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
                  <span className="mt-1 text-xs font-bold">{item.label}</span>
                  <span className={`text-[10px] rounded px-1.5 mt-0.5 ${item.current ? 'bg-white text-[#6366F1] font-bold' : 'bg-black/20 text-white/70'}`}>
                    {item.tag}
                  </span>
                </div>
              ))}
            </div>

            {/* 考场波浪趋势与监控状态 */}
            <div className="mt-3 relative h-14 rounded-xl bg-black/20 overflow-hidden flex items-end px-2">
              <svg className="w-full h-12" viewBox="0 0 300 50" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="waveBento" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#ffffff" stopOpacity="0.02" />
                  </linearGradient>
                </defs>
                <path d="M0,35 Q50,10 100,28 T200,16 T300,8 L300,50 L0,50 Z" fill="url(#waveBento)" />
                <path d="M0,35 Q50,10 100,28 T200,16 T300,8" fill="none" stroke="#ffffff" strokeWidth="2.5" />
              </svg>
              <div className="absolute inset-x-2 bottom-1 flex items-center justify-between text-[10px] text-white/90">
                <span>现场实录考场 (北京总办)</span>
                <span>飞书实时音视频连线</span>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="text-white/80">考官负荷均值: 4.2场/日</span>
              <button onClick={() => go('schedule')} className="cursor-pointer text-white underline font-bold hover:opacity-80">
                查看约面日历 ↗
              </button>
            </div>
          </div>

          {/* 2.2 现场考场实况与时钟罗盘 (鼠尾草灰绿拟真表盘 + 现场考场直达) */}
          <div className="rounded-3xl bg-gradient-to-br from-[#A8BFA4] to-[#8FA98A] p-5 text-[#1c2e1b] shadow-xl relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-lg bg-black/10 text-xs">⏱️</span>
                <h3 className="text-sm font-black tracking-wider uppercase text-[#1c2e1b]">考场准时罗盘与现场实况</h3>
              </div>
              <span className="badge badge-sm bg-black/10 text-[#1c2e1b] border-0 font-bold">准时率 98.6%</span>
            </div>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-[130px_1fr] gap-4 items-center">
              {/* 精美机械时钟 */}
              <div className="relative w-28 h-28 mx-auto rounded-full bg-[#f8faf7] border-4 border-[#1c2e1b]/20 shadow-inner flex items-center justify-center">
                {[...Array(12)].map((_, i) => (
                  <div
                    key={i}
                    className="absolute w-0.5 h-1.5 bg-[#1c2e1b]/30"
                    style={{ transform: `rotate(${i * 30}deg) translateY(-46px)` }}
                  />
                ))}
                {/* 时针 */}
                <div
                  className="absolute w-1.5 h-7 bg-[#1c2e1b] rounded-full origin-bottom"
                  style={{ transform: `rotate(${hourDeg}deg) translateY(-50%)`, bottom: '50%' }}
                />
                {/* 分针 */}
                <div
                  className="absolute w-1 h-10 bg-[#1c2e1b]/80 rounded-full origin-bottom"
                  style={{ transform: `rotate(${minDeg}deg) translateY(-50%)`, bottom: '50%' }}
                />
                {/* 秒针 */}
                <div
                  className="absolute w-0.5 h-11 bg-[#FF5A36] rounded-full origin-bottom"
                  style={{ transform: `rotate(${secDeg}deg) translateY(-50%)`, bottom: '50%' }}
                />
                <div className="absolute w-2.5 h-2.5 rounded-full bg-[#FF5A36] border border-white z-10" />
              </div>

              {/* 右侧当前考场卡片 */}
              <div className="space-y-2">
                <div className="rounded-xl bg-white/60 p-3 border border-white/80 shadow-xs">
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse" />
                      当前考场面试间
                    </span>
                    <span className="text-emerald-800">已就绪</span>
                  </div>
                  <div className="mt-1 font-bold text-sm text-[#1c2e1b]">
                    {activeRoomCandidate ? `${activeRoomCandidate.name} · ${activeRoomCandidate.role}` : 'c1 王磊 · 商业化大前端'}
                  </div>
                  <div className="mt-0.5 text-[10px] text-[#1c2e1b]/70">实录模式 · AI 实时转录与智能追问</div>
                </div>

                <button
                  onClick={() => go('room', activeRoomCid || 'c1')}
                  className="w-full btn btn-sm rounded-xl bg-[#1c2e1b] hover:bg-black text-white border-0 font-bold shadow-md cursor-pointer"
                >
                  进入现场考场面试间 →
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            模块 3（占 4 列）：渠道雷达与影刀数据源（冰蓝坐标纸风格）
            ───────────────────────────────────────────────────────────── */}
        <div className="xl:col-span-4 rounded-3xl bg-gradient-to-br from-[#7CD7F3] to-[#5BC5E7] p-6 text-[#0f2938] shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[330px]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-xl bg-black/10 text-sm">📍</span>
              <h2 className="text-base font-black tracking-wider uppercase text-[#0f2938]">POINTS & CHANNELS</h2>
            </div>
            <span className="badge badge-sm bg-black/15 text-[#0f2938] border-0 font-bold">来源库雷达</span>
          </div>

          {/* 科技坐标网格纸 */}
          <div className="my-3 flex-1 rounded-2xl bg-white/45 border border-white/70 p-4 relative overflow-hidden flex flex-col justify-between [background-image:linear-gradient(to_right,rgba(0,0,0,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.06)_1px,transparent_1px)] [background-size:16px_16px]">
            <div className="relative flex items-center gap-1.5 self-start bg-white/95 backdrop-blur-md px-3 py-1 rounded-full shadow-md border border-white">
              <span className="h-2 w-2 rounded-full bg-[#FF5A36] animate-ping" />
              <span className="text-xs font-bold text-[#0f2938]">影刀自动化流水线 (82%)</span>
            </div>

            <div className="relative self-center my-2 flex items-center gap-2 bg-[#0f2938] text-white px-3.5 py-1.5 rounded-full shadow-lg">
              <span className="text-xs">⚡</span>
              <div className="text-xs font-bold leading-tight">
                <div>大前端与 AI 算法专家池</div>
                <div className="text-[10px] text-white/70">78 份高匹配样本已解析</div>
              </div>
            </div>

            <div className="relative flex items-center gap-1.5 self-end bg-white/95 backdrop-blur-md px-3 py-1 rounded-full shadow-md border border-white">
              <span className="h-2 w-2 rounded-full bg-emerald-600" />
              <span className="text-xs font-bold text-[#0f2938]">内推与定向邀约 (18%)</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs font-bold text-[#0f2938]/90">
            <span>渠道转化率 42.8%</span>
            <button onClick={handleSync} className="underline hover:opacity-80 cursor-pointer">
              同步落库记录 ↻
            </button>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            模块 4（占 4 列）：录取审批与双轨流转中心（深色黑曜高对比）
            ───────────────────────────────────────────────────────────── */}
        <div className="xl:col-span-4 rounded-3xl bg-[#16171f] p-6 text-white shadow-2xl border border-white/10 flex flex-col justify-between min-h-[330px]">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-xl bg-purple-500/20 text-purple-400 text-sm">🏛️</span>
              <div>
                <h3 className="text-sm font-bold text-white">录取审批 · 业务+HR 双轨中心</h3>
                <p className="text-[10px] text-white/50">严格遵循 FR-C4 双边决策流程</p>
              </div>
            </div>
            <span className="badge badge-sm bg-purple-500/20 text-purple-300 border-0 font-bold">
              待批 {pendingApproval.length} 份
            </span>
          </div>

          <div className="my-3 space-y-2.5 overflow-y-auto max-h-44 pr-1">
            {pendingApproval.map((app) => (
              <div
                key={app.id}
                onClick={() => go('approvals')}
                className="cursor-pointer rounded-2xl bg-white/[0.04] p-3 border border-white/5 hover:border-purple-400/50 hover:bg-white/[0.08] transition-all"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white">{app.candidateName} · {app.positionName}</span>
                  <span className="badge badge-xs bg-amber-400/20 text-amber-300 border-0 font-bold">
                    {app.finalStatus === 'processing' ? '审批流转中' : '单边通过'}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-white/60">
                  <span>期望: {app.salary}</span>
                  <span className="text-purple-300 font-medium">飞书轨: {app.feishu.status === 'approved' ? '✓已过' : '待处理'}</span>
                  <span className="text-pink-300 font-medium">BPM轨: {app.bpm.status === 'approved' ? '✓已过' : '待处理'}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs">
            <span className="text-white/60">HC 占用审批时效: 1.2 天</span>
            <button onClick={() => go('approvals')} className="btn btn-xs rounded-full bg-purple-600 hover:bg-purple-700 text-white border-0 font-bold">
              进入审批中心 →
            </button>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            模块 5（占 4 列）：AI OPERATIONS LEAD 智能专家协同舱
            ───────────────────────────────────────────────────────────── */}
        <div className="xl:col-span-4 rounded-3xl bg-[#1c1d24] p-6 text-white shadow-2xl border border-white/10 flex flex-col justify-between min-h-[330px]">
          <div>
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="avatar placeholder">
                  <div className="bg-gradient-to-tr from-violet-500 to-indigo-600 text-white rounded-full w-8 h-8 font-black text-xs shadow-md">
                    AI
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
                    AI OPERATIONS LEAD
                    <span className="badge badge-xs badge-success">在线</span>
                  </h3>
                  <p className="text-[10px] text-white/50">全域业务协同 · 智能初筛与考题调度引擎</p>
                </div>
              </div>
            </div>

            {/* 对话消息区 (daisyUI chat 组件) */}
            <div className="mt-3 space-y-2 max-h-36 overflow-y-auto pr-1">
              {aiHistory.map((msg, idx) => (
                <div key={idx} className={`chat ${msg.who === 'ai' ? 'chat-start' : 'chat-end'} text-xs`}>
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

            {/* 快捷操作胶囊组 */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => go('candidates')}
                className="btn btn-xs rounded-full bg-white/10 border-white/15 text-white hover:bg-white/20"
              >
                ⚡ 候选人大池
              </button>
              <button
                onClick={() => go('schedule')}
                className="btn btn-xs rounded-full bg-white/10 border-white/15 text-white hover:bg-white/20"
              >
                📅 约面日历
              </button>
              <button
                onClick={() => go('jobs')}
                className="btn btn-xs rounded-full bg-white/10 border-white/15 text-white hover:bg-white/20"
              >
                📋 岗位标尺
              </button>
            </div>
          </div>

          {/* 底部 AI 输入栏 */}
          <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={aiMessage}
                onChange={(e) => setAiMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendAi()}
                placeholder="向 AI 提问，如：'分析王磊的技术疑点'…"
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
  )
}
