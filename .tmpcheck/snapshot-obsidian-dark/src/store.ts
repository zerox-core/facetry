import { useSyncExternalStore } from 'react'
import {
  bank,
  bankCats,
  candidates,
  history,
  importPool,
  initialApprovals,
  jds,
  positions,
  resumes,
  TODAY,
  type ApprovalApplication,
  type ApprovalHistoryItem,
  type ApprovalTrackStatus,
  type Candidate,
  type CandidateStage,
  type JD,
  type MaterialItem,
  type Position,
  type ScheduleDetail,
  type ScheduleEvent,
} from './data'

export { jds, positions }

// 缓存版本升级到 v4：阶段枚举收敛（待初筛→筛选中、待约面→待联系、待面试→约面中、待评价→面评中、已录取→已完成），
// 沿用 v3 旧缓存会让界面显示已废弃的阶段值，因此换 KEY 重新初始化
const KEY = 'facetry-demo-v4'

// —— 当前操作人与角色权限（PRD「权限」：页面用 can() 禁用无权限按钮）——
export type Role = 'hr' | 'interviewer' | 'approver' | 'admin'

export const currentUser = { name: '林婉', role: 'hr' as Role, dept: '技术部' }

/**
 * 角色权限判定：
 * - HR 可发起录取审批、分配候选人；
 * - 面试官可提交面评，但不可发起录取审批（PRD：面评不得自动触发审批）；
 * - 审批人只在飞书 / BPM 侧处理，工作台内不额外授权；
 * - 仅 admin 可进入管理后台。
 */
export function can(action: 'approval:create' | 'candidate:assign' | 'admin:view' | 'evaluation:submit'): boolean {
  switch (action) {
    case 'approval:create':
      return currentUser.role === 'hr'
    case 'candidate:assign':
      return currentUser.role === 'hr'
    case 'evaluation:submit':
      return currentUser.role === 'hr' || currentUser.role === 'interviewer'
    case 'admin:view':
      return currentUser.role === 'admin'
    default:
      return false
  }
}

export type Rec = { score?: number; hit: string[]; asked: string[]; tags: string[]; note: string; secs: number }
/** 综合评价：AI 只能产出草稿（draft=true），必须经人工确认后才作为面评结论（FR-B3） */
export type Review = {
  overall: string
  strengths: string[]
  weaknesses: string[]
  nextSteps: string[]
  suggestion: string
  evidence: string[]
  at: string
  draft: boolean
  confirmedBy?: string
  confirmedAt?: string
}

export type Room = {
  recs: Record<string, Rec>
  sec: number
  verdict: string
  summary: string
  savedAt?: string
  obs?: string
  review?: Review
  talk?: Talk[]
  shared?: boolean
  entered?: boolean
  paused?: boolean
  since?: number | null
  micOn?: boolean
  camOn?: boolean
  winMode?: 'min' | 'win' | 'full'
}

export type Talk = { id: string; who: '面试官' | '候选人'; kind: 'voice' | 'text' | 'file'; text: string; t: string; file?: { name: string; size: number; url?: string } }

export type LiveMsg =
  | { type: 'state'; name: string; role: string; round: string; idx: number; total: number; q: string; ended: boolean; sec: number }
  | { type: 'talk'; item: Talk }
  | { type: 'level'; who: Talk['who']; on: boolean }
  | { type: 'join' | 'leave' | 'hello' }

export function liveChannel(cid: string, f: (m: LiveMsg) => void) {
  if (typeof BroadcastChannel === 'undefined') return { send: (_: LiveMsg) => {}, close: () => {} }
  const ch = new BroadcastChannel(`facetry-room-${cid}`)
  ch.onmessage = (e) => f(e.data)
  return { send: (m: LiveMsg) => ch.postMessage(m), close: () => ch.close() }
}

export const picks: Record<string, string[]> = {}
export const rooms: Record<string, Room> = {}
export const approvals: ApprovalApplication[] = [...initialApprovals]

export type SourceDbSyncState = {
  connected: boolean
  lastSyncTime: string
  totalSynced: number
  lastBatchCount: number
  status: 'idle' | 'syncing' | 'success' | 'error'
  logs: { time: string; msg: string; count: number }[]
  lastError?: string // 最近一次同步失败原因：读取失败必须显式展示，不得静默吞错
  failedBatch?: { count: number; reason: string; at: string } // 失败批次：待同步条数与失败原因
  canRetry: boolean // 是否存在可重跑的失败批次
}

export const sourceDbSync: SourceDbSyncState = {
  connected: true,
  lastSyncTime: '2026-10-01 11:30:00',
  totalSynced: 6,
  lastBatchCount: 2,
  status: 'idle',
  canRetry: false,
  logs: [
    { time: '2026-10-01 11:30:00', msg: '影刀 RPA 同步完成：前程无忧、BOSS 直聘落库', count: 2 },
    { time: '2026-09-30 18:00:00', msg: '影刀 RPA 定时落库：猎聘增量扫描，1 条附件原件缺失', count: 1 },
  ],
}

// 模块级计数器：场次编号与审批单号都从这里确定性生序，不用随机数、不用数组长度拼接
const meta = { seq: 0, interviewSeq: 0, approvalSeq: 0 }

try {
  const raw = localStorage.getItem(KEY)
  if (raw) {
    const s = JSON.parse(raw)
    if (s.candidates) candidates.splice(0, candidates.length, ...s.candidates)
    if (s.history) history.splice(0, history.length, ...s.history)
    if (s.resumes) Object.assign(resumes, s.resumes)
    if (s.picks) Object.assign(picks, s.picks)
    if (s.rooms) Object.assign(rooms, s.rooms)
    if (s.approvals) approvals.splice(0, approvals.length, ...s.approvals)
    if (s.sourceDbSync) Object.assign(sourceDbSync, s.sourceDbSync)
    if (s.bank) bank.splice(0, bank.length, ...s.bank)
    if (s.bankCats) bankCats.splice(0, bankCats.length, ...s.bankCats)
    if (s.jds) jds.splice(0, jds.length, ...s.jds)
    if (s.positions) positions.splice(0, positions.length, ...s.positions)
    meta.seq = s.seq ?? 0
    meta.interviewSeq = s.interviewSeq ?? 0
    meta.approvalSeq = s.approvalSeq ?? 0
  }
} catch {
  localStorage.removeItem(KEY)
}

let version = 0
const subs = new Set<() => void>()

export function save() {
  localStorage.setItem(
    KEY,
    JSON.stringify({
      candidates,
      history,
      resumes,
      picks,
      rooms,
      approvals,
      sourceDbSync,
      bank,
      bankCats,
      jds,
      positions,
      seq: meta.seq,
      interviewSeq: meta.interviewSeq,
      approvalSeq: meta.approvalSeq,
    }),
  )
}

export function commit() {
  save()
  version += 1
  subs.forEach((f) => f())
}

export function useStore() {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb)
      return () => subs.delete(cb)
    },
    () => version,
  )
}

export function resetDemo() {
  localStorage.removeItem(KEY)
  location.reload()
}

// 找不到就返回 undefined：由调用方兜底，避免把数据静默绑到 candidates[0] / jds[0] / positions[0] 上
export const findC = (id: string): Candidate | undefined => candidates.find((c) => c.id === id)
export const pickedOf = (id: string) => picks[id] ?? findC(id)?.qs.map((q) => q.id) ?? []
export function setPicked(id: string, v: string[]) {
  picks[id] = v
  commit()
}

export const elapsedOf = (r?: Room) =>
  Math.max(0, Math.floor((r?.sec ?? 0) + (r?.since ? (Date.now() - r.since) / 1000 : 0)))

export const runningRoomId = () =>
  candidates.find((c) => {
    const r = rooms[c.id]
    return !!(r?.entered && !r.paused && r.since != null && !r.verdict && !['已完成', '已淘汰', '搁置'].includes(c.status))
  })?.id

export const slotDate = (slot?: string): Date | null => {
  if (!slot) return null
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(slot)
  return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : null
}
const todayD = () => {
  const [y, mo, d] = TODAY.split('-').map(Number)
  return new Date(y, mo - 1, d)
}

/** 演示时间基准（日期 + 时分）：日期固定取 data.ts 的 TODAY，避免真实日期混入演示数据 */
export function demoNow(): string {
  const d = new Date()
  return `${TODAY} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** 演示时间基准（仅时分秒）：用于沟通记录等只展示时刻的字段 */
export function demoClock(): string {
  const d = new Date()
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':')
}

/** 演示时间基准（仅日期）：新增业务记录的日期一律落在 TODAY */
export const demoToday = (): string => TODAY

export const slotLabel = (slot?: string): string => {
  if (!slot || slot === '待安排') return '待安排'
  const d = slotDate(slot)
  if (!d) return slot
  const t = slot.slice(11)
  const diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - todayD().getTime()) / 86400000)
  return diff === 0 ? `今天 ${t}` : diff === 1 ? `明天 ${t}` : `${slot.slice(5, 10)} ${t}`
}

/** 内部：写阶段并**追加** stageHistory（追加不覆盖），公开入口是 setStage */
function applyStage(c: Candidate, stage: CandidateStage, by: string, reason?: string) {
  c.status = stage
  c.stageHistory = [...(c.stageHistory ?? []), { stage, at: demoNow(), by, reason }]
}

/** 场次编号自增：模块级计数器，首次按既有数据推导，刷新前后不重号 */
function nextInterviewSeq(): number {
  if (!meta.interviewSeq) {
    let max = 0
    candidates.forEach((c) => {
      const m = /^IV-2026-(\d+)$/.exec(c.scheduleDetail?.interviewId ?? '')
      if (m) max = Math.max(max, Number(m[1]))
    })
    meta.interviewSeq = max
  }
  meta.interviewSeq += 1
  return meta.interviewSeq
}

/** 飞书会议入会链接：由场次编号确定性推导，不使用随机数 */
const feishuMeetingUrlOf = (interviewId: string) => `https://vc.feishu.cn/j/${interviewId.replace(/\D/g, '').padStart(9, '0').slice(-9)}`

/** 约面结果：duplicate 表示同一幂等键的场次已存在，直接复用既有场次，不重复建场 */
export type ScheduleResult =
  | { ok: true; detail: ScheduleDetail }
  | { ok: false; reason: 'duplicate' | 'not_found'; existing?: ScheduleDetail }

export type ScheduleInput = {
  cid: string
  slot: string
  round?: string
  type?: 'online' | 'offline'
  interviewer?: string
  durationMin?: number
  channel?: 'sms' | 'email'
  by?: string
}

/**
 * 统一约面（FR-B1 / FR-B2）：生成稳定场次编号与幂等键，新建场次初始为「飞书日历待同步 + 通知待发送」。
 * 幂等：同一候选人 + 轮次 + 时段已存在未取消场次时返回 duplicate，不重复建场（重复提交不产生重复预约）。
 */
export function schedule(opts: ScheduleInput): ScheduleResult {
  const { cid, slot, round = '一面', type = 'online', durationMin = 45, channel = 'sms', by = currentUser.name } = opts
  const c = findC(cid)
  if (!c) return { ok: false, reason: 'not_found' }

  const key = `${cid}|${round}|${slot}`
  const current = c.scheduleDetail
  if (current && current.status === 'scheduled' && current.idempotencyKey === key) {
    return { ok: false, reason: 'duplicate', existing: current }
  }

  const pos = findPos(c.positionId)
  const interviewer = opts.interviewer || pos?.hiringManager || c.assignee || '待指定面试官'
  const now = demoNow()
  const interviewId = `IV-2026-${String(nextInterviewSeq()).padStart(4, '0')}`

  // 已有未取消场次却重新约面时，保留历史链并追加 rescheduled，避免改期记录丢失
  const chain: ScheduleEvent[] = current ? [...current.history] : []
  if (current && current.status === 'scheduled') {
    chain.push({ at: now, by, action: 'rescheduled', from: current.slot, to: slot, reason: '重新约面' })
  }
  chain.push({ at: now, by, action: 'created' })

  const detail: ScheduleDetail = {
    interviewId,
    idempotencyKey: key,
    slot,
    round,
    type,
    interviewer,
    durationMin,
    status: 'scheduled',
    feishuCalendarStatus: 'pending',
    feishuMeetingUrl: type === 'online' ? feishuMeetingUrlOf(interviewId) : undefined,
    noticeChannel: channel,
    noticeStatus: 'pending',
    noticeAttempts: 0,
    history: chain,
  }

  c.slot = slot
  c.round = round
  c.scheduleDetail = detail
  // 已终结的候选人不再被约面流程改阶段
  if (c.status !== '约面中' && !['已完成', '已淘汰', '搁置'].includes(c.status)) {
    applyStage(c, '约面中', by, `${round}已安排：${slot}`)
  }
  c.notes.unshift({
    id: `n-${Date.now()}`,
    time: demoClock(),
    author: by,
    content: `已安排面试：${slot}（${round} · ${type === 'online' ? '线上飞书会议' : '线下'} · ${interviewer} · ${durationMin} 分钟），场次 ${interviewId}；飞书日历同步中，候选人${channel === 'sms' ? '短信' : '邮件'}通知待发送。`,
  })
  commit()
  return { ok: true, detail }
}

/** 改期（FR-B1）：旧时段写入 history，重置飞书日历同步与通知状态，历史全程保留 */
export function rescheduleSchedule(cid: string, newSlot: string, by = currentUser.name, reason = '候选人时间冲突'): ScheduleDetail | undefined {
  const c = findC(cid)
  const d = c?.scheduleDetail
  if (!c || !d) return undefined
  const from = d.slot
  d.history.push({ at: demoNow(), by, action: 'rescheduled', from, to: newSlot, reason })
  d.slot = newSlot
  d.status = 'scheduled'
  d.feishuCalendarStatus = 'pending'
  d.noticeStatus = 'pending'
  d.failureReason = undefined
  c.slot = newSlot
  c.notes.unshift({
    id: `n-${Date.now()}`,
    time: demoClock(),
    author: by,
    content: `面试场次 ${d.interviewId} 已改期：${from} → ${newSlot}（${reason}）。飞书日程待重新同步，候选人通知待重发。`,
  })
  commit()
  return d
}

/** 取消约面：保留场次与时段记录（不清空 slot），候选人回落到「待联系」并写跟进记录 */
export function cancelSchedule(cid: string, opts: { reason?: string; notifyCandidate?: boolean; by?: string } = {}): ScheduleDetail | undefined {
  const { reason = '候选人时间冲突', notifyCandidate = true, by = currentUser.name } = opts
  const c = findC(cid)
  if (!c) return undefined
  const d = c.scheduleDetail
  if (d) {
    d.status = 'canceled'
    d.history.push({ at: demoNow(), by, action: 'canceled', reason })
  }
  applyStage(c, '待联系', by, `取消面试：${reason}`)
  c.notes.unshift({
    id: `n-${Date.now()}`,
    time: demoClock(),
    author: by,
    content: `已取消面试安排（${reason}），飞书日程${d ? '已撤销' : '无需撤销'}，候选人回到待联系阶段${notifyCandidate ? `，已通过${d?.noticeChannel === 'email' ? '邮件' : '短信'}告知候选人` : '，暂未通知候选人'}。`,
  })
  commit()
  return d
}

/** 推进飞书日历同步状态：pending → synced / failed（外部对接异常必须显式可见） */
export function advanceCalendarSync(cid: string, forceFail = false): ScheduleDetail | undefined {
  const c = findC(cid)
  const d = c?.scheduleDetail
  if (!c || !d) return undefined
  if (d.feishuCalendarStatus === 'synced' && !forceFail) return d
  d.feishuCalendarStatus = forceFail ? 'failed' : 'synced'
  d.failureReason = forceFail ? '飞书日历接口调用失败（演示异常），可稍后重试同步' : undefined
  if (!forceFail && d.type === 'online' && !d.feishuMeetingUrl) d.feishuMeetingUrl = feishuMeetingUrlOf(d.interviewId)
  commit()
  return d
}

/**
 * 重发候选人通知：noticeAttempts 累计，成功置 sent 并追加 notice_resent，
 * 失败置 failed + failureReason 并追加 notice_failed（forceFail 供页面演示失败队列）
 */
export function resendNotice(cid: string, by = currentUser.name, forceFail = false): ScheduleDetail | undefined {
  const c = findC(cid)
  const d = c?.scheduleDetail
  if (!c || !d) return undefined
  d.noticeAttempts += 1
  const channel = d.noticeChannel === 'sms' ? '短信' : '邮件'
  if (forceFail) {
    d.noticeStatus = 'failed'
    d.failureReason = `${channel}通道返回失败（演示异常），已进入可重试队列`
    d.history.push({ at: demoNow(), by, action: 'notice_failed', reason: d.failureReason })
    c.notes.unshift({
      id: `n-${Date.now()}`,
      time: demoClock(),
      author: by,
      content: `重发约面通知失败（第 ${d.noticeAttempts} 次尝试，${channel}）：${d.failureReason}`,
    })
  } else {
    d.noticeStatus = 'sent'
    d.failureReason = undefined
    d.history.push({ at: demoNow(), by, action: 'notice_resent', reason: `第 ${d.noticeAttempts} 次发送成功` })
    c.notes.unshift({
      id: `n-${Date.now()}`,
      time: demoClock(),
      author: by,
      content: `已重发约面通知（${channel}，第 ${d.noticeAttempts} 次尝试），状态：已发送待候选人确认。`,
    })
  }
  commit()
  return d
}

/** 通知失败待处理队列（FR-B2：通知失败进入可处理队列，可重试） */
export function noticeQueue(): Candidate[] {
  return candidates.filter((c) => c.scheduleDetail?.noticeStatus === 'failed')
}

/** 候选人场次历史：改期 / 取消 / 重发全链路，按发生时间正序 */
export function scheduleHistory(cid: string): ScheduleEvent[] {
  return [...(findC(cid)?.scheduleDetail?.history ?? [])]
}

/**
 * 流转候选人生命周期阶段（FR-A4）：阶段值收敛为新枚举，并**追加** stageHistory（含操作人与原因），不覆盖历史
 */
export function setStage(cid: string, stage: CandidateStage, opts: { reason?: string; by?: string } = {}): Candidate | undefined {
  const c = findC(cid)
  if (!c) return undefined
  const { reason, by = currentUser.name } = opts
  const old = c.status
  applyStage(c, stage, by, reason)
  c.notes.unshift({
    id: `n-${Date.now()}`,
    time: demoClock(),
    author: by,
    content: `候选人阶段变动：从「${old}」流转为「${stage}」${reason ? `，说明：${reason}` : ''}`,
  })
  commit()
  return c
}

/** 兼容旧调用名：等价于 setStage（reason 由调用方传入） */
export function updateCandidateStage(cid: string, stage: CandidateStage, reason?: string) {
  return setStage(cid, stage, { reason })
}

/** 添加沟通跟进记录 */
export function addCandidateNote(cid: string, content: string, author = currentUser.name) {
  const c = findC(cid)
  if (!c || !content.trim()) return
  c.notes.unshift({
    id: `n-${Date.now()}`,
    time: demoClock(),
    author,
    content: content.trim(),
  })
  commit()
}

/** 批量分配 HR 负责人（权限：can('candidate:assign')，页面负责禁用） */
export function batchAssign(cids: string[], assignee: string) {
  cids.forEach((cid) => {
    const c = candidates.find((x) => x.id === cid)
    if (c) {
      c.assignee = assignee
      c.notes.unshift({
        id: `n-${Date.now()}`,
        time: demoClock(),
        author: currentUser.name,
        content: `负责人已变更为：${assignee}`,
      })
    }
  })
  commit()
}

/** 手动录入试题 */
export function addQuestion(
  cid: string,
  q: { q: string; topic: string; diff?: string; basis?: string; points?: string[]; answer?: string; follow?: string[]; flag?: string },
) {
  const c = findC(cid)
  if (!c) return
  const id = `${cid}-m${Date.now()}`
  c.qs.push({
    id,
    topic: q.topic,
    diff: q.diff ?? '中等',
    basis: q.basis ?? '面试官手动添加',
    q: q.q,
    points: q.points ?? [],
    answer: q.answer ?? '',
    follow: q.follow ?? [],
    flag: q.flag ?? '',
  })
  picks[cid] = [...pickedOf(cid), id]
  commit()
}

/** 题库管理 */
export function addBankItem(item: { cat: string; q: string; tag: string; diff: string; points: string[]; answer: string; follow: string[]; flag: string }) {
  bank.unshift({ id: `b${Date.now()}`, hot: '0', ...item })
  commit()
}
export function addBankCat(name: string) {
  const n = name.trim()
  if (n && !bankCats.includes(n)) {
    bankCats.push(n)
    commit()
  }
}

/** 待同步条数：按来源唯一标识判断哪些记录尚未建档 */
const countPendingSync = () =>
  importPool.filter((it) => !candidates.some((c) => c.source === it.c.source && c.sourceId === it.c.sourceId)).length

/**
 * 单次拉取：依据 source + sourceId 做幂等建档，重复读取不重复建人；
 * 来源侧更新只刷新 sourceUpdatedAt，不覆盖工作台已确认的业务数据（阶段 / 面评 / 审批结果）。
 * 新记录 id 由来源唯一标识确定性推导，便于演示「重复读取不重复建档」。
 */
function runSourceSyncPass(): { newCount: number; ignoredCount: number } {
  const at = demoNow()
  let newCount = 0
  let ignoredCount = 0

  importPool.forEach((item) => {
    const hit = candidates.find((c) => c.source === item.c.source && c.sourceId === item.c.sourceId)
    if (hit) {
      ignoredCount++
      hit.sourceUpdatedAt = at
      return
    }
    newCount++
    const id = `c-syn-${item.c.sourceId}`
    candidates.unshift({
      ...item.c,
      id,
      sourceUpdatedAt: at,
      qs: item.c.qs.map((q) => ({ ...q, id: `${id}-${q.id}` })),
    })
    resumes[id] = {
      ...item.r,
      sections: item.r.sections.map((s) => ({
        ...s,
        lines: s.lines.map((l) => (l.q ? { ...l, q: l.q.map((x) => `${id}-${x}`) } : l)),
      })),
    }
  })

  return { newCount, ignoredCount }
}

/**
 * 模拟从来源数据库（影刀落库，工作台只读）拉取新记录。
 * forceFail = true 时走失败分支：保留最后成功时间 + 异常原因 + 可重跑批次，不静默吞错。
 */
export function triggerSourceDbSync(forceFail = false): { newCount: number; ignoredCount: number; ok: boolean } {
  sourceDbSync.status = 'syncing'
  if (forceFail) {
    simulateSyncFailure()
    return { newCount: 0, ignoredCount: 0, ok: false }
  }

  const { newCount, ignoredCount } = runSourceSyncPass()
  const at = demoNow()
  sourceDbSync.lastSyncTime = at
  sourceDbSync.status = 'success'
  sourceDbSync.lastError = undefined
  sourceDbSync.failedBatch = undefined
  sourceDbSync.canRetry = false
  sourceDbSync.totalSynced += newCount
  sourceDbSync.lastBatchCount = newCount
  sourceDbSync.logs.unshift({
    time: at,
    msg: `手动触发拉取：从来源数据库拉取完成，发现 ${newCount} 条新简历落库，${ignoredCount} 条已存在跳过（幂等保护）`,
    count: newCount,
  })
  commit()
  return { newCount, ignoredCount, ok: true }
}

/** 演示异常：来源库读取失败（超时 / 权限失效），进入可重试队列并保留最后成功时间 */
export function simulateSyncFailure(reason = '来源数据库只读连接超时（演示异常）'): SourceDbSyncState {
  const at = demoNow()
  sourceDbSync.status = 'error'
  sourceDbSync.lastError = reason
  sourceDbSync.failedBatch = { count: countPendingSync(), reason, at }
  sourceDbSync.canRetry = true
  sourceDbSync.logs.unshift({
    time: at,
    msg: `拉取失败：${reason}；本批 ${sourceDbSync.failedBatch.count} 条待同步，已进入可重跑队列（最后成功时间 ${sourceDbSync.lastSyncTime}）`,
    count: 0,
  })
  commit()
  return sourceDbSync
}

/** 重跑失败批次：沿用同一幂等键补入，清空异常标记并更新最后成功时间 */
export function retryFailedBatch(): { newCount: number; ignoredCount: number; ok: boolean } {
  sourceDbSync.status = 'syncing'
  const { newCount, ignoredCount } = runSourceSyncPass()
  const at = demoNow()
  sourceDbSync.status = 'success'
  sourceDbSync.lastError = undefined
  sourceDbSync.failedBatch = undefined
  sourceDbSync.canRetry = false
  sourceDbSync.lastSyncTime = at
  sourceDbSync.totalSynced += newCount
  sourceDbSync.lastBatchCount = newCount
  sourceDbSync.logs.unshift({
    time: at,
    msg: `失败批次重跑成功：补入 ${newCount} 条，${ignoredCount} 条已存在跳过（同一幂等键，不重复建档）`,
    count: newCount,
  })
  commit()
  return { newCount, ignoredCount, ok: true }
}

/** 导入本地简历 mock */
export function importResume(): string {
  const { c, r } = importPool[meta.seq % importPool.length]
  const id = `c-upload-${Date.now()}`
  meta.seq += 1
  candidates.unshift({
    ...c,
    id,
    source: '简历导入',
    sourceId: `SRC-UP-${id}`,
    status: '新入库',
    qs: c.qs.map((q) => ({ ...q, id: `${id}-${q.id}` })),
  })
  resumes[id] = {
    ...r,
    sections: r.sections.map((s) => ({
      ...s,
      lines: s.lines.map((l) => (l.q ? { ...l, q: l.q.map((x) => `${id}-${x}`) } : l)),
    })),
  }
  commit()
  return id
}

/** 提交面试评价（FR-B3）：评价完成后进入待录取意向阶段，并追加阶段流转历史 */
export function submitEvaluation(cid: string, avg: number, dur: string, verdict: string, by = currentUser.name) {
  const c = findC(cid)
  if (!c) return
  const room = rooms[cid]
  if (room) {
    room.sec = elapsedOf(room)
    room.since = null
    room.paused = false
  }
  history.unshift({
    cid,
    id: `R-${1000 + history.length}`,
    name: c.name,
    role: c.role.replace(/（.*）/, ''),
    date: TODAY,
    score: Math.round(avg * 10) / 10,
    dur,
    verdict: verdict === '推荐录用' ? '推荐' : verdict,
  })
  if (c.status !== '待录取' && !['已完成', '已淘汰', '搁置'].includes(c.status)) {
    applyStage(c, '待录取', by, `面评完成，结论「${verdict}」`)
  }
  c.notes.unshift({
    id: `n-${Date.now()}`,
    time: demoClock(),
    author: by,
    content: `面试评价已完成：综合得分 ${avg.toFixed(1)} 分，面评结论「${verdict}」，进入待录取意向阶段。`,
  })
  commit()
}

/** 生成综合面评草稿报告：AI 只产出草稿（draft=true），必须经 confirmReview 人工确认后才生效 */
export function buildReviewFor(cid: string): Review | undefined {
  const c = findC(cid)
  const room = rooms[cid]
  if (!c || !room) return undefined
  const picked = pickedOf(cid)
  const qs = c.qs.filter((q) => !picked.length || picked.includes(q.id))
  const recs = room.recs
  const obs = room.obs ?? ''
  const rated = qs.filter((x) => recs[x.id]?.score)
  const scored = rated.length
  const avg = scored ? rated.reduce((a, x) => a + recs[x.id].score!, 0) / scored : 0
  const good = rated.filter((x) => recs[x.id].score! >= 4)
  const weak = rated.filter((x) => recs[x.id].score! <= 2)
  const cite = (x: (typeof qs)[number]) => `「${x.topic}」${recs[x.id].score} 分${recs[x.id].note ? `，记录：${recs[x.id].note.slice(0, 40)}` : ''}`
  const miss = qs.filter((x) => !recs[x.id]?.score)
  return {
    overall: rated.length
      ? `本场覆盖 ${rated.length}/${qs.length} 题，均分 ${avg.toFixed(1)}。${good.length ? `在${good.map((x) => x.topic).join('、')}上有实际证据支撑；` : ''}${weak.length ? `${weak.map((x) => x.topic).join('、')}表现偏弱。` : '未出现明显短板。'}${obs ? `面试官观察：${obs.slice(0, 60)}` : ''}`
      : '尚无评分记录，无法形成有依据的评价。',
    strengths: good.map(cite),
    weaknesses: [...weak.map(cite), ...(miss.length ? [`${miss.map((x) => x.topic).join('、')} 未评分，相关能力未验证`] : [])],
    nextSteps: [...weak, ...miss].flatMap((x) => (x.follow ?? []).filter((f) => !recs[x.id]?.asked.includes(f)).slice(0, 1)).slice(0, 3),
    suggestion: rated.length < qs.length / 2 ? '覆盖率不足一半，证据不充分，建议安排下一轮再做结论。' : weak.length ? '证据基本充分，建议结合偏弱项在下一轮定向验证后再做结论。' : '证据较充分，可结合团队需求复核后做结论。',
    evidence: [...good, ...weak].map((x) => x.id),
    at: demoClock(),
    draft: true,
  }
}

/**
 * 人工确认 AI 面评草稿（FR-B3：AI 辅助生成的评价必须经面试官 / HR 确认后保存）：
 * 置 draft=false 并记录确认人与确认时间。
 */
export function confirmReview(cid: string, by = currentUser.name): Review | undefined {
  const room = rooms[cid]
  if (!room) return undefined
  const review = room.review ?? buildReviewFor(cid)
  if (!review) return undefined
  review.draft = false
  review.confirmedBy = by
  review.confirmedAt = demoNow()
  room.review = review
  const c = findC(cid)
  c?.notes.unshift({
    id: `n-${Date.now()}`,
    time: demoClock(),
    author: by,
    content: `已人工确认综合评价报告（AI 辅助草稿），确认时间：${review.confirmedAt}。`,
  })
  commit()
  return review
}

// —— 岗位与 JD 标尺管理 ——
// 找不到返回 undefined，由调用方兜底，避免把标尺静默绑到第一条数据上
export const findJd = (id?: string): JD | undefined => jds.find((j) => j.id === id)
export const findPos = (id?: string): Position | undefined => positions.find((p) => p.id === id)

export function addJd(item: Omit<JD, 'id' | 'code' | 'updatedAt'>): JD {
  const id = `jd-${Date.now()}`
  const code = `JD-${String(jds.length + 1).padStart(3, '0')}`
  const now = demoToday()
  const newJd: JD = { id, code, ...item, updatedAt: now }
  jds.unshift(newJd)
  commit()
  return newJd
}

export function updateJd(id: string, patch: Partial<JD>) {
  const i = jds.findIndex((j) => j.id === id)
  if (i >= 0) {
    jds[i] = { ...jds[i], ...patch, updatedAt: demoToday() }
    commit()
  }
}

export function addPosition(item: Omit<Position, 'id' | 'code' | 'createdAt'>): Position {
  const id = `pos-${Date.now()}`
  const code = `POS-2026-${String(positions.length + 1).padStart(3, '0')}`
  const newPos: Position = { id, code, ...item, createdAt: demoToday() }
  positions.unshift(newPos)
  commit()
  return newPos
}

export function updatePosition(id: string, patch: Partial<Position>) {
  const i = positions.findIndex((p) => p.id === id)
  if (i >= 0) {
    positions[i] = { ...positions[i], ...patch }
    commit()
  }
}

export function bindCandidatePosition(cid: string, posId: string) {
  const c = findC(cid)
  const pos = findPos(posId)
  if (c && pos) {
    c.positionId = pos.id
    c.jdId = pos.jdId
    c.role = pos.name.replace(/.*·\s*/, '')
    c.notes.unshift({
      id: `n-${Date.now()}`,
      time: demoClock(),
      author: currentUser.name,
      content: `候选人调岗至：${pos.name}，已重新装配标尺。`,
    })
    commit()
  }
}

// —— 录取申请与飞书/BPM 双审批管理 (模块 C) ——
export type ApprovalTrackKey = 'feishu' | 'bpm'

/** 材料入参：字符串视为「已核对完成」，对象沿用调用方传入的核对状态 */
export type MaterialInput = MaterialItem | string

/** 发起结果：duplicate = 已有在途申请，直接复用既有单；forbidden = 当前角色无发起权限 */
export type ApprovalResult =
  | { ok: true; app: ApprovalApplication }
  | { ok: false; reason: 'duplicate' | 'forbidden' | 'not_found'; existing?: ApprovalApplication }

/** 审批单号自增：模块级确定性计数（首次按既有单号推导），不使用随机数与数组长度 */
function nextApprovalSeq(): number {
  if (!meta.approvalSeq) {
    let max = 1000
    approvals.forEach((a) => {
      const m = /^APP-2026-(\d+)$/.exec(a.id)
      if (m) max = Math.max(max, Number(m[1]))
    })
    meta.approvalSeq = max
  }
  meta.approvalSeq += 1
  return meta.approvalSeq
}

function normalizeMaterials(input?: MaterialInput[]): MaterialItem[] {
  return (input ?? []).map((m, i) => (typeof m === 'string' ? { key: `m${i + 1}`, name: m, required: true, status: 'done' } : m))
}

/** 标准申请材料清单（FR-C1）：逐项核对，附件原件缺失如实标记为 missing */
export function defaultMaterials(cid: string): MaterialItem[] {
  const c = findC(cid)
  if (!c) return []
  const file = resumes[c.id]?.file
  return [
    { key: 'review', name: '完整面评结论与试题依据', required: true, status: 'done' },
    {
      key: 'resume',
      name: `候选人简历与学历认证材料（${file ?? '附件缺失'}）`,
      required: true,
      status: c.attachmentType === 'missing' ? 'missing' : 'done',
      fileRef: c.attachmentType === 'missing' ? undefined : file,
    },
    { key: 'salary', name: '薪资证明与背景调查授权书', required: true, status: 'pending' },
    { key: 'onboard', name: '入职材料清单与预计到岗确认', required: false, status: 'pending' },
  ]
}

/**
 * 聚合结论判定（FR-C4：任一必需审批未完成不得标记为整体通过）
 * - 两轨均 approved → approved
 * - 任一 rejected → rejected；任一 canceled → canceled；任一 returned → returned
 * - 只有一侧 approved 且另一侧仍 pending → partial（单边通过，不算全流程完成）
 * - 其余 → processing
 */
function computeFinalStatus(feishu: ApprovalTrackStatus, bpm: ApprovalTrackStatus): ApprovalApplication['finalStatus'] {
  if (feishu === 'approved' && bpm === 'approved') return 'approved'
  if (feishu === 'rejected' || bpm === 'rejected') return 'rejected'
  if (feishu === 'canceled' || bpm === 'canceled') return 'canceled'
  if (feishu === 'returned' || bpm === 'returned') return 'returned'
  if ((feishu === 'approved' && bpm === 'pending') || (bpm === 'approved' && feishu === 'pending')) return 'partial'
  return 'processing'
}

/**
 * 发起录取申请（FR-C1 / C2 / C3）：
 * - 权限：仅 can('approval:create') 的角色可显式提交，否则返回 forbidden；
 * - 幂等：该候选人已有在途申请（processing / partial）时返回既有单，不重复发起；
 * - 单号 / 飞书实例号 / BPM 流程号均为确定性生序；两轨各初始化一条 history。
 */
export function createApproval(data: {
  candidateId: string
  salary: string
  level: string
  onboardDate: string
  materials?: MaterialInput[]
  by?: string
}): ApprovalResult {
  if (!can('approval:create')) return { ok: false, reason: 'forbidden' }
  const c = findC(data.candidateId)
  if (!c) return { ok: false, reason: 'not_found' }

  const inflight = approvals.find((a) => a.candidateId === c.id && (a.finalStatus === 'processing' || a.finalStatus === 'partial'))
  if (inflight) return { ok: false, reason: 'duplicate', existing: inflight }

  const pos = findPos(c.positionId)
  const positionId = pos?.id ?? c.positionId
  const by = data.by ?? currentUser.name
  const seq = nextApprovalSeq()
  const appId = `APP-2026-${seq}`
  const now = demoNow()
  const materials = normalizeMaterials(data.materials)
  const missing = materials.filter((m) => m.required && m.status !== 'done')

  const newApp: ApprovalApplication = {
    id: appId,
    candidateId: c.id,
    candidateName: c.name,
    positionId,
    positionName: pos?.name ?? c.role,
    applicant: by,
    applyDate: demoToday(),
    salary: data.salary,
    level: data.level,
    dept: pos?.dept ?? currentUser.dept,
    onboardDate: data.onboardDate,
    materials,
    idempotencyKey: `${c.id}|${positionId}`,
    feishu: {
      instanceId: `FS-APP-${8840000 + seq}`,
      status: 'pending',
      currentNode: '用人部门总监审批',
      updateTime: now,
      approver: pos?.hiringManager ?? c.assignee,
      history: [{ at: now, status: 'pending', node: '用人部门总监审批', by, comment: '按公司现有审批定义发起飞书审批' }],
      retryCount: 0,
    },
    bpm: {
      processId: `BPM-HIRE-${TODAY.slice(0, 7).replace('-', '')}-${String(seq).padStart(3, '0')}`,
      status: 'pending',
      currentNode: 'HR 薪酬组复核',
      updateTime: now,
      approver: '薪酬绩效中心',
      history: [{ at: now, status: 'pending', node: 'HR 薪酬组复核', by, comment: '发起 BPM 内部 OA 录取流程' }],
      retryCount: 0,
    },
    finalStatus: 'processing',
  }

  c.approvalId = appId
  if (c.status !== '待录取') applyStage(c, '待录取', by, `已发起录取申请 ${appId}`)
  c.notes.unshift({
    id: `n-${Date.now()}`,
    time: demoClock(),
    author: by,
    content: `已正式显式提交录取申请（单号：${appId}），飞书审批（实例 ${newApp.feishu.instanceId}）与 BPM 内部 OA 流程（${newApp.bpm.processId}）已并行发起${
      missing.length ? `；待补齐材料：${missing.map((m) => m.name).join('、')}` : '，申请材料已逐项核对完成'
    }。`,
  })

  approvals.unshift(newApp)
  commit()
  return { ok: true, app: newApp }
}

/**
 * 更新单条审批轨（FR-C2 / C3 / C4）：追加 history（不覆盖），同步当前节点 / 审批人 / 更新时间，
 * 再按 computeFinalStatus 重算聚合结论。只有两轨全部通过才把候选人置为「已完成」。
 */
export function updateApprovalTrack(
  appId: string,
  track: ApprovalTrackKey,
  status: ApprovalTrackStatus,
  info: { node?: string; by?: string; comment?: string } = {},
): ApprovalApplication | undefined {
  const app = approvals.find((a) => a.id === appId)
  if (!app) return undefined
  const t = app[track]
  const now = demoNow()
  const by = info.by ?? t.approver ?? currentUser.name
  if (info.node) t.currentNode = info.node
  t.status = status
  t.updateTime = now
  t.approver = by
  const item: ApprovalHistoryItem = { at: now, status, node: t.currentNode, by, comment: info.comment }
  t.history.push(item)

  const before = app.finalStatus
  app.finalStatus = computeFinalStatus(app.feishu.status, app.bpm.status)

  // 单边通过（partial）、退回、撤销、拒绝一律不写成已录取；只有双轨通过才流转「已完成」
  if (app.finalStatus === 'approved' && before !== 'approved') {
    const c = findC(app.candidateId)
    if (c) {
      applyStage(c, '已完成', by, '飞书审批与 BPM 流程均已通过')
      c.notes.unshift({
        id: `n-${Date.now()}`,
        time: demoClock(),
        author: '系统自动',
        content: `飞书审批与 BPM 流程均已归档通过（单号 ${app.id}），候选人进入「已完成」状态，可发放 Offer。`,
      })
    }
  }
  commit()
  return app
}

/** 页面在用的「模拟流转」入口：内部走同一套状态机，避免演示逻辑与真实判定分叉 */
export function updateApprovalNode(appId: string, target: ApprovalTrackKey, status: ApprovalTrackStatus, approver?: string) {
  const label: Record<ApprovalTrackStatus, string> = {
    pending: '回到处理中',
    approved: '节点通过',
    rejected: '驳回',
    returned: '退回修改',
    canceled: '撤销',
  }
  return updateApprovalTrack(appId, target, status, {
    by: approver,
    comment: `[演示] 模拟${target === 'feishu' ? '飞书审批' : 'BPM 流程'}${label[status]}`,
  })
}

/** 同步失败重试（FR-C4）：retryCount++ 并清除异常，沿用原实例，不重复发起 */
export function retryApprovalTrack(appId: string, track: ApprovalTrackKey): ApprovalApplication | undefined {
  const app = approvals.find((a) => a.id === appId)
  if (!app) return undefined
  app[track].retryCount += 1
  app[track].lastError = undefined
  app[track].updateTime = demoNow()
  commit()
  return app
}

/** 演示「同步失败 / 状态滞后」：只标记异常与时间，不擅改审批状态 */
export function setApprovalTrackError(appId: string, track: ApprovalTrackKey, message = '审批系统状态同步超时（演示异常），可重试'): ApprovalApplication | undefined {
  const app = approvals.find((a) => a.id === appId)
  if (!app) return undefined
  app[track].lastError = message
  app[track].updateTime = demoNow()
  commit()
  return app
}
