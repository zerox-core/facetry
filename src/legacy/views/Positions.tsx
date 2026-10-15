import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import { Chip } from '../components/Chip'
import { ConfirmModal } from '../components/Modal'
import { EmptyState, field, lab, rise, stageLabels, stageOrder } from '../components/recruit'
import { Select } from '../components/Select'
import { toast } from '../components/Toast'
import { Btn, Card, Spinner } from '../components/ui'
import { useJob } from '../store'
import type { Position } from '../types'
import { fmtTime } from './shared'

const statusMeta: Record<Position['status'], { label: string; dot: string }> = {
  open: { label: '招聘中', dot: 'bg-emerald-500' },
  paused: { label: '已暂停', dot: 'bg-slate-400' },
  closed: { label: '已关闭', dot: 'bg-[#1d2939]' },
}

/** 各阶段人数迷你条 */
function StageMiniBar({ stats }: { stats: Position['stats'] }) {
  const max = Math.max(1, ...stageOrder.map((s) => stats.byStage[s] || 0))
  return (
    <div className="flex items-end gap-1.5">
      {stageOrder.map((s) => {
        const n = stats.byStage[s] || 0
        return (
          <div key={s} className="flex flex-col items-center gap-1" title={`${stageLabels[s]} ${n} 人`}>
            <span className={`w-3 rounded-sm ${n ? 'bg-blue-200' : 'bg-slate-100'}`} style={{ height: 4 + (n / max) * 20 }} />
            <span className="text-[10px] leading-none text-slate-400 tabular-nums">{n || ''}</span>
          </div>
        )
      })}
    </div>
  )
}

type EditForm = { title: string; city: string; department: string; status: Position['status']; content: string; requirements: string; note: string }

/** 岗位编辑抽屉：基础信息 + JD 三栏 + 版本历史 + 重新初筛 */
function PositionDrawer({ position, onClose, onSaved }: { position: Position; onClose: () => void; onSaved: () => void }) {
  const [detail, setDetail] = useState<Position | null>(null)
  const [v, setV] = useState<EditForm>({
    title: position.title,
    city: position.city,
    department: position.department,
    status: position.status,
    content: position.jd.content,
    requirements: position.jd.requirements,
    note: position.jd.note,
  })
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const { job, run } = useJob(async () => {
    toast('已按当前 JD 重新初筛全部关联候选人')
    onSaved()
  })

  useEffect(() => {
    void api.getPosition(position.id).then(setDetail).catch(() => {})
  }, [position.id])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const jdChanged = v.content !== position.jd.content || v.requirements !== position.jd.requirements || v.note !== position.jd.note

  const save = async () => {
    if (!v.title.trim()) {
      toast('岗位名称不能为空')
      return
    }
    setSaving(true)
    try {
      await api.patchPosition(position.id, {
        title: v.title.trim(),
        city: v.city.trim(),
        department: v.department.trim(),
        status: v.status,
        ...(jdChanged ? { jd: { content: v.content.trim(), requirements: v.requirements.trim(), note: v.note.trim() } } : {}),
      })
      toast(jdChanged ? `已保存，JD 已生成新版本 v${position.jd.version + 1}` : '已保存')
      onSaved()
      onClose()
    } catch (e) {
      toast(e instanceof Error ? e.message : '保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  const doDelete = async () => {
    setDeleting(true)
    try {
      await api.deletePosition(position.id)
      toast('岗位已删除')
      setRemoving(false)
      onSaved()
      onClose()
    } catch (e) {
      // 409：有关联候选人，建议改为已关闭
      toast(e instanceof Error ? e.message : '删除失败，请改为「已关闭」')
    } finally {
      setDeleting(false)
    }
  }

  const set = (k: keyof EditForm) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value })

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-[#1d2939]/50" onClick={onClose} />
      <div className="login-fade relative flex h-full w-full max-w-xl flex-col bg-white shadow-2xl" role="dialog" aria-modal="true">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">编辑岗位</h3>
            <p className="mt-0.5 text-xs text-slate-400">当前 JD v{position.jd.version} · 修改 JD 保存后自动生成新版本</p>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭" className="cursor-pointer text-slate-400 hover:text-slate-700">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12 M18 6L6 18" /></svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={`block ${lab}`}>
              岗位名称
              <input value={v.title} onChange={set('title')} className={`mt-1 ${field}`} />
            </label>
            <label className={`block ${lab}`}>
              状态
              <Select className="mt-1" value={v.status} onChange={(s) => setV({ ...v, status: s as Position['status'] })}
                options={(['open', 'paused', 'closed'] as const).map((s) => ({ value: s, label: statusMeta[s].label }))} />
            </label>
            <label className={`block ${lab}`}>
              城市
              <input value={v.city} onChange={set('city')} placeholder="例如：珠海" className={`mt-1 ${field}`} />
            </label>
            <label className={`block ${lab}`}>
              部门
              <input value={v.department} onChange={set('department')} placeholder="可选" className={`mt-1 ${field}`} />
            </label>
          </div>
          <label className={`block ${lab}`}>
            岗位职责（JD 正文）
            <textarea value={v.content} onChange={set('content')} rows={7} className={`mt-1 ${field}`} />
          </label>
          <label className={`block ${lab}`}>
            岗位要求
            <textarea value={v.requirements} onChange={set('requirements')} rows={3} placeholder="学历、经验、技能等硬性要求" className={`mt-1 resize-none ${field}`} />
          </label>
          <label className={`block ${lab}`}>
            备注 / 筛选规则
            <textarea value={v.note} onChange={set('note')} rows={2} placeholder="例如：没有支付行业经验不考虑（将作为硬规则参与 AI 初筛）" className={`mt-1 resize-none ${field}`} />
          </label>

          {/* 版本历史 */}
          <div>
            <div className={lab}>版本历史</div>
            <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-100">
              {(detail?.versions || []).map((ver) => (
                <li key={ver.version} className="flex items-center gap-2 px-3 py-2 text-xs">
                  <Chip tone={ver.version === position.jd.version ? 'blue' : 'slate'}>v{ver.version}</Chip>
                  <span className="text-slate-500">{ver.updatedBy || '—'}</span>
                  <span className="ml-auto text-slate-400 tabular-nums">{fmtTime(ver.updatedAt)}</span>
                </li>
              ))}
              {!detail && (
                <li className="flex items-center justify-center gap-2 px-3 py-4 text-xs text-slate-400">
                  <Spinner /> 加载中…
                </li>
              )}
              {detail && !detail.versions.length && <li className="px-3 py-4 text-center text-xs text-slate-400">暂无历史版本</li>}
            </ul>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-3">
          <div className="flex items-center gap-2">
            <Btn variant="ghost" className="h-9 px-3 text-xs" disabled={!!job} onClick={() => void run(api.rescreenPosition(position.id))}>
              {job ? '初筛中…' : '重新初筛全部'}
            </Btn>
            <button type="button" onClick={() => setRemoving(true)} className="cursor-pointer px-2 text-xs font-medium text-slate-400 hover:text-red-500">
              删除
            </button>
          </div>
          <div className="flex gap-2">
            <Btn variant="ghost" onClick={onClose}>取消</Btn>
            <Btn onClick={() => void save()} disabled={saving}>{saving ? '保存中…' : '保存'}</Btn>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={removing}
        title={`删除岗位「${position.title}」？`}
        body="仅无关联候选人时可删除；已有候选人关联的岗位建议改为「已关闭」。"
        confirmLabel={deleting ? '删除中…' : '确认删除'}
        danger
        onConfirm={() => void doDelete()}
        onCancel={() => setRemoving(false)}
      />
    </div>
  )
}

/** 新建岗位弹窗：JD 必填 */
function NewPositionModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [v, setV] = useState({ title: '', city: '', department: '', content: '', requirements: '', note: '' })
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value })

  const submit = async () => {
    if (!v.title.trim() || !v.content.trim()) {
      toast('岗位名称与 JD 职责为必填项')
      return
    }
    setSaving(true)
    try {
      await api.createPosition({
        title: v.title.trim(),
        city: v.city.trim() || undefined,
        department: v.department.trim() || undefined,
        jd: { content: v.content.trim(), requirements: v.requirements.trim() || undefined, note: v.note.trim() || undefined },
      })
      toast('岗位已创建')
      onSaved()
      onClose()
    } catch (e) {
      toast(e instanceof Error ? e.message : '创建失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-[#1d2939]/50" onClick={onClose} />
      <div className="ws-paper login-fade relative max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-xl p-5" role="dialog" aria-modal="true">
        <h3 className="text-base font-semibold text-slate-900">新建岗位</h3>
        <p className="mt-1 text-xs text-slate-400">岗位必须关联 JD；保存后即为 v1 版本</p>
        <div className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={`block ${lab}`}>
              岗位名称 *
              <input value={v.title} onChange={set('title')} placeholder="例如：AI 管培生（信息方向）" className={`mt-1 ${field}`} />
            </label>
            <label className={`block ${lab}`}>
              城市
              <input value={v.city} onChange={set('city')} placeholder="例如：珠海" className={`mt-1 ${field}`} />
            </label>
          </div>
          <label className={`block ${lab}`}>
            部门
            <input value={v.department} onChange={set('department')} placeholder="可选" className={`mt-1 ${field}`} />
          </label>
          <label className={`block ${lab}`}>
            岗位职责（JD 正文）*
            <textarea value={v.content} onChange={set('content')} rows={6} className={`mt-1 ${field}`} />
          </label>
          <label className={`block ${lab}`}>
            岗位要求
            <textarea value={v.requirements} onChange={set('requirements')} rows={3} className={`mt-1 resize-none ${field}`} />
          </label>
          <label className={`block ${lab}`}>
            备注 / 筛选规则
            <textarea value={v.note} onChange={set('note')} rows={2} className={`mt-1 resize-none ${field}`} />
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Btn variant="ghost" onClick={onClose}>取消</Btn>
          <Btn onClick={() => void submit()} disabled={saving}>{saving ? '创建中…' : '创建岗位'}</Btn>
        </div>
      </div>
    </div>
  )
}

export default function Positions() {
  const [positions, setPositions] = useState<Position[] | null>(null)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [editing, setEditing] = useState<Position | null>(null)
  const [adding, setAdding] = useState(false)

  const reload = useCallback(async () => {
    try {
      const r = await api.listPositions()
      setPositions(r.positions)
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败，请重试')
    }
  }, [])
  useEffect(() => {
    void reload()
  }, [reload])

  const list = useMemo(() => {
    const kw = q.trim().toLowerCase()
    return (positions || []).filter(
      (p) => (!status || p.status === status) && (!kw || p.title.toLowerCase().includes(kw) || p.city.toLowerCase().includes(kw) || p.department.toLowerCase().includes(kw)),
    )
  }, [positions, q, status])

  return (
    <div className="space-y-6">
      <div className="ws-rise flex items-end justify-between" style={rise(0)}>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">岗位</h1>
          <p className="mt-1 text-sm text-slate-500">岗位与 JD 版本管理；JD 变更自动生成新版本，初筛结论保留当时的 JD 快照。</p>
        </div>
        <Btn variant="accent" onClick={() => setAdding(true)} disabled={!positions}>
          + 新建岗位
        </Btn>
      </div>

      <div className="ws-rise flex flex-wrap items-center gap-2" style={rise(1)}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索岗位、城市或部门…"
          className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:w-64" />
        <div className="flex gap-1.5">
          {(['', 'open', 'paused', 'closed'] as const).map((s) => (
            <button key={s} type="button" onClick={() => setStatus(s)}
              className={`h-7 cursor-pointer rounded-full px-3 text-xs font-medium transition-colors ws-press ${status === s ? 'bg-[#1d2939] text-white' : 'bg-white text-slate-600 shadow-[0_0_0_1px_rgb(15_23_42/0.08)] hover:bg-slate-50'}`}>
              {s === '' ? '全部' : statusMeta[s as Position['status']].label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <Card className="ws-rise px-5 py-4" style={rise(2)}>
          <div className="flex items-center justify-between">
            <p className="text-sm text-amber-700">{error}</p>
            <Btn variant="ghost" className="h-8 px-3 text-xs" onClick={() => void reload()}>重试</Btn>
          </div>
        </Card>
      )}

      {!positions && !error && (
        <Card className="ws-rise flex items-center justify-center gap-2 py-20 text-sm text-slate-400" style={rise(2)}>
          <Spinner /> 正在加载岗位…
        </Card>
      )}

      {positions && (
        <div className="ws-rise grid gap-4 sm:grid-cols-2 xl:grid-cols-3" style={rise(2)}>
          {list.map((p) => (
            <Card key={p.id} className="cursor-pointer px-5 py-4 ws-lift" onClick={() => setEditing(p)}>
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 shrink-0 rounded-full ${statusMeta[p.status].dot}`} title={statusMeta[p.status].label} />
                <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-slate-900">{p.title}</span>
                <Chip tone="blue">JD v{p.jd.version}</Chip>
              </div>
              <p className="mt-1 text-xs text-slate-400">{[p.city, p.department].filter(Boolean).join(' · ') || '—'}</p>
              <div className="mt-4 flex items-end justify-between">
                <StageMiniBar stats={p.stats || { total: 0, byStage: {} }} />
                <span className="text-xs text-slate-400">共 {p.stats?.total ?? 0} 人</span>
              </div>
              <p className="mt-3 border-t border-slate-100 pt-2.5 text-xs text-slate-400 tabular-nums">JD 更新于 {fmtTime(p.jd.updatedAt || p.updatedAt)}</p>
            </Card>
          ))}
          {!list.length && (
            <Card className="sm:col-span-2 xl:col-span-3">
              <EmptyState title={positions.length ? '没有匹配的岗位' : '还没有岗位'} hint={positions.length ? '换个筛选条件试试' : '点右上角「新建岗位」录入第一个岗位与 JD'} />
            </Card>
          )}
        </div>
      )}

      {editing && <PositionDrawer position={editing} onClose={() => setEditing(null)} onSaved={() => void reload()} />}
      {adding && <NewPositionModal onClose={() => setAdding(false)} onSaved={() => void reload()} />}
    </div>
  )
}
