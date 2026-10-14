import { useState, type KeyboardEvent, type ReactNode } from 'react'
import { TODAY, candidates, type ApprovalApplication, type Candidate } from '../data'
import { approvals, retryFailedBatch, simulateSyncFailure, slotLabel, sourceDbSync, triggerSourceDbSync, type SourceDbSyncState } from '../store'
import type { Go } from '../App'
import { Btn, Card, Chip, Empty, type Tone } from './ui'

/* ── 审批轨状态（FR-C4）：发起 / 处理中 / 通过 / 退回 / 拒绝 / 撤销逐一显式展示 ── */
const TRACK_NAME: Record<'feishu' | 'bpm', string> = { feishu: '飞书审批', bpm: 'BPM 流程' }
const TRACK_LABEL: Record<string, string> = {
  pending: '处理中',
  approved: '已通过',
  returned: '已退回',
  rejected: '已驳回',
  canceled: '已撤销',
}
const TRACK_TONE: Record<string, Tone> = { pending: 'info', approved: 'success', returned: 'warning', rejected: 'error', canceled: 'ghost' }

/* ── 聚合结论：partial = 单边通过，按 PRD C4 绝不能显示成「已通过 / 已录取」 ── */
const FINAL_LABEL: Record<ApprovalApplication['finalStatus'], string> = {
  approved: '双轨已通过',
  partial: '单边通过（未整体通过）',
  returned: '已退回',
  rejected: '已驳回',
  canceled: '已撤销',
  processing: '流转中',
}
const FINAL_TONE: Record<ApprovalApplication['finalStatus'], Tone> = {
  approved: 'success',
  partial: 'warning',
  returned: 'warning',
  rejected: 'error',
  canceled: 'ghost',
  processing: 'info',
}
// 分组口径：先列负向 / 待跟进，再列已通过，最后是仍在流转（无状态变化）
const FINAL_ORDER: ApprovalApplication['finalStatus'][] = ['partial', 'returned', 'rejected', 'canceled', 'approved', 'processing']

const SYNC_LABEL: Record<SourceDbSyncState['status'], string> = { idle: '待命', syncing: '同步中', success: '同步成功', error: '同步失败' }
const SYNC_TONE: Record<SourceDbSyncState['status'], Tone> = { idle: 'ghost', syncing: 'info', success: 'success', error: 'error' }

const CAL_LABEL = { synced: '日历已同步', pending: '日历待同步', failed: '日历同步失败' } as const
const CAL_TONE: Record<'synced' | 'pending' | 'failed', Tone> = { synced: 'success', pending: 'info', failed: 'error' }
const NOTICE_LABEL = { sent: '通知已发送', pending: '通知待发送', failed: '通知发送失败', confirmed: '候选人已确认' } as const
const NOTICE_TONE: Record<'sent' | 'pending' | 'failed' | 'confirmed', Tone> = { sent: 'success', pending: 'info', failed: 'error', confirmed: 'success' }

const ATTACH_LABEL: Record<Candidate['attachmentType'], string> = { original: '候选人原件', platform: '平台文件', missing: '附件缺失' }
const ATTACH_TONE: Record<Candidate['attachmentType'], Tone> = { original: 'success', platform: 'info', missing: 'error' }

type Tab = 'all' | 'screen' | 'schedule' | 'review' | 'approval'

/** 可点击卡片：键盘可达（Enter / Space）；卡片内次级动作放在 data-row-action 容器里隔离点击 */
function ActRow({ onActivate, ariaLabel, className = '', children }: { onActivate: () => void; ariaLabel: string; className?: string; children: ReactNode }) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('[data-row-action]')) return
        onActivate()
      }}
      onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onActivate()
        }
      }}
      className={`card card-border bg-base-100 shadow-[var(--shadow-paper)] cursor-pointer text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${className}`}
    >
      {children}
    </div>
  )
}

function GroupHead({ title, count, tone, hint }: { title: string; count: number; tone: Tone; hint?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-1">
      <Chip tone={tone}>{title}</Chip>
      <span className="text-xs font-medium tabular-nums text-base-content/70">{count} 条</span>
      {hint && <span className="text-[11px] text-base-content/50">{hint}</span>}
    </div>
  )
}

function NextAction({ c }: { c: Candidate }) {
  if (!c.nextAction) return null
  return (
    <div className="mt-1 text-[11px] text-base-content/60">
      下一步：{c.nextAction.text}
      <span className="text-base-content/40">
        （{c.nextAction.owner} · 截止 {c.nextAction.dueAt}）
      </span>
    </div>
  )
}

export default function Workbench({ go }: { go: Go }) {
  const [toast, setToast] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('all')

  const flash = (kind: 'success' | 'error', text: string) => {
    setToast({ kind, text })
    window.setTimeout(() => setToast(null), 5000)
  }

  const pendingScreen = candidates.filter((c) => c.status === '新入库' || c.status === '筛选中')
  const pendingSchedule = candidates.filter((c) => c.status === '待联系')
  const pendingReview = candidates.filter((c) => c.status === '面评中')

  // 审批状态变化：按聚合结论逐状态分组，另外单独挑出「单轨同步失败」的异常审批
  const approvalGroups = FINAL_ORDER.map((st) => ({ st, items: approvals.filter((a) => a.finalStatus === st) }))
  const syncIssueApps = approvals.filter((a) => a.feishu.lastError || a.bpm.lastError)
  const approvalAttention = approvals.filter((a) => a.finalStatus !== 'processing' || a.feishu.lastError || a.bpm.lastError)

  const todayInterviews = candidates
    .filter((c) => c.status === '约面中' && c.slot.startsWith(TODAY))
    .sort((a, b) => a.slot.localeCompare(b.slot))

  const handleSync = () => {
    const res = triggerSourceDbSync()
    if (res.ok) flash('success', `来源库拉取完成：新增 ${res.newCount} 人入库，${res.ignoredCount} 人已存在按幂等键跳过（最后成功时间 ${sourceDbSync.lastSyncTime}）`)
    else flash('error', `来源库拉取失败：${sourceDbSync.lastError ?? '未知原因'}，可点击「重试失败批次」`)
  }

  const handleRetry = () => {
    const res = retryFailedBatch()
    if (res.ok) flash('success', `失败批次重跑完成：补入 ${res.newCount} 人，${res.ignoredCount} 人已存在跳过（沿用同一幂等键，未重复建档）`)
    else flash('error', `失败批次重跑失败：${sourceDbSync.lastError ?? '未知原因'}`)
  }

  const handleSimulateFailure = () => {
    const s = simulateSyncFailure()
    flash('error', `来源库读取失败（演示异常）：${s.lastError}；本批 ${s.failedBatch?.count ?? 0} 条待同步，可点击「重试失败批次」`)
  }

  const totalPending = pendingScreen.length + pendingSchedule.length + pendingReview.length + approvalAttention.length
  const listEmpty = !pendingScreen.length && !pendingSchedule.length && !pendingReview.length && !approvals.length

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'all', label: '全部', count: totalPending },
    { key: 'screen', label: '筛选中', count: pendingScreen.length },
    { key: 'schedule', label: '待联系', count: pendingSchedule.length },
    { key: 'review', label: '待面评', count: pendingReview.length },
    { key: 'approval', label: '审批状态变化', count: approvalAttention.length },
  ]

  const tile = (key: Tab, title: string, badge: string, badgeTone: Tone, count: number, unit: string, note: string) => (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={activeTab === key}
      aria-label={`${title}，${count} ${unit}`}
      onClick={() => setActiveTab(key)}
      onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          setActiveTab(key)
        }
      }}
      className={`card card-border cursor-pointer bg-base-100 shadow-[var(--shadow-paper)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[var(--shadow-lift)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
        activeTab === key ? 'border-primary/40 ring-2 ring-primary/15' : ''
      }`}
    >
      <div className="card-body gap-2 p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-base-content/70">{title}</span>
          <Chip tone={badgeTone}>{badge}</Chip>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold tabular-nums tracking-tight text-base-content">{count}</span>
          <span className="text-xs text-base-content/60">{unit}</span>
        </div>
        <p className="line-clamp-1 text-[11px] text-base-content/50">{note}</p>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* 顶部标题栏 */}
      <div className="ws-rise flex flex-col justify-between gap-4 border-b border-base-300 pb-5 md:flex-row md:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-base-content">工作台 · 我的待办</h1>
            <Chip tone="neutral">待处理 {totalPending} 项</Chip>
          </div>
          <p className="mt-1.5 text-xs text-base-content/60">来源库落库人选 · AI 宽松初筛 · 飞书日程协同 · 考场实录考核 · 录取双轨审批</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Btn variant="ghost" onClick={() => go('bento')}>
            四色指挥舱
          </Btn>
          <Btn variant="solid" onClick={() => go('candidates')}>
            查看候选人大池
          </Btn>
        </div>
      </div>

      {toast && (
        <div role="status" className={`alert alert-soft ${toast.kind === 'success' ? 'alert-success' : 'alert-error'} flex items-center justify-between gap-3 text-xs`}>
          <span>{toast.text}</span>
          <button type="button" onClick={() => setToast(null)} aria-label="关闭提示" className="btn btn-ghost btn-xs btn-circle">
            ✕
          </button>
        </div>
      )}

      {/* 来源库同步状态（FR-A1）：读真实状态，失败显式可见并可重跑 */}
      <Card className="ws-rise [--i:1]">
        <div className="card-body gap-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-base-content">来源库同步状态</span>
              <Chip tone={SYNC_TONE[sourceDbSync.status]}>{SYNC_LABEL[sourceDbSync.status]}</Chip>
              <Chip tone={sourceDbSync.connected ? 'info' : 'error'}>{sourceDbSync.connected ? '只读连接正常' : '只读连接断开'}</Chip>
              <span className="text-xs text-base-content/60">最后成功：{sourceDbSync.lastSyncTime}</span>
              <span className="text-xs text-base-content/50">
                累计落库 {sourceDbSync.totalSynced} 人 · 最近一批 {sourceDbSync.lastBatchCount} 人
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Btn variant="ghost" onClick={handleSync}>
                刷新拉取来源库
              </Btn>
              {sourceDbSync.canRetry && (
                <Btn variant="danger" onClick={handleRetry}>
                  重试失败批次（{sourceDbSync.failedBatch?.count ?? 0} 条）
                </Btn>
              )}
              <Btn variant="soft" onClick={handleSimulateFailure} title="演示来源库读取失败：进入可重跑队列">
                演示同步失败
              </Btn>
            </div>
          </div>

          {sourceDbSync.lastError ? (
            <div className="alert alert-soft alert-error items-start text-xs">
              <div>
                <div className="font-semibold">来源库读取失败：{sourceDbSync.lastError}</div>
                <div className="mt-0.5 text-base-content/70">
                  最后成功时间仍为 {sourceDbSync.lastSyncTime}
                  {sourceDbSync.failedBatch
                    ? `；失败批次 ${sourceDbSync.failedBatch.count} 条（${sourceDbSync.failedBatch.at}）已进入可重跑队列，重跑沿用同一幂等键，不会重复建档。`
                    : '。'}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-base-content/50">
              按来源唯一标识（渠道 + 来源 ID）幂等建档，重复读取不重复建人；来源侧更新只刷新来源时间，不覆盖工作台已确认的阶段 / 面评 / 审批结果。
            </p>
          )}
        </div>
      </Card>

      {/* 四大待办分区卡片 */}
      <div className="ws-rise [--i:1] grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tile(
          'screen',
          '筛选中复核',
          '影刀落库',
          'info',
          pendingScreen.length,
          '人需确认意向',
          pendingScreen.length ? `最新：${pendingScreen[0].name}（${pendingScreen[0].role}）` : '暂无待处理',
        )}
        {tile(
          'schedule',
          '待安排面试',
          '日程协同',
          'warning',
          pendingSchedule.length,
          '人待排期通知',
          pendingSchedule.length ? `最新：${pendingSchedule[0].name}` : '所有约面均已排期',
        )}
        {tile('review', '待面评确认', '人工面评', 'accent', pendingReview.length, '场待补全打分', pendingReview.length ? `考场：${pendingReview[0].name}` : '已全部完成评价')}
        {tile(
          'approval',
          '审批状态变化',
          '飞书 / BPM',
          'neutral',
          approvalAttention.length,
          '份状态已变化或有异常',
          approvalAttention.length ? `待跟进：${approvalAttention[0].candidateName}（${FINAL_LABEL[approvalAttention[0].finalStatus]}）` : '暂无状态变化',
        )}
      </div>

      {/* 主体布局：左侧待办事务流，右侧今日考场与快捷动作 */}
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold tracking-tight text-base-content">待处理事务清单</h2>
              <span className="text-xs text-base-content/50">（回车或点击卡片推进对应业务）</span>
            </div>

            <div role="tablist" className="tabs tabs-box tabs-sm w-fit">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`tab text-xs ${activeTab === t.key ? 'tab-active font-semibold' : ''}`}
                >
                  {t.label}
                  <span className="ml-1 tabular-nums text-base-content/50">({t.count})</span>
                </button>
              ))}
            </div>
          </div>

          {/* 1. 筛选中复核 */}
          {pendingScreen.length > 0 && (activeTab === 'all' || activeTab === 'screen') && (
            <div className="space-y-3">
              <GroupHead title="筛选中复核" count={pendingScreen.length} tone="info" hint="AI 宽松初筛已出结论，由 HR 决定是否联系" />
              {pendingScreen.map((c) => (
                <ActRow key={c.id} ariaLabel={`筛选中复核：${c.name}，应聘 ${c.role}`} onActivate={() => go('detail', c.id)}>
                  <div className="card-body flex-row items-center justify-between gap-4 p-4">
                    <div className="flex items-center gap-3.5">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-base-300 bg-base-200 text-xs font-bold text-base-content/70">筛</div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-base-content">{c.name}</span>
                          <span className="text-xs text-base-content/60">· {c.role}</span>
                          <Chip tone="ghost">来源 {c.source}</Chip>
                          <Chip tone={ATTACH_TONE[c.attachmentType]}>{ATTACH_LABEL[c.attachmentType]}</Chip>
                        </div>
                        <div className="mt-1 text-xs text-base-content/60">
                          AI 宽松初筛：<span className="font-medium text-base-content">{c.aiScreening?.looseMatch ?? '尚未运行 AI 初筛'}</span>
                        </div>
                        <NextAction c={c} />
                      </div>
                    </div>
                    <div data-row-action className="shrink-0">
                      <Btn variant="ghost" className="!h-8 !px-3.5" onClick={() => go('detail', c.id)}>
                        复核简历
                      </Btn>
                    </div>
                  </div>
                </ActRow>
              ))}
            </div>
          )}

          {/* 2. 待联系：点击带候选人上下文进入约面管理 */}
          {pendingSchedule.length > 0 && (activeTab === 'all' || activeTab === 'schedule') && (
            <div className="space-y-3">
              <GroupHead title="待联系 / 待约面" count={pendingSchedule.length} tone="warning" hint="初筛通过，待确认双方时间并发起预约" />
              {pendingSchedule.map((c) => (
                <ActRow key={c.id} ariaLabel={`待联系：${c.name}，点击进入约面管理`} onActivate={() => go('schedule', c.id)}>
                  <div className="card-body flex-row items-center justify-between gap-4 p-4">
                    <div className="flex items-center gap-3.5">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-base-300 bg-base-200 text-xs font-bold text-base-content/70">约</div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-base-content">{c.name}</span>
                          <span className="text-xs text-base-content/60">· {c.role}</span>
                          <Chip tone="success">初筛已通过</Chip>
                          <Chip tone={ATTACH_TONE[c.attachmentType]}>{ATTACH_LABEL[c.attachmentType]}</Chip>
                        </div>
                        <div className="mt-1 text-xs text-base-content/60">
                          负责 HR：{c.assignee} · 契合度 <span className="font-semibold tabular-nums text-base-content">{c.match}%</span>
                          {c.scheduleDetail
                            ? ` · 场次 ${c.scheduleDetail.interviewId}（${c.scheduleDetail.status === 'canceled' ? '已取消' : '待排期'}）`
                            : ' · 尚无场次记录'}
                        </div>
                        <NextAction c={c} />
                      </div>
                    </div>
                    <div data-row-action className="flex shrink-0 items-center gap-2">
                      <Btn variant="ghost" className="!h-8 !px-3" onClick={() => go('detail', c.id)}>
                        候选人详情
                      </Btn>
                      <Btn variant="solid" className="!h-8 !px-3.5" onClick={() => go('schedule', c.id)}>
                        去排期
                      </Btn>
                    </div>
                  </div>
                </ActRow>
              ))}
            </div>
          )}

          {/* 3. 待面评确认 */}
          {pendingReview.length > 0 && (activeTab === 'all' || activeTab === 'review') && (
            <div className="space-y-3">
              <GroupHead title="待面评确认" count={pendingReview.length} tone="accent" hint="考场已结束，AI 草稿需人工确认后保存" />
              {pendingReview.map((c) => (
                <ActRow key={c.id} ariaLabel={`待面评：${c.name}，点击进入考场`} onActivate={() => go('room', c.id)}>
                  <div className="card-body flex-row items-center justify-between gap-4 p-4">
                    <div className="flex items-center gap-3.5">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-base-300 bg-base-200 text-xs font-bold text-base-content/70">评</div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-base-content">{c.name}</span>
                          <span className="text-xs text-base-content/60">· {c.role}</span>
                          {c.scheduleDetail && <Chip tone={CAL_TONE[c.scheduleDetail.feishuCalendarStatus]}>{CAL_LABEL[c.scheduleDetail.feishuCalendarStatus]}</Chip>}
                          {c.scheduleDetail && <Chip tone={NOTICE_TONE[c.scheduleDetail.noticeStatus]}>{NOTICE_LABEL[c.scheduleDetail.noticeStatus]}</Chip>}
                        </div>
                        <div className="mt-1 text-xs text-base-content/60">{slotLabel(c.slot)} 场次已完成 · 待面试官确认并提交综合面评</div>
                        <NextAction c={c} />
                      </div>
                    </div>
                    <div data-row-action className="shrink-0">
                      <Btn variant="ghost" className="!h-8 !px-3.5" onClick={() => go('room', c.id)}>
                        确认面评
                      </Btn>
                    </div>
                  </div>
                </ActRow>
              ))}
            </div>
          )}

          {/* 4. 审批状态变化提醒（FR-C4）：逐状态分组，单边通过与同步失败单独可辨 */}
          {approvals.length > 0 && (activeTab === 'all' || activeTab === 'approval') && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 px-1">
                <Chip tone="neutral">审批状态口径</Chip>
                {FINAL_ORDER.map((st) => (
                  <Chip key={st} tone={FINAL_TONE[st]}>
                    {FINAL_LABEL[st]} {approvals.filter((a) => a.finalStatus === st).length}
                  </Chip>
                ))}
                <Chip tone="error">同步失败 {syncIssueApps.length}</Chip>
              </div>

              {approvalGroups.map(({ st, items }) =>
                items.length === 0 ? null : (
                  <div key={st} className="space-y-3">
                    <GroupHead
                      title={FINAL_LABEL[st]}
                      count={items.length}
                      tone={FINAL_TONE[st]}
                      hint={st === 'partial' ? '仅一侧通过，必需审批未完成，不得标记为整体录用' : undefined}
                    />
                    {items.map((a) => (
                      <ActRow key={a.id} ariaLabel={`审批单 ${a.id}，候选人 ${a.candidateName}，整体结论 ${FINAL_LABEL[a.finalStatus]}`} onActivate={() => go('approvals')}>
                        <div className="card-body gap-3 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold text-base-content">{a.candidateName}</span>
                              <span className="text-xs text-base-content/60">· {a.positionName}</span>
                              <Chip tone="ghost">单号 {a.id}</Chip>
                              <Chip tone={FINAL_TONE[a.finalStatus]}>{FINAL_LABEL[a.finalStatus]}</Chip>
                            </div>
                            <div data-row-action className="flex shrink-0 items-center gap-2">
                              <Btn variant="ghost" className="!h-8 !px-3" onClick={() => go('detail', a.candidateId)}>
                                候选人详情
                              </Btn>
                              <Btn variant="ghost" className="!h-8 !px-3" onClick={() => go('approvals')}>
                                追踪进度
                              </Btn>
                            </div>
                          </div>

                          <div className="grid gap-2 sm:grid-cols-2">
                            {(['feishu', 'bpm'] as const).map((k) => {
                              const t = a[k]
                              return (
                                <div key={k} className="rounded-xl border border-base-300 bg-base-200/60 p-3 text-xs">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-medium text-base-content">{TRACK_NAME[k]}</span>
                                    <Chip tone={TRACK_TONE[t.status]}>{TRACK_LABEL[t.status] ?? t.status}</Chip>
                                  </div>
                                  <div className="mt-1 text-base-content/70">当前节点：{t.currentNode}</div>
                                  <div className="tabular-nums text-base-content/50">更新时间：{t.updateTime}</div>
                                  {t.lastError && (
                                    <div className="mt-1 font-medium text-error">
                                      同步异常：{t.lastError}（已重试 {t.retryCount} 次，沿用原实例未重复发起）
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </ActRow>
                    ))}
                  </div>
                ),
              )}
            </div>
          )}

          {/* 空态：每个分段独立给文案，不留白 */}
          {activeTab === 'screen' && !pendingScreen.length && (
            <Empty title="暂无待筛选候选人" hint="来源库同步后，处于「新入库 / 筛选中」的候选人会出现在这里" action={<Btn variant="ghost" onClick={handleSync}>立即拉取来源库</Btn>} />
          )}
          {activeTab === 'schedule' && !pendingSchedule.length && (
            <Empty title="暂无待联系候选人" hint="初筛通过进入「待联系」阶段的人选会出现在这里，可在此发起约面与通知" />
          )}
          {activeTab === 'review' && !pendingReview.length && (
            <Empty title="暂无待面评场次" hint="面试结束进入「面评中」的候选人会出现在这里，AI 草稿需人工确认后保存" />
          )}
          {activeTab === 'approval' && !approvals.length && (
            <Empty
              title="暂无审批状态变化"
              hint="发起录取申请后，飞书审批与 BPM 流程的通过 / 退回 / 驳回 / 撤销 / 同步失败都会在这里提醒"
              action={<Btn variant="ghost" onClick={() => go('approvals')}>前往录取申请</Btn>}
            />
          )}
          {activeTab === 'all' && listEmpty && <Empty title="当前没有待办" hint="来源库有新简历落库或面试流转后，待办会自动出现在这里" />}
        </div>

        {/* 右侧：今日面试日程与快捷入口 */}
        <aside className="space-y-5">
          <Card>
            <div className="card-body gap-3 p-5">
              <div className="flex items-center justify-between border-b border-base-300 pb-3">
                <div className="flex items-center gap-2">
                  <span className="status status-success" aria-hidden="true" />
                  <h3 className="text-sm font-semibold text-base-content">今日面试安排（{todayInterviews.length}）</h3>
                </div>
                <span className="font-mono text-xs text-base-content/50">{TODAY}</span>
              </div>

              {todayInterviews.map((c) => (
                <ActRow key={c.id} ariaLabel={`今日面试：${c.name}，点击进入考场`} onActivate={() => go('room', c.id)} className="!shadow-none">
                  <div className="card-body gap-2 p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-base-content">
                        {c.name} · {c.role}
                      </span>
                      <span className="rounded bg-base-200 px-1.5 py-0.5 font-mono text-xs text-base-content">{c.slot.slice(11)}</span>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-base-content/60">
                      {c.scheduleDetail ? (
                        <span className="flex flex-wrap items-center gap-1.5">
                          <Chip tone={CAL_TONE[c.scheduleDetail.feishuCalendarStatus]}>{CAL_LABEL[c.scheduleDetail.feishuCalendarStatus]}</Chip>
                          <Chip tone={NOTICE_TONE[c.scheduleDetail.noticeStatus]}>{NOTICE_LABEL[c.scheduleDetail.noticeStatus]}</Chip>
                        </span>
                      ) : (
                        <Chip tone="warning">无场次记录</Chip>
                      )}
                      <span className="font-semibold text-base-content">进入考场</span>
                    </div>
                  </div>
                </ActRow>
              ))}

              {!todayInterviews.length && (
                <Empty title="今日暂无排期待面场次" hint={`以 ${TODAY} 为演示基准日，约面成功的场次会在当天显示在这里`} />
              )}
            </div>
          </Card>

          <Card>
            <div className="card-body gap-3 p-5">
              <h3 className="text-sm font-semibold text-base-content">系统快捷入口</h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {(
                  [
                    { k: 'jobs', t: '岗位编制', s: '维护 JD 标尺' },
                    { k: 'schedule', t: '约面日程', s: '日历与通知重发' },
                    { k: 'bank', t: '团队题库', s: '录入标准化问题' },
                    { k: 'admin', t: '管理后台', s: '监控来源库同步' },
                  ] as const
                ).map((it) => (
                  <button
                    key={it.k}
                    type="button"
                    onClick={() => go(it.k)}
                    className="cursor-pointer rounded-xl border border-base-300 bg-base-200/60 p-3 text-left transition-colors hover:bg-base-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <div className="font-semibold text-base-content">{it.t}</div>
                    <div className="mt-0.5 text-[10px] text-base-content/50">{it.s}</div>
                  </button>
                ))}
              </div>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  )
}
