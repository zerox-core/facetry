import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import type { Go } from '../App'
import { Chip } from '../components/Chip'
import { PdfViewer } from '../components/PdfViewer'
import { EmptyState, InterviewStatusChip, OverallBadge, SideTrack, VerdictBadge, field, fmtDT, lab, rise, stageLabels, stageOrder } from '../components/recruit'
import { Select } from '../components/Select'
import { toast } from '../components/Toast'
import { Btn, Card, SectionHead, Spinner } from '../components/ui'
import { loadDocument } from '../pdf'
import type { DocData } from '../pdf'
import { useJob } from '../store'
import type { Candidate, CandidateAttachment, CandidateRow, DirectoryUser, FollowUp, Interview, Match, Offer, Position, Stage } from '../types'

type Detail = { candidate: Candidate; matches: Match[]; followups: FollowUp[]; interviews: Interview[]; offers: Offer[] }

/** 附件预览弹层：PDF / 图片用 PdfViewer 渲染，其余类型提示打开原链接 */
function AttachmentPreview({ att, onClose }: { att: CandidateAttachment; onClose: () => void }) {
  const [doc, setDoc] = useState<DocData | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  useEffect(() => {
    setDoc(null)
    setErr('')
    loadDocument(att.url, '')
      .then(setDoc)
      .catch(() => setErr('该格式暂不支持预览，请打开原文件查看'))
  }, [att])
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
      <div className="absolute inset-0 bg-[#1d2939]/50" onClick={onClose} />
      <div className="login-fade relative flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-[#f4f3ef] shadow-2xl" role="dialog" aria-modal="true">
        <div className="flex items-center justify-between border-b border-slate-200/60 bg-[#fffdf9] px-5 py-3">
          <span className="truncate text-sm font-medium text-slate-900">{att.name}</span>
          <div className="flex items-center gap-3">
            <a href={att.url} target="_blank" rel="noreferrer" className="text-xs font-medium text-blue-600 hover:text-blue-800">
              打开原文件
            </a>
            <button type="button" onClick={onClose} aria-label="关闭" className="cursor-pointer text-slate-400 hover:text-slate-700">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12 M18 6L6 18" /></svg>
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {!doc && !err && (
            <p className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
              <Spinner /> 正在加载附件…
            </p>
          )}
          {err && <p className="py-16 text-center text-sm text-slate-400">{err}</p>}
          {doc && <PdfViewer doc={doc} sections={[]} lines={[]} activeId={null} onToggle={() => {}} hoverId={null} placingFor={null} onPlace={() => {}} onLocate={() => {}} />}
        </div>
      </div>
    </div>
  )
}

/** 岗位匹配卡：AI 初筛结论 + 重新初筛 */
function MatchCard({ match, candidateId, onChanged }: { match: Match; candidateId: string; onChanged: () => void }) {
  const { job, jobError, run } = useJob(onChanged, '初筛完成')
  const [removing, setRemoving] = useState(false)
  const screening = !!job || match.jobState === 'screen'

  const rescreen = () => void run(api.screenMatch(match.id))
  const remove = async () => {
    setRemoving(true)
    try {
      await api.removeMatch(candidateId, match.id)
      toast('已移除岗位关联')
      onChanged()
    } catch (e) {
      toast(e instanceof Error ? e.message : '移除失败，请重试')
    } finally {
      setRemoving(false)
    }
  }

  const pct = Math.max(0, Math.min(100, match.score || 0))
  const barColor = match.verdict === '合适' ? 'bg-emerald-500' : match.verdict === '待定' ? 'bg-amber-400' : match.verdict === '不合适' ? 'bg-red-400' : 'bg-slate-300'
  return (
    <Card className="px-5 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[15px] font-semibold text-slate-900">{match.positionTitle}</span>
        <Chip>JD v{match.jdVersion}</Chip>
        <span className="ml-auto flex items-center gap-3">
          {screening && (
            <span className="flex items-center gap-1.5 text-xs text-amber-600">
              <Spinner /> 初筛中…
            </span>
          )}
          <VerdictBadge verdict={match.verdict} size="lg" />
        </span>
      </div>

      {match.verdict ? (
        <>
          <div className="mt-3 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-sm font-semibold text-slate-900 tabular-nums">{match.score}<span className="text-xs font-normal text-slate-400">/100</span></span>
          </div>
          {match.reason && <p className="mt-2 text-sm text-slate-600">{match.reason}</p>}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-emerald-50/60 px-3 py-2">
              <div className="text-xs font-medium text-emerald-700">命中</div>
              <ul className="mt-1 space-y-0.5 text-xs leading-5 text-slate-600">
                {match.hits.map((h, i) => <li key={i}>· {h}</li>)}
                {!match.hits.length && <li className="text-slate-400">—</li>}
              </ul>
            </div>
            <div className="rounded-lg bg-red-50/60 px-3 py-2">
              <div className="text-xs font-medium text-red-600">缺失</div>
              <ul className="mt-1 space-y-0.5 text-xs leading-5 text-slate-600">
                {match.misses.map((m, i) => <li key={i}>· {m}</li>)}
                {!match.misses.length && <li className="text-slate-400">—</li>}
              </ul>
            </div>
          </div>
          {match.aiSummary && <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-700">{match.aiSummary}</p>}
          {match.concerns.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {match.concerns.map((c, i) => (
                <Chip key={i} tone="amber">{c}</Chip>
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="mt-3 text-sm text-slate-400">尚未初筛{screening ? '，正在进行中' : '，点击右下角按钮发起 AI 初筛'}。</p>
      )}
      {jobError && <p className="mt-2 text-xs text-red-500">{jobError}</p>}

      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
        <span className="text-xs text-slate-400 tabular-nums">{match.screenedAt ? `评估于 ${fmtDT(match.screenedAt)}` : ''}</span>
        <span className="flex items-center gap-3 text-xs font-medium">
          <button type="button" onClick={rescreen} disabled={screening} className="cursor-pointer text-blue-600 hover:text-blue-800 disabled:cursor-not-allowed disabled:opacity-50">
            重新初筛
          </button>
          <button type="button" onClick={() => void remove()} disabled={removing} className="cursor-pointer text-slate-400 hover:text-red-500 disabled:opacity-50">
            移除关联
          </button>
        </span>
      </div>
    </Card>
  )
}

export default function CandidateDetail({ candidateId, go }: { candidateId: string; go: Go }) {
  const [data, setData] = useState<Detail | null>(null)
  const [error, setError] = useState('')
  const [users, setUsers] = useState<DirectoryUser[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [preview, setPreview] = useState<CandidateAttachment | null>(null)
  const [addPositionId, setAddPositionId] = useState('')
  const [adding, setAdding] = useState(false)
  const [fuContent, setFuContent] = useState('')
  const [fuNext, setFuNext] = useState('')
  const [fuSaving, setFuSaving] = useState(false)
  const [nextStep, setNextStep] = useState('')
  const [savingStage, setSavingStage] = useState(false)

  const reload = useCallback(async () => {
    try {
      const d = await api.getCandidate(candidateId)
      setData(d)
      setNextStep(d.candidate.nextStep || '')
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败，请重试')
    }
  }, [candidateId])
  useEffect(() => {
    void reload()
  }, [reload])
  useEffect(() => {
    void api.listUsers().then((r) => setUsers(r.users)).catch(() => {})
    void api.listPositions().then((r) => setPositions(r.positions)).catch(() => {})
  }, [])

  const c = data?.candidate
  const matchedIds = useMemo(() => new Set((data?.matches || []).map((m) => m.positionId)), [data])
  const addable = positions.filter((p) => !matchedIds.has(p.id) && p.status === 'open')

  const patchCandidate = async (patch: { stage?: Stage; ownerId?: string; nextStep?: string }, okMsg: string) => {
    setSavingStage(true)
    try {
      await api.patchCandidate(candidateId, patch)
      toast(okMsg)
      await reload()
    } catch (e) {
      toast(e instanceof Error ? e.message : '保存失败，请重试')
    } finally {
      setSavingStage(false)
    }
  }

  const addMatch = async () => {
    if (!addPositionId) return
    setAdding(true)
    try {
      await api.addMatch(candidateId, addPositionId)
      toast('已关联岗位，AI 初筛已发起')
      setAddPositionId('')
      await reload()
    } catch (e) {
      toast(e instanceof Error ? e.message : '关联失败，请重试')
    } finally {
      setAdding(false)
    }
  }

  const submitFollowUp = async () => {
    if (!fuContent.trim()) {
      toast('先写点跟进内容')
      return
    }
    setFuSaving(true)
    try {
      await api.addFollowUp(candidateId, { content: fuContent.trim(), nextStep: fuNext.trim() || undefined })
      setFuContent('')
      setFuNext('')
      toast('跟进已记录')
      await reload()
    } catch (e) {
      toast(e instanceof Error ? e.message : '提交失败，请重试')
    } finally {
      setFuSaving(false)
    }
  }

  // 预填后跳转：localStorage 暂存，目标页读取后清除
  const prefillAndGo = (kind: 'interview' | 'offer') => {
    if (!c) return
    const row: Partial<CandidateRow> = { id: c.id, name: c.name, currentPosition: c.currentPosition, currentCompany: c.currentCompany, channelName: c.channelName, stage: c.stage }
    localStorage.setItem(`facetry-prefill-${kind}`, JSON.stringify({ candidate: row, positionId: data?.matches[0]?.positionId || '' }))
    go(kind === 'interview' ? 'interviews' : 'offers')
  }

  if (error) {
    return (
      <Card className="px-5 py-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-amber-700">{error}</p>
          <Btn variant="ghost" className="h-8 px-3 text-xs" onClick={() => void reload()}>
            重试
          </Btn>
        </div>
      </Card>
    )
  }
  if (!data || !c) {
    return (
      <Card className="flex items-center justify-center gap-2 py-24 text-sm text-slate-400">
        <Spinner /> 正在加载候选人…
      </Card>
    )
  }

  const years = c.yearsOfExperience >= 0 ? `${c.yearsOfExperience} 年经验` : '年限未知'

  return (
    <div className="space-y-6">
      {/* 顶行：返回 + 操作 */}
      <div className="ws-rise flex items-center justify-between" style={rise(0)}>
        <button type="button" onClick={() => go('back')} className="flex cursor-pointer items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          返回{go.from}
        </button>
        <div className="flex items-center gap-2">
          <Btn variant="ghost" onClick={() => prefillAndGo('offer')}>发起录取申请</Btn>
          <Btn variant="accent" onClick={() => prefillAndGo('interview')}>发起约面</Btn>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* 左栏：档案卡 */}
        <div className="space-y-4">
          <Card className="ws-rise px-5 py-5" style={rise(1)}>
            <h1 className="text-xl font-semibold text-slate-900">{c.name}</h1>
            <p className="mt-1 text-sm text-slate-500">{[c.currentPosition, c.currentCompany].filter(Boolean).join(' @ ') || '岗位信息未识别'}</p>
            {c.summary && <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">{c.summary}</p>}
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex gap-2"><dt className="w-20 shrink-0 text-xs leading-6 text-slate-400">学历专业</dt><dd className="text-slate-700">{[c.education, c.major].filter(Boolean).join(' · ') || '—'}</dd></div>
              <div className="flex gap-2"><dt className="w-20 shrink-0 text-xs leading-6 text-slate-400">工作年限</dt><dd className="text-slate-700">{years}</dd></div>
              <div className="flex gap-2"><dt className="w-20 shrink-0 text-xs leading-6 text-slate-400">期望城市</dt><dd className="text-slate-700">{c.expectedCity || '—'}</dd></div>
              <div className="flex gap-2"><dt className="w-20 shrink-0 text-xs leading-6 text-slate-400">联系方式</dt><dd className="text-slate-700">{[c.phone, c.email].filter(Boolean).join(' / ') || '—'}</dd></div>
              <div className="flex gap-2"><dt className="w-20 shrink-0 text-xs leading-6 text-slate-400">渠道来源</dt><dd><Chip>{c.channelName || c.channel || '—'}</Chip></dd></div>
            </dl>
            {c.skills.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-100 pt-3">
                {c.skills.map((s) => (
                  <Chip key={s} tone="blue">{s}</Chip>
                ))}
              </div>
            )}
            {/* 附件 */}
            <div className="mt-4 border-t border-slate-100 pt-3">
              <div className={lab}>附件</div>
              <ul className="mt-2 space-y-1.5">
                {c.attachments.map((a) => (
                  <li key={a.id} className="flex items-center gap-2 text-sm">
                    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></svg>
                    {a.url ? (
                      <button type="button" onClick={() => setPreview(a)} className="min-w-0 flex-1 cursor-pointer truncate text-left text-blue-600 hover:text-blue-800">
                        {a.name}
                      </button>
                    ) : (
                      <span className="min-w-0 flex-1 truncate text-slate-500">{a.name}</span>
                    )}
                    {a.kind === 'missing' && <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-400">缺失</span>}
                    {a.kind === 'platform' && <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">平台</span>}
                  </li>
                ))}
                {!c.attachments.length && <li className="text-xs text-slate-400">暂无附件</li>}
              </ul>
            </div>
          </Card>

          {/* 阶段步进器 */}
          <Card className="ws-rise px-5 py-4" style={rise(2)}>
            <div className={lab}>阶段{ savingStage ? '（保存中…）' : '' }</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {stageOrder.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={savingStage}
                  onClick={() => s !== c.stage && void patchCandidate({ stage: s }, `已流转到「${stageLabels[s]}」`)}
                  className={`h-7 cursor-pointer rounded-full px-3 text-xs font-medium transition-colors ws-press disabled:cursor-wait ${
                    c.stage === s ? 'bg-[#1d2939] text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {stageLabels[s]}
                </button>
              ))}
            </div>
            <div className="mt-4 space-y-3 border-t border-slate-100 pt-3">
              <label className={`block ${lab}`}>
                负责人
                <Select className="mt-1" size="sm" value={c.ownerId} onChange={(v) => void patchCandidate({ ownerId: v }, '负责人已更新')}
                  options={users.map((u) => ({ value: u.id, label: u.name, hint: u.groupName }))} placeholder="选择负责人" />
              </label>
              <label className={`block ${lab}`}>
                下一步
                <div className="mt-1 flex gap-2">
                  <input value={nextStep} onChange={(e) => setNextStep(e.target.value)} placeholder="例如：电话沟通薪资预期" className={`${field} h-9 py-1.5`} />
                  <Btn variant="ghost" className="h-9 shrink-0 px-3 text-xs" disabled={savingStage || nextStep.trim() === (c.nextStep || '')}
                    onClick={() => void patchCandidate({ nextStep: nextStep.trim() }, '下一步已更新')}>
                    保存
                  </Btn>
                </div>
              </label>
            </div>
          </Card>
        </div>

        {/* 右栏主区 */}
        <div className="min-w-0 space-y-8">
          {/* 岗位匹配 */}
          <section className="ws-rise" style={rise(3)}>
            <SectionHead title="岗位匹配" sub={data.matches.length ? `${data.matches.length} 个关联岗位` : ''} />
            <div className="space-y-3">
              {data.matches.map((m) => (
                <MatchCard key={m.id} match={m} candidateId={candidateId} onChanged={() => void reload()} />
              ))}
              {!data.matches.length && (
                <Card>
                  <EmptyState title="还没有关联岗位" hint="关联岗位后会自动发起 AI 初筛，给出合适度结论" />
                </Card>
              )}
              <Card className="flex flex-wrap items-center gap-2 px-4 py-3">
                <Select className="w-56" size="sm" value={addPositionId} onChange={setAddPositionId} placeholder="选择要关联的岗位…"
                  options={addable.map((p) => ({ value: p.id, label: p.title, hint: p.city }))} />
                <Btn variant="ghost" className="h-8 px-3 text-xs" disabled={!addPositionId || adding} onClick={() => void addMatch()}>
                  {adding ? '关联中…' : '关联岗位'}
                </Btn>
              </Card>
            </div>
          </section>

          {/* 跟进记录 */}
          <section className="ws-rise" style={rise(4)}>
            <SectionHead title="跟进记录" />
            <Card className="px-5 py-4">
              <ol className="space-y-4">
                {data.followups.map((f) => (
                  <li key={f.id} className="flex gap-3">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-200" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2 text-xs text-slate-400">
                        <span className="font-medium text-slate-600">{f.userName}</span>
                        <span className="tabular-nums">{fmtDT(f.createdAt)}</span>
                      </div>
                      <p className="mt-0.5 whitespace-pre-wrap text-sm leading-6 text-slate-700">{f.content}</p>
                      {f.nextStep && <p className="mt-1 text-xs text-slate-400">下一步：{f.nextStep}</p>}
                    </div>
                  </li>
                ))}
                {!data.followups.length && <EmptyState title="还没有跟进记录" hint="第一次电话、微信沟通后记在这里" />}
              </ol>
              <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                <textarea value={fuContent} onChange={(e) => setFuContent(e.target.value)} rows={2} placeholder="记录一次沟通…" className={`resize-none ${field}`} />
                <div className="flex items-center gap-2">
                  <input value={fuNext} onChange={(e) => setFuNext(e.target.value)} placeholder="下一步（可选）" className={`${field} h-9 py-1.5`} />
                  <Btn className="h-9 shrink-0 px-4 text-xs" disabled={fuSaving} onClick={() => void submitFollowUp()}>
                    {fuSaving ? '提交中…' : '提交'}
                  </Btn>
                </div>
              </div>
            </Card>
          </section>

          {/* 面试安排 */}
          <section className="ws-rise" style={rise(5)}>
            <SectionHead title="面试安排" sub={data.interviews.length ? `${data.interviews.length} 场` : ''} />
            <div className="space-y-2">
              {data.interviews.map((iv) => (
                <Card key={iv.id} className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 ws-lift" onClick={() => go('interviews')}>
                  <span className="text-sm font-medium text-slate-900 tabular-nums">{fmtDT(iv.startAt)}</span>
                  <span className="text-sm text-slate-700">{iv.positionTitle} · {iv.round}</span>
                  <span className="text-xs text-slate-400">{iv.mode === 'online' ? '线上' : iv.location || '线下'}</span>
                  <span className="ml-auto"><InterviewStatusChip status={iv.status} /></span>
                </Card>
              ))}
              {!data.interviews.length && (
                <Card>
                  <EmptyState title="还没有面试安排" hint="点右上角「发起约面」安排第一场" />
                </Card>
              )}
            </div>
          </section>

          {/* 录取申请 */}
          <section className="ws-rise" style={rise(6)}>
            <SectionHead title="录取申请" sub={data.offers.length ? `${data.offers.length} 条` : ''} />
            <div className="space-y-2">
              {data.offers.map((o) => (
                <Card key={o.id} className="cursor-pointer px-5 py-4 ws-lift" onClick={() => go('offers')}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-900">{o.positionTitle}</span>
                    <span className="ml-auto"><OverallBadge state={o.overall} /></span>
                  </div>
                  <div className="mt-3 space-y-2">
                    <SideTrack label="飞书审批" state={o.feishu.state} updatedAt={o.feishu.updatedAt} />
                    <SideTrack label="BPM" state={o.bpm.state} updatedAt={o.bpm.updatedAt} />
                  </div>
                </Card>
              ))}
              {!data.offers.length && (
                <Card>
                  <EmptyState title="还没有录取申请" hint="面评通过后，点右上角「发起录取申请」" />
                </Card>
              )}
            </div>
          </section>
        </div>
      </div>

      {preview && <AttachmentPreview att={preview} onClose={() => setPreview(null)} />}
    </div>
  )
}
