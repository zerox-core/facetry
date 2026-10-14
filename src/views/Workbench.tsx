import { useState } from 'react'
import { candidates, positions, TODAY } from '../data'
import { approvals, findJd, findPos, runningRoomId, slotDate, slotLabel, triggerSourceDbSync } from '../store'
import type { Go } from '../App'
import { Btn, Card } from './ui'

// 审批轨状态中文标签：发起 / 处理中 / 通过 / 退回 / 拒绝 / 撤销全部显式展示（FR-C4）
const trackLabel: Record<string, string> = { pending: '处理中', approved: '已通过', returned: '已退回', rejected: '已拒绝', canceled: '已撤销' }

export default function Workbench({ go }: { go: Go }) {
  const [syncToast, setSyncToast] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'screen' | 'schedule' | 'review' | 'approval'>('all')

  const pendingScreen = candidates.filter((c) => c.status === '新入库' || c.status === '筛选中')
  const pendingSchedule = candidates.filter((c) => c.status === '待联系')
  const pendingReview = candidates.filter((c) => c.status === '面评中')
  // processing + partial（单边通过）都算仍在流转，partial 不得当作已完成
  const pendingApproval = approvals.filter((a) => a.finalStatus === 'processing' || a.finalStatus === 'partial')

  const todayStr = TODAY
  const todayInterviews = candidates
    .filter((c) => c.status === '约面中' && c.slot.startsWith(todayStr))
    .sort((a, b) => a.slot.localeCompare(b.slot))

  const handleSync = () => {
    const res = triggerSourceDbSync()
    setSyncToast(`从来源数据库同步成功：发现 ${res.newCount} 条新入库人选，${res.ignoredCount} 条已存在跳过`)
    setTimeout(() => setSyncToast(''), 3500)
  }

  return (
    <div className="space-y-6">
      {/* 顶部欢迎栏与来源库快速同步 (清爽透气白底，局部深曜黑与彩色呼吸灯) */}
      <div className="ws-rise flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-black/[0.08] pb-5">
        <div>
          <div className="flex items-center gap-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-[#1d1d1f]">工作台 · 我的待办</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/[0.04] px-2.5 py-0.5 text-xs font-semibold text-[#1d1d1f] ring-1 ring-inset ring-black/10">
              待处理 <strong className="text-amber-800 font-bold">{pendingScreen.length + pendingSchedule.length + pendingReview.length + pendingApproval.length}</strong> 项
            </span>
          </div>
          <p className="mt-1.5 text-xs text-[#6e6e73]">
            来源库落库人选 · AI 宽松初筛 · 飞书日程协同 · 考场实录考核 · 录取双轨审批
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => go('bento')}
            className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#FF5A36] to-[#6366F1] px-3.5 py-1.5 text-xs font-bold text-white shadow-md hover:brightness-110 hover:-translate-y-0.5 transition-all cursor-pointer"
          >
            <span>🎛️ COLOR 四色指挥舱</span>
          </button>
          <Btn variant="ghost" onClick={handleSync} className="hover:-translate-y-0.5 transition-transform">
            🔄 刷新拉取来源库
          </Btn>
          <Btn variant="solid" onClick={() => go('candidates')} className="hover:-translate-y-0.5 transition-transform shadow-sm">
            查看候选人大池 ↗
          </Btn>
        </div>
      </div>

      {syncToast && (
        <div className="login-fade rounded-2xl bg-emerald-50 px-4 py-3 text-xs text-emerald-800 border border-emerald-200/60 flex items-center justify-between">
          <span>✓ {syncToast}</span>
          <button onClick={() => setSyncToast('')} className="cursor-pointer text-emerald-600 hover:text-emerald-900">
            ✕
          </button>
        </div>
      )}

      {/* 4 大核心业务待办 Bento 卡片 (纯白微浮雕底 + 4 色优雅点缀微线 + 弹簧代码动效) */}
      <div className="ws-rise [--i:1] grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* 1. 筛选中 (紫罗兰点缀) */}
        <div
          onClick={() => setActiveTab('screen')}
          className={`cursor-pointer ws-paper rounded-2xl p-5 border transition-all duration-300 relative overflow-hidden group hover:-translate-y-1 hover:shadow-lg ${
            activeTab === 'screen'
              ? 'border-[#1d1d1f] ring-2 ring-black/10 shadow-md bg-gradient-to-b from-purple-50/20 to-white'
              : 'border-black/[0.06] hover:border-purple-300'
          }`}
        >
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-purple-500 to-indigo-500 opacity-80 group-hover:h-1.5 transition-all" />
          <div className="flex items-center justify-between text-xs text-[#86868b]">
            <span className="group-hover:text-purple-700 transition-colors font-medium">筛选中复核</span>
            <span className="rounded-full bg-purple-50 px-2.5 py-0.5 text-[10px] font-semibold text-purple-700 ring-1 ring-inset ring-purple-600/20">
              影刀落库
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-[#1d1d1f]">{pendingScreen.length}</span>
            <span className="text-xs text-[#86868b]">人需确认意向</span>
          </div>
          <p className="mt-2 text-[11px] text-[#86868b] line-clamp-1">
            {pendingScreen.length > 0 ? `最新：${pendingScreen[0].name} (${pendingScreen[0].role})` : '暂无待处理'}
          </p>
        </div>

        {/* 2. 待联系 (暖阳琥珀点缀) */}
        <div
          onClick={() => setActiveTab('schedule')}
          className={`cursor-pointer ws-paper rounded-2xl p-5 border transition-all duration-300 relative overflow-hidden group hover:-translate-y-1 hover:shadow-lg ${
            activeTab === 'schedule'
              ? 'border-[#1d1d1f] ring-2 ring-black/10 shadow-md bg-gradient-to-b from-amber-50/20 to-white'
              : 'border-black/[0.06] hover:border-amber-300'
          }`}
        >
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-500 to-orange-500 opacity-80 group-hover:h-1.5 transition-all" />
          <div className="flex items-center justify-between text-xs text-[#86868b]">
            <span className="group-hover:text-amber-800 transition-colors font-medium">待安排面试</span>
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-600/20">
              日程协同
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-[#1d1d1f]">{pendingSchedule.length}</span>
            <span className="text-xs text-[#86868b]">人待排期通知</span>
          </div>
          <p className="mt-2 text-[11px] text-[#86868b] line-clamp-1">
            {pendingSchedule.length > 0 ? `最新：${pendingSchedule[0].name}` : '所有约面均已排期'}
          </p>
        </div>

        {/* 3. 待面评 (极光翠绿点缀) */}
        <div
          onClick={() => setActiveTab('review')}
          className={`cursor-pointer ws-paper rounded-2xl p-5 border transition-all duration-300 relative overflow-hidden group hover:-translate-y-1 hover:shadow-lg ${
            activeTab === 'review'
              ? 'border-[#1d1d1f] ring-2 ring-black/10 shadow-md bg-gradient-to-b from-emerald-50/20 to-white'
              : 'border-black/[0.06] hover:border-emerald-300'
          }`}
        >
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500 opacity-80 group-hover:h-1.5 transition-all" />
          <div className="flex items-center justify-between text-xs text-[#86868b]">
            <span className="group-hover:text-emerald-800 transition-colors font-medium">待面评确认</span>
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-600/20">
              人工面评
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-[#1d1d1f]">{pendingReview.length}</span>
            <span className="text-xs text-[#86868b]">场待补全打分</span>
          </div>
          <p className="mt-2 text-[11px] text-[#86868b] line-clamp-1">
            {pendingReview.length > 0 ? `考场：${pendingReview[0].name}` : '已全部完成评价'}
          </p>
        </div>

        {/* 4. 录取审批流转 (玫瑰珊瑚红点缀) */}
        <div
          onClick={() => setActiveTab('approval')}
          className={`cursor-pointer ws-paper rounded-2xl p-5 border transition-all duration-300 relative overflow-hidden group hover:-translate-y-1 hover:shadow-lg ${
            activeTab === 'approval'
              ? 'border-[#1d1d1f] ring-2 ring-black/10 shadow-md bg-gradient-to-b from-rose-50/20 to-white'
              : 'border-black/[0.06] hover:border-rose-300'
          }`}
        >
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-rose-500 to-pink-500 opacity-80 group-hover:h-1.5 transition-all" />
          <div className="flex items-center justify-between text-xs text-[#86868b]">
            <span className="group-hover:text-rose-800 transition-colors font-medium">录取审批流转</span>
            <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-[10px] font-semibold text-rose-800 ring-1 ring-inset ring-rose-600/20">
              飞书 / BPM
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-[#1d1d1f]">{pendingApproval.length}</span>
            <span className="text-xs text-[#86868b]">份审批流转中</span>
          </div>
          <p className="mt-2 text-[11px] text-[#86868b] line-clamp-1">
            {pendingApproval.length > 0 ? `单号：${pendingApproval[0].id}` : '无流转中审批'}
          </p>
        </div>
      </div>

      {/* 主体布局：左侧待办事务流，右侧今日考场与快捷动作 */}
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* 左侧：待办明细工作台 */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold tracking-tight text-[#1d1d1f]">待处理事务清单</h2>
              <span className="text-xs text-[#86868b]">（点击卡片直接推进对应业务）</span>
            </div>

            <div className="ws-segmented-track flex rounded-full p-1 text-xs">
              <button
                onClick={() => setActiveTab('all')}
                className={`cursor-pointer rounded-full px-3.5 py-1 font-medium transition-all ${
                  activeTab === 'all' ? 'ws-segmented-active font-semibold shadow-xs' : 'text-[#6e6e73] hover:text-[#1d1d1f]'
                }`}
              >
                全部
              </button>
              <button
                onClick={() => setActiveTab('screen')}
                className={`cursor-pointer rounded-full px-3.5 py-1 font-medium transition-all ${
                  activeTab === 'screen' ? 'ws-segmented-active font-semibold shadow-xs' : 'text-[#6e6e73] hover:text-[#1d1d1f]'
                }`}
              >
                筛选中 ({pendingScreen.length})
              </button>
              <button
                onClick={() => setActiveTab('schedule')}
                className={`cursor-pointer rounded-full px-3.5 py-1 font-medium transition-all ${
                  activeTab === 'schedule' ? 'ws-segmented-active font-semibold shadow-xs' : 'text-[#6e6e73] hover:text-[#1d1d1f]'
                }`}
              >
                待联系 ({pendingSchedule.length})
              </button>
              <button
                onClick={() => setActiveTab('review')}
                className={`cursor-pointer rounded-full px-3.5 py-1 font-medium transition-all ${
                  activeTab === 'review' ? 'ws-segmented-active font-semibold shadow-xs' : 'text-[#6e6e73] hover:text-[#1d1d1f]'
                }`}
              >
                待面评 ({pendingReview.length})
              </button>
              <button
                onClick={() => setActiveTab('approval')}
                className={`cursor-pointer rounded-full px-3.5 py-1 font-medium transition-all ${
                  activeTab === 'approval' ? 'ws-segmented-active font-semibold shadow-xs' : 'text-[#6e6e73] hover:text-[#1d1d1f]'
                }`}
              >
                审批流 ({pendingApproval.length})
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {/* 筛选中列表 (电光紫侧标微动效) */}
            {(activeTab === 'all' || activeTab === 'screen') &&
              pendingScreen.map((c) => (
                <div
                  key={c.id}
                  onClick={() => go('detail', c.id)}
                  className="group cursor-pointer ws-paper rounded-2xl p-4 border border-black/[0.06] border-l-4 border-l-violet-500 hover:-translate-y-0.5 hover:shadow-md hover:border-black/20 transition-all duration-200 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-50 text-xs font-bold text-violet-700 border border-violet-100 group-hover:scale-105 transition-transform">
                      筛
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-[#1d1d1f] group-hover:text-violet-900 transition-colors">{c.name}</span>
                        <span className="text-xs text-[#86868b]">· {c.role}</span>
                        <span className="rounded-full bg-black/[0.04] px-2 py-0.5 text-[10px] text-[#86868b]">
                          来源: {c.source}
                        </span>
                        {c.attachmentType === 'missing' && (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-800 ring-1 ring-inset ring-amber-600/20">
                            原件缺失
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-[#86868b]">
                        AI 宽松建议：<span className="text-violet-700 font-medium">{c.aiScreening?.looseMatch || '等待初筛'}</span>
                      </div>
                    </div>
                  </div>
                  <Btn variant="ghost" className="!h-8 !px-3.5 shrink-0 font-medium group-hover:bg-violet-50 group-hover:text-violet-900 group-hover:border-violet-200 transition-all" onClick={() => go('detail', c.id)}>
                    复核简历 ↗
                  </Btn>
                </div>
              ))}

            {/* 待联系列表 (暖阳琥珀侧标微动效) */}
            {(activeTab === 'all' || activeTab === 'schedule') &&
              pendingSchedule.map((c) => (
                <div
                  key={c.id}
                  onClick={() => go('detail', c.id)}
                  className="group cursor-pointer ws-paper rounded-2xl p-4 border border-black/[0.06] border-l-4 border-l-amber-500 hover:-translate-y-0.5 hover:shadow-md hover:border-black/20 transition-all duration-200 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-xs font-bold text-amber-800 border border-amber-100 group-hover:scale-105 transition-transform">
                      约
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-[#1d1d1f] group-hover:text-amber-900 transition-colors">{c.name}</span>
                        <span className="text-xs text-[#86868b]">· {c.role}</span>
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-800 font-medium ring-1 ring-inset ring-amber-600/20">
                          初筛已通过
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-[#86868b]">
                        负责 HR：{c.assignee} · 契合度 <span className="text-emerald-700 font-semibold">{c.match}%</span> · 待确认双方时间发起预约
                      </div>
                    </div>
                  </div>
                  <Btn variant="ghost" className="!h-8 !px-3.5 shrink-0 font-medium group-hover:bg-amber-50 group-hover:text-amber-900 group-hover:border-amber-200 transition-all" onClick={() => go('schedule')}>
                    去排期 ↗
                  </Btn>
                </div>
              ))}

            {/* 待面评列表 (极光翡翠侧标微动效) */}
            {(activeTab === 'all' || activeTab === 'review') &&
              pendingReview.map((c) => (
                <div
                  key={c.id}
                  onClick={() => go('room', c.id)}
                  className="group cursor-pointer ws-paper rounded-2xl p-4 border border-black/[0.06] border-l-4 border-l-emerald-500 hover:-translate-y-0.5 hover:shadow-md hover:border-black/20 transition-all duration-200 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-xs font-bold text-emerald-800 border border-emerald-100 group-hover:scale-105 transition-transform">
                      评
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-[#1d1d1f] group-hover:text-emerald-900 transition-colors">{c.name}</span>
                        <span className="text-xs text-[#86868b]">· {c.role}</span>
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-800 font-medium ring-1 ring-inset ring-emerald-600/20">
                          考场已结束
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-[#86868b]">
                        {slotLabel(c.slot)} 场次已完成 · 待面试官确认并提交综合面评
                      </div>
                    </div>
                  </div>
                  <Btn variant="ghost" className="!h-8 !px-3.5 shrink-0 font-medium group-hover:bg-emerald-50 group-hover:text-emerald-900 group-hover:border-emerald-200 transition-all" onClick={() => go('room', c.id)}>
                    确认面评 ↗
                  </Btn>
                </div>
              ))}

            {/* 审批流列表 (玫瑰粉紫侧标微动效) */}
            {(activeTab === 'all' || activeTab === 'approval') &&
              pendingApproval.map((a) => (
                <div
                  key={a.id}
                  onClick={() => go('approvals')}
                  className="group cursor-pointer ws-paper rounded-2xl p-4 border border-black/[0.06] border-l-4 border-l-rose-500 hover:-translate-y-0.5 hover:shadow-md hover:border-black/20 transition-all duration-200 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-50 text-xs font-bold text-rose-800 border border-rose-100 group-hover:scale-105 transition-transform">
                      批
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-[#1d1d1f] group-hover:text-rose-900 transition-colors">{a.candidateName}</span>
                        <span className="text-xs text-[#86868b]">· {a.positionName}</span>
                        <span className="rounded-full bg-black/[0.04] px-2 py-0.5 text-[10px] font-medium text-[#1d1d1f] ring-1 ring-inset ring-black/10">
                          单号: {a.id}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-xs text-[#86868b]">
                        <span>飞书审批: <strong className="text-rose-700">{a.feishu.currentNode}</strong> ({trackLabel[a.feishu.status] ?? a.feishu.status})</span>
                        <span>·</span>
                        <span>BPM 流程: <strong className="text-rose-700">{a.bpm.currentNode}</strong> ({trackLabel[a.bpm.status] ?? a.bpm.status})</span>
                      </div>
                    </div>
                  </div>
                  <Btn variant="ghost" className="!h-8 !px-3.5 shrink-0 font-medium group-hover:bg-rose-50 group-hover:text-rose-900 group-hover:border-rose-200 transition-all" onClick={() => go('approvals')}>
                    追踪进度 ↗
                  </Btn>
                </div>
              ))}
          </div>
        </div>

        {/* 右侧：今日面试日程与快速连接 */}
        <aside className="space-y-5">
          <div className="ws-paper rounded-2xl p-5 border border-black/[0.06] shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.05]">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <h3 className="text-sm font-semibold text-[#1d1d1f]">今日面试安排 ({todayInterviews.length})</h3>
              </div>
              <span className="text-xs text-[#86868b] font-mono">{todayStr}</span>
            </div>

            <div className="mt-3.5 space-y-3">
              {todayInterviews.map((c) => (
                <div
                  key={c.id}
                  onClick={() => go('room', c.id)}
                  className="group cursor-pointer rounded-xl bg-gradient-to-br from-[#ffffff] to-[#f8f9fb] border border-black/[0.06] p-3.5 hover:shadow-md hover:border-black/20 hover:-translate-y-0.5 transition-all duration-200"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#1d1d1f] group-hover:text-black">{c.name} · {c.role}</span>
                    <span className="text-xs font-mono font-semibold text-[#1d1d1f] bg-black/[0.04] px-1.5 py-0.5 rounded">{c.slot.slice(11)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-[#86868b]">
                    <span className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      飞书日历已同步
                    </span>
                    <span className="text-xs font-semibold text-[#1d1d1f] group-hover:translate-x-0.5 transition-transform">进入考场 →</span>
                  </div>
                </div>
              ))}

              {!todayInterviews.length && (
                <div className="py-6 text-center text-xs text-[#86868b]">今日暂无排期待面场次</div>
              )}
            </div>
          </div>

          {/* 快捷通道 */}
          <div className="ws-paper rounded-2xl p-5 border border-black/[0.05] shadow-sm space-y-3">
            <h3 className="text-sm font-semibold text-[#1d1d1f]">系统快捷入口</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                onClick={() => go('jobs')}
                className="group cursor-pointer rounded-xl bg-[#f5f5f7] p-3 text-left hover:bg-black/[0.04] hover:-translate-y-0.5 transition-all duration-200 border border-transparent hover:border-black/[0.06]"
              >
                <div className="font-semibold text-[#1d1d1f] group-hover:text-black">岗位编制</div>
                <div className="text-[10px] text-[#86868b] mt-0.5">维护 JD 标尺</div>
              </button>
              <button
                onClick={() => go('schedule')}
                className="group cursor-pointer rounded-xl bg-[#f5f5f7] p-3 text-left hover:bg-black/[0.04] hover:-translate-y-0.5 transition-all duration-200 border border-transparent hover:border-black/[0.06]"
              >
                <div className="font-semibold text-[#1d1d1f] group-hover:text-black">约面日程</div>
                <div className="text-[10px] text-[#86868b] mt-0.5">日历与通知重发</div>
              </button>
              <button
                onClick={() => go('bank')}
                className="group cursor-pointer rounded-xl bg-[#f5f5f7] p-3 text-left hover:bg-black/[0.04] hover:-translate-y-0.5 transition-all duration-200 border border-transparent hover:border-black/[0.06]"
              >
                <div className="font-semibold text-[#1d1d1f] group-hover:text-black">团队题库</div>
                <div className="text-[10px] text-[#86868b] mt-0.5">录入标准化问题</div>
              </button>
              <button
                onClick={() => go('admin')}
                className="group cursor-pointer rounded-xl bg-[#f5f5f7] p-3 text-left hover:bg-black/[0.04] hover:-translate-y-0.5 transition-all duration-200 border border-transparent hover:border-black/[0.06]"
              >
                <div className="font-semibold text-[#1d1d1f] group-hover:text-black">管理后台</div>
                <div className="text-[10px] text-[#86868b] mt-0.5">监控影刀同步</div>
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
