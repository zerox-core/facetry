import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api'
import type { Go } from '../App'
import { Chip } from '../components/Chip'
import { EmptyState, StageChip, VerdictBadge, rise, stageLabels, stageOrder } from '../components/recruit'
import { Select } from '../components/Select'
import { Btn, Card, Spinner } from '../components/ui'
import type { CandidateRow, DirectoryUser, Position, Stage, Verdict } from '../types'
import { fmtTime } from './shared'

/** 候选人列表：搜索 + 阶段胶囊筛选 + 岗位/渠道/负责人/AI 判定筛选 */
export default function Candidates({ go }: { go: Go }) {
  const [rows, setRows] = useState<CandidateRow[] | null>(null)
  const [error, setError] = useState('')
  const [stage, setStage] = useState<Stage | ''>('')
  const [q, setQ] = useState('')
  const [positionId, setPositionId] = useState('')
  const [channel, setChannel] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const [verdict, setVerdict] = useState('')
  const [positions, setPositions] = useState<Position[]>([])
  const [users, setUsers] = useState<DirectoryUser[]>([])
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [qInput, setQInput] = useState('')

  const reload = useCallback(async (kw: string, pid: string, ch: string, ow: string, vd: string) => {
    try {
      // 阶段筛选在前端做（便于胶囊计数），其余条件交服务端
      const r = await api.listCandidates({ q: kw, positionId: pid, channel: ch, ownerId: ow, verdict: vd, size: 200 })
      setRows(r.candidates)
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败，请重试')
    }
  }, [])

  useEffect(() => {
    void reload(q, positionId, channel, ownerId, verdict)
  }, [reload, q, positionId, channel, ownerId, verdict])

  useEffect(() => {
    void api.listPositions().then((r) => setPositions(r.positions)).catch(() => {})
    void api.listUsers().then((r) => setUsers(r.users)).catch(() => {})
  }, [])

  const onSearch = (v: string) => {
    setQInput(v)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setQ(v), 300)
  }

  const channels = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of rows || []) if (c.channel) m.set(c.channel, c.channelName || c.channel)
    return [...m.entries()].map(([value, label]) => ({ value, label }))
  }, [rows])

  const counts = useMemo(() => {
    const c: Partial<Record<Stage, number>> = {}
    for (const r of rows || []) c[r.stage] = (c[r.stage] || 0) + 1
    return c
  }, [rows])

  const list = (rows || []).filter((r) => !stage || r.stage === stage)

  return (
    <div className="space-y-6">
      <div className="ws-rise flex items-end justify-between" style={rise(0)}>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">候选人</h1>
          <p className="mt-1 text-sm text-slate-500">候选人来自外部来源库同步；点进详情可查看 AI 初筛结论并跟进。</p>
        </div>
        <span className="text-sm text-slate-400 tabular-nums">{rows ? `${list.length} 人` : ''}</span>
      </div>

      {/* 筛选区 */}
      <div className="ws-rise space-y-3" style={rise(1)}>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={qInput}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="搜索姓名、公司、技能…"
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:w-64"
          />
          <Select size="sm" className="h-9 w-36" value={positionId} onChange={setPositionId} placeholder="全部岗位"
            options={[{ value: '', label: '全部岗位' }, ...positions.map((p) => ({ value: p.id, label: p.title }))]} />
          <Select size="sm" className="h-9 w-32" value={channel} onChange={setChannel} placeholder="全部渠道"
            options={[{ value: '', label: '全部渠道' }, ...channels]} />
          <Select size="sm" className="h-9 w-32" value={ownerId} onChange={setOwnerId} placeholder="全部负责人"
            options={[{ value: '', label: '全部负责人' }, ...users.map((u) => ({ value: u.id, label: u.name }))]} />
          <Select size="sm" className="h-9 w-36" value={verdict} onChange={setVerdict} placeholder="AI 判定"
            options={[
              { value: '', label: '全部判定' },
              ...(['合适', '待定', '不合适', '信息不足'] as Verdict[]).map((v) => ({ value: v, label: v })),
            ]} />
        </div>
        {/* 阶段胶囊：横向滚动，带计数 */}
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          <button
            type="button"
            onClick={() => setStage('')}
            className={`h-7 shrink-0 cursor-pointer rounded-full px-3 text-xs font-medium transition-colors ws-press ${!stage ? 'bg-[#1d2939] text-white' : 'bg-white text-slate-600 shadow-[0_0_0_1px_rgb(15_23_42/0.08)] hover:bg-slate-50'}`}
          >
            全部 <span className="tabular-nums opacity-70">{rows?.length ?? ''}</span>
          </button>
          {stageOrder.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStage(stage === s ? '' : s)}
              className={`h-7 shrink-0 cursor-pointer rounded-full px-3 text-xs font-medium transition-colors ws-press ${stage === s ? 'bg-[#1d2939] text-white' : 'bg-white text-slate-600 shadow-[0_0_0_1px_rgb(15_23_42/0.08)] hover:bg-slate-50'}`}
            >
              {stageLabels[s]} <span className="tabular-nums opacity-70">{counts[s] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <Card className="ws-rise px-5 py-4" style={rise(2)}>
          <div className="flex items-center justify-between">
            <p className="text-sm text-amber-700">{error}</p>
            <Btn variant="ghost" className="h-8 px-3 text-xs" onClick={() => void reload(q, positionId, channel, ownerId, verdict)}>
              重试
            </Btn>
          </div>
        </Card>
      )}

      {!rows && !error && (
        <Card className="ws-rise flex items-center justify-center gap-2 py-20 text-sm text-slate-400" style={rise(2)}>
          <Spinner /> 正在加载候选人…
        </Card>
      )}

      {rows && (
        <Card className="ws-rise overflow-hidden" style={rise(2)}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400">
                  <th className="px-5 py-3 font-medium">姓名</th>
                  <th className="px-5 py-3 font-medium">目前岗位</th>
                  <th className="px-5 py-3 font-medium">学历 · 年限</th>
                  <th className="px-5 py-3 font-medium">期望城市</th>
                  <th className="px-5 py-3 font-medium">渠道</th>
                  <th className="px-5 py-3 font-medium">AI 判定</th>
                  <th className="px-5 py-3 font-medium">阶段</th>
                  <th className="px-5 py-3 font-medium">负责人</th>
                  <th className="px-5 py-3 font-medium">更新</th>
                </tr>
              </thead>
              <tbody>
                {list.map((c) => {
                  const m = c.matches.find((x) => x.positionId === positionId) || c.matches[0]
                  return (
                    <tr key={c.id} onClick={() => go('candidate', c.id)} className="cursor-pointer border-t border-slate-100 transition-colors duration-150 hover:bg-slate-50">
                      <td className="px-5 py-3.5 font-medium text-slate-900">{c.name}</td>
                      <td className="max-w-48 truncate px-5 py-3.5 text-slate-500">
                        {[c.currentPosition, c.currentCompany].filter(Boolean).join(' @ ') || '—'}
                      </td>
                      <td className="px-5 py-3.5 text-slate-500">
                        {c.education || '—'} · {c.yearsOfExperience >= 0 ? `${c.yearsOfExperience} 年` : '年限未知'}
                      </td>
                      <td className="px-5 py-3.5 text-slate-500">{c.expectedCity || '—'}</td>
                      <td className="px-5 py-3.5">
                        <Chip>{c.channelName || c.channel || '—'}</Chip>
                      </td>
                      <td className="px-5 py-3.5">
                        {m ? <VerdictBadge verdict={m.verdict} score={m.score} /> : <span className="text-xs text-slate-300">未关联岗位</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        <StageChip stage={c.stage} />
                      </td>
                      <td className="px-5 py-3.5 text-slate-500">{c.ownerName || '—'}</td>
                      <td className="px-5 py-3.5 text-slate-400 tabular-nums">{fmtTime(c.updatedAt)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {!list.length && (
            <EmptyState
              title={rows.length ? '当前筛选下没有候选人' : '候选人库还是空的'}
              hint={rows.length ? '换个筛选条件试试' : '到「管理」页同步来源库，候选人会自动出现在这里'}
              action={
                !rows.length ? (
                  <Btn variant="ghost" onClick={() => go('admin')}>
                    去管理页同步
                  </Btn>
                ) : undefined
              }
            />
          )}
        </Card>
      )}
    </div>
  )
}
