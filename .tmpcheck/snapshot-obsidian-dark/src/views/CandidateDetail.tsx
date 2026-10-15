import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import {
  STAGES,
  candidates,
  history,
  resumes,
  type ApprovalApplication,
  type ApprovalHistoryItem,
  type ApprovalTrack,
  type ApprovalTrackStatus,
  type Candidate,
  type CandidateStage,
  type JD,
  type MaterialItem,
  type Position,
  type ScheduleDetail,
  type ScheduleEvent,
} from '../data'
import {
  addCandidateNote,
  advanceCalendarSync,
  approvals,
  batchAssign,
  bindCandidatePosition,
  buildReviewFor,
  can,
  cancelSchedule,
  confirmReview,
  currentUser,
  findC,
  findJd,
  findPos,
  positions,
  rescheduleSchedule,
  resendNotice,
  retryApprovalTrack,
  rooms,
  schedule,
  scheduleHistory,
  setStage,
  slotLabel,
  type Review,
  type Room,
} from '../store'
import type { Go } from '../App'
import { Btn, Card, Chip, Empty, Field, Modal, ScoreStamp, type Tone } from './ui'
import ResumeDoc from './ResumeDoc'

type Props = { cid: string; go: Go }
type Section = 'resume' | 'screening' | 'notes' | 'interview' | 'review' | 'approval'
type FinalStatus = ApprovalApplication['finalStatus']

/* 岗位 / 标尺缺失时的兜底展示对象：不把数据静默绑到其他岗位或标尺上（findPos / findJd 找不到返回 undefined） */
const emptyPos = (c: Candidate): Position => ({ id: '', code: '—', name: c.role, jdId: '', dept: '', recruiter: c.assignee, hiringManager: c.assignee, hc: 0, hired: 0, status: '招募中', createdAt: '' })
const emptyJd = (c: Candidate): JD => ({ id: '', code: '—', title: '未装配标尺', dept: c.role, exp: '—', edu: '—', salary: '—', skills: [], summary: '', responsibilities: [], requirements: [], updatedAt: '' })

/* ───────── 审批语义映射（FR-C4）：每条轨六态如实呈现，负向态不用模糊话术 ───────── */
const TRACK_TONE: Record<ApprovalTrackStatus, Tone> = { pending: 'info', approved: 'success', returned: 'warning', rejected: 'error', canceled: 'neutral' }
const TRACK_TEXT: Record<ApprovalTrackStatus, string> = {
  pending: '流转中',
  approved: '本轨通过（仅代表该轨结论）',
  returned: '已退回（需补充材料后重走）',
  rejected: '已拒绝',
  canceled: '已撤销',
}
const TRACK_DOT: Record<ApprovalTrackStatus, string> = {
  pending: 'status-info',
  approved: 'status-success',
  returned: 'status-warning',
  rejected: 'status-error',
  canceled: 'status-neutral',
}

/* 聚合结论独立呈现：partial（单边通过）绝不写成已录取 / 已通过 */
const FINAL_TONE: Record<FinalStatus, Tone> = { approved: 'success', partial: 'warning', returned: 'warning', rejected: 'error', canceled: 'neutral', processing: 'info' }
const FINAL_ALERT: Record<FinalStatus, string> = {
  approved: 'alert-success',
  partial: 'alert-warning',
  returned: 'alert-warning',
  rejected: 'alert-error',
  canceled: 'alert-info',
  processing: 'alert-info',
}
const FINAL_TEXT: Record<FinalStatus, string> = {
  approved: '双审批全部通过：整体通过，可继续发放 Offer',
  partial: '单边通过·未完成，不得视为录用',
  returned: '审批被退回：需补充材料后重新发起，当前不构成录用结论',
  rejected: '审批被拒绝：本次申请不予录用',
  canceled: '审批已撤销：申请已终止，不再流转',
  processing: '双流程并行流转中：任一必需审批未完成前，不得标记为整体通过',
}

const MATERIAL_TONE: Record<MaterialItem['status'], Tone> = { done: 'success', pending: 'warning', missing: 'error' }
const MATERIAL_TEXT: Record<MaterialItem['status'], string> = { done: '已完成', pending: '待补', missing: '缺失' }

const CAL_TONE: Record<ScheduleDetail['feishuCalendarStatus'], Tone> = { synced: 'success', pending: 'warning', failed: 'error' }
const CAL_TEXT: Record<ScheduleDetail['feishuCalendarStatus'], string> = { synced: '已同步', pending: '待同步', failed: '同步失败' }
const NOTICE_TONE: Record<ScheduleDetail['noticeStatus'], Tone> = { sent: 'info', pending: 'warning', failed: 'error', confirmed: 'success' }
const NOTICE_TEXT: Record<ScheduleDetail['noticeStatus'], string> = {
  sent: '已发送（待候选人确认）',
  pending: '待发送',
  failed: '发送失败',
  confirmed: '候选人已确认',
}
const SCHED_ACTION: Record<ScheduleEvent['action'], string> = {
  created: '创建场次',
  rescheduled: '改期',
  canceled: '取消场次',
  notice_resent: '重发通知',
  notice_failed: '通知失败',
}
const SCHED_DOT: Record<ScheduleEvent['action'], string> = {
  created: 'status-info',
  rescheduled: 'status-warning',
  canceled: 'status-error',
  notice_resent: 'status-success',
  notice_failed: 'status-error',
}

const ATTACH_BADGE: Record<Candidate['attachmentType'], string> = { original: 'badge-success', platform: 'badge-ghost', missing: 'badge-warning' }
const ATTACH_TEXT: Record<Candidate['attachmentType'], string> = { original: '原件已入库', platform: '平台模板文件', missing: '附件缺失' }

const SLOT_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/

/** 面评得分：优先取归档记录的分数，其次取面试间逐题评分的均分 */
function liveScoreOf(room?: Room): number | undefined {
  if (!room) return undefined
  const vals = Object.values(room.recs)
    .map((r) => r.score)
    .filter((v): v is number => typeof v === 'number')
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : undefined
}

type HistoryRec = (typeof history)[number]

/**
 * 存量候选人的面评回退（FR-B3）：面试间没有运行时记录时，用已归档的评价记录拼出可读结论，
 * 并如实标注为历史归档记录（不是 AI 草稿），不伪造评分证据。
 */
function buildArchivedReview(c: Candidate, h: HistoryRec): Review {
  const steps =
    h.verdict === '推荐'
      ? ['确认业务录用意向后，由有权限的 HR 显式发起飞书 / BPM 双审批', '按材料清单补齐材料后再进入 Offer 流程']
      : h.verdict === '待定'
        ? ['针对待核实项安排一轮定向补测，补齐评分证据', '补测通过后再决定是否发起录取审批']
        : ['维持不予推进，归档至共享人才库备复用', '若岗位需求变化，需重新走筛选与面试流程']
  const suggestion =
    h.verdict === '推荐'
      ? '复核建议：历史面评支持推进；录取审批必须由 HR 显式发起，面评与 AI 初筛都不会自动触发审批。'
      : h.verdict === '待定'
        ? '复核建议：结论为待定，需补充证据后重新形成面评结论，不得直接进入录取流程。'
        : '复核建议：结论为不推荐，维持不予推进；如需复用请重新安排面试并重新评分。'
  return {
    overall: `历史归档面评（记录号 ${h.id} · ${h.date}）：综合得分 ${h.score.toFixed(1)} / 5，面试时长 ${h.dur}，原始结论「${h.verdict}」。本条为已归档的评价记录，不是 AI 草稿。`,
    strengths: c.highlights ?? [],
    weaknesses: c.risks ?? [],
    nextSteps: steps,
    suggestion,
    evidence: [],
    at: h.date,
    draft: false,
  }
}

/** 从材料名里解析归档的分数与结论，如「终面综合面评报告 (4.5 分 · 极力推荐)」「技术评审表 (均分 3.8)」 */
function parseMaterialReview(name: string): { score: number; verdict: string } | undefined {
  const inside = /\(([^)]*)\)/.exec(name)
  if (!inside) return undefined
  const num = /(\d+(?:\.\d+)?)/.exec(inside[1])
  if (!num) return undefined
  const score = Number(num[1])
  if (!(score > 0 && score <= 5)) return undefined
  const text = inside[1]
  const verdict = /极力推荐/.test(text) ? '极力推荐' : /不推荐/.test(text) ? '不推荐' : /推荐/.test(text) ? '推荐' : /待定/.test(text) ? '待定' : `材料标注：${text}`
  return { score, verdict }
}

/** 面评回退②：申请单里归档的面评 / 评审材料结论，同样如实标注来源，不当作 AI 草稿 */
function buildMaterialReview(c: Candidate, app: ApprovalApplication, name: string, score: number, verdict: string): Review {
  const positive = /推荐/.test(verdict) && !/不推荐/.test(verdict)
  return {
    overall: `归档面评结论（来自录取申请单 ${app.id} 的材料「${name}」）：综合得分 ${score.toFixed(1)} / 5，材料标注结论「${verdict}」。本条为归档材料中的结论，不是 AI 草稿。`,
    strengths: c.highlights ?? [],
    weaknesses: c.risks ?? [],
    nextSteps: positive
      ? ['核对材料与面评结论一致后，由有权限的 HR 显式发起飞书 / BPM 双审批', '按材料清单补齐材料并跟进双轨审批节点']
      : ['补齐评分证据后重新形成面评结论', '结论未明确前不进入录取审批流程'],
    suggestion: positive
      ? '复核建议：归档材料支持推进；是否录用仍以双审批结论为准，材料结论本身不构成整体通过。'
      : '复核建议：材料结论不支持直接推进，需面试官 / HR 重新确认后再决定是否发起录取申请。',
    evidence: [],
    at: app.applyDate,
    draft: false,
  }
}

/** 数值进场：0 → 目标值（--dur-slow 600ms）；reduced-motion 下直接落位，配合 .motion-meter 使用 */
function useEnterValue(target: number): number {
  const [v, setV] = useState(0)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setV(target)
      return
    }
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 600)
      setV(target * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target])
  return v
}

/** 数值（契合度等）：进场从 0 过渡到目标值，容器走 .motion-meter，不硬跳 */
function MeterNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
  const shown = useEnterValue(value)
  return (
    <span className="motion-meter tabular-nums">
      {Math.round(shown)}
      {suffix}
    </span>
  )
}

/** 进度条：进场从 0 到目标宽度（.motion-meter 600ms）；数值以文字为准，条仅作视觉 */
function MeterBar({ value }: { value: number }) {
  const shown = useEnterValue(value)
  return (
    <span aria-hidden="true" className="inline-block h-1 w-16 overflow-hidden rounded-full bg-base-content/10 align-middle">
      <span className="motion-meter block h-full rounded-full bg-success" style={{ width: `${Math.max(0, Math.min(100, shown))}%` }} />
    </span>
  )
}

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-base-300 bg-base-200/60 p-3">
      <div className="text-[11px] text-base-content/50">{label}</div>
      <div className="mt-0.5 text-xs font-medium text-base-content">{children}</div>
    </div>
  )
}

function HeroBtn({ children, onClick, title, disabled }: { children: ReactNode; onClick: () => void; title?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="btn motion-pop btn-sm h-8 min-h-8 rounded-full border-none bg-base-content/10 px-3.5 text-xs font-semibold text-base-content hover:bg-base-content/20 disabled:bg-base-content/5 disabled:text-base-content/40"
    >
      {children}
    </button>
  )
}

function EventTimeline({ items }: { items: { key: string; at: string; dot: string; title: string; sub?: string }[] }) {
  return (
    <ul className="timeline timeline-vertical timeline-compact">
      {items.map((it, i) => (
        <li key={it.key}>
          {i > 0 && <hr className="bg-base-300" />}
          <div className="timeline-start text-[11px] tabular-nums text-base-content/50">{it.at}</div>
          <div className="timeline-middle">
            <span className={`status status-sm ${it.dot}`} />
          </div>
          <div className="timeline-end timeline-box m-1 rounded-lg border border-base-300 bg-base-200 px-2.5 py-1.5">
            <div className="text-[11px] font-medium text-base-content">{it.title}</div>
            {it.sub && <div className="text-[11px] text-base-content/50">{it.sub}</div>}
          </div>
          {i < items.length - 1 && <hr className="bg-base-300" />}
        </li>
      ))}
    </ul>
  )
}

/** 单条审批轨（飞书 / BPM）：六态 + 节点 + 流转历史时间线 + 同步异常重试 */
function TrackCard({
  name,
  idLabel,
  instanceId,
  track,
  onRetry,
}: {
  name: string
  idLabel: string
  instanceId?: string
  track: ApprovalTrack
  onRetry: () => void
}) {
  const items = track.history.map((h: ApprovalHistoryItem, i: number) => ({
    key: `${h.at}-${h.status}-${i}`,
    at: h.at,
    dot: TRACK_DOT[h.status],
    title: `${h.node} · ${TRACK_TEXT[h.status]}`,
    sub: `${h.by}${h.comment ? ` · ${h.comment}` : ''}`,
  }))
  return (
    <Card className="motion-pop p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs font-semibold text-base-content">{name}</span>
        <Chip tone={TRACK_TONE[track.status]}>{TRACK_TEXT[track.status]}</Chip>
      </div>
      <dl className="mt-3 grid gap-3 text-[11px] text-base-content/60 sm:grid-cols-2">
        <div>
          {idLabel}：<span className="text-base-content">{instanceId ?? '—'}</span>
        </div>
        <div>
          当前节点：<span className="text-base-content">{track.currentNode || '—'}</span>
        </div>
        <div>
          当前审批人：<span className="text-base-content">{track.approver || '—'}</span>
        </div>
        <div>
          更新时间：<span className="text-base-content">{track.updateTime || '—'}</span>
        </div>
      </dl>
      {track.retryCount > 0 && <p className="mt-2 text-[11px] text-warning">同步重试 {track.retryCount} 次（沿用原实例，未重复发起）</p>}
      {track.lastError && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-error/10 px-2.5 py-2">
          <span className="text-[11px] text-error">最近异常：{track.lastError}</span>
          <Btn variant="ghost" onClick={onRetry}>
            重试同步
          </Btn>
        </div>
      )}
      <div className="mt-3 border-t border-base-300 pt-2">
        <div className="mb-1 text-[11px] font-semibold text-base-content/60">流转历史（追加不覆盖）</div>
        {items.length ? <EventTimeline items={items} /> : <p className="py-2 text-[11px] text-base-content/50">该轨尚无流转记录。</p>}
      </div>
    </Card>
  )
}

export default function CandidateDetail({ cid, go }: Props) {
  const foundC = findC(cid)

  const [activeSection, setActiveSection] = useState<Section>('resume')
  const [newNote, setNewNote] = useState('')
  const [actionMsg, setActionMsg] = useState('')

  const [showSwitchPos, setShowSwitchPos] = useState(false)
  const [showFileInfo, setShowFileInfo] = useState(false)
  const [showAssign, setShowAssign] = useState(false)
  const [assignee, setAssignee] = useState('')

  // 阶段流转：二次确认 + 必填原因
  const [pickStage, setPickStage] = useState<CandidateStage | ''>('')
  const [stageTarget, setStageTarget] = useState<CandidateStage | null>(null)
  const [stageReason, setStageReason] = useState('')
  const [stageErr, setStageErr] = useState('')

  // 新增约面
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [schedSlot, setSchedSlot] = useState('')
  const [schedRound, setSchedRound] = useState('一面')
  const [schedType, setSchedType] = useState<'online' | 'offline'>('online')
  const [schedInterviewer, setSchedInterviewer] = useState('')
  const [schedDuration, setSchedDuration] = useState('45')
  const [schedChannel, setSchedChannel] = useState<'sms' | 'email'>('sms')
  const [schedErr, setSchedErr] = useState('')

  // 改期
  const [showReschedule, setShowReschedule] = useState(false)
  const [reschedSlot, setReschedSlot] = useState('')
  const [reschedReason, setReschedReason] = useState('')
  const [reschedErr, setReschedErr] = useState('')

  // 取消（二次确认 + 原因 + 是否通知候选人）
  const [showCancel, setShowCancel] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelNotify, setCancelNotify] = useState(true)
  const [cancelErr, setCancelErr] = useState('')

  // 候选人不存在时的空态：不要崩，也不要静默绑到别人身上
  if (!foundC) {
    return (
      <div className="ws-paper rounded-2xl p-4">
        <Empty
          title="候选人不存在或数据已重置"
          hint={`未找到候选人记录（${cid}）。可能来源库已标记该记录失效，或本地演示数据被重置，请返回候选人大池重新选择。`}
          action={<Btn variant="outline" onClick={() => go('back')}>返回上一页</Btn>}
        />
      </div>
    )
  }

  const c = foundC
  const pos = findPos(c.positionId) ?? emptyPos(c)
  const jd = findJd(c.jdId || pos.jdId) ?? emptyJd(c)
  const notes = c.notes ?? []
  const qs = c.qs ?? []
  const highlights = c.highlights ?? []
  const risks = c.risks ?? []
  const ai = c.aiScreening as Candidate['aiScreening'] | undefined
  const aiReasons = ai?.reasons ?? []
  const aiRisks = ai?.risks ?? []

  const candidateApprovals = approvals.filter((a) => a.candidateId === c.id)
  // 审批单优先按 c.approvalId 精确匹配，取不到再回退到该候选人的申请单
  const app = (c.approvalId ? approvals.find((a) => a.id === c.approvalId) : undefined) ?? candidateApprovals[0]
  const approvedApp = candidateApprovals.find((a) => a.finalStatus === 'approved')
  const doneLocked = !approvedApp

  const room = rooms[c.id]
  const liveReview: Review | undefined = room?.review ?? buildReviewFor(c.id)
  // 存量候选人面评回退①：历史归档面评记录（先按 cid 精确匹配，再按姓名匹配早期无 cid 的记录）
  const archived = history.find((h) => h.cid === c.id) ?? history.find((h) => !h.cid && h.name === c.name)
  const archivedReview = archived ? buildArchivedReview(c, archived) : undefined
  // 存量候选人面评回退②：申请单里归档的面评 / 评审材料结论
  let materialSrc: { name: string; score: number; verdict: string } | undefined
  if (!liveReview && !archivedReview && app) {
    for (const m of app.materials ?? []) {
      if (!/面评|评审/.test(m.name)) continue
      const parsed = parseMaterialReview(m.name)
      if (parsed) {
        materialSrc = { name: m.name, ...parsed }
        break
      }
    }
  }
  const materialReview = materialSrc && app ? buildMaterialReview(c, app, materialSrc.name, materialSrc.score, materialSrc.verdict) : undefined
  const review = liveReview ?? archivedReview ?? materialReview
  const isArchivedReview = !liveReview && !!(archivedReview || materialReview)
  const reviewScore = archived?.score ?? materialSrc?.score ?? (liveReview ? liveScoreOf(room) : undefined)
  const archiveLabel = archivedReview ? '（来自归档记录与简历要点）' : materialSrc ? '（来自归档材料与简历要点）' : ''
  const archiveWho = archivedReview ? '历史归档记录' : materialSrc ? '归档材料结论' : undefined

  const sd = c.scheduleDetail
  const schedEvents = scheduleHistory(c.id)
  const fileAvailable = c.attachmentType !== 'missing'
  const resumeFile = resumes[c.id]

  // 面试已结束过（阶段历史可证）但没有面评记录时，空态要说清原因，不再一律说「尚未完成面试」
  const interviewHappened = (c.stageHistory ?? []).some((s) => ['面评中', '待录取', '已完成'].includes(s.stage))

  const openStageModal = (target: CandidateStage, reason = '') => {
    if (target === '已完成' && doneLocked) {
      setActionMsg('已拒绝流转到「已完成」：该候选人没有双审批全部通过的录取申请单，需先完成录取双轨审批。')
      return
    }
    setStageTarget(target)
    setStageReason(reason)
    setStageErr('')
  }

  const submitStage = () => {
    if (!stageTarget) return
    if (stageTarget === c.status) {
      setStageErr(`目标阶段与当前阶段相同（${c.status}），无需流转。`)
      return
    }
    if (!stageReason.trim()) {
      setStageErr('流转原因为必填项，请说明本次阶段变动依据，便于留痕与追溯。')
      return
    }
    if (stageTarget === '已完成' && doneLocked) {
      setStageErr('「已完成」需先完成录取双轨审批（飞书 + BPM 均通过），当前不满足条件。')
      return
    }
    setStage(c.id, stageTarget, { reason: stageReason.trim(), by: currentUser.name })
    setStageTarget(null)
    setStageReason('')
    setStageErr('')
  }

  const openSchedule = () => {
    setSchedSlot(sd?.status === 'scheduled' ? sd.slot : c.slot !== '待安排' ? c.slot : '')
    setSchedRound(sd?.round ?? '一面')
    setSchedType(sd?.type ?? 'online')
    setSchedInterviewer(sd?.interviewer ?? pos.hiringManager ?? '')
    setSchedDuration(String(sd?.durationMin ?? 45))
    setSchedChannel(sd?.noticeChannel ?? 'sms')
    setSchedErr('')
    setShowScheduleModal(true)
  }

  const submitSchedule = () => {
    const slot = schedSlot.trim()
    if (!SLOT_RE.test(slot)) {
      setSchedErr('请按 YYYY-MM-DD HH:mm 填写面试时间。')
      return
    }
    const res = schedule({
      cid: c.id,
      slot,
      round: schedRound,
      type: schedType,
      interviewer: schedInterviewer.trim() || undefined,
      durationMin: Number(schedDuration) || 45,
      channel: schedChannel,
    })
    if (!res.ok) {
      setSchedErr(
        res.reason === 'duplicate'
          ? `该候选人同一轮次在此时间已存在预约${res.existing ? `（场次 ${res.existing.interviewId}）` : ''}，未重复建场；如需调整请使用「改期」。`
          : '未找到候选人记录，请刷新页面后重试。',
      )
      return
    }
    setShowScheduleModal(false)
    setActionMsg(`已创建场次 ${res.detail.interviewId}（${res.detail.round} · ${res.detail.slot}），飞书日历待同步、候选人通知待发送。`)
  }

  const openReschedule = () => {
    setReschedSlot(sd?.slot ?? '')
    setReschedReason('候选人时间冲突')
    setReschedErr('')
    setShowReschedule(true)
  }

  const submitReschedule = () => {
    if (!sd) {
      setReschedErr('该候选人当前没有面试场次，无法改期。')
      return
    }
    const next = reschedSlot.trim()
    if (!SLOT_RE.test(next)) {
      setReschedErr('请按 YYYY-MM-DD HH:mm 填写新的面试时间。')
      return
    }
    if (next === sd.slot) {
      setReschedErr('新时段与当前时段一致，无需改期。')
      return
    }
    if (!reschedReason.trim()) {
      setReschedErr('改期原因为必填项。')
      return
    }
    const done = rescheduleSchedule(c.id, next, currentUser.name, reschedReason.trim())
    if (!done) {
      setReschedErr('改期失败：未找到对应场次，请刷新后重试。')
      return
    }
    setShowReschedule(false)
    setActionMsg(`场次 ${done.interviewId} 已改期至 ${done.slot}，飞书日程待重新同步，候选人通知待重发。`)
  }

  const openCancel = () => {
    setCancelReason('')
    setCancelNotify(true)
    setCancelErr('')
    setShowCancel(true)
  }

  const submitCancel = () => {
    if (!cancelReason.trim()) {
      setCancelErr('取消原因为必填项，会写入场次历史与跟进记录。')
      return
    }
    cancelSchedule(c.id, { reason: cancelReason.trim(), notifyCandidate: cancelNotify, by: currentUser.name })
    setShowCancel(false)
    setActionMsg(`面试安排已取消（${cancelReason.trim()}），候选人回到「待联系」阶段。`)
  }

  const handleAddNote = () => {
    if (!newNote.trim()) return
    addCandidateNote(c.id, newNote)
    setNewNote('')
  }

  const assignOptions = Array.from(
    new Set([...candidates.map((x) => x.assignee), ...positions.map((p) => p.recruiter), currentUser.name, '未分配'].filter(Boolean)),
  )

  const tabs: { key: Section; label: string }[] = [
    { key: 'resume', label: '简历原文与附件' },
    { key: 'screening', label: 'AI 初筛与标尺' },
    { key: 'notes', label: `沟通与跟进 (${notes.length})` },
    { key: 'interview', label: '约面与题目清单' },
    { key: 'review', label: '面评复盘报告' },
    { key: 'approval', label: `录取与双审批${app ? '（已发起）' : ''}` },
  ]

  const aiTone: Tone = !ai ? 'ghost' : ai.recommended ? 'success' : 'warning'
  const aiText = !ai ? 'AI 未跑（无初筛结果）' : ai.recommended ? 'AI 推荐' : 'AI 未推荐'

  return (
    <div className="space-y-7">
      {/* 顶部黑曜石全景档案看板 (Obsidian Pro Candidate Hero) */}
      <div className="ws-rise obsidian-panel relative overflow-hidden rounded-3xl p-6 text-base-content shadow-2xl sm:p-7">
        <div className="pointer-events-none absolute -top-20 -right-20 h-72 w-72 rounded-full bg-gradient-to-br from-secondary/25 via-accent/15 to-transparent blur-3xl" />

        <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <div className="flex items-center gap-3 text-xs text-base-content/50">
              <button type="button" onClick={() => go('back')} className="cursor-pointer transition-colors duration-200 hover:text-base-content active:text-base-content/70">
                返回{go.from}
              </button>
              <span>/</span>
              <span className="text-base-content/80">一页贯通全景档案</span>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-4">
              <h1 className="text-3xl font-bold tracking-tight text-base-content">{c.name}</h1>
              <span className="text-lg font-medium text-base-content/70">{c.role}</span>
              <span className="rounded-full border border-base-content/10 bg-base-content/10 px-3 py-1 text-xs font-semibold text-base-content backdrop-blur-md">
                在招编制: {pos.name}
              </span>
              <span className="rounded-full bg-base-content/5 px-2.5 py-1 text-xs text-base-content/60">
                来源: {c.source} ({c.sourceId})
              </span>
              <span className={`badge badge-sm badge-soft border-none ${ATTACH_BADGE[c.attachmentType]}`}>{ATTACH_TEXT[c.attachmentType]}</span>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-5 text-xs text-base-content/60">
              <span>{c.exp}</span>
              <span>·</span>
              <span>{c.edu}</span>
              <span>·</span>
              <span>
                负责 HR: <strong className="text-base-content">{c.assignee}</strong>
              </span>
              {can('candidate:assign') ? (
                <button
                  type="button"
                  onClick={() => {
                    setAssignee(c.assignee)
                    setShowAssign(true)
                  }}
                  className="motion-pop cursor-pointer rounded-full border border-base-content/15 px-2.5 py-0.5 text-[11px] text-base-content/80 hover:bg-base-content/10"
                >
                  指派 / 变更
                </button>
              ) : (
                <span className="text-[11px] text-base-content/50" title="当前角色无分配候选人的权限">
                  指派 / 变更（无权限）
                </span>
              )}
              <span>·</span>
              <span className="flex items-center gap-2">
                <span className="status status-success status-sm" />
                标尺契合度:{' '}
                <strong className="text-sm font-bold text-success">
                  <MeterNumber value={c.match} suffix="%" />
                </strong>
                <MeterBar value={c.match} />
              </span>
              <span>·</span>
              <span>
                阶段: <strong className="text-base-content">{c.status}</strong>
              </span>
              {c.nextAction && (
                <span className="text-base-content/50">
                  下一步: {c.nextAction.text}（{c.nextAction.owner} · {c.nextAction.dueAt}）
                </span>
              )}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-3">
            <HeroBtn onClick={() => setShowSwitchPos(true)} title="调换在招岗位并重新装配标尺">
              调岗换标尺
            </HeroBtn>

            {c.status === '筛选中' && (
              <HeroBtn onClick={() => openStageModal('待联系', 'AI 宽松匹配通过且人工复核同意联系候选人')}>初筛通过，去约面</HeroBtn>
            )}
            {c.status === '待联系' && <HeroBtn onClick={openSchedule}>安排面试日程</HeroBtn>}
            {c.status === '约面中' && <HeroBtn onClick={() => go('room', c.id)}>进入考场（面试间）</HeroBtn>}
            {c.status === '面评中' && <HeroBtn onClick={() => go('room', c.id)}>完成综合面评</HeroBtn>}
            {c.status === '待录取' && !app && (
              <HeroBtn onClick={() => go('approvals')} title="录取申请由有权限的 HR 显式发起">
                发起录取双审批
              </HeroBtn>
            )}
          </div>
        </div>
      </div>

      {actionMsg && (
        <div role="status" className="alert alert-soft alert-info flex flex-wrap items-center justify-between gap-4 text-xs">
          <span>{actionMsg}</span>
          <Btn variant="ghost" onClick={() => setActionMsg('')} ariaLabel="关闭提示">
            知道了
          </Btn>
        </div>
      )}

      {/* 生命周期流转轴：受控流转，禁止绕过双审批一键置已完成 */}
      <div className="ws-rise ws-paper rounded-2xl border border-base-300 p-4 [--i:1]">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-xs font-semibold text-base-content/70">
          <div className="flex flex-wrap items-center gap-3">
            <span>招聘生命周期流转</span>
            <span className="text-[11px] font-normal text-base-content/50">（每次流转需二次确认并填写原因，写入阶段历史）</span>
          </div>
          <span className="badge badge-sm badge-soft badge-ghost">当前处于：{c.status}</span>
        </div>

        <div className="stagger grid grid-cols-3 gap-3 text-center text-xs sm:grid-cols-9">
          {STAGES.map((s, idx) => {
            const isCurrent = c.status === s
            const isPast = STAGES.indexOf(c.status) > idx
            const locked = s === '已完成' && doneLocked
            return (
              <button
                key={s}
                type="button"
                onClick={() => openStageModal(s)}
                disabled={locked}
                aria-label={locked ? `流转到${s}（已锁定，需先完成录取双轨审批）` : `流转到${s}`}
                title={locked ? '需先完成录取双轨审批（飞书 + BPM 均通过）' : `流转到 ${s}`}
                style={{ '--i': Math.min(idx, 7) } as CSSProperties}
                className={`motion-pop cursor-pointer rounded-xl p-2 disabled:cursor-not-allowed disabled:opacity-40 ${
                  isCurrent
                    ? 'bg-neutral font-semibold text-neutral-content'
                    : isPast
                      ? 'border border-success/30 bg-success/10 text-success hover:bg-success/20'
                      : 'border border-base-300 bg-base-200 text-base-content/60 hover:bg-base-300 hover:text-base-content'
                }`}
              >
                <div className="font-mono text-[11px] opacity-75">阶段 {idx + 1}</div>
                <div className="mt-0.5 font-medium">{s}</div>
              </button>
            )
          })}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-base-300 pt-3">
          <label className="text-[11px] text-base-content/60" htmlFor="stage-pick">
            手动流转到
          </label>
          <select id="stage-pick" className="select select-sm w-44" value={pickStage || c.status} onChange={(e) => setPickStage(e.target.value as CandidateStage)}>
            {STAGES.map((s) => (
              <option key={s} value={s} disabled={s === '已完成' && doneLocked}>
                {s}
                {s === '已完成' && doneLocked ? '（需先完成录取双轨审批）' : ''}
              </option>
            ))}
          </select>
          <Btn variant="outline" onClick={() => openStageModal((pickStage || c.status) as CandidateStage)}>
            填写原因后流转
          </Btn>
          {doneLocked && <span className="text-[11px] text-warning">「已完成」已锁定：需先完成录取双轨审批（飞书 + BPM 双通过）。</span>}
        </div>

        {(c.stageHistory ?? []).length > 0 && (
          <div className="mt-3 border-t border-base-300 pt-3">
            <div className="mb-1 text-[11px] font-semibold text-base-content/60">阶段流转历史（追加不覆盖）</div>
            <EventTimeline
              items={(c.stageHistory ?? []).map((h, i) => ({
                key: `${h.at}-${h.stage}-${i}`,
                at: h.at,
                dot: 'status-neutral',
                title: `流转为「${h.stage}」 · ${h.by}`,
                sub: h.reason || '未填写原因',
              }))}
            />
          </div>
        )}
      </div>

      {/* 贯通模块粘性分段导航 */}
      <div className="sticky top-12 z-20 rounded-2xl border border-base-300 bg-base-100/95 p-1.5 shadow-[var(--shadow-paper)] backdrop-blur-xl">
        <div className="stagger ws-segmented-track no-scrollbar flex items-center gap-2 overflow-x-auto rounded-xl p-1">
          {tabs.map((tab, i) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveSection(tab.key)}
              aria-pressed={activeSection === tab.key}
              style={{ '--i': Math.min(i, 7) } as CSSProperties}
              className={`motion-pop flex-1 shrink-0 cursor-pointer rounded-lg px-3.5 py-1.5 text-xs whitespace-nowrap select-none ${
                activeSection === tab.key ? 'bg-neutral font-semibold text-neutral-content' : 'text-base-content/60 hover:bg-base-200 hover:text-base-content'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ================= 一页贯通主区域 ================= */}
      <div className="space-y-9">
        {/* 区块 1：简历原文与附件（FR-A2） */}
        {activeSection === 'resume' && (
          <section className="ws-rise ws-paper space-y-6 rounded-2xl border border-base-300 p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-base-300 pb-4">
              <div>
                <h2 className="text-base font-semibold text-base-content">简历原文与附件展示</h2>
                <p className="mt-0.5 text-xs text-base-content/50">
                  来源存储：MinIO 对象存储 · 文件标识：{c.sourceId}
                  {c.sourceUpdatedAt ? ` · 来源库最后更新：${c.sourceUpdatedAt}` : ' · 来源库未提供更新时间'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Chip tone={c.attachmentType === 'missing' ? 'warning' : c.attachmentType === 'platform' ? 'ghost' : 'success'}>{ATTACH_TEXT[c.attachmentType]}</Chip>
                {fileAvailable ? (
                  <Btn variant="ghost" onClick={() => setShowFileInfo(true)}>
                    查看原件信息
                  </Btn>
                ) : (
                  <>
                    <Btn variant="ghost" disabled title="来源库未提供可访问的原件文件，工作台不自动回网站补采">
                      原件不可下载
                    </Btn>
                    <span className="text-[11px] text-warning">原始附件缺失，仅展示平台结构化文本</span>
                  </>
                )}
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-base-300 bg-base-100">
              <ResumeDoc c={c} />
            </div>
          </section>
        )}

        {/* 区块 2：AI 宽松初筛与岗位 JD 对标（FR-A3） */}
        {activeSection === 'screening' && (
          <section className="ws-rise ws-paper space-y-6 rounded-2xl border border-base-300 p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-base-300 pb-3">
              <div>
                <h2 className="text-base font-semibold text-base-content">AI 辅助初筛结论与标尺对标</h2>
                <p className="mt-0.5 text-xs text-base-content/50">基于岗位《{jd.title}》标准要求进行的宽松匹配，AI 仅供参考，不自动淘汰候选人</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Chip tone={aiTone}>{aiText}</Chip>
                <Chip tone="ghost">初筛契合度 {c.match}%</Chip>
              </div>
            </div>

            <div className="rounded-xl border border-base-300 bg-base-200/60 p-4 text-xs">
              <div className="font-semibold text-base-content">宽松匹配结论</div>
              <p className="mt-1 text-base-content/70">
                {ai?.looseMatch ?? '该候选人尚无 AI 宽松匹配结论（AI 未跑或来源库未回传），请人工查看简历后决定是否联系。'}
              </p>
              <p className="mt-2 text-[11px] text-base-content/50">AI 结果仅作参考，是否联系、是否约面由 HR 决定。</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="collapse collapse-arrow border border-success/30 bg-success/5">
                <input type="checkbox" defaultChecked aria-label="展开 AI 推荐理由" />
                <div className="collapse-title text-xs font-semibold text-success">AI 推荐理由（{aiReasons.length}）</div>
                <div className="collapse-content text-xs text-base-content/80">
                  {aiReasons.length ? (
                    <ul className="space-y-2">
                      {aiReasons.map((r) => (
                        <li key={r}>· {r}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-base-content/50">无推荐理由记录（AI 未跑或该候选人未被推荐）。</p>
                  )}
                </div>
              </div>

              <div className="collapse collapse-arrow border border-warning/30 bg-warning/5">
                <input type="checkbox" aria-label="展开 AI 疑点与风险" />
                <div className="collapse-title text-xs font-semibold text-warning">AI 疑点与风险（{aiRisks.length + risks.length}）</div>
                <div className="collapse-content text-xs text-base-content/80">
                  <ul className="space-y-2">
                    {aiRisks.map((r) => (
                      <li key={`ai-${r}`}>· [AI] {r}</li>
                    ))}
                    {risks.map((r) => (
                      <li key={`c-${r}`}>· [简历] {r}</li>
                    ))}
                  </ul>
                  {!aiRisks.length && !risks.length && <p className="text-base-content/50">暂无明显风险疑点，仍建议面试核实。</p>}
                </div>
              </div>
            </div>

            <div className="text-xs">
              <div className="font-semibold text-base-content/70">候选人摘要</div>
              <p className="mt-1 text-base-content/70">{c.summary}</p>
            </div>

            <div className="text-xs">
              <div className="font-semibold text-base-content/70">简历亮点（{highlights.length}）</div>
              {highlights.length ? (
                <ul className="mt-1 space-y-2 text-base-content/70">
                  {highlights.map((h) => (
                    <li key={h}>· {h}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-base-content/50">暂无亮点记录。</p>
              )}
            </div>

            <div className="text-xs">
              <div className="font-semibold text-base-content/70">JD 核心技能点阵核验</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {jd.skills.length ? (
                  jd.skills.map((s) => {
                    const hit = (c.skills ?? []).find((x) => s.includes(x.k) || x.k.includes(s.split('/')[0].trim()))
                    return (
                      <Chip key={s} tone={hit ? 'success' : 'ghost'}>
                        {hit ? `${s}（${hit.v} 分）` : s}
                      </Chip>
                    )
                  })
                ) : (
                  <span className="text-base-content/50">该岗位尚未装配标尺技能项，无法逐项核验。</span>
                )}
              </div>
            </div>
          </section>
        )}

        {/* 区块 3：沟通跟进记录（FR-A4） */}
        {activeSection === 'notes' && (
          <section className="ws-rise ws-paper space-y-5 rounded-2xl border border-base-300 p-6">
            <h2 className="text-base font-semibold text-base-content">团队沟通跟进记录</h2>

            <div className="flex gap-3">
              <input
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                placeholder="录入沟通意向、候选人期望薪资、面试反馈便签…"
                aria-label="新增沟通跟进记录"
                className="input input-sm h-9 flex-1"
              />
              <Btn onClick={handleAddNote} disabled={!newNote.trim()}>
                添加记录
              </Btn>
            </div>

            {notes.length ? (
              <div className="stagger mt-4 space-y-3">
                {notes.map((n, i) => (
                  <div key={n.id} style={{ '--i': Math.min(i, 7) } as CSSProperties} className="flex items-start justify-between gap-5 rounded-xl bg-base-200 p-3 text-xs">
                    <div>
                      <div className="font-semibold text-base-content">{n.author}</div>
                      <div className="mt-1 leading-relaxed text-base-content/70">{n.content}</div>
                    </div>
                    <span className="shrink-0 font-mono text-[11px] text-base-content/50">{n.time}</span>
                  </div>
                ))}
              </div>
            ) : (
              <Empty title="暂无沟通记录" hint="联系候选人后把意向、薪资预期与下一步动作记录在此，团队共享可查。" />
            )}

            <div className="grid gap-4 border-t border-base-300 pt-3 text-xs sm:grid-cols-2">
              <div className="space-y-2 rounded-xl border border-base-300 p-3">
                <div className="font-semibold text-base-content">下一步动作</div>
                {c.nextAction ? (
                  <>
                    <div className="leading-relaxed text-base-content/70">{c.nextAction.text}</div>
                    <div className="text-[11px] text-base-content/50">
                      责任人：{c.nextAction.owner} · 期限：{c.nextAction.dueAt}
                    </div>
                  </>
                ) : (
                  <div className="text-base-content/50">暂无登记，可在沟通后补充下一步与责任人。</div>
                )}
                <div className="text-[11px] text-base-content/50">当前负责人：{c.assignee}</div>
              </div>
              <div className="space-y-2 rounded-xl border border-base-300 p-3">
                <div className="font-semibold text-base-content">来源数据与业务记录分离</div>
                <div className="text-[11px] text-base-content/60">来源库最后更新：{c.sourceUpdatedAt ?? '未知（来源侧未提供更新时间）'}</div>
                <div className="text-[11px] text-base-content/60">来源：{c.source} · 唯一标识：{c.sourceId}</div>
                <div className="text-[11px] text-base-content/60">来源更新只刷新更新时间，不覆盖工作台已确认的阶段、面评与审批结果。</div>
              </div>
            </div>
          </section>
        )}

        {/* 区块 4：约面安排与本场出题（FR-B1 / B2） */}
        {activeSection === 'interview' && (
          <section className="ws-rise ws-paper space-y-6 rounded-2xl border border-base-300 p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-base-300 pb-3">
              <div>
                <h2 className="text-base font-semibold text-base-content">约面安排与定制试题</h2>
                <p className="mt-0.5 text-xs text-base-content/50">当前安排：{c.slot === '待安排' ? '未排期' : `${slotLabel(c.slot)} · ${c.round}`}</p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {(!sd || sd.status === 'canceled') && (
                  <Btn variant="accent" onClick={openSchedule}>
                    {sd ? '重新排期' : '安排面试'}
                  </Btn>
                )}
                {sd && sd.status === 'scheduled' && (
                  <>
                    <Btn variant="ghost" onClick={openReschedule}>
                      改期
                    </Btn>
                    <Btn variant="ghost" onClick={openCancel}>
                      取消面试
                    </Btn>
                    {sd.noticeStatus !== 'confirmed' && (
                      <Btn
                        variant="ghost"
                        onClick={() => {
                          resendNotice(c.id)
                          setActionMsg(`已重发${sd.noticeChannel === 'sms' ? '短信' : '邮件'}通知（第 ${sd.noticeAttempts + 1} 次尝试）。`)
                        }}
                      >
                        {sd.noticeStatus === 'failed' ? '重试发送通知' : '重发通知'}
                      </Btn>
                    )}
                    {(sd.feishuCalendarStatus === 'pending' || sd.feishuCalendarStatus === 'failed') && (
                      <Btn
                        variant="ghost"
                        onClick={() => {
                          advanceCalendarSync(c.id)
                          setActionMsg('已重试飞书日历同步（沿用原场次，不重复建场）。')
                        }}
                      >
                        重试同步日程
                      </Btn>
                    )}
                    <Btn variant="outline" onClick={() => go('room', c.id)}>
                      进入考场
                    </Btn>
                  </>
                )}
                {sd && sd.status === 'canceled' && <Chip tone="error">该场次已取消（记录保留）</Chip>}
              </div>
            </div>

            {sd ? (
              <div className="space-y-5">
                <div className="grid gap-4 text-xs sm:grid-cols-2 lg:grid-cols-4">
                  <Info label="场次编号">{sd.interviewId}</Info>
                  <Info label="轮次 / 时段">
                    {sd.round} · {slotLabel(sd.slot)}
                  </Info>
                  <Info label="面试官">{sd.interviewer || '待指定'}</Info>
                  <Info label="方式 / 时长">
                    {sd.type === 'online' ? '线上（飞书会议）' : '线下（现场）'} · {sd.durationMin} 分钟
                  </Info>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-base-300 p-3.5 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="font-semibold text-base-content">飞书日历与会议</span>
                      <Chip tone={CAL_TONE[sd.feishuCalendarStatus]}>{CAL_TEXT[sd.feishuCalendarStatus]}</Chip>
                    </div>
                    <div className="mt-2 text-base-content/60">
                      {sd.type === 'online' ? (
                        sd.feishuMeetingUrl ? (
                          <a href={sd.feishuMeetingUrl} target="_blank" rel="noreferrer" className="link link-hover text-base-content">
                            {sd.feishuMeetingUrl}
                          </a>
                        ) : (
                          '线上会议链接待飞书日历同步完成后生成。'
                        )
                      ) : (
                        '线下面试：无需飞书会议链接，日历与会议室由飞书日程同步。'
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-base-300 p-3.5 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="font-semibold text-base-content">候选人通知（{sd.noticeChannel === 'sms' ? '短信通道' : '邮件通道'}）</span>
                      <Chip tone={NOTICE_TONE[sd.noticeStatus]}>{NOTICE_TEXT[sd.noticeStatus]}</Chip>
                    </div>
                    <div className="mt-2 text-base-content/60">
                      已尝试发送 {sd.noticeAttempts} 次
                      {sd.noticeStatus === 'failed' && <span className="ml-1 text-error">· 已进入可重试队列</span>}
                    </div>
                    {sd.failureReason && <div className="mt-1 text-[11px] text-error">失败原因：{sd.failureReason}</div>}
                  </div>
                </div>

                <div className="border-t border-base-300 pt-3">
                  <div className="mb-1 text-[11px] font-semibold text-base-content/60">场次变更时间线（改期 / 取消 / 通知全链路，追加不覆盖）</div>
                  {schedEvents.length ? (
                    <EventTimeline
                      items={schedEvents.map((e, i) => ({
                        key: `${e.at}-${e.action}-${i}`,
                        at: e.at,
                        dot: SCHED_DOT[e.action],
                        title: `${SCHED_ACTION[e.action]} · ${e.by}`,
                        sub: `${e.from ? `原：${slotLabel(e.from)} ` : ''}${e.to ? `新：${slotLabel(e.to)} ` : ''}${e.reason ?? ''}`.trim() || undefined,
                      }))}
                    />
                  ) : (
                    <p className="py-2 text-[11px] text-base-content/50">该候选人尚无场次变更记录。</p>
                  )}
                </div>
              </div>
            ) : (
              <Empty
                title="尚未安排面试"
                hint="安排面试后会生成场次编号与飞书日程，并保留改期 / 取消的全链路记录；重复提交同一时段不会产生重复预约。"
                action={
                  <Btn variant="accent" onClick={openSchedule}>
                    安排面试
                  </Btn>
                }
              />
            )}

            <div className="stagger space-y-4">
              <div className="text-xs font-semibold text-base-content">本场针对性命题清单（{qs.length} 道）</div>
              {qs.length ? (
                qs.map((q, idx) => (
                  <div key={q.id} style={{ '--i': Math.min(idx + 1, 7) } as CSSProperties} className="space-y-2 rounded-xl border border-base-300 bg-base-100 p-3.5 text-xs">
                    <div className="font-medium text-base-content">
                      {idx + 1}. {q.q}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-base-content/50">
                      <span className="rounded bg-base-200 px-1.5 py-0.5">{q.topic}</span>
                      <span>出题依据: {q.basis ?? '—'}</span>
                    </div>
                  </div>
                ))
              ) : (
                <Empty title="暂无命题清单" hint="可在面试间按简历定位题与 JD 标尺生成题目。" />
              )}
            </div>
          </section>
        )}

        {/* 区块 5：综合面评复盘报告（FR-B3） */}
        {activeSection === 'review' && (
          <section className="ws-rise ws-paper space-y-5 rounded-2xl border border-base-300 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-base-300 pb-3">
              <h2 className="text-base font-semibold text-base-content">面试综合评价报告</h2>
              <div className="flex flex-wrap items-center gap-3">
                {typeof reviewScore === 'number' && (
                  <span className="motion-meter ws-rise inline-flex">
                    <ScoreStamp score={reviewScore} />
                  </span>
                )}
                {liveReview?.draft && <Chip tone="warning">AI 草稿·待人工确认</Chip>}
                {liveReview && !liveReview.draft && <Chip tone="success">已人工确认</Chip>}
                {isArchivedReview && <Chip tone="neutral">{archiveWho}</Chip>}
              </div>
            </div>

            {review ? (
              <div className="space-y-5 text-xs leading-relaxed text-base-content">
                <div className="rounded-xl bg-base-200 p-4">
                  <div className="mb-1 flex flex-wrap items-center gap-3 text-sm font-semibold text-base-content">
                    综合结论
                    {liveReview?.draft && <span className="text-[11px] font-normal text-warning">AI 生成草稿，未经人工确认不作为正式面评结论</span>}
                  </div>
                  <p className="text-base-content/70">{review.overall}</p>
                  <dl className="mt-2 grid gap-3 text-[11px] text-base-content/50 sm:grid-cols-3">
                    <div>面评时间：{review.at || '—'}</div>
                    <div>确认人：{review.confirmedBy ?? archiveWho ?? '待人工确认'}</div>
                    <div>确认时间：{review.confirmedAt ?? (archiveWho ? review.at : '待人工确认')}</div>
                    {liveReview && <div>评分证据题数：{review.evidence.length}</div>}
                  </dl>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="rounded-xl border border-success/30 bg-success/5 p-3.5">
                    <div className="font-semibold text-success">亮点与确认优势{archiveLabel}</div>
                    {review.strengths.length ? (
                      <ul className="mt-2 space-y-2 text-base-content/80">
                        {review.strengths.map((s, i) => (
                          <li key={`s-${i}`}>· {s}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-base-content/50">面评未记录亮点。</p>
                    )}
                  </div>
                  <div className="rounded-xl border border-warning/30 bg-warning/5 p-3.5">
                    <div className="font-semibold text-warning">风险与待核实{archiveLabel}</div>
                    {review.weaknesses.length ? (
                      <ul className="mt-2 space-y-2 text-base-content/80">
                        {review.weaknesses.map((w, i) => (
                          <li key={`w-${i}`}>· {w}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-base-content/50">面评未记录风险项。</p>
                    )}
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="rounded-xl border border-base-300 p-3.5">
                    <div className="font-semibold text-base-content/70">下一步验证建议</div>
                    {review.nextSteps.length ? (
                      <ul className="mt-2 space-y-2 text-base-content/70">
                        {review.nextSteps.map((n, i) => (
                          <li key={`n-${i}`}>· {n}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-base-content/50">暂无下一步建议。</p>
                    )}
                  </div>
                  <div className="rounded-xl border border-base-300 p-3.5">
                    <div className="font-semibold text-base-content/70">复核建议</div>
                    <p className="mt-2 text-base-content/70">{review.suggestion || '暂无复核建议。'}</p>
                  </div>
                </div>

                {liveReview?.draft && (
                  <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-warning/30 bg-warning/5 p-3">
                    <p className="text-[11px] text-base-content/70">AI 仅依据逐题评分与备注生成草稿；请面试官 / HR 核对后确认，确认动作会记录确认人与时间。</p>
                    <Btn
                      variant="accent"
                      disabled={!can('evaluation:submit')}
                      title={can('evaluation:submit') ? '确认后作为正式面评结论保存' : '当前角色无提交面评权限'}
                      onClick={() => {
                        const done = confirmReview(c.id, currentUser.name)
                        setActionMsg(done ? `已人工确认综合评价报告（确认人：${done.confirmedBy} · ${done.confirmedAt}）。` : '确认失败：该候选人没有面试间评分记录，无法确认 AI 草稿。')
                      }}
                    >
                      人工确认
                    </Btn>
                  </div>
                )}

                {liveReview && !liveReview.draft && (liveReview.confirmedBy || liveReview.confirmedAt) && (
                  <p className="text-[11px] text-base-content/50">
                    已由 {liveReview.confirmedBy ?? '—'} 于 {liveReview.confirmedAt ?? '—'} 人工确认（内容为 AI 辅助生成的草稿）。
                  </p>
                )}
              </div>
            ) : (
              <Empty
                title={interviewHappened ? '面试已结束，但工作台没有对应的面评记录' : '该候选人尚未完成面试'}
                hint={
                  interviewHappened
                    ? '阶段历史显示该候选人已进入「面评中」及之后的环节，但面试间的评分与归档面评记录均为空（可能来源库未回传）。请进入面试间补齐评分，或在来源库确认后重新同步。'
                    : '面试结束后在面试间逐题打分，此处会生成 AI 面评草稿，经人工确认后作为正式结论。'
                }
                action={
                  <Btn variant="outline" onClick={() => go('room', c.id)}>
                    进入面试间
                  </Btn>
                }
              />
            )}
          </section>
        )}

        {/* 区块 6：录取与飞书 / BPM 双审批跟踪（FR-C2 / C3 / C4） */}
        {activeSection === 'approval' && (
          <section className="ws-rise ws-paper space-y-6 rounded-2xl border border-base-300 p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-base-300 pb-3">
              <div>
                <h2 className="text-base font-semibold text-base-content">录取申请与双审批流（飞书 / BPM）</h2>
                <p className="mt-0.5 text-xs text-base-content/50">
                  业务确认录取后由有权限的 HR 显式发起；两条轨均通过才算整体通过，AI 初筛与面评都不会自动触发审批
                </p>
              </div>
              {!app && (
                <Btn
                  variant="solid"
                  disabled={!can('approval:create')}
                  title={can('approval:create') ? '前往录取申请页发起' : '当前角色无发起录取申请权限'}
                  onClick={() => go('approvals')}
                >
                  发起录取审批申请
                </Btn>
              )}
            </div>

            {app ? (
              <div className="space-y-5">
                <div className="rounded-xl border border-base-300 bg-base-200/60 p-4 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="font-semibold text-base-content">审批单号：{app.id}</span>
                    <Chip tone={FINAL_TONE[app.finalStatus]}>
                      {app.finalStatus === 'approved' ? '整体通过（双轨均通过）' : app.finalStatus === 'partial' ? '单边通过·未完成' : '未完成'}
                    </Chip>
                  </div>
                  <dl className="mt-3 grid gap-3 text-base-content/60 sm:grid-cols-4">
                    <div>拟定薪资：{app.salary}</div>
                    <div>拟定职级：{app.level}</div>
                    <div>
                      发起 HR：{app.applicant}（{app.applyDate}）
                    </div>
                    <div>预计到岗：{app.onboardDate}</div>
                  </dl>
                </div>

                {/* 聚合结论独立呈现：非 approved 一律不得读作已录取 */}
                <div role="alert" className={`alert alert-soft ${FINAL_ALERT[app.finalStatus]} items-start text-xs`}>
                  <div>
                    <div className="font-semibold">聚合结论：{FINAL_TEXT[app.finalStatus]}</div>
                    <p className="mt-1 text-[11px]">
                      判定口径：仅当飞书审批与 BPM 流程两条轨状态均为「已通过」时，整体才算通过；单边通过、退回、拒绝、撤销都不构成录用结论。
                    </p>
                  </div>
                </div>

                {/* 申请材料逐项核对（FR-C1）：已完成 / 待补 / 缺失 */}
                <div className="space-y-3">
                  <div className="text-xs font-semibold text-base-content">申请材料逐项核对（{app.materials?.length ?? 0}）</div>
                  {app.materials?.length ? (
                    <ul className="stagger grid gap-3 sm:grid-cols-2">
                      {app.materials.map((m, i) => (
                        <li key={m.key} style={{ '--i': Math.min(i, 7) } as CSSProperties} className="flex items-start justify-between gap-4 rounded-xl border border-base-300 bg-base-100 p-3">
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-base-content">
                              {m.name}
                              {m.required && <span className="ml-1 text-[11px] text-error">必需</span>}
                            </div>
                            <div className="mt-0.5 truncate text-[11px] text-base-content/50">
                              {m.fileRef ?? (m.status === 'missing' ? '来源库未提供文件引用' : '暂无文件引用')}
                            </div>
                          </div>
                          <Chip tone={MATERIAL_TONE[m.status]}>{MATERIAL_TEXT[m.status]}</Chip>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <Empty title="申请单未登记材料清单" hint="材料清单缺失时无法核对材料，请联系发起人补齐后再提交。" />
                  )}
                </div>

                <div className="stagger grid gap-5 lg:grid-cols-2">
                  <div style={{ '--i': 0 } as CSSProperties}>
                    <TrackCard name="飞书审批" idLabel="审批实例" instanceId={app.feishu.instanceId} track={app.feishu} onRetry={() => retryApprovalTrack(app.id, 'feishu')} />
                  </div>
                  <div style={{ '--i': 1 } as CSSProperties}>
                    <TrackCard name="BPM（内部 OA）录取流程" idLabel="流程编号" instanceId={app.bpm.processId} track={app.bpm} onRetry={() => retryApprovalTrack(app.id, 'bpm')} />
                  </div>
                </div>
              </div>
            ) : (
              <Empty
                title="尚未创建录取申请单"
                hint="业务明确录用意向后，由有权限的 HR 在录取申请页显式提交；提交后会分别发起飞书审批与 BPM 流程并在此跟踪双轨状态。"
                action={
                  can('approval:create') ? (
                    <Btn variant="solid" onClick={() => go('approvals')}>
                      去发起录取申请
                    </Btn>
                  ) : undefined
                }
              />
            )}
          </section>
        )}
      </div>

      {/* 调岗换标尺弹窗 */}
      <Modal
        open={showSwitchPos}
        onClose={() => setShowSwitchPos(false)}
        title="调换在招岗位与装配标尺"
        sub="调岗后候选人会重新装配该岗位关联的 JD 标尺，变更会写入跟进记录"
      >
        <div className="space-y-3 text-xs">
          {positions.length ? (
            positions.map((p) => {
              const targetJd = findJd(p.jdId)
              const isCur = c.positionId === p.id
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={isCur}
                  onClick={() => {
                    bindCandidatePosition(c.id, p.id)
                    setShowSwitchPos(false)
                    setActionMsg(`已调岗至「${p.name}」，并重新装配标尺。`)
                  }}
                  className={`w-full rounded-xl border p-3.5 text-left motion-pop ${
                    isCur ? 'cursor-default border-primary bg-base-200 font-semibold' : 'cursor-pointer border-base-300 bg-base-100 hover:border-base-content/40'
                  }`}
                >
                  <div className="flex justify-between gap-3">
                    <span>{p.name}</span>
                    {isCur && <span className="text-[11px] text-base-content/60">当前岗位</span>}
                  </div>
                  <div className="mt-1 text-[11px] text-base-content/50">
                    {p.code} · 标尺: {targetJd ? `${targetJd.title}（${targetJd.code}）` : '该岗位尚未装配标尺'}
                  </div>
                </button>
              )
            })
          ) : (
            <Empty title="暂无可选岗位" hint="请先在岗位管理中建立在招岗位。" />
          )}
        </div>
      </Modal>

      {/* 指派 / 变更负责人弹窗（FR-A4） */}
      <Modal
        open={showAssign}
        onClose={() => setShowAssign(false)}
        title="指派 / 变更负责人"
        sub={`当前负责人：${c.assignee}`}
        footer={
          <>
            <Btn variant="ghost" onClick={() => setShowAssign(false)}>
              取消
            </Btn>
            <Btn
              disabled={!assignee.trim() || !can('candidate:assign')}
              title={can('candidate:assign') ? '确认后负责人立即变更' : '当前角色无分配候选人权限'}
              onClick={() => {
                batchAssign([c.id], assignee.trim())
                setShowAssign(false)
                setActionMsg(`负责人已变更为：${assignee.trim()}。`)
              }}
            >
              确认指派
            </Btn>
          </>
        }
      >
        <Field label="负责人" htmlFor="assignee" required hint="负责人用于跟进提醒与共享人才库归属，变更会写入跟进记录。">
          <select id="assignee" className="select w-full" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            {!assignOptions.includes(assignee) && assignee && <option value={assignee}>{assignee}</option>}
            {assignOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </Field>
      </Modal>

      {/* 原件信息弹窗：附件缺失时入口已禁用，不再出现点不动的死控件 */}
      <Modal open={showFileInfo} onClose={() => setShowFileInfo(false)} title="简历原件信息" sub={`附件状态：${ATTACH_TEXT[c.attachmentType]}`}>
        <div className="space-y-3 text-xs text-base-content/70">
          <div>
            文件名：<span className="font-medium text-base-content">{resumeFile?.file ?? '来源库未提供文件名'}</span>
          </div>
          <div>
            对象存储引用：
            <span className="font-mono text-[11px] text-base-content">{`minio://facetry/resumes/${c.id}/${resumeFile?.file ?? 'unknown'}`}</span>
          </div>
          <div>
            来源：{c.source} · 来源唯一标识：{c.sourceId}
            {c.sourceUpdatedAt ? ` · 最后更新：${c.sourceUpdatedAt}` : ''}
          </div>
          <p className="text-[11px] text-base-content/50">当前为前端演示环境，未接入真实 MinIO 下载接口；接入后此入口将直接打开受控的临时下载地址（按岗位与部门权限校验）。</p>
        </div>
      </Modal>

      {/* 新增约面弹窗 */}
      <Modal
        open={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        title="安排面试日程"
        sub="确认后创建面试场次、发起飞书日程与会议，并通过选定通道通知候选人"
        footer={
          <>
            <Btn variant="ghost" onClick={() => setShowScheduleModal(false)}>
              取消
            </Btn>
            <Btn onClick={submitSchedule}>确认排期与通知</Btn>
          </>
        }
      >
        <div className="space-y-4">
          {schedErr && (
            <div role="alert" className="alert alert-soft alert-warning text-xs">
              {schedErr}
            </div>
          )}
          <Field label="面试时间" htmlFor="sched-slot" required hint="格式 YYYY-MM-DD HH:mm；同一候选人 + 轮次 + 时段重复提交不会重复建场。">
            <input id="sched-slot" className="input w-full" value={schedSlot} onChange={(e) => setSchedSlot(e.target.value)} placeholder="2026-10-08 14:30" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="轮次" htmlFor="sched-round">
              <select id="sched-round" className="select w-full" value={schedRound} onChange={(e) => setSchedRound(e.target.value)}>
                {Array.from(new Set(['一面', '二面', '终面', 'HR面', schedRound])).map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="面试方式" htmlFor="sched-type">
              <select id="sched-type" className="select w-full" value={schedType} onChange={(e) => setSchedType(e.target.value as 'online' | 'offline')}>
                <option value="online">线上（飞书会议）</option>
                <option value="offline">线下（现场）</option>
              </select>
            </Field>
            <Field label="面试官" htmlFor="sched-interviewer" hint={`默认取用人主管：${pos.hiringManager || '未指定'}`}>
              <input id="sched-interviewer" className="input w-full" value={schedInterviewer} onChange={(e) => setSchedInterviewer(e.target.value)} />
            </Field>
            <Field label="面试时长（分钟）" htmlFor="sched-duration">
              <input id="sched-duration" className="input w-full" inputMode="numeric" value={schedDuration} onChange={(e) => setSchedDuration(e.target.value)} />
            </Field>
          </div>
          <Field label="候选人通知通道" htmlFor="sched-channel" hint="至少一个通道可用；发送失败会进入可重试队列。">
            <select id="sched-channel" className="select w-full" value={schedChannel} onChange={(e) => setSchedChannel(e.target.value as 'sms' | 'email')}>
              <option value="sms">短信通道（第三方）</option>
              <option value="email">邮件通道（SMTP）</option>
            </select>
          </Field>
        </div>
      </Modal>

      {/* 改期弹窗（预填当前时段） */}
      <Modal
        open={showReschedule}
        onClose={() => setShowReschedule(false)}
        title="面试改期"
        sub={sd ? `场次 ${sd.interviewId} · 当前：${sd.slot}` : '当前没有可改期的场次'}
        footer={
          <>
            <Btn variant="ghost" onClick={() => setShowReschedule(false)}>
              取消
            </Btn>
            <Btn onClick={submitReschedule} disabled={!sd}>
              确认改期
            </Btn>
          </>
        }
      >
        <div className="space-y-4">
          {reschedErr && (
            <div role="alert" className="alert alert-soft alert-warning text-xs">
              {reschedErr}
            </div>
          )}
          <Field label="新的面试时间" htmlFor="resched-slot" required hint="已预填当前时段；旧时段会写入场次历史，飞书日程与通知状态将重置为待处理。">
            <input id="resched-slot" className="input w-full" value={reschedSlot} onChange={(e) => setReschedSlot(e.target.value)} />
          </Field>
          <Field label="改期原因" htmlFor="resched-reason" required>
            <input id="resched-reason" className="input w-full" value={reschedReason} onChange={(e) => setReschedReason(e.target.value)} />
          </Field>
        </div>
      </Modal>

      {/* 取消面试弹窗：二次确认 + 原因 + 是否通知候选人 */}
      <Modal
        open={showCancel}
        onClose={() => setShowCancel(false)}
        title="取消面试安排"
        sub="此操作会写入场次历史并保留记录，候选人阶段回落到「待联系」"
        footer={
          <>
            <Btn variant="ghost" onClick={() => setShowCancel(false)}>
              我再想想
            </Btn>
            <Btn variant="danger" onClick={submitCancel}>
              确认取消面试
            </Btn>
          </>
        }
      >
        <div className="space-y-4">
          {cancelErr && (
            <div role="alert" className="alert alert-soft alert-error text-xs">
              {cancelErr}
            </div>
          )}
          <div role="alert" className="alert alert-soft alert-warning items-start text-xs">
            <div>取消后：飞书日程与会议将撤销，场次状态置为「已取消」（记录不删除），候选人回到「待联系」阶段，需要重新约面。</div>
          </div>
          <Field label="取消原因" htmlFor="cancel-reason" required hint="会写入场次历史与跟进记录，便于后续追溯。">
            <input id="cancel-reason" className="input w-full" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="如：候选人时间冲突 / 面试官临时出差" />
          </Field>
          <label className="label cursor-pointer justify-start gap-3" htmlFor="cancel-notify">
            <input id="cancel-notify" type="checkbox" className="toggle toggle-sm" checked={cancelNotify} onChange={(e) => setCancelNotify(e.target.checked)} />
            <span className="text-xs text-base-content/70">同时通过现有通知通道告知候选人取消安排</span>
          </label>
        </div>
      </Modal>

      {/* 阶段流转二次确认弹窗：必填原因，禁止绕过双审批一键置已完成 */}
      <Modal
        open={!!stageTarget}
        onClose={() => setStageTarget(null)}
        title="确认阶段流转"
        sub={`${c.status} → ${stageTarget ?? ''}`}
        footer={
          <>
            <Btn variant="ghost" onClick={() => setStageTarget(null)}>
              取消
            </Btn>
            <Btn onClick={submitStage} disabled={stageTarget === '已完成' && doneLocked}>
              确认流转
            </Btn>
          </>
        }
      >
        <div className="space-y-4">
          {stageErr && (
            <div role="alert" className="alert alert-soft alert-error text-xs">
              {stageErr}
            </div>
          )}
          {stageTarget === '已完成' && doneLocked && (
            <div role="alert" className="alert alert-soft alert-warning text-xs">
              需先完成录取双轨审批：该候选人没有「飞书 + BPM 双通过」的录取申请单，禁止直接流转到「已完成」。
            </div>
          )}
          <div className="rounded-xl bg-base-200 p-3 text-xs text-base-content/70">
            阶段流转会追加到阶段历史（不覆盖旧记录），并同步写入沟通跟进记录，操作人：{currentUser.name}。
          </div>
          <Field label="流转原因" htmlFor="stage-reason" required hint="必填：说明本次阶段变动的依据（如面评结论、审批结果）。">
            <textarea
              id="stage-reason"
              className="textarea w-full text-xs"
              rows={3}
              value={stageReason}
              onChange={(e) => setStageReason(e.target.value)}
              placeholder="如：一面面评结论为推荐，安排二面"
            />
          </Field>
        </div>
      </Modal>
    </div>
  )
}
