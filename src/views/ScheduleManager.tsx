import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { candidates, positions, STAGES } from '../data'
import type { Candidate, ScheduleDetail, ScheduleEvent } from '../data'
import {
  advanceCalendarSync,
  cancelSchedule,
  currentUser,
  demoToday,
  noticeQueue,
  rescheduleSchedule,
  resendNotice,
  schedule,
  scheduleHistory,
  slotLabel,
  useStore,
} from '../store'
import type { Go } from '../App'
import { Btn, Card, Chip, Empty, Field, Modal } from './ui'
import type { Tone } from './ui'

/* ───────────── 演示时间的日历运算 ─────────────
   一律基于演示数据里的日期字符串（demoToday / slot）做加减，
   不读真实时钟，也不硬编码日期，保证演示数据与界面一致。 */

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'] // 周一起始
const pad2 = (n: number) => String(n).padStart(2, '0')
const dayKeyOf = (slot?: string) => (slot ?? '').slice(0, 10)
const CHANNEL_LABEL: Record<ScheduleDetail['noticeChannel'], string> = {
  sms: '第三方短信服务',
  email: '邮件 SMTP',
}
const ROUNDS = ['一面', '二面', '三面', '终面', 'HR 面']
const DURATIONS = [30, 45, 60, 90]
const TIME_OPTIONS: string[] = (() => {
  const list: string[] = []
  for (let h = 9; h <= 18; h++) list.push(`${pad2(h)}:00`, `${pad2(h)}:30`)
  return list
})()

type Ymd = { y: number; m0: number; d: number }

function parseDay(key: string): Ymd | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  if (!m) return null
  const y = +m[1]
  const m0 = +m[2] - 1
  const d = +m[3]
  if (m0 < 0 || m0 > 11 || d < 1 || d > 31) return null
  return { y, m0, d }
}

const toDayKey = (dt: Date) => `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`

/** 日期加减（天），用于周切换与「明天 / 昨天」相对文案 */
function shiftDay(key: string, delta: number): string {
  const p = parseDay(key) ?? parseDay(demoToday())
  if (!p) return key
  return toDayKey(new Date(p.y, p.m0, p.d + delta))
}

function weekdayCn(key: string): string {
  const p = parseDay(key)
  if (!p) return ''
  return `周${WEEKDAYS[(new Date(p.y, p.m0, p.d).getDay() + 6) % 7]}`
}

function relativeDay(key: string): string {
  const a = parseDay(key)
  const b = parseDay(demoToday())
  if (!a || !b) return ''
  const diff = Math.round((new Date(a.y, a.m0, a.d).getTime() - new Date(b.y, b.m0, b.d).getTime()) / 86400000)
  if (diff === 0) return '今天'
  if (diff === 1) return '明天'
  if (diff === -1) return '昨天'
  return diff > 0 ? `${diff} 天后` : `${-diff} 天前`
}

/** 月网格：周一起始，前后补空格子（不跨月展示他月日期，避免误选） */
function monthCells(y: number, m0: number): (string | null)[] {
  const lead = (new Date(y, m0, 1).getDay() + 6) % 7
  const days = new Date(y, m0 + 1, 0).getDate()
  const cells: (string | null)[] = Array.from({ length: lead }, () => null)
  for (let d = 1; d <= days; d++) cells.push(`${y}-${pad2(m0 + 1)}-${pad2(d)}`)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

/** 时段格式校验：YYYY-MM-DD HH:mm（改期弹窗与发起约面共用） */
const SLOT_RE = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/
function slotError(slot: string): string {
  const v = slot.trim()
  if (!v) return '请填写面试时间'
  const m = SLOT_RE.exec(v)
  if (!m) return `时间格式应为 YYYY-MM-DD HH:mm（示例 ${demoToday()} 10:00）`
  if (+m[2] < 1 || +m[2] > 12 || +m[3] < 1 || +m[3] > 31) return '日期不合法，请检查月份与日期'
  if (+m[4] > 23 || +m[5] > 59) return '时间不合法，请检查小时与分钟'
  return ''
}

/** 统计数字进场：从 0 过渡到目标值（--dur-slow 600ms 档）。
    只用一次 requestAnimationFrame 补间，不新增无限循环动画；reduced-motion 下直接落位。 */
function useCountUp(target: number, duration = 600): number {
  const [value, setValue] = useState(0)
  const fromRef = useRef(0)
  useEffect(() => {
    const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const from = reduced ? target : fromRef.current
    if (from === target) {
      fromRef.current = target
      setValue(target)
      return
    }
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setValue(from + (target - from) * eased)
      if (p < 1) raf = requestAnimationFrame(tick)
      else fromRef.current = target
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      fromRef.current = target
    }
  }, [target, duration])
  return value
}

const NOTICE_CHIP: Record<ScheduleDetail['noticeStatus'], { tone: Tone; text: string }> = {
  pending: { tone: 'warning', text: '预约中 · 通知待发送' },
  sent: { tone: 'info', text: '已发送 · 待候选人确认' },
  confirmed: { tone: 'success', text: '已确认 · 候选人确认参加' },
  failed: { tone: 'error', text: '通知失败 · 已进入重试队列' },
}

const CAL_CHIP: Record<ScheduleDetail['feishuCalendarStatus'], { tone: Tone; text: string }> = {
  pending: { tone: 'warning', text: '同步中' },
  synced: { tone: 'success', text: '已同步' },
  failed: { tone: 'error', text: '同步失败' },
}

const ACTION_LABEL: Record<ScheduleEvent['action'], string> = {
  created: '创建场次',
  rescheduled: '改期',
  canceled: '取消场次',
  notice_resent: '通知重发成功',
  notice_failed: '通知发送失败',
}

const ACTION_DOT: Record<ScheduleEvent['action'], string> = {
  created: 'status status-info status-sm',
  rescheduled: 'status status-warning status-sm',
  canceled: 'status status-error status-sm',
  notice_resent: 'status status-success status-sm',
  notice_failed: 'status status-error status-sm',
}

type Scope = 'day' | 'all' | 'canceled'
type BusyKind = 'calendar' | 'notice' | 'reschedule' | 'cancel'
type ToastTone = 'success' | 'warning' | 'error'
const TOAST_ALERT: Record<ToastTone, string> = {
  success: 'alert-success',
  warning: 'alert-warning',
  error: 'alert-error',
}

export default function ScheduleManager({ go }: { go: Go }) {
  // 订阅 store 版本：schedule / 改期 / 取消 / 重试都会 commit，界面随之刷新
  useStore()

  const [scope, setScope] = useState<Scope>('day')
  const [filterChannel, setFilterChannel] = useState<'all' | 'sms' | 'email'>('all')
  const [selectedDate, setSelectedDate] = useState<string>(() => demoToday())
  const [cursor, setCursor] = useState(() => {
    const p = parseDay(demoToday())
    return { y: p?.y ?? 0, m0: p?.m0 ?? 0 }
  })
  const [busy, setBusy] = useState<{ cid: string; kind: BusyKind } | null>(null)
  const [toast, setToast] = useState<{ id: number; tone: ToastTone; text: string } | null>(null)
  const toastSeq = useRef(0)

  // 发起约面
  const first = candidates[0]
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [form, setForm] = useState(() => ({
    cid: first?.id ?? '',
    posId: first?.positionId ?? positions[0]?.id ?? '',
    round: '一面',
    interviewer: positions.find((p) => p.id === first?.positionId)?.hiringManager ?? '',
    date: demoToday(),
    time: '10:00',
    type: 'online' as ScheduleDetail['type'],
    duration: 45,
    channel: 'sms' as ScheduleDetail['noticeChannel'],
  }))

  // 改期 / 取消
  const [resched, setResched] = useState<{ cid: string; from: string; value: string; reason: string } | null>(null)
  const [reschedError, setReschedError] = useState('')
  const [canceling, setCanceling] = useState<{
    cid: string
    name: string
    interviewId: string
    slot: string
    reason: string
    notifyCandidate: boolean
  } | null>(null)
  const [cancelError, setCancelError] = useState('')

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 4200)
    return () => window.clearTimeout(t)
  }, [toast])

  const notify = (tone: ToastTone, text: string) => {
    toastSeq.current += 1
    setToast({ id: toastSeq.current, tone, text })
  }

  /** 演示用异步：接口调用保留短暂进行态，便于展示 loading / disabled 防重复点击 */
  const run = (cid: string, kind: BusyKind, fn: () => void) => {
    setBusy({ cid, kind })
    window.setTimeout(() => {
      fn()
      setBusy(null)
    }, 550)
  }

  /* ───────────── 真实数据聚合 ───────────── */

  const sessions = candidates.flatMap((c) => (c.scheduleDetail ? [{ c, d: c.scheduleDetail }] : []))
  const live = sessions.filter((s) => s.d.status === 'scheduled')
  const canceled = sessions.filter((s) => s.d.status === 'canceled')
  const calSynced = live.filter((s) => s.d.feishuCalendarStatus === 'synced').length
  const calPending = live.filter((s) => s.d.feishuCalendarStatus === 'pending').length
  const calFailed = live.filter((s) => s.d.feishuCalendarStatus === 'failed').length
  const noticeConfirmed = live.filter((s) => s.d.noticeStatus === 'confirmed').length
  const noticeSent = live.filter((s) => s.d.noticeStatus === 'sent').length
  const noticeWaiting = live.filter((s) => s.d.noticeStatus === 'pending').length
  const noticeFailed = live.filter((s) => s.d.noticeStatus === 'failed').length
  const confirmRate = live.length ? Math.round((noticeConfirmed / live.length) * 100) : 0
  const queue = noticeQueue()
  // 统计卡数值进场（0 → 目标值）；逻辑判断仍用真实值，动画只影响展示
  const calSyncedAnim = Math.round(useCountUp(calSynced))
  const confirmRateAnim = Math.round(useCountUp(confirmRate))
  const queueAnim = Math.round(useCountUp(queue.length))

  const dayStats: Record<string, { live: number; canceled: number }> = {}
  sessions.forEach(({ d }) => {
    const k = dayKeyOf(d.slot)
    const cur = dayStats[k] ?? { live: 0, canceled: 0 }
    if (d.status === 'canceled') cur.canceled += 1
    else cur.live += 1
    dayStats[k] = cur
  })
  const selectedStat = dayStats[selectedDate] ?? { live: 0, canceled: 0 }

  const scopeSessions = sessions.filter(({ d }) => {
    if (scope === 'canceled') return d.status === 'canceled'
    if (scope === 'day') return dayKeyOf(d.slot) === selectedDate
    return true
  })
  const channelCount = (ch: 'all' | 'sms' | 'email') =>
    ch === 'all' ? scopeSessions.length : scopeSessions.filter(({ d }) => d.noticeChannel === ch).length
  const ordered = scopeSessions
    .filter(({ d }) => filterChannel === 'all' || d.noticeChannel === filterChannel)
    .sort((a, b) => a.d.slot.localeCompare(b.d.slot))

  const scopeMeta: Record<Scope, { title: string; sub: string }> = {
    day: {
      title: `当日场次 · ${selectedDate}`,
      sub: `${weekdayCn(selectedDate)}（${relativeDay(selectedDate)}）· 在排 ${selectedStat.live} 场 · 已取消 ${selectedStat.canceled} 场`,
    },
    all: {
      title: '全部场次',
      sub: `共 ${sessions.length} 场（含已取消 ${canceled.length} 场），按时间正序，取消记录不物理删除`,
    },
    canceled: {
      title: '已取消场次',
      sub: `取消是状态流转而非删除：${canceled.length} 场保留取消原因、操作人与完整历史`,
    },
  }

  /* ───────────── 日历交互 ───────────── */

  const selectDay = (key: string) => {
    setSelectedDate(key)
    setScope('day')
  }

  const shiftMonth = (delta: number) => {
    setCursor((c) => {
      const t = new Date(c.y, c.m0 + delta, 1)
      return { y: t.getFullYear(), m0: t.getMonth() }
    })
  }

  const shiftWeek = (delta: number) => {
    const key = shiftDay(selectedDate, delta * 7)
    setSelectedDate(key)
    const p = parseDay(key)
    if (p) setCursor({ y: p.y, m0: p.m0 })
  }

  const goToday = () => {
    const key = demoToday()
    setSelectedDate(key)
    const p = parseDay(key)
    if (p) setCursor({ y: p.y, m0: p.m0 })
    setScope('day')
    setFilterChannel('all')
  }

  /* ───────────── 发起约面 ───────────── */

  const pickCandidate = (cid: string) => {
    const c = candidates.find((x) => x.id === cid)
    const pos = positions.find((p) => p.id === c?.positionId)
    setForm((f) => ({
      ...f,
      cid,
      posId: c?.positionId ?? f.posId,
      interviewer: pos?.hiringManager ?? f.interviewer,
    }))
    setCreateError('')
  }

  const pickPosition = (posId: string) => {
    const pos = positions.find((p) => p.id === posId)
    setForm((f) => ({ ...f, posId, interviewer: pos?.hiringManager ?? f.interviewer }))
  }

  const submitSchedule = () => {
    const slot = `${form.date} ${form.time}`
    const err = slotError(slot)
    if (err) {
      setCreateError(err)
      return
    }
    if (!candidates.some((c) => c.id === form.cid)) {
      setCreateError('请选择候选人后再提交')
      return
    }
    setCreating(true)
    setCreateError('')
    window.setTimeout(() => {
      const res = schedule({
        cid: form.cid,
        slot,
        round: form.round,
        type: form.type,
        interviewer: form.interviewer.trim() || undefined,
        durationMin: form.duration,
        channel: form.channel,
      })
      setCreating(false)
      if (res.ok) {
        setCreateOpen(false)
        setScope('day')
        setSelectedDate(dayKeyOf(res.detail.slot))
        const p = parseDay(dayKeyOf(res.detail.slot))
        if (p) setCursor({ y: p.y, m0: p.m0 })
        notify(
          'success',
          `已创建场次 ${res.detail.interviewId}：${res.detail.slot}（${res.detail.round} · ${res.detail.interviewer} · ${res.detail.durationMin} 分钟）`,
        )
        return
      }
      if (res.reason === 'duplicate') {
        const exist = res.existing?.interviewId ?? '未知'
        setCreateError(`该时段已存在预约（场次号 ${exist}），未重复建场`)
        notify('warning', `重复提交已被拦截：该时段已存在预约（场次号 ${exist}）`)
        return
      }
      setCreateError('未找到该候选人，请重新选择后再提交')
    }, 550)
  }

  /* ───────────── 行内动作：飞书日历 / 通知 ───────────── */

  const syncCalendar = (cid: string, forceFail: boolean) => {
    run(cid, 'calendar', () => {
      const d = advanceCalendarSync(cid, forceFail)
      if (forceFail) {
        notify('error', `飞书日历同步失败（演示异常）：${d?.failureReason ?? '可稍后重试'}`)
        return
      }
      notify('success', `场次 ${d?.interviewId ?? ''} 的飞书日历已同步${d?.feishuMeetingUrl ? '，会议链接已生成' : ''}`)
    })
  }

  const retryNotice = (cid: string, forceFail: boolean) => {
    run(cid, 'notice', () => {
      const d = resendNotice(cid, currentUser.name, forceFail)
      if (forceFail) {
        notify('error', `重发失败（第 ${d?.noticeAttempts ?? 0} 次尝试）：${d?.failureReason ?? '通道异常'}，仍留在可重试队列`)
        return
      }
      notify('success', `通知已重新发送（第 ${d?.noticeAttempts ?? 0} 次尝试），状态更新为「已发送」，等待候选人确认`)
    })
  }

  /* ───────────── 改期 / 取消 ───────────── */

  const openResched = (c: Candidate, d: ScheduleDetail) => {
    setResched({ cid: c.id, from: d.slot, value: d.slot, reason: '候选人时间冲突' })
    setReschedError('')
  }

  const confirmResched = () => {
    if (!resched) return
    const value = resched.value.trim()
    const err = slotError(value) || (value === resched.from ? '新时段与现有场次相同，未产生变更' : '')
    if (err) {
      setReschedError(err)
      return
    }
    const target = resched
    run(target.cid, 'reschedule', () => {
      rescheduleSchedule(target.cid, value, currentUser.name, target.reason.trim() || '未填写原因')
      setResched(null)
      setSelectedDate(dayKeyOf(value))
      const p = parseDay(dayKeyOf(value))
      if (p) setCursor({ y: p.y, m0: p.m0 })
      setScope('day')
      notify('success', `已改期至 ${value}：飞书日历重置为同步中、通知重置为待发送，旧时段写入变更历史`)
    })
  }

  const openCancel = (c: Candidate, d: ScheduleDetail) => {
    setCanceling({
      cid: c.id,
      name: c.name,
      interviewId: d.interviewId,
      slot: d.slot,
      reason: '',
      notifyCandidate: true,
    })
    setCancelError('')
  }

  const confirmCancel = () => {
    if (!canceling) return
    const reason = canceling.reason.trim()
    if (!reason) {
      setCancelError('请填写取消原因，取消原因与操作人会写入变更历史')
      return
    }
    const target = canceling
    run(target.cid, 'cancel', () => {
      cancelSchedule(target.cid, {
        reason,
        notifyCandidate: target.notifyCandidate,
        by: currentUser.name,
      })
      setCanceling(null)
      setScope('canceled')
      setFilterChannel('all')
      notify(
        'warning',
        `场次 ${target.interviewId} 已取消并保留在「已取消场次」视角；候选人回落到「待联系」${
          target.notifyCandidate ? '，已按原通知通道告知候选人' : '，未通知候选人'
        }`,
      )
    })
  }

  const anyBusy = busy !== null

  /* ───────────── 单条场次 ───────────── */

  const renderSession = ({ c, d }: { c: Candidate; d: ScheduleDetail }, i: number) => {
    const events = scheduleHistory(c.id)
    const calBusy = busy?.cid === c.id && busy.kind === 'calendar'
    const noticeBusy = busy?.cid === c.id && busy.kind === 'notice'
    return (
      // 外层承担 .stagger 错位入场，内层承担 .motion-pop 的 hover/active 反馈
      // （两者放同一个元素时，入场动画的 fill 值会盖住 hover 位移）
      <div key={c.id} style={{ '--i': Math.min(i, 7) } as CSSProperties}>
        <div className="motion-pop rounded-xl border border-base-300 bg-base-100 p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-semibold text-base-content">{c.name}</span>
                <span className="text-xs text-base-content/60">{c.role}</span>
                <Chip tone="ghost">{d.round}</Chip>
                {/* 深色补丁翻转为墨黑药丸：仅线下场次；线上保持 info 语义色 */}
                <Chip
                  tone={d.type === 'offline' ? 'neutral' : 'info'}
                  className={d.type === 'offline' ? 'bg-neutral text-neutral-content' : undefined}
                >
                  {d.type === 'offline' ? '线下现场' : '线上飞书会议'}
                </Chip>
                {d.status === 'canceled' && <Chip tone="warning">已取消 · 保留历史</Chip>}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-base-content">
                <span className="font-mono tabular-nums">{d.slot}</span>
                <span className="text-base-content/50">（{slotLabel(d.slot)}）</span>
                <span className="text-base-content/50">· 时长 {d.durationMin} 分钟</span>
                <span className="text-base-content/50">· 面试官 {d.interviewer}</span>
              </div>
              <div className="text-[11px] text-base-content/50">
                场次号 {d.interviewId} · 负责 HR {c.assignee} · 来源 {c.source} · 通知通道 {CHANNEL_LABEL[d.noticeChannel]}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              {d.status === 'scheduled' ? (
                <>
                  <Btn
                    variant="ghost"
                    className="!h-8 !px-3"
                    disabled={anyBusy}
                    onClick={() => openResched(c, d)}
                    ariaLabel={`改期 ${c.name} 的场次 ${d.interviewId}`}
                  >
                    改期
                  </Btn>
                  <Btn
                    variant="ghost"
                    className="!h-8 !px-3 text-error"
                    disabled={anyBusy}
                    onClick={() => openCancel(c, d)}
                    ariaLabel={`取消 ${c.name} 的场次 ${d.interviewId}`}
                  >
                    取消
                  </Btn>
                  <Btn variant="outline" className="!h-8 !px-3" disabled={anyBusy} onClick={() => go('room', c.id)}>
                    进入考场
                  </Btn>
                </>
              ) : (
                <Chip tone="ghost">已取消场次不可改期，如需重新约面请发起新场次</Chip>
              )}
            </div>
          </div>

          {/* 飞书日历 + 候选人通知双轨状态 */}
          <div className="mt-3 grid gap-3 border-t border-base-300 pt-3 text-xs sm:grid-cols-2">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-medium text-base-content/70">飞书日历</span>
              <Chip tone={CAL_CHIP[d.feishuCalendarStatus].tone}>{CAL_CHIP[d.feishuCalendarStatus].text}</Chip>
              {calBusy && <span className="loading loading-spinner loading-xs" role="status" aria-label="日历同步处理中" />}
              {d.status === 'scheduled' && d.feishuCalendarStatus !== 'synced' && (
                <Btn
                  variant="link"
                  className="!h-6 !px-1"
                  loading={calBusy}
                  disabled={anyBusy}
                  onClick={() => syncCalendar(c.id, false)}
                  ariaLabel={`重试同步场次 ${d.interviewId} 到飞书日历`}
                >
                  {d.feishuCalendarStatus === 'failed' ? '重试同步' : '立即同步'}
                </Btn>
              )}
              {d.status === 'scheduled' && d.feishuCalendarStatus !== 'failed' && (
                <Btn
                  variant="link"
                  className="!h-6 !px-1 text-base-content/50"
                  disabled={anyBusy}
                  onClick={() => syncCalendar(c.id, true)}
                  ariaLabel={`演示同步失败：场次 ${d.interviewId}`}
                >
                  模拟同步失败
                </Btn>
              )}
              {d.status === 'scheduled' && d.feishuMeetingUrl && (
                <a
                  className="link link-hover font-medium text-base-content"
                  href={d.feishuMeetingUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  进入飞书会议
                </a>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span className="font-medium text-base-content/70">候选人通知</span>
              <Chip tone={NOTICE_CHIP[d.noticeStatus].tone}>{NOTICE_CHIP[d.noticeStatus].text}</Chip>
              <span className="text-[11px] text-base-content/50">已尝试 {d.noticeAttempts} 次</span>
              {noticeBusy && <span className="loading loading-spinner loading-xs" role="status" aria-label="通知发送处理中" />}
              {d.status === 'scheduled' && (
                <Btn
                  variant="link"
                  className="!h-6 !px-1"
                  loading={noticeBusy}
                  disabled={anyBusy}
                  onClick={() => retryNotice(c.id, false)}
                  ariaLabel={`重发 ${c.name} 的场次 ${d.interviewId} 通知`}
                >
                  {d.noticeStatus === 'failed' ? '重试发送' : '重发通知'}
                </Btn>
              )}
            </div>
          </div>

          {d.failureReason && (
            <div className="mt-2 rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-[11px] text-error">
              异常原因：{d.failureReason}
            </div>
          )}

          {/* 变更历史：折叠时间线，改期 / 取消 / 重发全链路追加不覆盖 */}
          <details className="collapse collapse-arrow mt-3 border border-base-300 bg-base-200">
            <summary className="collapse-title min-h-0 list-none py-2 text-xs font-medium text-base-content/70">
              变更历史（{events.length} 条）
            </summary>
            <div className="collapse-content">
              {events.length ? (
                <ul className="timeline timeline-vertical timeline-compact">
                  {events.map((e, i) => (
                    <li key={`${e.at}-${e.action}-${i}`}>
                      {i > 0 && <hr className="bg-base-300" />}
                      <div className="timeline-start text-[11px] tabular-nums text-base-content/50">{e.at}</div>
                      <div className="timeline-middle">
                        <span className={ACTION_DOT[e.action]} aria-hidden="true" />
                      </div>
                      <div className="timeline-end timeline-box border-base-300 bg-base-100 text-[11px]">
                        <div className="font-medium text-base-content">{ACTION_LABEL[e.action]}</div>
                        {e.from && e.to && (
                          <div className="text-base-content/60">
                            {e.from} → {e.to}
                          </div>
                        )}
                        {!e.from && e.to && <div className="text-base-content/60">时段 {e.to}</div>}
                        {e.reason && <div className="text-base-content/60">原因：{e.reason}</div>}
                        <div className="text-base-content/50">操作人 {e.by}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="pb-2 text-[11px] text-base-content/50">该场次暂无变更记录</p>
              )}
            </div>
          </details>
        </div>
      </div>
    )
  }

  const cellList = monthCells(cursor.y, cursor.m0)

  return (
    <div className="space-y-7">
      {/* 页头：一屏唯一主色按钮留给「发起约面」 */}
      <div className="ws-rise flex flex-col gap-5 border-b border-base-300 pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-base-content">约面管理与通知中心</h1>
            <Chip tone="ghost">
              在排 {live.length} 场 · 已取消 {canceled.length} 场
            </Chip>
          </div>
          <p className="mt-1.5 text-xs text-base-content/60">
            面试安排日历视图 · 飞书日历同步状态可见可重试 · 短信/邮件通知三态与失败队列 · 改期与取消只追加历史、不物理删除场次
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Btn variant="ghost" onClick={() => go('candidates')}>
            前往候选人大池
          </Btn>
          <Btn
            variant="solid"
            onClick={() => {
              setCreateError('')
              setCreateOpen(true)
            }}
          >
            + 发起约面
          </Btn>
        </div>
      </div>

      {/* 统计卡：全部按真实场次聚合，不再写死「全部在线同步 / 确认率 100%」 */}
      <div className="ws-rise stats stats-vertical w-full border border-base-300 bg-base-100 shadow-[var(--shadow-paper)] sm:stats-horizontal [--i:1]">
        <div className="stat">
          <div className="stat-title text-xs text-base-content/60">飞书日历同步</div>
          <div className="stat-value text-2xl tabular-nums">{calSyncedAnim} 场已同步</div>
          <div className="stat-desc whitespace-normal text-[11px] text-base-content/60">
            待同步 {calPending} 场 · 同步失败 {calFailed} 场{calFailed ? '（可重试，沿用原场次不重复建场）' : ''}
          </div>
        </div>
        <div className="stat">
          <div className="stat-title text-xs text-base-content/60">候选人通知确认率</div>
          <div className="stat-value text-2xl tabular-nums">{confirmRateAnim}%</div>
          <div className="stat-desc whitespace-normal text-[11px] text-base-content/60">
            已确认 {noticeConfirmed} / 在排 {live.length} 场 · 已发送待确认 {noticeSent} · 待发送 {noticeWaiting} · 失败{' '}
            {noticeFailed}
          </div>
        </div>
        <div className="stat">
          <div className="stat-title text-xs text-base-content/60">通知失败队列</div>
          <div className={`stat-value text-2xl tabular-nums ${queue.length ? 'text-error' : 'text-success'}`}>
            {queueAnim} 条待处理
          </div>
          <div className="stat-desc whitespace-normal text-[11px] text-base-content/60">
            {queue.length
              ? `最近失败：${queue[0]?.scheduleDetail?.failureReason ?? '通道返回失败'}`
              : '当前没有失败通知，通道状态正常'}
          </div>
        </div>
      </div>

      {/* 日历 + 当日场次 */}
      <div className="ws-rise grid gap-5 lg:grid-cols-12 [--i:2]">
        <div className="lg:col-span-5">
          <Card>
            <div className="card-body gap-4 p-5">
              <div className="flex items-center justify-between">
                <h2 className="card-title text-base">
                  {cursor.y} 年 {cursor.m0 + 1} 月
                </h2>
                <div className="flex items-center gap-1.5">
                  <Btn variant="ghost" className="!h-8 !px-2.5" onClick={() => shiftMonth(-1)} ariaLabel="切换到上一月">
                    上一月
                  </Btn>
                  <Btn variant="ghost" className="!h-8 !px-2.5" onClick={() => shiftMonth(1)} ariaLabel="切换到下一月">
                    下一月
                  </Btn>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 text-xs">
                <Btn variant="ghost" className="!h-7 !px-2.5" onClick={() => shiftWeek(-1)} ariaLabel="查看上一周">
                  上一周
                </Btn>
                <button
                  type="button"
                  onClick={goToday}
                  className="motion-pop cursor-pointer rounded-full bg-base-200 px-3 py-1 font-medium text-base-content hover:bg-base-300"
                >
                  回到今天
                </button>
                <Btn variant="ghost" className="!h-7 !px-2.5" onClick={() => shiftWeek(1)} ariaLabel="查看下一周">
                  下一周
                </Btn>
              </div>

              <p className="text-[11px] text-base-content/50">
                当前选中：{selectedDate} {weekdayCn(selectedDate)}（{relativeDay(selectedDate)}）· 该日在排{' '}
                {selectedStat.live} 场、已取消 {selectedStat.canceled} 场
              </p>

              {/* 日历格子尺寸不动（gap-1 保持原密度，改 gap 会破格） */}
              <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-base-content/50">
                {WEEKDAYS.map((w) => (
                  <div key={w}>{w}</div>
                ))}
              </div>

              <div className="stagger grid grid-cols-7 gap-1">
                {cellList.map((key, i) => {
                  if (!key) {
                    return (
                      <div
                        key={`blank-${i}`}
                        className="aspect-square rounded-lg bg-base-200/60"
                        style={{ '--i': Math.min(i, 7) } as CSSProperties}
                        aria-hidden="true"
                      />
                    )
                  }
                  const stat = dayStats[key] ?? { live: 0, canceled: 0 }
                  const total = stat.live + stat.canceled
                  const isToday = key === demoToday()
                  const isSelected = key === selectedDate
                  const cells: string[] = []
                  if (stat.live) cells.push(`在排 ${stat.live} 场`)
                  if (stat.canceled) cells.push(`已取消 ${stat.canceled} 场`)
                  const countText = cells.length ? cells.join(' · ') : '无面试安排'
                  return (
                    // 荧光青柠落点：选中=实底荧光小块；今天=墨黑格+荧光点/荧光字（只在墨底上用 text-accent）
                    <button
                      key={key}
                      type="button"
                      onClick={() => selectDay(key)}
                      aria-pressed={isSelected}
                      aria-label={`${key} ${weekdayCn(key)}，${
                        total ? `${total} 场面试${stat.canceled ? `（含 ${stat.canceled} 场已取消）` : ''}` : '无面试安排'
                      }`}
                      title={`${key} ${weekdayCn(key)}${isToday ? ' · 今天' : ''} · ${countText}${isSelected ? ' · 当前已选中' : ''}`}
                      style={{ '--i': Math.min(i, 7) } as CSSProperties}
                      className={`motion-pop relative flex aspect-square cursor-pointer flex-col items-center justify-center rounded-lg border pb-2 text-xs active:bg-primary/15 ${
                        isSelected
                          ? 'border-accent bg-accent font-semibold text-accent-content'
                          : isToday
                            ? 'border-primary bg-primary text-primary-content'
                            : 'border-base-300 bg-base-100 text-base-content/70 hover:border-base-content/25 hover:bg-base-200'
                      }`}
                    >
                      <span className={`tabular-nums ${isToday ? (isSelected ? 'font-bold' : 'font-bold text-accent') : ''}`}>
                        {Number(key.slice(8, 10))}
                      </span>
                      {isToday && (
                        <span
                          className={`absolute right-1 top-1 text-[9px] font-bold leading-none ${
                            isSelected ? 'text-accent-content' : 'text-accent'
                          }`}
                        >
                          今
                        </span>
                      )}
                      {isSelected && (
                        <span className="absolute left-1 top-1 text-[9px] font-semibold text-primary" aria-hidden="true">
                          选中
                        </span>
                      )}
                      {total > 0 && (
                        <span className="absolute bottom-0.5 flex items-center gap-0.5" aria-hidden="true">
                          <span className="badge badge-xs badge-soft badge-info tabular-nums">{total}</span>
                          {stat.canceled > 0 && <span className="status status-warning status-xs" />}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              <div className="flex flex-wrap items-center gap-4 border-t border-base-300 pt-3 text-[11px] text-base-content/50">
                <span className="flex items-center gap-1.5">
                  <span className="rounded-sm bg-neutral px-1 text-[9px] font-bold leading-none text-accent" aria-hidden="true">
                    今
                  </span>
                  今天（格内标「今」）
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded bg-accent" aria-hidden="true" />
                  已选中日期
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="badge badge-xs badge-soft badge-info" aria-hidden="true">
                    2
                  </span>
                  当日场次数
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="status status-warning status-xs" aria-hidden="true" />
                  含已取消场次
                </span>
              </div>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-7">
          <Card>
            <div className="card-body gap-4 p-5">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2 className="card-title text-base">{scopeMeta[scope].title}</h2>
                  <p className="text-xs text-base-content/60">{scopeMeta[scope].sub}</p>
                </div>
                <div className="flex items-center gap-1.5" role="group" aria-label="场次视角">
                  {(
                    [
                      ['day', `当日 (${selectedStat.live + selectedStat.canceled})`],
                      ['all', `全部 (${sessions.length})`],
                      ['canceled', `已取消 (${canceled.length})`],
                    ] as [Scope, string][]
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={scope === key}
                      onClick={() => setScope(key)}
                      className={`btn btn-xs rounded-full ${scope === key ? 'btn-neutral' : 'btn-ghost border border-base-300'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs" role="group" aria-label="通知通道筛选">
                <span className="text-base-content/50">通知通道：</span>
                {(
                  [
                    ['all', '全部通道'],
                    ['sms', '第三方短信服务'],
                    ['email', '邮件 SMTP'],
                  ] as ['all' | 'sms' | 'email', string][]
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={filterChannel === key}
                    onClick={() => setFilterChannel(key)}
                    className={`btn btn-xs rounded-full ${
                      filterChannel === key ? 'btn-neutral' : 'btn-ghost border border-base-300'
                    }`}
                  >
                    {label} ({channelCount(key)})
                  </button>
                ))}
              </div>

              <div className="stagger space-y-4">
                {ordered.length ? (
                  ordered.map((item, i) => renderSession(item, i))
                ) : (
                  <Empty
                    title={scope === 'canceled' ? '暂无已取消场次' : '该视角暂无场次'}
                    hint={
                      scope === 'canceled'
                        ? '在场次行内点击「取消」并填写原因后，取消记录会一直保留在这个视角里，不会从列表消失。'
                        : '可切换日期或视角查看，也可以直接发起一场新的约面。'
                    }
                    action={
                      <Btn variant="ghost" onClick={() => setCreateOpen(true)}>
                        + 发起约面
                      </Btn>
                    }
                  />
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* 通知失败队列 */}
      <Card className="ws-rise [--i:3]">
        <div className="card-body gap-4 p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="card-title text-base">通知失败待处理队列</h2>
              <p className="text-xs text-base-content/60">
                通知发送失败即进入队列，重试沿用同一场次与幂等键，不重复创建预约
              </p>
            </div>
            <Chip tone={queue.length ? 'error' : 'success'}>
              {queue.length ? `${queue.length} 条待处理` : '队列为空'}
            </Chip>
          </div>

          {queue.length ? (
            <ul className="stagger space-y-3">
              {queue.map((c, i) => {
                const d = c.scheduleDetail
                if (!d) return null
                const rowBusy = busy?.cid === c.id && busy.kind === 'notice'
                return (
                  <li key={c.id} style={{ '--i': Math.min(i, 7) } as CSSProperties}>
                    <div className="motion-pop flex flex-col gap-3 rounded-xl border border-base-300 bg-base-100 p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 space-y-1.5 text-xs">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="font-semibold text-base-content">{c.name}</span>
                          <span className="text-base-content/60">{c.role}</span>
                          <Chip tone="ghost">{d.interviewId}</Chip>
                          <Chip tone="info">{CHANNEL_LABEL[d.noticeChannel]}</Chip>
                          <span className="text-base-content/50">已尝试 {d.noticeAttempts} 次</span>
                          <span className="text-base-content/50">负责 HR {c.assignee}</span>
                        </div>
                        <div className="text-base-content/60">
                          {d.slot}（{slotLabel(d.slot)}）· 场次状态 {d.status === 'canceled' ? '已取消' : '在排'}
                        </div>
                        {d.failureReason && <div className="text-error">失败原因：{d.failureReason}</div>}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Btn
                          variant="soft"
                          className="!h-8 !px-3"
                          loading={rowBusy}
                          disabled={anyBusy}
                          onClick={() => retryNotice(c.id, false)}
                          ariaLabel={`重试发送 ${c.name} 的约面通知`}
                        >
                          重试
                        </Btn>
                        <Btn
                          variant="ghost"
                          className="!h-8 !px-3"
                          disabled={anyBusy}
                          onClick={() => retryNotice(c.id, true)}
                          ariaLabel={`演示失败分支：强制重试 ${c.name} 的约面通知`}
                        >
                          演示失败
                        </Btn>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : (
            <Empty
              title="暂无失败通知"
              hint="通道正常时队列为空。可在场次行内用「模拟同步失败」或此处的「演示失败」体验异常入队与重试。"
            />
          )}
        </div>
      </Card>

      {/* 发起约面弹窗 */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="发起约面"
        sub="关联候选人、岗位、轮次、面试官、时间与通知通道；同一候选人 + 轮次 + 时段重复提交不会重复建场"
        className="max-w-2xl!"
        footer={
          <>
            <Btn variant="ghost" onClick={() => setCreateOpen(false)} disabled={creating}>
              取消
            </Btn>
            <Btn variant="primary" onClick={submitSchedule} loading={creating} disabled={creating}>
              确认发起约面
            </Btn>
          </>
        }
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="候选人" htmlFor="sched-cid" required className="sm:col-span-2" hint="展示姓名 · 岗位 · 当前阶段">
            <select
              id="sched-cid"
              className="select w-full"
              value={form.cid}
              onChange={(e) => pickCandidate(e.target.value)}
            >
              {STAGES.map((stage) => {
                const list = candidates.filter((c) => c.status === stage)
                if (!list.length) return null
                return (
                  <optgroup key={stage} label={stage}>
                    {list.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} · {c.role} · {c.status}
                      </option>
                    ))}
                  </optgroup>
                )
              })}
            </select>
          </Field>

          <Field label="岗位" htmlFor="sched-pos" hint="来自在招编制，决定默认面试官">
            <select id="sched-pos" className="select w-full" value={form.posId} onChange={(e) => pickPosition(e.target.value)}>
              {positions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.dept}
                </option>
              ))}
            </select>
          </Field>

          <Field label="轮次" htmlFor="sched-round">
            <select
              id="sched-round"
              className="select w-full"
              value={form.round}
              onChange={(e) => setForm((f) => ({ ...f, round: e.target.value }))}
            >
              {ROUNDS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </Field>

          <Field label="面试官" htmlFor="sched-interviewer">
            <input
              id="sched-interviewer"
              className="input w-full"
              value={form.interviewer}
              onChange={(e) => setForm((f) => ({ ...f, interviewer: e.target.value }))}
              placeholder="例如：张工 (前端TL)"
            />
          </Field>

          <Field label="面试时长" htmlFor="sched-duration">
            <select
              id="sched-duration"
              className="select w-full"
              value={form.duration}
              onChange={(e) => setForm((f) => ({ ...f, duration: Number(e.target.value) }))}
            >
              {DURATIONS.map((m) => (
                <option key={m} value={m}>
                  {m} 分钟
                </option>
              ))}
            </select>
          </Field>

          <Field label="面试日期" htmlFor="sched-date" required hint={`演示基准日 ${demoToday()}`}>
            <input
              id="sched-date"
              type="date"
              className="input w-full"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            />
          </Field>

          <Field label="面试时段" htmlFor="sched-time" required hint={`最终时段：${form.date} ${form.time}`}>
            <select
              id="sched-time"
              className="select w-full"
              value={form.time}
              onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
            >
              {TIME_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>

          <Field label="面试方式" htmlFor="sched-online" required>
            <div className="flex items-center gap-5 pt-1.5">
              <label className="flex cursor-pointer items-center gap-3 text-xs text-base-content" htmlFor="sched-online">
                <input
                  id="sched-online"
                  type="radio"
                  name="sched-type"
                  className="radio radio-sm"
                  checked={form.type === 'online'}
                  onChange={() => setForm((f) => ({ ...f, type: 'online' }))}
                />
                线上飞书会议
              </label>
              <label className="flex cursor-pointer items-center gap-3 text-xs text-base-content" htmlFor="sched-offline">
                <input
                  id="sched-offline"
                  type="radio"
                  name="sched-type"
                  className="radio radio-sm"
                  checked={form.type === 'offline'}
                  onChange={() => setForm((f) => ({ ...f, type: 'offline' }))}
                />
                线下现场
              </label>
            </div>
          </Field>

          <Field label="通知通道" htmlFor="sched-sms" required hint="飞书 API 不承担候选人侧短信与邮件发送">
            <div className="flex items-center gap-5 pt-1.5">
              <label className="flex cursor-pointer items-center gap-3 text-xs text-base-content" htmlFor="sched-sms">
                <input
                  id="sched-sms"
                  type="radio"
                  name="sched-channel"
                  className="radio radio-sm"
                  checked={form.channel === 'sms'}
                  onChange={() => setForm((f) => ({ ...f, channel: 'sms' }))}
                />
                第三方短信
              </label>
              <label className="flex cursor-pointer items-center gap-3 text-xs text-base-content" htmlFor="sched-email">
                <input
                  id="sched-email"
                  type="radio"
                  name="sched-channel"
                  className="radio radio-sm"
                  checked={form.channel === 'email'}
                  onChange={() => setForm((f) => ({ ...f, channel: 'email' }))}
                />
                邮件 SMTP
              </label>
            </div>
          </Field>
        </div>

        {createError && (
          <div className="alert alert-soft alert-error mt-4 text-xs" role="alert">
            <span>{createError}</span>
          </div>
        )}

        <p className="mt-3 text-[11px] text-base-content/50">
          提交后场次初始为「飞书日历同步中 + 通知待发送」；同一候选人 + 轮次 + 时段重复提交会命中幂等键、不重复建场；
          若该候选人已有在排场次，新时段按改期链路覆盖并写入变更历史。取消或改期都会重置这两项状态。
        </p>
      </Modal>

      {/* 改期弹窗 */}
      <Modal
        open={!!resched}
        onClose={() => setResched(null)}
        title="调整面试时间（改期）"
        sub="旧时段写入变更历史，飞书日程待重新同步，候选人通知待重发"
        footer={
          <>
            <Btn variant="ghost" onClick={() => setResched(null)} disabled={busy?.kind === 'reschedule'}>
              取消
            </Btn>
            <Btn
              variant="primary"
              onClick={confirmResched}
              loading={busy?.kind === 'reschedule'}
              disabled={busy?.kind === 'reschedule'}
            >
              确认改期
            </Btn>
          </>
        }
      >
        {resched && (
          <div className="space-y-5">
            <div className="rounded-xl border border-base-300 bg-base-200 px-3 py-2 text-xs text-base-content/70">
              现有时段：<span className="font-mono text-base-content">{resched.from}</span>（{slotLabel(resched.from)}）
            </div>

            <Field
              label="新面试时段"
              htmlFor="resched-slot"
              required
              error={reschedError || undefined}
              hint={`格式 YYYY-MM-DD HH:mm，例如 ${demoToday()} 10:00`}
            >
              <input
                id="resched-slot"
                className="input w-full font-mono"
                value={resched.value}
                onChange={(e) => {
                  setResched({ ...resched, value: e.target.value })
                  setReschedError('')
                }}
                placeholder="YYYY-MM-DD HH:mm"
              />
            </Field>

            <Field label="改期原因" htmlFor="resched-reason" hint="原因会写入变更历史，候选人侧将收到新的邀约">
              <input
                id="resched-reason"
                className="input w-full"
                value={resched.reason}
                onChange={(e) => setResched({ ...resched, reason: e.target.value })}
                placeholder="例如：面试官临时出差"
              />
            </Field>
          </div>
        )}
      </Modal>

      {/* 取消弹窗：二次确认 + 原因 + 是否通知候选人 */}
      <Modal
        open={!!canceling}
        onClose={() => setCanceling(null)}
        title="取消面试场次"
        sub="取消是状态流转：场次与历史保留，候选人阶段回落到「待联系」"
        footer={
          <>
            <Btn variant="ghost" onClick={() => setCanceling(null)} disabled={busy?.kind === 'cancel'}>
              暂不取消
            </Btn>
            <Btn variant="danger" onClick={confirmCancel} loading={busy?.kind === 'cancel'} disabled={busy?.kind === 'cancel'}>
              确认取消场次
            </Btn>
          </>
        }
      >
        {canceling && (
          <div className="space-y-5">
            <div className="alert alert-soft alert-warning text-xs" role="alert">
              <div>
                <div className="font-semibold">请确认取消后果</div>
                <ul className="mt-1 list-disc space-y-0.5 pl-4">
                  <li>
                    场次 {canceling.interviewId}（{canceling.slot}）标记为已取消，仍保留在「已取消场次」视角与变更历史中；
                  </li>
                  <li>飞书日程与线上会议链接随取消撤销，不能继续用于面试；</li>
                  <li>候选人 {canceling.name} 的阶段回落到「待联系」，需要重新联系确认意向。</li>
                </ul>
              </div>
            </div>

            <Field
              label="取消原因"
              htmlFor="cancel-reason"
              required
              error={cancelError || undefined}
              hint="取消原因与操作人会写入变更历史，便于后续复盘"
            >
              <textarea
                id="cancel-reason"
                className="textarea w-full"
                rows={3}
                value={canceling.reason}
                onChange={(e) => {
                  setCanceling({ ...canceling, reason: e.target.value })
                  setCancelError('')
                }}
                placeholder="例如：候选人临时时间冲突，需重新协调"
              />
            </Field>

            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-base-300 bg-base-200 px-3 py-2">
              <span className="text-xs font-semibold text-base-content/70">是否同步通知候选人</span>
              <input
                type="checkbox"
                className="toggle toggle-sm"
                checked={canceling.notifyCandidate}
                onChange={(e) => setCanceling({ ...canceling, notifyCandidate: e.target.checked })}
              />
            </label>
            <p className="text-[11px] text-base-content/50">
              关闭后仅在工作台内取消，不向候选人发送取消通知；取消动作不重复创建场次，也不删除历史记录。
            </p>
          </div>
        )}
      </Modal>

      {toast && (
        <div className="toast toast-end z-50">
          <div className={`ws-rise alert alert-soft ${TOAST_ALERT[toast.tone]} max-w-md text-xs`} role="status">
            <span>{toast.text}</span>
          </div>
        </div>
      )}
    </div>
  )
}
