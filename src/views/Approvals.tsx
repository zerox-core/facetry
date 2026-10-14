import { useEffect, useRef, useState } from 'react'
import {
  candidates,
  type ApprovalApplication,
  type ApprovalTrack,
  type ApprovalTrackStatus,
  type Candidate,
  type MaterialItem,
} from '../data'
import {
  approvals,
  can,
  createApproval,
  currentUser,
  defaultMaterials,
  demoToday,
  retryApprovalTrack,
  setApprovalTrackError,
  updateApprovalTrack,
  type ApprovalTrackKey,
  type Role,
} from '../store'
import type { Go } from '../App'
import { Btn, Card, Chip, Empty, Field, Label, Modal, SectionHead, type Tone } from './ui'

/* ───────────── 录取申请与飞书 / BPM 双审批中心（PRD 模块 C · FR-C1 / C2 / C4）─────────────
   聚合铁律：两条审批轨的状态分别展示、分别追溯；只有飞书审批与 BPM OA 流程都通过，整体才算通过。
   单边通过（partial）一律呈现为「未完成」，绝不渲染成已通过 / 已录取。
   两条轨是并行还是串行，以公司现有审批定义配置为准，代码不写死。
   配色只用 daisyUI 语义色；演示入口一律带 [演示] 标注。 */

const ROLE_LABEL: Record<Role, string> = {
  hr: 'HR 招聘专员',
  interviewer: '面试官',
  approver: '审批人',
  admin: '管理员',
}

const TRACK_NAME: Record<ApprovalTrackKey, string> = {
  feishu: '飞书审批',
  bpm: 'BPM 内部 OA',
}

const TRACK_ID_LABEL: Record<ApprovalTrackKey, string> = {
  feishu: '审批实例号',
  bpm: '流程号',
}

const TRACKS: ApprovalTrackKey[] = ['feishu', 'bpm']

/* 单条轨的六态：发起 → 处理中 → 通过 / 退回 / 驳回 / 撤销 */
type TrackState = { label: string; tone: Tone; dot: string }

const TRACK_STATE: Record<ApprovalTrackStatus, TrackState> = {
  pending: { label: '处理中', tone: 'warning', dot: 'status-warning' },
  approved: { label: '已通过', tone: 'success', dot: 'status-success' },
  rejected: { label: '已驳回', tone: 'error', dot: 'status-error' },
  returned: { label: '已退回', tone: 'info', dot: 'status-info' },
  canceled: { label: '已撤销', tone: 'neutral', dot: 'status-neutral' },
}

function trackStateOf(t: ApprovalTrack): TrackState {
  // 只有发起记录、还没有任何节点动作时，如实显示为「已发起 · 处理中」
  if (t.status === 'pending' && t.history.length <= 1) {
    return { label: '已发起 · 处理中', tone: 'warning', dot: 'status-warning' }
  }
  return TRACK_STATE[t.status]
}

const trackIdOf = (t: ApprovalTrack, key: ApprovalTrackKey) => (key === 'feishu' ? t.instanceId : t.processId)

/* 聚合结论六态：只有 approved 可以出现「可发放 Offer」 */
type FinalStatus = ApprovalApplication['finalStatus']
type FinalState = { label: string; tone: Tone; alert: string; note: string }

const FINAL_STATE: Record<FinalStatus, FinalState> = {
  approved: {
    label: '双轨通过 · 可发放 Offer',
    tone: 'success',
    alert: 'alert alert-soft alert-success',
    note: '飞书审批与 BPM 流程均已通过，聚合结论为整体通过。',
  },
  partial: {
    label: '单边通过 · 未完成',
    tone: 'accent',
    alert: 'alert alert-soft alert-warning',
    note: '单边通过 · 未完成：按聚合铁律（两条轨均通过才算整体通过）不得视为录用，不得发放 Offer。',
  },
  processing: {
    label: '双轨流转中 · 未完成',
    tone: 'info',
    alert: 'alert alert-soft alert-info',
    note: '两条审批轨都还在流转，尚未产生任何通过结论。',
  },
  returned: {
    label: '已退回 · 待补充材料后重走',
    tone: 'warning',
    alert: 'alert alert-soft alert-warning',
    note: '审批被退回发起人整改，本申请单未通过，需补充材料后重新流转。',
  },
  rejected: {
    label: '已驳回 · 不予录用',
    tone: 'error',
    alert: 'alert alert-soft alert-error',
    note: '审批明确驳回，本申请单终止，不进入录用与 Offer 环节。',
  },
  canceled: {
    label: '已撤销 · 申请单作废',
    tone: 'neutral',
    alert: 'alert alert-soft',
    note: '申请单被撤销，不再继续流转，历史记录保留。',
  },
}

const MATERIAL_STATE: Record<MaterialItem['status'], { label: string; tone: Tone; dot: string }> = {
  done: { label: '已齐备', tone: 'success', dot: 'status-success' },
  pending: { label: '待核对', tone: 'warning', dot: 'status-warning' },
  missing: { label: '缺失', tone: 'error', dot: 'status-error' },
}

/* 列表筛选（只按聚合结论过滤，不改变任何单条轨的状态） */
type FilterKey = 'all' | 'inflight' | 'partial' | 'approved' | 'closed'

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: '全部申请单' },
  { key: 'inflight', label: '在途（双轨流转中）' },
  { key: 'partial', label: '单边通过 · 未完成' },
  { key: 'approved', label: '双轨通过' },
  { key: 'closed', label: '退回 / 驳回 / 撤销' },
]

function inFilter(app: ApprovalApplication, key: FilterKey): boolean {
  switch (key) {
    case 'inflight':
      return app.finalStatus === 'processing'
    case 'partial':
      return app.finalStatus === 'partial'
    case 'approved':
      return app.finalStatus === 'approved'
    case 'closed':
      return app.finalStatus === 'rejected' || app.finalStatus === 'returned' || app.finalStatus === 'canceled'
    default:
      return true
  }
}

function trackSummary(app: ApprovalApplication, status: ApprovalTrackStatus): string {
  return TRACKS.filter((k) => app[k].status === status)
    .map((k) => `${TRACK_NAME[k]}（${TRACK_STATE[status].label}）`)
    .join('、')
}

/** 聚合结论说明：partial 必须写清哪一侧通过、哪一侧未完成 */
function finalNoteOf(app: ApprovalApplication): string {
  if (app.finalStatus !== 'partial') return FINAL_STATE[app.finalStatus].note
  const done = trackSummary(app, 'approved')
  const rest = TRACKS.filter((k) => app[k].status !== 'approved')
    .map((k) => `${TRACK_NAME[k]}（${TRACK_STATE[app[k].status].label}）`)
    .join('、')
  return `单边通过 · 未完成：${done} 已通过，${rest} 尚未完成。按聚合铁律（两条轨均通过才算整体通过），不得视为录用、不得发放 Offer。`
}

/* [演示] 模拟入口：状态流转走 updateApprovalTrack，同步异常走 setApprovalTrackError */
type DemoAction = ApprovalTrackStatus | 'sync_fail'

const DEMO_ACTIONS: { value: DemoAction; label: string }[] = [
  { value: 'approved', label: '节点通过（该轨 → 已通过）' },
  { value: 'returned', label: '退回发起人（该轨 → 已退回）' },
  { value: 'rejected', label: '驳回（该轨 → 已驳回，不予录用）' },
  { value: 'canceled', label: '撤销该轨（该轨 → 已撤销）' },
  { value: 'pending', label: '恢复为处理中' },
  { value: 'sync_fail', label: '模拟状态同步失败（状态滞后，可重试）' },
]

const DEMO_NODE: Record<ApprovalTrackStatus, string | undefined> = {
  pending: undefined,
  approved: '已归档',
  returned: '退回发起人',
  rejected: '审批驳回',
  canceled: '已撤销终止',
}

const DEMO_ALERT: Record<DemoAction, string> = {
  approved: 'alert alert-soft alert-success',
  returned: 'alert alert-soft alert-warning',
  rejected: 'alert alert-soft alert-error',
  canceled: 'alert alert-soft',
  pending: 'alert alert-soft alert-info',
  sync_fail: 'alert alert-soft alert-warning',
}

const DEMO_NOTE: Record<DemoAction, string> = {
  approved: '该轨标记为已通过。只有两条轨都通过时，聚合结论才会变成「双轨通过 · 可发放 Offer」，候选人才会被置为「已完成」。',
  returned: '该轨标记为已退回，聚合结论变为「已退回 · 待补充材料后重走」，本申请单不会被当作通过。',
  rejected: '该轨标记为已驳回，聚合结论变为「已驳回 · 不予录用」，本申请单终止。',
  canceled: '该轨标记为已撤销，聚合结论变为「已撤销 · 申请单作废」。',
  pending: '该轨恢复为处理中，聚合结论按两条轨的当前状态重新计算（可能回到流转中，也可能停留在单边通过 · 未完成）。',
  sync_fail: '只标记状态同步失败与更新时间，不修改审批状态；随后可在该轨点击「重试」沿用原实例恢复。',
}

type PoolItem = { c: Candidate; app?: ApprovalApplication; enabled: boolean }
type DemoState = { appId: string; candidateName: string; track: ApprovalTrackKey; action: DemoAction; comment: string }

export default function Approvals({ go }: { go: Go }) {
  const canCreate = can('approval:create')

  const [showWizard, setShowWizard] = useState(false)
  const [salary, setSalary] = useState('')
  const [level, setLevel] = useState('')
  const [onboardDate, setOnboardDate] = useState(demoToday())
  const [checks, setChecks] = useState<Record<string, boolean>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<{ title: string; detail: string; appId?: string } | null>(null)
  const [filter, setFilter] = useState<FilterKey>('all')
  const [highlight, setHighlight] = useState('')
  const [toast, setToast] = useState('')
  const [demo, setDemo] = useState<DemoState | null>(null)

  const timers = useRef<number[]>([])
  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms))
  }
  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t))
      timers.current = []
    },
    [],
  )

  const showToast = (msg: string) => {
    setToast(msg)
    later(() => setToast(''), 6000)
  }

  // 候选池口径：只列业务已确认录用的人（已完成 / 待录取）
  // 已有在途申请的人选不静默消失，而是作为禁用项保留并带单号
  const pool: PoolItem[] = candidates
    .filter((c) => c.status === '已完成' || c.status === '待录取')
    .map((c) => {
      const app = approvals.find((a) => a.candidateId === c.id)
      const inflight = !!app && (app.finalStatus === 'processing' || app.finalStatus === 'partial')
      return { c, app, enabled: !inflight }
    })
  const eligibleCandidates = pool.filter((p) => p.enabled)
  const eligibleIds = eligibleCandidates.map((p) => p.c.id).join('|')

  // 默认选中第一个「可发起」的人，避免选中已被过滤掉的人导致下拉空白
  const [selectedCid, setSelectedCid] = useState(eligibleCandidates[0]?.c.id ?? '')
  useEffect(() => {
    const list = eligibleIds ? eligibleIds.split('|') : []
    if (!list.includes(selectedCid)) setSelectedCid(list[0] ?? '')
  }, [eligibleIds, selectedCid])

  const materials = selectedCid ? defaultMaterials(selectedCid) : []

  // 打开向导或切换候选人时，按材料清单重置勾选（done 默认勾选，pending / missing 默认未勾选）
  useEffect(() => {
    if (!showWizard) return
    const next: Record<string, boolean> = {}
    defaultMaterials(selectedCid).forEach((m) => {
      next[m.key] = m.status === 'done'
    })
    setChecks(next)
  }, [showWizard, selectedCid])

  const selected = eligibleCandidates.find((p) => p.c.id === selectedCid)
  const requiredMaterials = materials.filter((m) => m.required)
  const missingRequired = requiredMaterials.filter((m) => m.status === 'missing')
  const uncheckedRequired = requiredMaterials.filter((m) => m.status !== 'missing' && !checks[m.key])
  const checkedRequired = requiredMaterials.length - missingRequired.length - uncheckedRequired.length
  const checkedCount = materials.filter((m) => checks[m.key]).length
  const formFilled = !!salary.trim() && !!level.trim() && !!onboardDate
  const ready = canCreate && !!selected && formFilled && !missingRequired.length && !uncheckedRequired.length
  const errorAppId = submitError?.appId

  const submittedMaterials: MaterialItem[] = materials.map((m) => ({
    ...m,
    status: checks[m.key] ? 'done' : m.status === 'missing' ? 'missing' : 'pending',
  }))

  const blockReason = !canCreate
    ? '当前角色不具备「发起录取申请」权限'
    : !selected
    ? '未选定拟录用候选人'
    : !formFilled
    ? '请填写拟定薪资待遇、拟定职级与预计到岗日期'
    : missingRequired.length
    ? `必交材料原件缺失：${missingRequired.map((m) => m.name).join('、')}，请先补传后再提交`
    : uncheckedRequired.length
    ? `仍有 ${uncheckedRequired.length} 项必交材料未勾选核对`
    : ''

  const startHint = !canCreate
    ? `当前角色（${ROLE_LABEL[currentUser.role]}）不具备「发起录取申请」权限，仅 HR 可显式提交。`
    : !eligibleCandidates.length
    ? '当前没有「已完成 / 待录取」且无在途申请单的候选人，可先在其他页面确认录用结果。'
    : '业务确认录用意向后由有权限的 HR 显式提交；AI 初筛与面评都不会自动触发审批。'

  const openWizard = () => {
    setSubmitError(null)
    setShowWizard(true)
  }

  const closeWizard = () => {
    setShowWizard(false)
    setSubmitError(null)
  }

  const focusApp = (appId: string) => {
    setFilter('all')
    setHighlight(appId)
    later(() => document.getElementById(`approval-${appId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80)
    later(() => setHighlight(''), 4000)
  }

  const submitApproval = () => {
    if (!selectedCid || submitting || !ready) return
    setSubmitting(true)
    setSubmitError(null)
    // 演示：模拟一次发起请求的往返；期间按钮保持 disabled / loading，防重复点击
    later(() => {
      const res = createApproval({
        candidateId: selectedCid,
        salary: salary.trim(),
        level: level.trim(),
        onboardDate,
        materials: submittedMaterials,
        by: currentUser.name,
      })
      setSubmitting(false)
      if (!res.ok) {
        if (res.reason === 'duplicate') {
          const id = res.existing?.id
          setSubmitError({
            title: id ? `该候选人已有在途申请单 ${id}` : '该候选人已有在途申请单',
            detail: '幂等键命中：同一候选人 + 岗位只允许一张在途申请单，未重复发起飞书审批与 BPM 流程。可直接查看该单的实时双轨状态。',
            appId: id,
          })
        } else if (res.reason === 'forbidden') {
          setSubmitError({
            title: '权限不足，未发起任何审批',
            detail: '当前角色不具备「发起录取申请」权限（approval:create），仅 HR 可显式提交。',
          })
        } else {
          setSubmitError({
            title: '未找到该候选人',
            detail: '候选人记录可能已被移除或来源库数据已变更，请刷新后重试。',
          })
        }
        return
      }
      setShowWizard(false)
      const app = res.app
      showToast(
        `已发起录取申请 ${app.id}：${TRACK_NAME.feishu} ${app.feishu.instanceId ?? ''} / ${TRACK_NAME.bpm} ${
          app.bpm.processId ?? ''
        }，两条轨状态分别跟踪，均通过后才是整体通过。`,
      )
      focusApp(app.id)
    }, 500)
  }

  const handleRetry = (appId: string, key: ApprovalTrackKey) => {
    const app = approvals.find((a) => a.id === appId)
    const before = app ? trackIdOf(app[key], key) : undefined
    retryApprovalTrack(appId, key)
    showToast(
      `已重试 ${TRACK_NAME[key]} 状态同步，沿用原${key === 'feishu' ? '实例' : '流程'}${before ? ` ${before}` : ''}，未重复发起。`,
    )
  }

  const openDemo = (app: ApprovalApplication, key: ApprovalTrackKey, action: DemoAction) => {
    setDemo({ appId: app.id, candidateName: app.candidateName, track: key, action, comment: '' })
  }

  const applyDemo = () => {
    if (!demo) return
    const track = demo.track
    const comment = demo.comment.trim()
    if (demo.action === 'sync_fail') {
      setApprovalTrackError(demo.appId, track, comment || '审批系统状态同步超时（演示异常），状态可能滞后，可重试')
      showToast(`[演示] 已模拟 ${TRACK_NAME[track]} 状态同步失败：在该轨点击「重试」可沿用原实例恢复。`)
    } else {
      const action = demo.action
      updateApprovalTrack(demo.appId, track, action, {
        by: currentUser.name,
        node: DEMO_NODE[action],
        comment: comment || `[演示] 模拟${TRACK_NAME[track]}${TRACK_STATE[action].label}`,
      })
      showToast(`[演示] 已模拟 ${TRACK_NAME[track]} → ${TRACK_STATE[action].label}；聚合结论已按两条轨重新计算。`)
    }
    setDemo(null)
  }

  const countOf = (status: FinalStatus) => approvals.filter((a) => a.finalStatus === status).length
  const inflightCount = countOf('processing') + countOf('partial')
  const listed = approvals.filter((a) => inFilter(a, filter))
  const demoApp = demo ? approvals.find((a) => a.id === demo.appId) : undefined

  const checklist = [
    {
      ok: canCreate,
      text: canCreate
        ? `当前用户 ${currentUser.name}（${ROLE_LABEL[currentUser.role]}）具备发起权限 approval:create`
        : `当前用户 ${currentUser.name}（${ROLE_LABEL[currentUser.role]}）不具备发起权限，无法提交`,
    },
    {
      ok: !!selected,
      text: selected ? `已选定候选人 ${selected.c.name}（阶段：${selected.c.status}）` : '尚未选定拟录用候选人',
    },
    { ok: formFilled, text: '拟定薪资 / 职级 / 预计到岗日期已填写' },
    {
      ok: !missingRequired.length,
      text: missingRequired.length
        ? `必交材料原件缺失 ${missingRequired.length} 项：${missingRequired.map((m) => m.name).join('、')}`
        : '没有缺失的必交材料原件',
    },
    {
      ok: !uncheckedRequired.length,
      text: uncheckedRequired.length
        ? `仍有 ${uncheckedRequired.length} 项必交材料未勾选核对（已勾选 ${checkedRequired}/${requiredMaterials.length}）`
        : `必交材料已全部勾选核对（${checkedRequired}/${requiredMaterials.length}）`,
    },
    { ok: true, text: '幂等保护：同一候选人 + 岗位已有在途申请单时直接返回原单，不重复发起审批' },
  ]

  /* 单条审批轨卡片：状态 / 实例号 / 当前节点 / 审批人 / 更新时间 / 失败重试 / 时间线 */
  const renderTrack = (app: ApprovalApplication, key: ApprovalTrackKey) => {
    const t = app[key]
    const st = trackStateOf(t)
    const idValue = trackIdOf(t, key)
    return (
      <div key={key} className="space-y-3 rounded-xl border border-base-300 bg-base-200/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-base-content">{TRACK_NAME[key]}</span>
            <Chip tone={st.tone}>
              <span className={`status status-xs ${st.dot}`} aria-hidden="true" />
              {st.label}
            </Chip>
          </div>
          <span className="font-mono text-[11px] text-base-content/55">
            {TRACK_ID_LABEL[key]} {idValue ?? '待回填'}
          </span>
        </div>

        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-[11px]">
          <div className="min-w-0">
            <dt className="text-base-content/50">当前节点</dt>
            <dd className="text-base-content">{t.currentNode}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-base-content/50">{key === 'feishu' ? '审批人' : '经办人'}</dt>
            <dd className="text-base-content">{t.approver}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-base-content/50">更新时间</dt>
            <dd className="text-base-content tabular-nums">{t.updateTime}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-base-content/50">失败重试次数</dt>
            <dd className="text-base-content tabular-nums">{t.retryCount} 次</dd>
          </div>
        </dl>

        {t.lastError && (
          <div role="alert" className="alert alert-soft alert-warning items-start gap-3 text-[11px]">
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold">同步失败 / 状态滞后</div>
              <div className="mt-0.5 text-base-content/75">{t.lastError}</div>
              <div className="mt-1 text-base-content/55">
                重试沿用原{key === 'feishu' ? '实例' : '流程'} {idValue ?? ''}（已重试 {t.retryCount} 次），只重新拉取 / 提交状态，不会新建第二条审批。
              </div>
            </div>
            <Btn variant="accent" className="!h-8 !px-3" onClick={() => handleRetry(app.id, key)}>
              重试（沿用原实例，不重复发起）
            </Btn>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Btn variant="ghost" className="!h-8 !px-3" onClick={() => openDemo(app, key, 'approved')}>
            [演示] 模拟该轨流转
          </Btn>
          {!t.lastError && (
            <Btn variant="ghost" className="!h-8 !px-3" onClick={() => openDemo(app, key, 'sync_fail')}>
              [演示] 模拟同步失败
            </Btn>
          )}
        </div>

        <div>
          <Label>状态流转历史（追加不覆盖）</Label>
          <ul className="timeline timeline-vertical timeline-compact mt-2">
            {t.history.map((h, i) => (
              <li key={`${h.at}-${i}`}>
                <div className="timeline-middle">
                  <span className={`status status-xs ${TRACK_STATE[h.status].dot}`} aria-hidden="true" />
                </div>
                <div className="timeline-end w-full px-3 pb-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-medium text-base-content">{h.node}</span>
                    <Chip tone={TRACK_STATE[h.status].tone}>{TRACK_STATE[h.status].label}</Chip>
                    <span className="font-mono text-[10px] text-base-content/50">{h.at}</span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-base-content/60">审批人：{h.by}</div>
                  {h.comment && <div className="mt-0.5 text-[11px] text-base-content/75">意见：{h.comment}</div>}
                </div>
                {i < t.history.length - 1 && <hr className="bg-base-300" />}
              </li>
            ))}
          </ul>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 页头：当前用户 + 发起权限 + 中性化的双轨说明 */}
      <div className="ws-rise flex flex-col gap-4 border-b border-base-300 pb-5 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-base-content">录取申请与双审批中心</h1>
            <Chip tone="ghost">在途 {inflightCount} 单</Chip>
          </div>
          <p className="max-w-3xl text-xs leading-relaxed text-base-content/60">
            飞书审批与 BPM 内部 OA 两条审批轨的状态分别展示、分别追溯；按公司制度配置：飞书审批 + BPM OA 双轨并行或串行，以公司现有审批定义为准（代码不写死）。
            任一必需审批未完成，不标记为整体通过。
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone="neutral">
              {currentUser.name} · {ROLE_LABEL[currentUser.role]} · {currentUser.dept}
            </Chip>
            <Chip tone={canCreate ? 'success' : 'error'}>
              {canCreate ? '具备发起权限（approval:create）' : '不具备发起权限（approval:create）'}
            </Chip>
            <span className="text-[11px] text-base-content/50">权限按 PRD「权限」：录取申请由有权限的人明确提交。</span>
          </div>
        </div>

        <div className="flex flex-col items-start gap-2 md:items-end">
          <Btn variant="solid" onClick={openWizard} disabled={!canCreate || !eligibleCandidates.length} title={startHint}>
            + 发起录取申请
          </Btn>
          <span
            className={`max-w-[260px] text-[11px] md:text-right ${
              !canCreate || !eligibleCandidates.length ? 'text-error' : 'text-base-content/50'
            }`}
          >
            {startHint}
          </span>
        </div>
      </div>

      {/* 反馈提示 */}
      {toast && (
        <div role="alert" className="alert alert-soft alert-success items-start text-xs">
          <span className="min-w-0 flex-1">{toast}</span>
          <button type="button" aria-label="关闭提示" className="btn btn-ghost btn-xs btn-circle" onClick={() => setToast('')}>
            ✕
          </button>
        </div>
      )}

      {/* 聚合结论总览：只有 approved 才是可发放 Offer */}
      <div className="ws-rise [--i:1] stats stats-vertical w-full border border-base-300 bg-base-100 shadow-[var(--shadow-paper)] sm:stats-horizontal">
        <div className="stat">
          <div className="stat-title text-xs">累计申请单</div>
          <div className="stat-value text-2xl tabular-nums">{approvals.length}</div>
          <div className="stat-desc text-[11px]">带幂等键，重复提交不产生废单</div>
        </div>
        <div className="stat">
          <div className="stat-title text-xs">在途（双轨流转中）</div>
          <div className="stat-value text-2xl tabular-nums text-info">{countOf('processing')}</div>
          <div className="stat-desc text-[11px]">两条轨均无结论，不标为通过</div>
        </div>
        <div className="stat">
          <div className="stat-title text-xs">单边通过 · 未完成</div>
          <div className="stat-value text-2xl tabular-nums text-accent">{countOf('partial')}</div>
          <div className="stat-desc text-[11px]">仅一侧通过，不得视为录用</div>
        </div>
        <div className="stat">
          <div className="stat-title text-xs">双轨通过（可发放 Offer）</div>
          <div className="stat-value text-2xl tabular-nums text-success">{countOf('approved')}</div>
          <div className="stat-desc text-[11px]">飞书与 BPM 均已通过</div>
        </div>
        <div className="stat">
          <div className="stat-title text-xs">退回 / 驳回 / 撤销</div>
          <div className="stat-value text-2xl tabular-nums text-error">
            {countOf('returned') + countOf('rejected') + countOf('canceled')}
          </div>
          <div className="stat-desc text-[11px]">已终止，历史完整保留</div>
        </div>
      </div>

      {/* 列表 + 筛选 */}
      <div className="ws-rise [--i:2] space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <SectionHead title="申请单列表" sub="每条轨独立展示发起 / 处理中 / 通过 / 退回 / 驳回 / 撤销" />
          <div className="flex flex-wrap items-center gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                aria-pressed={filter === f.key}
                onClick={() => setFilter(f.key)}
                className={`btn h-8 min-h-8 rounded-full px-3 text-xs font-medium ${
                  filter === f.key ? 'btn-primary' : 'btn-ghost border border-base-300'
                }`}
              >
                {f.label} ({approvals.filter((a) => inFilter(a, f.key)).length})
              </button>
            ))}
          </div>
        </div>

        {listed.map((app) => (
          <div
            key={app.id}
            id={`approval-${app.id}`}
            className={`scroll-mt-24 rounded-2xl transition-shadow ${
              highlight === app.id ? 'ring-2 ring-accent ring-offset-2 ring-offset-base-200' : ''
            }`}
          >
            <Card className="space-y-4 p-5">
              {/* 单头：单号 / 候选人 / 聚合结论 */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-base-300 pb-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="rounded-md bg-base-200 px-2 py-1 font-mono text-xs font-semibold text-base-content">{app.id}</span>
                  <span className="text-base font-semibold text-base-content">{app.candidateName}</span>
                  <span className="text-xs text-base-content/60">应聘：{app.positionName}</span>
                  <Chip tone="ghost">{app.dept}</Chip>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Chip tone={FINAL_STATE[app.finalStatus].tone}>{FINAL_STATE[app.finalStatus].label}</Chip>
                  <Btn variant="ghost" className="!h-8 !px-3" onClick={() => go('detail', app.candidateId)}>
                    查看候选人贯通详情 ↗
                  </Btn>
                </div>
              </div>

              {/* 聚合结论说明（partial 明确写清不得视为录用） */}
              <div role="alert" className={`${FINAL_STATE[app.finalStatus].alert} items-start text-xs`}>
                <div className="space-y-0.5">
                  <div className="font-semibold">
                    {FINAL_STATE[app.finalStatus].label} · 飞书审批：{TRACK_STATE[app.feishu.status].label} · BPM OA：
                    {TRACK_STATE[app.bpm.status].label}
                  </div>
                  <div className="text-base-content/75">{finalNoteOf(app)}</div>
                </div>
              </div>

              {/* 拟定待遇与幂等键 */}
              <dl className="grid grid-cols-2 gap-3 rounded-xl bg-base-200/60 p-3.5 text-xs sm:grid-cols-3 lg:grid-cols-6">
                {[
                  ['拟定薪酬', app.salary],
                  ['拟定职级', app.level],
                  ['发起人', app.applicant],
                  ['发起日期', app.applyDate],
                  ['预计入职', app.onboardDate],
                  ['幂等键', app.idempotencyKey],
                ].map(([k, v]) => (
                  <div key={k} className="min-w-0">
                    <dt className="text-base-content/50">{k}</dt>
                    <dd className={`text-base-content ${k === '幂等键' ? 'truncate font-mono text-[10px]' : 'font-semibold'}`} title={v}>
                      {v}
                    </dd>
                  </div>
                ))}
              </dl>

              {/* 两条审批轨分别展示 */}
              <div className="grid gap-4 lg:grid-cols-2">{TRACKS.map((key) => renderTrack(app, key))}</div>

              {/* 申请材料核对结果（创建时提交的勾选结果） */}
              <div className="space-y-2">
                <Label>申请材料核对结果</Label>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {app.materials.map((m) => (
                    <li
                      key={m.key}
                      className={`flex items-start gap-2.5 rounded-xl border p-2.5 ${
                        m.required && m.status === 'missing' ? 'border-error/40 bg-error/5' : 'border-base-300 bg-base-100'
                      }`}
                    >
                      <span className={`status status-xs mt-1 ${MATERIAL_STATE[m.status].dot}`} aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-base-content">{m.name}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <Chip tone={m.required ? 'accent' : 'ghost'}>{m.required ? '必需' : '选填'}</Chip>
                          <Chip tone={MATERIAL_STATE[m.status].tone}>{MATERIAL_STATE[m.status].label}</Chip>
                          {m.fileRef && <span className="truncate font-mono text-[10px] text-base-content/45">{m.fileRef}</span>}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          </div>
        ))}

        {!listed.length && (
          <Card className="p-4">
            <Empty
              title={approvals.length ? '当前筛选下没有申请单' : '暂无录取申请记录'}
              hint={
                approvals.length
                  ? '可切换到「全部申请单」查看其它聚合结论的申请单。'
                  : '业务确认录用意向后，由有权限的 HR 在右上角发起录取申请，飞书审批与 BPM 流程会分别创建并跟踪。'
              }
              action={
                !approvals.length && canCreate && eligibleCandidates.length ? (
                  <Btn variant="solid" className="mt-2" onClick={openWizard}>
                    发起录取申请
                  </Btn>
                ) : undefined
              }
            />
          </Card>
        )}
      </div>

      {/* 发起向导：选择候选人 + 材料逐项核对 */}
      <Modal
        open={showWizard}
        onClose={closeWizard}
        title="发起录取申请"
        sub="业务确认录用意向后，由有权限的 HR 显式提交；材料逐项核对后随单提交，AI 初筛与面评不会自动触发审批"
        footer={
          <>
            <span className={`mr-auto max-w-[280px] text-[11px] ${ready ? 'text-base-content/50' : 'text-error'}`}>
              {ready ? `将随单提交 ${checkedCount} 项材料，并分别创建飞书审批实例与 BPM 流程` : blockReason}
            </span>
            <Btn variant="ghost" onClick={closeWizard}>
              取消
            </Btn>
            <Btn
              variant="solid"
              onClick={submitApproval}
              disabled={!ready || submitting}
              loading={submitting}
              title={ready ? undefined : blockReason}
            >
              {submitting ? '正在发起…' : '确认发起双轨审批'}
            </Btn>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          {submitError && (
            <div role="alert" className="alert alert-soft alert-error items-start text-xs">
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{submitError.title}</div>
                <div className="mt-0.5 text-base-content/75">{submitError.detail}</div>
              </div>
              {errorAppId && (
                <Btn
                  variant="outline"
                  className="!h-8 !px-3"
                  onClick={() => {
                    closeWizard()
                    focusApp(errorAppId)
                  }}
                >
                  去查看该申请单（{errorAppId}）
                </Btn>
              )}
            </div>
          )}

          <Field
            label="拟录用候选人"
            htmlFor="approval-candidate"
            required
            hint="只列出阶段为「已完成 / 待录取」的候选人；已有在途申请单的人选标注单号并禁止重复发起。"
          >
            <select
              id="approval-candidate"
              className="select w-full"
              value={selectedCid}
              disabled={!canCreate}
              onChange={(e) => setSelectedCid(e.target.value)}
            >
              {!pool.length && <option value="">暂无可发起人选</option>}
              {pool.map((p) => (
                <option key={p.c.id} value={p.c.id} disabled={!p.enabled}>
                  {p.c.name} · {p.c.role}（阶段：{p.c.status}）
                  {p.app ? ` · 申请单 ${p.app.id}${p.enabled ? '' : '（在途，禁止重复发起）'}` : ''}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="拟定薪资待遇" htmlFor="approval-salary" required hint="如：32k · 14薪 + 绩效">
              <input
                id="approval-salary"
                className="input w-full"
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
                placeholder="填写后随单提交"
              />
            </Field>
            <Field label="拟定职级" htmlFor="approval-level" required hint="如：P7 资深研发工程师">
              <input
                id="approval-level"
                className="input w-full"
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                placeholder="填写后随单提交"
              />
            </Field>
          </div>

          <Field
            label="预计到岗入职日期"
            htmlFor="approval-onboard"
            required
            hint={`默认取演示基准日期 ${demoToday()}，可按实际到岗计划调整。`}
          >
            <input
              id="approval-onboard"
              type="date"
              className="input w-full"
              value={onboardDate}
              onChange={(e) => setOnboardDate(e.target.value)}
            />
          </Field>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label>申请材料逐项核对（提交内容 = 勾选结果）</Label>
              <span className="text-[11px] text-base-content/50">
                必交 {requiredMaterials.length} 项 · 已勾选 {checkedRequired}/{requiredMaterials.length}
              </span>
            </div>
            <ul className="space-y-2">
              {materials.map((m) => {
                const unavailable = m.required && m.status === 'missing'
                const checked = !!checks[m.key]
                return (
                  <li
                    key={m.key}
                    className={`rounded-xl border p-3 ${
                      unavailable ? 'border-error/50 bg-error/5' : checked ? 'border-base-300 bg-base-100' : 'border-warning/40 bg-warning/5'
                    }`}
                  >
                    <label className="flex cursor-pointer items-start gap-2.5">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm mt-0.5"
                        checked={checked}
                        disabled={unavailable || !canCreate}
                        onChange={(e) => setChecks((prev) => ({ ...prev, [m.key]: e.target.checked }))}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs font-medium text-base-content">{m.name}</span>
                          <Chip tone={m.required ? 'accent' : 'ghost'}>{m.required ? '必需' : '选填'}</Chip>
                          <Chip tone={MATERIAL_STATE[m.status].tone}>{MATERIAL_STATE[m.status].label}</Chip>
                        </span>
                        <span className="mt-1 block text-[11px] text-base-content/60">
                          {unavailable
                            ? '原件缺失：系统中未找到该必需材料，请先补传后再提交（缺失项不可勾选）。'
                            : checked
                            ? '已勾选：随本次申请单一起提交，创建时标记为已齐备。'
                            : '未勾选：不随单提交，申请单上会如实标记为待核对。'}
                        </span>
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
            {missingRequired.length > 0 && (
              <div role="alert" className="alert alert-soft alert-error items-start text-[11px]">
                <span>
                  必交材料缺失 {missingRequired.length} 项：{missingRequired.map((m) => m.name).join('、')}
                  。缺失项已高亮并阻止提交；补传后再发起，避免生成材料不全的申请单。
                </span>
              </div>
            )}
          </div>

          <div className="rounded-xl bg-base-200/70 p-3">
            <Label>提交前检查</Label>
            <ul className="mt-2 space-y-1.5">
              {checklist.map((it) => (
                <li key={it.text} className="flex items-start gap-2">
                  <span className={`status status-xs mt-1 ${it.ok ? 'status-success' : 'status-error'}`} aria-hidden="true" />
                  <span className={it.ok ? 'text-base-content/75' : 'text-error'}>{it.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Modal>

      {/* [演示] 模拟审批流转：确认后走 updateApprovalTrack / setApprovalTrackError */}
      <Modal
        open={!!demo}
        onClose={() => setDemo(null)}
        title={demo ? `[演示] 模拟审批流转 · ${demo.candidateName}` : '[演示] 模拟审批流转'}
        sub="仅在前端 mockup 内追加审批历史并重算聚合结论，不会调用真实飞书 / BPM 接口"
        footer={
          <>
            <span className="mr-auto max-w-[260px] text-[11px] text-base-content/50">
              演示操作只影响本页演示数据，可随时再次模拟或重试回到流转中。
            </span>
            <Btn variant="ghost" onClick={() => setDemo(null)}>
              取消
            </Btn>
            <Btn variant="accent" onClick={applyDemo}>
              确认模拟
            </Btn>
          </>
        }
      >
        {demo && (
          <div className="space-y-4 text-xs">
            <div role="alert" className="alert alert-soft alert-warning items-start text-[11px]">
              <span>
                这是演示入口：确认后会真实写入本页演示数据（追加 {TRACK_NAME[demo.track]} 的一条状态历史、更新时间与失败重试标记），请确认后再执行。
              </span>
            </div>

            <Field label="模拟哪条审批轨" htmlFor="demo-track" required hint="两条轨各自独立实例，互不影响聚合结论以外的字段。">
              <select
                id="demo-track"
                className="select w-full"
                value={demo.track}
                onChange={(e) => setDemo((prev) => (prev ? { ...prev, track: e.target.value as ApprovalTrackKey } : prev))}
              >
                {TRACKS.map((k) => (
                  <option key={k} value={k}>
                    {TRACK_NAME[k]}
                    {demoApp ? `（${TRACK_ID_LABEL[k]} ${trackIdOf(demoApp[k], k) ?? '待回填'}）` : ''}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="模拟动作 / 结果" htmlFor="demo-action" required hint="通过 / 退回 / 驳回 / 撤销 / 恢复处理中，全部走同一套状态机。">
              <select
                id="demo-action"
                className="select w-full"
                value={demo.action}
                onChange={(e) => setDemo((prev) => (prev ? { ...prev, action: e.target.value as DemoAction } : prev))}
              >
                {DEMO_ACTIONS.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="模拟审批意见 / 异常原因" htmlFor="demo-comment" hint="留空则自动生成演示说明；填写后会出现在该轨的状态流转历史里。">
              <input
                id="demo-comment"
                className="input w-full"
                value={demo.comment}
                onChange={(e) => setDemo((prev) => (prev ? { ...prev, comment: e.target.value } : prev))}
                placeholder="如：薪资超出该职级预算 12%，退回补充薪酬对标说明"
              />
            </Field>

            <div role="alert" className={`${DEMO_ALERT[demo.action]} items-start text-[11px]`}>
              <span>{DEMO_NOTE[demo.action]}</span>
            </div>

            {demo.action === 'sync_fail' && demoApp?.[demo.track]?.lastError && (
              <div role="alert" className="alert alert-soft alert-info items-start text-[11px]">
                <span>
                  该轨当前已有同步异常记录，重试会沿用原{demo.track === 'feishu' ? '实例' : '流程'}并累加重试次数。
                </span>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
