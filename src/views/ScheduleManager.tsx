import { useState } from 'react'
import { candidates, TODAY } from '../data'
import { advanceCalendarSync, cancelSchedule, rescheduleSchedule, resendNotice, slotDate, slotLabel } from '../store'
import type { Go } from '../App'
import { Btn, Card } from './ui'

export default function ScheduleManager({ go }: { go: Go }) {
  const [filterChannel, setFilterChannel] = useState<'all' | 'sms' | 'email'>('all')
  const [selectedCid, setSelectedCid] = useState<string | null>(null)
  const [showReschedModal, setShowReschedModal] = useState<string | null>(null)
  const [newSlot, setNewSlot] = useState('2026-10-02 10:00')

  // 已排场次：以场次记录为准（含日程待同步 / 通知失败 / 已取消等异常态），不隐藏待联系候选人
  const scheduled = candidates
    .filter((c) => !!c.scheduleDetail)
    .sort((a, b) => a.slot.localeCompare(b.slot))

  const live = scheduled.filter((c) => c.scheduleDetail?.status === 'scheduled')
  const noticeFailed = scheduled.filter((c) => c.scheduleDetail?.noticeStatus === 'failed')
  const noticePending = scheduled.filter((c) => c.scheduleDetail?.noticeStatus === 'pending')
  const noticeConfirmed = scheduled.filter((c) => c.scheduleDetail?.noticeStatus === 'confirmed')
  const calendarPending = scheduled.filter((c) => c.scheduleDetail?.feishuCalendarStatus !== 'synced')
  const confirmRate = live.length ? Math.round((noticeConfirmed.length / live.length) * 100) : 0

  const filtered = scheduled.filter(
    (c) => filterChannel === 'all' || c.scheduleDetail?.noticeChannel === filterChannel,
  )

  const handleReschedule = (cid: string) => {
    rescheduleSchedule(cid, newSlot)
    setShowReschedModal(null)
  }

  return (
    <div className="space-y-6">
      {/* 顶部标题与筛选 */}
      <div className="ws-rise flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-black/[0.08] pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-[#1d1d1f]">约面管理与通知中心</h1>
            <span className="inline-flex items-center rounded-full bg-black/[0.04] px-2.5 py-0.5 text-xs font-semibold text-[#1d1d1f] ring-1 ring-inset ring-black/10">
              已安排 {live.length} 场面试
            </span>
          </div>
          <p className="mt-1.5 text-xs text-[#6e6e73]">
            飞书日历与会议日程协同 · 短信/邮件双通知通道 · 改期与取消幂等保护
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Btn variant="solid" onClick={() => go('candidates')}>
            + 从候选人大池约面
          </Btn>
        </div>
      </div>

      {/* 状态统计卡片 */}
      <div className="ws-rise [--i:1] grid gap-4 sm:grid-cols-3">
        <div className="ws-paper rounded-2xl p-5 border border-black/[0.05]">
          <div className="text-xs text-[#86868b]">已排约面场次</div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-[#1d1d1f]">{live.length} 场</div>
          <div className="mt-2 text-[11px] text-[#86868b]">改期 / 取消只追加历史，场次记录不物理删除</div>
        </div>

        <div className="ws-paper rounded-2xl p-5 border border-black/[0.05]">
          <div className="text-xs text-[#86868b]">通知确认率</div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-emerald-700">{confirmRate}%</div>
          <div className="mt-2 text-[11px] text-[#86868b]">
            待确认 {noticePending.length} 场 · 失败 {noticeFailed.length} 场（进入可重试队列）
          </div>
        </div>

        <div className="ws-paper rounded-2xl p-5 border border-black/[0.05]">
          <div className="text-xs text-[#86868b]">飞书日程同步</div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-[#1d1d1f]">{live.length - calendarPending.length} 场已同步</div>
          <div className="mt-2 text-[11px] text-[#86868b]">
            {calendarPending.length ? `待同步 / 同步失败 ${calendarPending.length} 场，可重试不重复建场` : '全部场次已同步至面试官飞书日历'}
          </div>
        </div>
      </div>

      {/* 筛选过滤条 */}
      <div className="ws-rise [--i:2] flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-[#86868b]">通知通道：</span>
          <button
            onClick={() => setFilterChannel('all')}
            className={`cursor-pointer rounded-full px-3 py-1 font-medium transition-all ${
              filterChannel === 'all'
                ? 'bg-[#1d1d1f] text-white'
                : 'bg-white text-[#86868b] border border-black/[0.08]'
            }`}
          >
            全部通道 ({scheduled.length})
          </button>
          <button
            onClick={() => setFilterChannel('sms')}
            className={`cursor-pointer rounded-full px-3 py-1 font-medium transition-all ${
              filterChannel === 'sms'
                ? 'bg-[#1d1d1f] text-white'
                : 'bg-white text-[#86868b] border border-black/[0.08]'
            }`}
          >
            第三方短信通道
          </button>
          <button
            onClick={() => setFilterChannel('email')}
            className={`cursor-pointer rounded-full px-3 py-1 font-medium transition-all ${
              filterChannel === 'email'
                ? 'bg-[#1d1d1f] text-white'
                : 'bg-white text-[#86868b] border border-black/[0.08]'
            }`}
          >
            邮件通知 (SMTP)
          </button>
        </div>
      </div>

      {/* 面试安排场次列表 */}
      <div className="ws-rise [--i:3] space-y-3.5">
        {filtered.map((c) => {
          const dt = c.scheduleDetail
          return (
            <div
              key={c.id}
              className="ws-paper rounded-2xl p-5 border border-black/[0.05] hover:border-black/25 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4"
            >
              {/* 左侧：候选人与时间 */}
              <div className="space-y-1.5 min-w-[280px]">
                <div className="flex items-center gap-2.5">
                  <span className="text-base font-semibold text-[#1d1d1f]">{c.name}</span>
                  <span className="text-xs text-[#86868b]">· {c.role}</span>
                  <span className="rounded-full bg-black/[0.04] px-2 py-0.5 text-[10px] font-semibold text-[#1d1d1f] ring-1 ring-inset ring-black/10">
                    {c.round}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${dt?.type === 'offline' ? 'bg-purple-50 text-purple-800 ring-purple-600/20' : 'bg-black/[0.04] text-[#1d1d1f] ring-black/10'}`}>
                    {dt?.type === 'offline' ? '线下现场' : '线上飞书会议'}
                  </span>
                  {dt?.status === 'canceled' && (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800 ring-1 ring-inset ring-amber-600/20">已取消（保留历史）</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-[#1d1d1f] font-mono">
                  <span>📅 {c.slot}</span>
                  <span className="text-[#86868b]">({slotLabel(c.slot)})</span>
                  <span className="text-[#86868b]">· {dt?.durationMin ?? 45} 分钟</span>
                </div>
                <div className="text-[11px] text-[#86868b]">
                  场次 {dt?.interviewId} · 面试官：{dt?.interviewer} · 负责 HR：{c.assignee} · 来源：{c.source}
                </div>
              </div>

              {/* 中间：飞书日程与通知双轨（同步 / 发送异常均显式展示，可重试且不重复建场） */}
              <div className="flex-1 border-t lg:border-t-0 lg:border-l border-black/[0.05] pt-3 lg:pt-0 lg:pl-6 text-xs space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-[#1d1d1f]">飞书日程：</span>
                  {dt?.feishuCalendarStatus === 'synced' ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-800 font-medium ring-1 ring-inset ring-emerald-600/20">
                      ✓ 已同步至面试官飞书日历
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-800 font-medium ring-1 ring-inset ring-amber-600/20">
                      {dt?.feishuCalendarStatus === 'failed' ? '✕ 日程同步失败' : '⏳ 日程待同步'}
                    </span>
                  )}
                  {dt?.feishuCalendarStatus !== 'synced' && (
                    <button onClick={() => advanceCalendarSync(c.id)} className="cursor-pointer text-[11px] font-semibold text-[#1d1d1f] hover:underline">
                      重试同步
                    </button>
                  )}
                  {dt?.feishuMeetingUrl && (
                    <a
                      href={dt.feishuMeetingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#1d1d1f] font-semibold hover:underline"
                    >
                      进入飞书会议 ↗
                    </a>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-[#1d1d1f]">候选人通知：</span>
                  <span className="rounded bg-black/[0.04] px-1.5 py-0.5 text-[11px]">
                    {dt?.noticeChannel === 'sms' ? '第三方短信服务' : '邮件 SMTP'}
                  </span>
                  <span className={`font-medium ${dt?.noticeStatus === 'failed' ? 'text-red-600' : 'text-emerald-700'}`}>
                    {dt?.noticeStatus === 'confirmed'
                      ? '✓ 候选人已确认参加'
                      : dt?.noticeStatus === 'sent'
                      ? '✓ 已发邀约待确认'
                      : dt?.noticeStatus === 'failed'
                      ? `✕ 通知失败（已尝试 ${dt?.noticeAttempts ?? 0} 次，可重试）`
                      : '⏳ 通知待发送'}
                  </span>
                </div>

                {dt?.failureReason && (
                  <div className="rounded-lg bg-red-50/70 border border-red-200/60 px-2.5 py-1.5 text-[11px] text-red-700">
                    异常原因：{dt.failureReason}
                  </div>
                )}
              </div>

              {/* 右侧：操作胶囊 */}
              <div className="flex items-center justify-end gap-2 border-t lg:border-t-0 lg:border-l border-black/[0.05] pt-3 lg:pt-0 lg:pl-6 shrink-0">
                <Btn variant="ghost" className="!h-8 !px-3" onClick={() => resendNotice(c.id)}>
                  重发通知
                </Btn>
                <Btn
                  variant="ghost"
                  className="!h-8 !px-3"
                  onClick={() => {
                    setNewSlot(c.slot)
                    setShowReschedModal(c.id)
                  }}
                >
                  改期
                </Btn>
                <Btn variant="ghost" className="!h-8 !px-3 text-red-600" onClick={() => cancelSchedule(c.id)}>
                  取消
                </Btn>
                <Btn variant="accent" className="!h-8 !px-3.5" onClick={() => go('room', c.id)}>
                  进入考场 ↗
                </Btn>
              </div>
            </div>
          )
        })}

        {!filtered.length && (
          <div className="ws-paper rounded-2xl p-12 text-center text-xs text-[#86868b]">
            暂无符合条件的排期场次
          </div>
        )}
      </div>

      {/* 改期弹窗 */}
      {showReschedModal && (
        <div
          className="ws-scrim fixed inset-0 z-50 grid place-items-center px-4"
          onClick={() => setShowReschedModal(null)}
        >
          <div
            className="w-full max-w-sm ws-paper rounded-2xl p-6 border border-black/[0.08] shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-baseline justify-between border-b border-black/[0.06] pb-3">
              <h2 className="text-base font-semibold text-[#1d1d1f]">调整面试时间 (改期)</h2>
              <button onClick={() => setShowReschedModal(null)} className="cursor-pointer text-xs text-[#86868b]">
                ✕
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <label className="text-[#86868b] block">新面试时间</label>
              <input
                value={newSlot}
                onChange={(e) => setNewSlot(e.target.value)}
                placeholder="YYYY-MM-DD HH:mm"
                className="h-9 w-full rounded-xl border border-black/[0.08] px-3 outline-none focus:border-black/50"
              />
              <p className="text-[11px] text-[#86868b]">
                改期将自动在飞书日历更新日程，并重新触发候选人短信通知。
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Btn variant="ghost" onClick={() => setShowReschedModal(null)}>
                取消
              </Btn>
              <Btn variant="solid" onClick={() => handleReschedule(showReschedModal)}>
                确认改期
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
