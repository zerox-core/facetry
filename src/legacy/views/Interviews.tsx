import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import type { NewInterviewInput } from '../api'
import type { Go } from '../App'
import { ConfirmModal } from '../components/Modal'
import { AvatarStack, CandidatePicker, EmptyState, InterviewStatusChip, NotifyDots, field, fmtDT, fmtHM, fmtMD, lab, rise, weekdayLabels } from '../components/recruit'
import { ScoreDots } from '../components/ScoreDots'
import { Select } from '../components/Select'
import { toast } from '../components/Toast'
import { Btn, Card, SectionHead, Spinner } from '../components/ui'
import { useJob } from '../store'
import type { CandidateRow, DirectoryUser, Interview, Position } from '../types'

const roundOptions = ['一面', '二面', '三面', 'HR 面', '自定义']
const dims = ['岗位专业', '通用能力', '文化契合']

const mondayOf = (d: Date) => {
  const t = new Date(d)
  t.setDate(t.getDate() - ((t.getDay() + 6) % 7))
  t.setHours(0, 0, 0, 0)
  return t
}
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
/** datetime-local 值 → ISO；空串返回 '' */
const localToIso = (v: string) => (v ? new Date(v).toISOString() : '')
const isoToLocal = (iso: string) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

/** 发起约面弹窗：候选人搜索 → 岗位随 matches 过滤 → 时间与面试官 → 通知方式；幂等提交 */
function NewInterviewModal({
  prefill,
  positions,
  users,
  onClose,
  onCreated,
}: {
  prefill: { candidate: CandidateRow | null; positionId: string } | null
  positions: Position[]
  users: DirectoryUser[]
  onClose: () => void
  onCreated: (iv: Interview) => void
}) {
  const [candidate, setCandidate] = useState<CandidateRow | null>(prefill?.candidate ?? null)
  const [positionId, setPositionId] = useState(prefill?.positionId || '')
  const [round, setRound] = useState('一面')
  const [customRound, setCustomRound] = useState('')
  const [mode, setMode] = useState<'online' | 'offline'>('online')
  const [startAt, setStartAt] = useState('')
  const [duration, setDuration] = useState('60')
  const [location, setLocation] = useState('')
  const [interviewerIds, setInterviewerIds] = useState<string[]>([])
  const [notifyEmail, setNotifyEmail] = useState(prefill?.candidate?.email || '')
  const [notifySms, setNotifySms] = useState(prefill?.candidate?.phone || '')
  const [submitting, setSubmitting] = useState(false)
  const [idemKey] = useState(() => crypto.randomUUID())

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // 岗位随候选人 matches 过滤；候选人无 matches 信息时显示全部在招岗位
  const positionOptions = useMemo(() => {
    const matched = candidate?.matches?.length ? positions.filter((p) => candidate.matches!.some((m) => m.positionId === p.id)) : null
    return (matched && matched.length ? matched : positions.filter((p) => p.status === 'open')).map((p) => ({ value: p.id, label: p.title, hint: p.city }))
  }, [candidate, positions])

  const pickCandidate = (c: CandidateRow | null) => {
    setCandidate(c)
    setPositionId(c?.matches?.[0]?.positionId || '')
    if (c) {
      setNotifyEmail(c.email || '')
      setNotifySms(c.phone || '')
    }
  }

  const toggleInterviewer = (id: string) => setInterviewerIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  const submit = async () => {
    if (!candidate) return toast('请选择候选人')
    if (!positionId) return toast('请选择岗位')
    if (!startAt) return toast('请选择开始时间')
    const start = new Date(startAt)
    const end = new Date(start.getTime() + (parseInt(duration, 10) || 60) * 60000)
    const body: NewInterviewInput = {
      candidateId: candidate.id,
      positionId,
      round: round === '自定义' ? customRound.trim() || '自定义' : round,
      mode,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      location: location.trim(),
      interviewerIds,
      notifyEmail: notifyEmail.trim(),
      notifySms: notifySms.trim(),
      idempotencyKey: idemKey,
    }
    setSubmitting(true)
    try {
      const iv = await api.createInterview(body)
      toast('面试已安排，通知发送中')
      onCreated(iv)
      onClose()
    } catch (e) {
      toast(e instanceof Error ? e.message : '创建失败，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-[#1d2939]/50" onClick={onClose} />
      <div className="ws-paper login-fade relative max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-xl p-5" role="dialog" aria-modal="true">
        <h3 className="text-base font-semibold text-slate-900">发起约面</h3>
        <p className="mt-1 text-xs text-slate-400">创建后自动建立飞书日程与会议链接，并通知候选人</p>
        <div className="mt-4 space-y-3">
          <div>
            <div className={lab}>候选人</div>
            <div className="mt-1">
              <CandidatePicker value={candidate} onPick={pickCandidate} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={`block ${lab}`}>
              岗位
              <Select className="mt-1" value={positionId} onChange={setPositionId} options={positionOptions} placeholder={candidate ? '选择岗位' : '先选候选人'} />
            </label>
            <label className={`block ${lab}`}>
              轮次
              <Select className="mt-1" value={round} onChange={setRound} options={roundOptions.map((r) => ({ value: r, label: r }))} />
            </label>
          </div>
          {round === '自定义' && (
            <label className={`block ${lab}`}>
              自定义轮次名称
              <input value={customRound} onChange={(e) => setCustomRound(e.target.value)} placeholder="例如：总监面" className={`mt-1 ${field}`} />
            </label>
          )}
          <div>
            <div className={lab}>方式</div>
            <div className="mt-1 flex gap-1.5">
              {(['online', 'offline'] as const).map((m) => (
                <button key={m} type="button" onClick={() => setMode(m)}
                  className={`h-8 cursor-pointer rounded-lg px-3 text-xs font-medium transition-colors ws-press ${mode === m ? 'bg-[#1d2939] text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>
                  {m === 'online' ? '线上（飞书会议）' : '线下'}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={`block ${lab}`}>
              开始时间
              <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} className={`mt-1 ${field}`} />
            </label>
            <label className={`block ${lab}`}>
              时长
              <Select className="mt-1" value={duration} onChange={setDuration}
                options={['30', '45', '60', '90', '120'].map((m) => ({ value: m, label: `${m} 分钟` }))} />
            </label>
          </div>
          <label className={`block ${lab}`}>
            {mode === 'online' ? '说明（可选）' : '地点 / 说明'}
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder={mode === 'online' ? '会议链接将由飞书自动生成' : '例如：珠海办公室 3F 会议室'} className={`mt-1 ${field}`} />
          </label>
          <div>
            <div className={lab}>面试官（可多选）</div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {users.map((u) => {
                const on = interviewerIds.includes(u.id)
                return (
                  <button key={u.id} type="button" onClick={() => toggleInterviewer(u.id)}
                    className={`flex h-8 cursor-pointer items-center gap-1.5 rounded-full pl-1 pr-3 text-xs font-medium transition-colors ws-press ${on ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>
                    {u.avatar ? (
                      <img src={u.avatar} alt={u.name} referrerPolicy="no-referrer" className="h-6 w-6 rounded-full object-cover" />
                    ) : (
                      <span className={`grid h-6 w-6 place-items-center rounded-full text-[10px] ${on ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-600'}`}>{u.name[0]}</span>
                    )}
                    {u.name}
                  </button>
                )
              })}
              {!users.length && <span className="text-xs text-slate-400">用户目录加载中或为空</span>}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={`block ${lab}`}>
              候选人邮箱（通知用）
              <input value={notifyEmail} onChange={(e) => setNotifyEmail(e.target.value)} placeholder="name@example.com" className={`mt-1 ${field}`} />
            </label>
            <label className={`block ${lab}`}>
              候选人手机（通知用）
              <input value={notifySms} onChange={(e) => setNotifySms(e.target.value)} placeholder="可选" className={`mt-1 ${field}`} />
            </label>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Btn variant="ghost" onClick={onClose}>取消</Btn>
          <Btn variant="accent" onClick={() => void submit()} disabled={submitting}>{submitting ? '提交中…' : '确认约面'}</Btn>
        </div>
      </div>
    </div>
  )
}

/** 改期弹窗 */
function RescheduleModal({ interview, onClose, onDone }: { interview: Interview; onClose: () => void; onDone: (iv: Interview) => void }) {
  const [startAt, setStartAt] = useState(isoToLocal(interview.startAt))
  const [endAt, setEndAt] = useState(isoToLocal(interview.endAt))
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  const submit = async () => {
    if (!startAt || !endAt) return toast('请选择起止时间')
    setSaving(true)
    try {
      const iv = await api.patchInterview(interview.id, { action: 'reschedule', startAt: localToIso(startAt), endAt: localToIso(endAt), reason: reason.trim() || undefined })
      toast('已改期，飞书日程同步更新')
      onDone(iv)
      onClose()
    } catch (e) {
      toast(e instanceof Error ? e.message : '改期失败，请重试')
    } finally {
      setSaving(false)
    }
  }
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-[#1d2939]/50" onClick={onClose} />
      <div className="ws-paper login-fade relative w-full max-w-md rounded-xl p-5" role="dialog" aria-modal="true">
        <h3 className="text-base font-semibold text-slate-900">改期</h3>
        <div className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={`block ${lab}`}>
              开始时间
              <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} className={`mt-1 ${field}`} />
            </label>
            <label className={`block ${lab}`}>
              结束时间
              <input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} className={`mt-1 ${field}`} />
            </label>
          </div>
          <label className={`block ${lab}`}>
            改期原因（可选）
            <input value={reason} onChange={(e) => setReason(e.target.value)} className={`mt-1 ${field}`} />
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Btn variant="ghost" onClick={onClose}>取消</Btn>
          <Btn onClick={() => void submit()} disabled={saving}>{saving ? '保存中…' : '确认改期'}</Btn>
        </div>
      </div>
    </div>
  )
}

/** 面评区：completed 后可填；AI 草稿可编辑后确认 */
function FeedbackPanel({ interview, onChanged, onRefresh }: { interview: Interview; onChanged: (iv: Interview) => void; onRefresh: () => void }) {
  const fb = interview.feedback
  const [scores, setScores] = useState<Record<string, number | null>>(() => {
    const m: Record<string, number | null> = {}
    for (const d of dims) m[d] = fb?.scores.find((s) => s.dimension === d)?.score ?? null
    return m
  })
  const [note, setNote] = useState(fb?.note || '')
  const [conclusion, setConclusion] = useState(fb?.conclusion || '')
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const { job, run } = useJob(async () => {
    // 草稿任务完成后重新拉取，拿到 aiDraft
    onRefresh()
    toast('AI 草稿已生成，请修改后确认')
  })

  // interview 变化（AI 草稿落库）时同步本地
  useEffect(() => {
    const f = interview.feedback
    if (!f) return
    if (f.aiDraft && !f.confirmedAt && !note) setNote(f.aiDraft)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interview.feedback?.aiDraft])

  if (interview.status !== 'completed') {
    return (
      <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-500">
        面试结束后才能填写面评。
        {interview.status !== 'canceled' && (
          <button
            type="button"
            className="ml-2 cursor-pointer font-medium text-blue-600 hover:text-blue-800"
            onClick={() =>
              void api
                .patchInterview(interview.id, { action: 'complete' })
                .then((iv) => { toast('已标记为完成，可以填写面评了'); onChanged(iv) })
                .catch((e) => toast(e instanceof Error ? e.message : '操作失败'))
            }
          >
            标记已完成
          </button>
        )}
      </div>
    )
  }

  const confirmed = !!fb?.confirmedAt
  const scoreList = () => dims.flatMap((d) => (scores[d] ? [{ dimension: d, score: scores[d]! }] : []))

  const saveDraft = async () => {
    setSaving(true)
    try {
      await api.saveFeedback(interview.id, { scores: scoreList(), note: note.trim(), conclusion })
      toast('草稿已保存')
    } catch (e) {
      toast(e instanceof Error ? e.message : '保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }
  const confirm = async () => {
    if (!conclusion) return toast('请先选择结论')
    setConfirming(true)
    try {
      const f = await api.confirmFeedback(interview.id, { scores: scoreList(), note: note.trim(), conclusion })
      toast('面评已确认')
      onChanged({ ...interview, feedback: f })
    } catch (e) {
      toast(e instanceof Error ? e.message : '确认失败，请重试')
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div className="space-y-3">
      {confirmed && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          面评已确认{fb?.interviewerName ? ` · ${fb.interviewerName}` : ''} · {fmtDT(fb!.confirmedAt)}，结论：{fb?.conclusion || '—'}
        </p>
      )}
      <div className="space-y-2">
        {dims.map((d) => (
          <div key={d} className="flex items-center gap-3">
            <span className="w-16 shrink-0 text-xs text-slate-500">{d}</span>
            <ScoreDots size="sm" value={scores[d] ?? null} readonly={confirmed} onChange={(n) => setScores((s) => ({ ...s, [d]: n }))} />
          </div>
        ))}
      </div>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} readOnly={confirmed}
        placeholder="评价备注；也可以先填评分，再用 AI 辅助生成草稿后修改"
        className={`${field} ${confirmed ? 'bg-slate-50 text-slate-500' : ''}`} />
      <div className="flex flex-wrap items-center gap-2">
        <Select className="w-32" size="sm" value={conclusion} onChange={(v) => setConclusion(v as typeof conclusion)} placeholder="结论"
          options={['通过', '待定', '不通过'].map((c) => ({ value: c, label: c }))} />
        <Btn variant="ghost" className="h-8 px-3 text-xs" disabled={saving || confirmed} onClick={() => void saveDraft()}>
          {saving ? '保存中…' : '保存草稿'}
        </Btn>
        <Btn variant="ghost" className="h-8 px-3 text-xs" disabled={!!job || confirmed} onClick={() => void run(api.aiDraftFeedback(interview.id))}>
          {job ? 'AI 生成中…' : 'AI 辅助生成草稿'}
        </Btn>
        {!confirmed && (
          <Btn className="h-8 px-3 text-xs" disabled={confirming} onClick={() => void confirm()}>
            {confirming ? '确认中…' : '确认面评'}
          </Btn>
        )}
      </div>
    </div>
  )
}

/** 面试详情抽屉：完整信息 + 历史 + 面评 + 面试助手关联 */
function InterviewDrawer({ interview, users, go, onClose, onChanged, onRefresh }: { interview: Interview; users: DirectoryUser[]; go: Go; onClose: () => void; onChanged: (iv: Interview) => void; onRefresh: () => void }) {
  const [rescheduling, setRescheduling] = useState(false)
  const [canceling, setCanceling] = useState(false)
  const [cancelBusy, setCancelBusy] = useState(false)
  const [linking, setLinking] = useState(false)
  const [sessionId, setSessionId] = useState(interview.feedback?.sessionId || '')
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const doCancel = async () => {
    setCancelBusy(true)
    try {
      const iv = await api.patchInterview(interview.id, { action: 'cancel' })
      toast('面试已取消')
      onChanged(iv)
      setCanceling(false)
    } catch (e) {
      toast(e instanceof Error ? e.message : '取消失败，请重试')
    } finally {
      setCancelBusy(false)
    }
  }
  const resend = async (channel: 'email' | 'sms') => {
    try {
      const iv = await api.resendInterview(interview.id, channel)
      toast(channel === 'email' ? '邮件已重发' : '短信已重发')
      onChanged(iv)
    } catch (e) {
      toast(e instanceof Error ? e.message : '重发失败，请重试')
    }
  }
  const linkSession = async () => {
    if (!sessionId.trim()) return toast('请输入评审会话 ID')
    setLinking(true)
    try {
      const iv = await api.linkInterviewSession(interview.id, sessionId.trim())
      toast('已关联面试助手会话')
      onChanged(iv)
      go('review', sessionId.trim())
    } catch (e) {
      toast(e instanceof Error ? e.message : '关联失败，请重试')
    } finally {
      setLinking(false)
    }
  }

  const interviewerNames = interview.interviewers.map((i) => users.find((u) => u.id === i.id) || i)

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-[#1d2939]/50" onClick={onClose} />
      <div className="login-fade relative flex h-full w-full max-w-xl flex-col bg-white shadow-2xl" role="dialog" aria-modal="true">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-slate-900">{interview.candidateName}</h3>
              <InterviewStatusChip status={interview.status} />
            </div>
            <p className="mt-0.5 text-xs text-slate-400">
              {interview.positionTitle} · {interview.round} · {fmtDT(interview.startAt)}–{fmtHM(interview.endAt)}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭" className="cursor-pointer text-slate-400 hover:text-slate-700">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12 M18 6L6 18" /></svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-4">
          {/* 基本信息 */}
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-xs text-slate-400">方式</span>
              {interview.mode === 'online' ? (
                interview.meetingUrl ? (
                  <a href={interview.meetingUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-blue-600 hover:text-blue-800">
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M15 10l4.55-2.28A1 1 0 0 1 21 8.62v6.76a1 1 0 0 1-1.45.9L15 14" /><rect x="3" y="6" width="12" height="12" rx="2" /></svg>
                    飞书会议链接
                  </a>
                ) : (
                  <span className="text-slate-500">线上（会议链接生成中）</span>
                )
              ) : (
                <span className="text-slate-700">{interview.location || '线下'}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-xs text-slate-400">面试官</span>
              <AvatarStack users={interviewerNames} />
              <span className="text-xs text-slate-500">{interview.interviewers.map((i) => i.name).join('、') || '—'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-xs text-slate-400">通知</span>
              <NotifyDots notify={interview.notify} />
              {(interview.notify.email.state === 'failed' || interview.notify.sms.state === 'failed') && (
                <span className="flex gap-2 text-xs font-medium">
                  {interview.notify.email.state === 'failed' && (
                    <button type="button" className="cursor-pointer text-blue-600 hover:text-blue-800" onClick={() => void resend('email')}>重发邮件</button>
                  )}
                  {interview.notify.sms.state === 'failed' && (
                    <button type="button" className="cursor-pointer text-blue-600 hover:text-blue-800" onClick={() => void resend('sms')}>重发短信</button>
                  )}
                </span>
              )}
            </div>
            {interview.location && interview.mode === 'online' && (
              <div className="flex items-center gap-2">
                <span className="w-16 shrink-0 text-xs text-slate-400">说明</span>
                <span className="text-slate-700">{interview.location}</span>
              </div>
            )}
          </div>

          {/* 操作 */}
          {interview.status !== 'canceled' && (
            <div className="flex flex-wrap gap-2">
              <Btn variant="ghost" className="h-8 px-3 text-xs" onClick={() => setRescheduling(true)}>改期</Btn>
              <Btn variant="ghost" className="h-8 px-3 text-xs" onClick={() => setCanceling(true)}>取消面试</Btn>
            </div>
          )}

          {/* 面评 */}
          <div>
            <div className="mb-2 text-sm font-medium text-slate-900">面试评价</div>
            <FeedbackPanel interview={interview} onChanged={onChanged} onRefresh={onRefresh} />
          </div>

          {/* 面试助手 */}
          <div>
            <div className="mb-2 text-sm font-medium text-slate-900">面试助手</div>
            {interview.feedback?.sessionId ? (
              <Btn variant="ghost" className="h-8 px-3 text-xs" onClick={() => go('review', interview.feedback!.sessionId)}>打开面试助手</Btn>
            ) : (
              <div className="flex gap-2">
                <input value={sessionId} onChange={(e) => setSessionId(e.target.value)} placeholder="粘贴评审会话 ID" className={`${field} h-9 py-1.5`} />
                <Btn variant="ghost" className="h-9 shrink-0 px-3 text-xs" disabled={linking} onClick={() => void linkSession()}>
                  {linking ? '关联中…' : '关联并打开'}
                </Btn>
              </div>
            )}
          </div>

          {/* 历史 */}
          <div>
            <div className="mb-2 text-sm font-medium text-slate-900">历史</div>
            <ol className="space-y-3">
              {[...interview.history].reverse().map((h, i) => (
                <li key={i} className="flex gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-200" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2 text-xs text-slate-400">
                      <span className="font-medium text-slate-600">{h.action}</span>
                      <span>{h.by}</span>
                      <span className="tabular-nums">{fmtDT(h.at)}</span>
                    </div>
                    {h.detail && <p className="mt-0.5 text-xs leading-5 text-slate-500">{h.detail}</p>}
                  </div>
                </li>
              ))}
              {!interview.history.length && <p className="text-xs text-slate-400">暂无历史记录</p>}
            </ol>
          </div>
        </div>
      </div>

      {rescheduling && <RescheduleModal interview={interview} onClose={() => setRescheduling(false)} onDone={onChanged} />}
      <ConfirmModal
        open={canceling}
        title="取消这场面试？"
        body="将同步取消飞书日程并通知面试官，历史中会保留记录。"
        confirmLabel={cancelBusy ? '取消中…' : '确认取消'}
        danger
        onConfirm={() => void doCancel()}
        onCancel={() => setCanceling(false)}
      />
    </div>
  )
}

export default function Interviews({ go }: { go: Go }) {
  const [interviews, setInterviews] = useState<Interview[] | null>(null)
  const [error, setError] = useState('')
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()))
  const [creating, setCreating] = useState(false)
  const [prefill, setPrefill] = useState<{ candidate: CandidateRow | null; positionId: string } | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [positions, setPositions] = useState<Position[]>([])
  const [users, setUsers] = useState<DirectoryUser[]>([])

  const reload = useCallback(async () => {
    try {
      const r = await api.listInterviews()
      setInterviews(r.interviews)
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败，请重试')
    }
  }, [])
  useEffect(() => {
    void reload()
    void api.listPositions().then((r) => setPositions(r.positions)).catch(() => {})
    void api.listUsers().then((r) => setUsers(r.users)).catch(() => {})
    // 候选人详情页「发起约面」的预填
    const raw = localStorage.getItem('facetry-prefill-interview')
    if (raw) {
      localStorage.removeItem('facetry-prefill-interview')
      try {
        setPrefill(JSON.parse(raw) as { candidate: CandidateRow | null; positionId: string })
        setCreating(true)
      } catch { /* 忽略坏数据 */ }
    }
  }, [reload])

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d
  }), [weekStart])

  const byDay = useMemo(() => {
    const m = new Map<string, Interview[]>()
    for (const iv of interviews || []) {
      const key = iv.startAt.slice(0, 10)
      const arr = m.get(key) || []
      arr.push(iv)
      m.set(key, arr)
    }
    for (const arr of m.values()) arr.sort((a, b) => a.startAt.localeCompare(b.startAt))
    return m
  }, [interviews])

  const sorted = useMemo(() => [...(interviews || [])].sort((a, b) => b.startAt.localeCompare(a.startAt)), [interviews])
  const active = activeId ? (interviews || []).find((i) => i.id === activeId) || null : null

  const shiftWeek = (n: number) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + n * 7)
    setWeekStart(d)
  }
  const upsert = (iv: Interview) => setInterviews((s) => (s ? (s.some((x) => x.id === iv.id) ? s.map((x) => (x.id === iv.id ? iv : x)) : [iv, ...s]) : s))

  const todayKey = dayKey(new Date())

  return (
    <div className="space-y-8">
      <div className="ws-rise flex items-end justify-between" style={rise(0)}>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">约面</h1>
          <p className="mt-1 text-sm text-slate-500">
            面试安排与飞书日程联动，候选人通过邮件 / 短信通知。
            {/* 面试官工具入口：面试助手与题库只在面试场景出现，不占主导航 */}
            <button onClick={() => go('assist')} className="ml-3 cursor-pointer text-slate-400 underline decoration-slate-200 underline-offset-4 transition-colors hover:text-slate-600">
              面试官工具 · 面试助手与题库 →
            </button>
          </p>
        </div>
        <Btn variant="accent" onClick={() => { setPrefill(null); setCreating(true) }} disabled={!interviews}>
          + 发起约面
        </Btn>
      </div>

      {error && (
        <Card className="ws-rise px-5 py-4" style={rise(1)}>
          <div className="flex items-center justify-between">
            <p className="text-sm text-amber-700">{error}</p>
            <Btn variant="ghost" className="h-8 px-3 text-xs" onClick={() => void reload()}>重试</Btn>
          </div>
        </Card>
      )}

      {/* 本周日历 */}
      <Card className="ws-rise overflow-hidden" style={rise(1)}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <span className="text-sm font-medium text-slate-900">
            {fmtMD(weekDays[0].toISOString())} – {fmtMD(weekDays[6].toISOString())}
          </span>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => shiftWeek(-1)} aria-label="上一周" className="grid h-7 w-7 cursor-pointer place-items-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-700">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            <button type="button" onClick={() => setWeekStart(mondayOf(new Date()))} className="h-7 cursor-pointer rounded-lg px-2 text-xs text-slate-500 hover:bg-slate-50">
              本周
            </button>
            <button type="button" onClick={() => shiftWeek(1)} aria-label="下一周" className="grid h-7 w-7 cursor-pointer place-items-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-700">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 divide-x divide-slate-100 overflow-x-auto">
          {weekDays.map((d) => {
            const key = dayKey(d)
            const list = byDay.get(key) || []
            const isToday = key === todayKey
            return (
              <div key={key} className={`min-w-28 px-2 py-3 ${isToday ? 'bg-blue-50/40' : ''}`}>
                <div className={`mb-2 text-center text-xs ${isToday ? 'font-semibold text-blue-700' : 'text-slate-400'}`}>
                  {weekdayLabels[d.getDay()]} <span className="tabular-nums">{d.getDate()}</span>
                </div>
                <div className="space-y-1.5">
                  {list.map((iv) => (
                    <button
                      key={iv.id}
                      type="button"
                      onClick={() => setActiveId(iv.id)}
                      className={`block w-full cursor-pointer rounded-lg px-2 py-1.5 text-left transition-colors ws-press ${
                        iv.status === 'canceled' ? 'bg-slate-50 opacity-50' : 'bg-white shadow-[0_0_0_1px_rgb(15_23_42/0.08)] hover:shadow-[var(--shadow-lift)]'
                      }`}
                    >
                      <span className="block text-xs font-medium text-slate-900 tabular-nums">{fmtHM(iv.startAt)}</span>
                      <span className="block truncate text-xs text-slate-600">{iv.candidateName}</span>
                      <span className="block truncate text-[10px] text-slate-400">{iv.round}</span>
                    </button>
                  ))}
                  {!list.length && <div className="py-3 text-center text-[10px] text-slate-300">—</div>}
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {/* 全部面试列表 */}
      <section className="ws-rise" style={rise(2)}>
        <SectionHead title="全部面试" sub={interviews ? `共 ${interviews.length} 场` : ''} />
        <Card className="overflow-hidden">
          {!interviews && !error && (
            <p className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
              <Spinner /> 正在加载…
            </p>
          )}
          {interviews && !sorted.length && (
            <EmptyState
              title="还没有面试安排"
              hint="点右上角「发起约面」，为候选人安排第一场面试"
              action={<Btn variant="ghost" onClick={() => { setPrefill(null); setCreating(true) }}>发起约面</Btn>}
            />
          )}
          {interviews && sorted.length > 0 && (
            <ul className="divide-y divide-slate-100">
              {sorted.map((iv) => (
                <li key={iv.id} onClick={() => setActiveId(iv.id)} className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-3.5 transition-colors hover:bg-slate-50">
                  <span className="w-32 shrink-0 text-sm font-medium text-slate-900 tabular-nums">{fmtDT(iv.startAt)}</span>
                  <span className="min-w-0">
                    <span className="text-sm font-medium text-slate-900">{iv.candidateName}</span>
                    <span className="ml-2 text-xs text-slate-400">{iv.positionTitle} · {iv.round}</span>
                  </span>
                  <span className="flex items-center gap-1 text-xs text-slate-500">
                    {iv.mode === 'online' ? (
                      <>
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M15 10l4.55-2.28A1 1 0 0 1 21 8.62v6.76a1 1 0 0 1-1.45.9L15 14" /><rect x="3" y="6" width="12" height="12" rx="2" /></svg>
                        线上
                      </>
                    ) : (
                      <>
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s7-5.1 7-11a7 7 0 1 0-14 0c0 5.9 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>
                        {iv.location || '线下'}
                      </>
                    )}
                  </span>
                  <AvatarStack users={iv.interviewers} size="sm" />
                  <span className="ml-auto flex items-center gap-3">
                    <NotifyDots notify={iv.notify} />
                    <InterviewStatusChip status={iv.status} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      {creating && (
        <NewInterviewModal
          prefill={prefill}
          positions={positions}
          users={users}
          onClose={() => { setCreating(false); setPrefill(null) }}
          onCreated={upsert}
        />
      )}
      {active && <InterviewDrawer interview={active} users={users} go={go} onClose={() => setActiveId(null)} onChanged={upsert} onRefresh={() => void reload()} />}
    </div>
  )
}
