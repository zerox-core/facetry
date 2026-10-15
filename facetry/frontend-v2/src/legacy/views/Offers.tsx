import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import { ConfirmModal } from '../components/Modal'
import { CandidatePicker, EmptyState, OverallBadge, SideTrack, field, fmtDT, lab, rise, sideStateLabels, stageLabels } from '../components/recruit'
import { Select } from '../components/Select'
import { toast } from '../components/Toast'
import { Btn, Card, Spinner } from '../components/ui'
import type { CandidateRow, Offer, Position, SideState } from '../types'

const defaultMaterials = ['简历原件', '学历证明', '背调授权', '薪资证明']

/** 发起录取申请弹窗：候选人 + 岗位 + 材料核对清单 + 备注；幂等提交 */
function NewOfferModal({
  prefill,
  positions,
  onClose,
  onCreated,
}: {
  prefill: { candidate: CandidateRow | null; positionId: string } | null
  positions: Position[]
  onClose: () => void
  onCreated: (o: Offer) => void
}) {
  const [candidate, setCandidate] = useState<CandidateRow | null>(prefill?.candidate ?? null)
  const [positionId, setPositionId] = useState(prefill?.positionId || '')
  const [materials, setMaterials] = useState<{ name: string; ok: boolean }[]>(defaultMaterials.map((name) => ({ name, ok: false })))
  const [newMaterial, setNewMaterial] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [idemKey] = useState(() => crypto.randomUUID())

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const positionOptions = useMemo(() => {
    const matched = candidate?.matches?.length ? positions.filter((p) => candidate.matches!.some((m) => m.positionId === p.id)) : null
    return (matched && matched.length ? matched : positions).map((p) => ({ value: p.id, label: p.title, hint: p.city }))
  }, [candidate, positions])

  const notReady = candidate && candidate.stage !== 'offer'

  const submit = async () => {
    if (!candidate) return toast('请选择候选人')
    if (!positionId) return toast('请选择岗位')
    setSubmitting(true)
    try {
      const o = await api.createOffer({
        candidateId: candidate.id,
        positionId,
        note: note.trim() || undefined,
        materials: materials.filter((m) => m.name.trim()),
        idempotencyKey: idemKey,
      })
      toast('录取申请已发起，双轨审批推进中')
      onCreated(o)
      onClose()
    } catch (e) {
      // 409：已有进行中的申请（幂等键冲突）
      toast(e instanceof Error ? e.message : '发起失败，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-[#1d2939]/50" onClick={onClose} />
      <div className="ws-paper login-fade relative max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-xl p-5" role="dialog" aria-modal="true">
        <h3 className="text-base font-semibold text-slate-900">发起录取申请</h3>
        <p className="mt-1 text-xs text-slate-400">发起后将同时创建飞书审批实例与 BPM 流程，进度可在列表跟踪</p>
        <div className="mt-4 space-y-3">
          <div>
            <div className={lab}>候选人</div>
            <div className="mt-1">
              <CandidatePicker value={candidate} onPick={(c) => { setCandidate(c); setPositionId(c?.matches?.[0]?.positionId || '') }} />
            </div>
            {notReady && (
              <p className="mt-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700">
                该候选人当前处于「{stageLabels[candidate.stage]}」阶段，建议在面评通过、进入「待录取」后再发起；请确认业务已审批通过。
              </p>
            )}
          </div>
          <label className={`block ${lab}`}>
            岗位
            <Select className="mt-1" value={positionId} onChange={setPositionId} options={positionOptions} placeholder={candidate ? '选择岗位' : '先选候选人'} />
          </label>
          <div>
            <div className={lab}>申请材料核对</div>
            <ul className="mt-1.5 space-y-1">
              {materials.map((m, i) => (
                <li key={i} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-1.5">
                  <input
                    type="checkbox"
                    checked={m.ok}
                    onChange={(e) => setMaterials((ms) => ms.map((x, j) => (j === i ? { ...x, ok: e.target.checked } : x)))}
                    className="accent-blue-600"
                  />
                  <span className={`min-w-0 flex-1 text-sm ${m.ok ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{m.name}</span>
                  <button type="button" aria-label="移除" onClick={() => setMaterials((ms) => ms.filter((_, j) => j !== i))} className="cursor-pointer text-slate-300 hover:text-red-500">
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12 M18 6L6 18" /></svg>
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-1.5 flex gap-2">
              <input value={newMaterial} onChange={(e) => setNewMaterial(e.target.value)} placeholder="添加材料项…"
                onKeyDown={(e) => { if (e.key === 'Enter' && newMaterial.trim()) { setMaterials((ms) => [...ms, { name: newMaterial.trim(), ok: false }]); setNewMaterial('') } }}
                className={`${field} h-8 py-1 text-xs`} />
              <Btn variant="ghost" className="h-8 shrink-0 px-3 text-xs" disabled={!newMaterial.trim()}
                onClick={() => { setMaterials((ms) => [...ms, { name: newMaterial.trim(), ok: false }]); setNewMaterial('') }}>
                添加
              </Btn>
            </div>
          </div>
          <label className={`block ${lab}`}>
            备注
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="薪资方案、入职时间等说明（可选）" className={`mt-1 resize-none ${field}`} />
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Btn variant="ghost" onClick={onClose}>取消</Btn>
          <Btn variant="accent" onClick={() => void submit()} disabled={submitting}>{submitting ? '提交中…' : '发起申请'}</Btn>
        </div>
      </div>
    </div>
  )
}

/** 录取申请详情抽屉：双轨实例号 + 历史 + 刷新 / 撤销 */
function OfferDrawer({ offerId, onClose, onChanged }: { offerId: string; onClose: () => void; onChanged: (o: Offer) => void }) {
  const [offer, setOffer] = useState<Offer | null>(null)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [canceling, setCanceling] = useState(false)
  const [cancelBusy, setCancelBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const o = await api.getOffer(offerId)
      setOffer(o)
      onChanged(o)
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败，请重试')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offerId])
  useEffect(() => {
    void load()
  }, [load])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const refresh = async () => {
    setRefreshing(true)
    try {
      const o = await api.refreshOffer(offerId)
      setOffer(o)
      onChanged(o)
      toast('已刷新两侧审批状态')
    } catch (e) {
      toast(e instanceof Error ? e.message : '刷新失败，请重试')
    } finally {
      setRefreshing(false)
    }
  }
  const doCancel = async () => {
    setCancelBusy(true)
    try {
      const o = await api.cancelOffer(offerId)
      setOffer(o)
      onChanged(o)
      setCanceling(false)
      toast('已撤销申请')
    } catch (e) {
      toast(e instanceof Error ? e.message : '撤销失败，请重试')
    } finally {
      setCancelBusy(false)
    }
  }

  const sideName = (s: 'feishu' | 'bpm' | 'system') => (s === 'feishu' ? '飞书审批' : s === 'bpm' ? 'BPM' : '系统')

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-[#1d2939]/50" onClick={onClose} />
      <div className="login-fade relative flex h-full w-full max-w-xl flex-col bg-white shadow-2xl" role="dialog" aria-modal="true">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-slate-900">{offer?.candidateName || '录取申请'}</h3>
              {offer && <OverallBadge state={offer.overall} />}
            </div>
            <p className="mt-0.5 text-xs text-slate-400">{offer ? `${offer.positionTitle} · ${offer.createdByName} 发起于 ${fmtDT(offer.createdAt)}` : '正在加载…'}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭" className="cursor-pointer text-slate-400 hover:text-slate-700">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12 M18 6L6 18" /></svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-4">
          {error && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">{error}</p>}
          {!offer && !error && (
            <p className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
              <Spinner /> 正在加载…
            </p>
          )}
          {offer && (
            <>
              {/* 双轨状态 */}
              <div className="space-y-4 rounded-xl bg-slate-50 px-4 py-4">
                <div>
                  <SideTrack label="飞书审批" state={offer.feishu.state} updatedAt={offer.feishu.updatedAt} error={offer.feishu.error} onRetry={() => void refresh()} />
                  {offer.feishu.instanceId && <p className="mt-1 text-[11px] text-slate-400">实例号 {offer.feishu.instanceId}</p>}
                </div>
                <div>
                  <SideTrack label="BPM" state={offer.bpm.state} updatedAt={offer.bpm.updatedAt} error={offer.bpm.error} onRetry={() => void refresh()} />
                  {offer.bpm.processId && <p className="mt-1 text-[11px] text-slate-400">流程号 {offer.bpm.processId}</p>}
                </div>
              </div>

              {/* 材料清单 */}
              {offer.materials.length > 0 && (
                <div>
                  <div className="mb-2 text-sm font-medium text-slate-900">申请材料</div>
                  <div className="flex flex-wrap gap-1.5">
                    {offer.materials.map((m, i) => (
                      <span key={i} className={`rounded px-1.5 py-0.5 text-xs ${m.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {m.ok ? '✓ ' : ''}{m.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {offer.note && (
                <div>
                  <div className="mb-1 text-sm font-medium text-slate-900">备注</div>
                  <p className="whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-700">{offer.note}</p>
                </div>
              )}

              {/* 历史 */}
              <div>
                <div className="mb-2 text-sm font-medium text-slate-900">历史</div>
                <ol className="space-y-3">
                  {[...offer.history].reverse().map((h, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-200" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2 text-xs text-slate-400">
                          <span className="font-medium text-slate-600">{h.action}</span>
                          <span>{sideName(h.side)}</span>
                          <span className="tabular-nums">{fmtDT(h.at)}</span>
                        </div>
                        {h.detail && <p className="mt-0.5 text-xs leading-5 text-slate-500">{h.detail}</p>}
                      </div>
                    </li>
                  ))}
                  {!offer.history.length && <p className="text-xs text-slate-400">暂无历史记录</p>}
                </ol>
              </div>
            </>
          )}
        </div>

        {offer && (
          <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-3">
            <Btn variant="ghost" className="h-9 px-3 text-xs" disabled={refreshing} onClick={() => void refresh()}>
              {refreshing ? '刷新中…' : '刷新状态'}
            </Btn>
            {offer.overall !== 'canceled' && offer.overall !== 'approved' && (
              <Btn variant="ghost" className="h-9 px-3 text-xs text-red-500 hover:text-red-600" onClick={() => setCanceling(true)}>
                撤销申请
              </Btn>
            )}
          </div>
        )}
      </div>

      <ConfirmModal
        open={canceling}
        title="撤销这条录取申请？"
        body="两侧审批可撤则撤；无法撤销的将标记本方取消意图并记录在历史中。"
        confirmLabel={cancelBusy ? '撤销中…' : '确认撤销'}
        danger
        onConfirm={() => void doCancel()}
        onCancel={() => setCanceling(false)}
      />
    </div>
  )
}

export default function Offers() {
  const [offers, setOffers] = useState<Offer[] | null>(null)
  const [error, setError] = useState('')
  const [state, setState] = useState('')
  const [creating, setCreating] = useState(false)
  const [prefill, setPrefill] = useState<{ candidate: CandidateRow | null; positionId: string } | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [positions, setPositions] = useState<Position[]>([])

  const reload = useCallback(async (st: string) => {
    try {
      const r = await api.listOffers(st ? { state: st } : {})
      setOffers(r.offers)
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败，请重试')
    }
  }, [])
  useEffect(() => {
    void reload(state)
  }, [reload, state])
  useEffect(() => {
    void api.listPositions().then((r) => setPositions(r.positions)).catch(() => {})
    // 候选人详情页「发起录取申请」的预填
    const raw = localStorage.getItem('facetry-prefill-offer')
    if (raw) {
      localStorage.removeItem('facetry-prefill-offer')
      try {
        setPrefill(JSON.parse(raw) as { candidate: CandidateRow | null; positionId: string })
        setCreating(true)
      } catch { /* 忽略坏数据 */ }
    }
  }, [])

  const upsert = (o: Offer) => setOffers((s) => (s ? (s.some((x) => x.id === o.id) ? s.map((x) => (x.id === o.id ? o : x)) : [o, ...s]) : s))

  return (
    <div className="space-y-6">
      <div className="ws-rise flex items-end justify-between" style={rise(0)}>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">录取</h1>
          <p className="mt-1 text-sm text-slate-500">录取申请同时走飞书审批与 BPM 两条线，两侧都通过才算完成。</p>
        </div>
        <Btn variant="accent" onClick={() => { setPrefill(null); setCreating(true) }} disabled={!offers}>
          + 发起录取申请
        </Btn>
      </div>

      <div className="ws-rise flex gap-1.5 overflow-x-auto" style={rise(1)}>
        {(['', 'processing', 'approved', 'returned', 'rejected', 'canceled', 'error'] as const).map((s) => (
          <button key={s} type="button" onClick={() => setState(s)}
            className={`h-7 shrink-0 cursor-pointer rounded-full px-3 text-xs font-medium transition-colors ws-press ${state === s ? 'bg-[#1d2939] text-white' : 'bg-white text-slate-600 shadow-[0_0_0_1px_rgb(15_23_42/0.08)] hover:bg-slate-50'}`}>
            {s === '' ? '全部' : sideStateLabels[s as SideState]}
          </button>
        ))}
      </div>

      {error && (
        <Card className="ws-rise px-5 py-4" style={rise(2)}>
          <div className="flex items-center justify-between">
            <p className="text-sm text-amber-700">{error}</p>
            <Btn variant="ghost" className="h-8 px-3 text-xs" onClick={() => void reload(state)}>重试</Btn>
          </div>
        </Card>
      )}

      {!offers && !error && (
        <Card className="ws-rise flex items-center justify-center gap-2 py-20 text-sm text-slate-400" style={rise(2)}>
          <Spinner /> 正在加载录取申请…
        </Card>
      )}

      {offers && (
        <div className="ws-rise space-y-3" style={rise(2)}>
          {offers.map((o) => (
            <Card key={o.id} className="cursor-pointer px-5 py-4 ws-lift" onClick={() => setActiveId(o.id)}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-sm font-semibold text-slate-900">{o.candidateName}</span>
                <span className="text-sm text-slate-500">{o.positionTitle}</span>
                <span className="text-xs text-slate-400">{o.createdByName} 发起 · <span className="tabular-nums">{fmtDT(o.createdAt)}</span></span>
                <span className="ml-auto"><OverallBadge state={o.overall} /></span>
              </div>
              <div className="mt-3 grid gap-x-8 gap-y-2 sm:grid-cols-2">
                <SideTrack label="飞书审批" state={o.feishu.state} updatedAt={o.feishu.updatedAt} error={o.feishu.error} />
                <SideTrack label="BPM" state={o.bpm.state} updatedAt={o.bpm.updatedAt} error={o.bpm.error} />
              </div>
            </Card>
          ))}
          {!offers.length && (
            <Card>
              <EmptyState
                title="还没有录取申请"
                hint="候选人进入「待录取」阶段后，点右上角发起申请，双轨审批自动推进"
                action={<Btn variant="ghost" onClick={() => { setPrefill(null); setCreating(true) }}>发起录取申请</Btn>}
              />
            </Card>
          )}
        </div>
      )}

      {creating && (
        <NewOfferModal
          prefill={prefill}
          positions={positions}
          onClose={() => { setCreating(false); setPrefill(null) }}
          onCreated={(o) => { upsert(o); setActiveId(o.id) }}
        />
      )}
      {activeId && <OfferDrawer offerId={activeId} onClose={() => setActiveId(null)} onChanged={upsert} />}
    </div>
  )
}
