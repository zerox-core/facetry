import { useEffect, useState } from 'react'
import { CHANNELS, STAGES, candidates, resumes, type Candidate, type CandidateStage } from '../data'
import { batchAssign, can, findPos } from '../store'
import type { Go } from '../App'
import { Btn, Chip, Empty, Field, Modal, type Tone } from './ui'

/* ── 阶段口径：一律取合法枚举，兼容缓存里可能残留的旧阶段值 ── */
const STAGE_TONE: Record<string, Tone> = {
  新入库: 'ghost',
  筛选中: 'info',
  待联系: 'warning',
  约面中: 'neutral',
  面评中: 'accent',
  待录取: 'info',
  已完成: 'success',
  搁置: 'warning',
  已淘汰: 'error',
}

/* ── 附件三态（FR-A2）：候选人原件 / 平台文件 / 附件缺失，缺失态用 error 强调 ── */
const ATTACH_LABEL: Record<Candidate['attachmentType'], string> = { original: '候选人原件', platform: '平台文件', missing: '附件缺失' }
const ATTACH_TONE: Record<Candidate['attachmentType'], Tone> = { original: 'success', platform: 'info', missing: 'error' }

/* ── AI 初筛标识（FR-A3）：推荐 / 未推荐 / 未跑，三态可辨，不再统一写「AI 宽松初筛评定」── */
type AiState = 'recommended' | 'not-recommended' | 'not-run'
const AI_LABEL: Record<AiState, string> = { recommended: 'AI 推荐', 'not-recommended': 'AI 未推荐', 'not-run': 'AI 未跑' }
const AI_TONE: Record<AiState, Tone> = { recommended: 'success', 'not-recommended': 'warning', 'not-run': 'ghost' }

const aiOf = (c: Candidate) => c.aiScreening as Candidate['aiScreening'] | undefined
const aiStateOf = (c: Candidate): AiState => {
  const ai = aiOf(c)
  if (!ai) return 'not-run'
  return ai.recommended ? 'recommended' : 'not-recommended'
}

/* ── 统计条口径：四个桶按合法阶段全覆盖（9 个阶段不重不漏），不再引用任何作废旧阶段 ── */
const STAT_BUCKETS: { label: string; desc: string; stages: CandidateStage[] }[] = [
  { label: '入库与初筛', desc: '新入库 / 筛选中', stages: ['新入库', '筛选中'] },
  { label: '联系与约面', desc: '待联系 / 约面中', stages: ['待联系', '约面中'] },
  { label: '面评与录取', desc: '面评中 / 待录取', stages: ['面评中', '待录取'] },
  { label: '已完成 / 搁置 / 淘汰', desc: '终态与暂缓', stages: ['已完成', '搁置', '已淘汰'] },
]

export default function Candidates({ go }: { go: Go }) {
  const [kw, setKw] = useState('')
  const [selectedPos, setSelectedPos] = useState('全部')
  const [selectedStage, setSelectedStage] = useState('全部')
  const [selectedSource, setSelectedSource] = useState('全部')
  const [selectedAssignee, setSelectedAssignee] = useState('全部')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [openAi, setOpenAi] = useState<string[]>([])
  const [batchModal, setBatchModal] = useState(false)
  const [toast, setToast] = useState('')

  // —— 筛选枚举全部从 candidates / positions 派生，新增岗位与渠道无需改页面代码 ——
  const positionOptions = Array.from(new Set(candidates.map((c) => c.positionId))).map((id) => {
    const p = findPos(id)
    const label = p ? `${p.name.replace(/.*·\s*/, '')}（${p.code}）` : (candidates.find((c) => c.positionId === id)?.role ?? id)
    return { id, label }
  })
  const sourceOptions = Array.from(new Set(candidates.map((c) => c.source))).sort((a, b) => {
    const ia = (CHANNELS as readonly string[]).indexOf(a)
    const ib = (CHANNELS as readonly string[]).indexOf(b)
    if (ia < 0 && ib < 0) return a.localeCompare(b)
    if (ia < 0) return 1
    if (ib < 0) return -1
    return ia - ib
  })
  const assigneeOptions = Array.from(new Set(candidates.map((c) => c.assignee))).sort((a, b) =>
    a === '未分配' ? 1 : b === '未分配' ? -1 : a.localeCompare(b),
  )
  // 阶段：以合法枚举为序，再补上数据里出现但枚举未覆盖的值（防旧缓存残留）
  const stageOptions: CandidateStage[] = [...STAGES, ...Array.from(new Set(candidates.map((c) => c.status))).filter((s) => !(STAGES as readonly string[]).includes(s))]
  const stageCount = (st: CandidateStage) => candidates.filter((c) => c.status === st).length

  const [targetAssignee, setTargetAssignee] = useState(() => assigneeOptions.find((a) => a !== '未分配') ?? '未分配')
  const canAssign = can('candidate:assign')
  const assignableOptions = assigneeOptions.filter((a) => a !== '未分配')

  const list = candidates.filter(
    (c) =>
      (selectedStage === '全部' || c.status === selectedStage) &&
      (selectedPos === '全部' || c.positionId === selectedPos) &&
      (selectedSource === '全部' || c.source === selectedSource) &&
      (selectedAssignee === '全部' || c.assignee === selectedAssignee) &&
      (!kw || c.name.includes(kw) || c.role.includes(kw) || (resumes[c.id]?.file ?? '').includes(kw) || c.sourceId.includes(kw)),
  )

  // 筛选 / 搜索变化时清空已选：避免对当前不可见的候选人误操作
  useEffect(() => {
    setSelectedIds((prev) => (prev.length ? [] : prev))
  }, [kw, selectedPos, selectedStage, selectedSource, selectedAssignee])

  const hasFilter = !!kw || selectedPos !== '全部' || selectedStage !== '全部' || selectedSource !== '全部' || selectedAssignee !== '全部'
  const resetFilters = () => {
    setKw('')
    setSelectedPos('全部')
    setSelectedStage('全部')
    setSelectedSource('全部')
    setSelectedAssignee('全部')
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  // 全选判断基于「当前列表逐项命中」，不用长度比较（换筛选后不会误伤被隐藏的候选人）
  const allSelected = list.length > 0 && list.every((c) => selectedIds.includes(c.id))

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? [] : list.map((c) => c.id))
  }

  const toggleAi = (id: string) => {
    setOpenAi((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const handleBatchAssign = () => {
    if (!selectedIds.length) return
    const n = selectedIds.length
    batchAssign(selectedIds, targetAssignee)
    setSelectedIds([])
    setBatchModal(false)
    setToast(`批量分配成功：${n} 位候选人已分配给 ${targetAssignee}`)
    window.setTimeout(() => setToast(''), 5000)
  }

  return (
    <div className="space-y-6">
      {/* 顶部标题与行动 */}
      <div className="ws-rise flex flex-col justify-between gap-4 border-b border-base-300 pb-5 md:flex-row md:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-base-content">候选人大池 · 全流程管理</h1>
            <Chip tone="success">
              <span className="status status-success" aria-hidden="true" />
              在库人选 {candidates.length} 人
            </Chip>
          </div>
          <p className="mt-1.5 text-xs text-base-content/60">来源库落库 · 按岗位 / 阶段 / 渠道 / 负责人筛选 · AI 推荐标识 · 附件三态 · 批量分配</p>
        </div>

        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <Btn variant="solid" onClick={() => setBatchModal(true)} disabled={!canAssign} title={canAssign ? undefined : '当前角色无分配候选人权限'}>
              批量分配负责人（{selectedIds.length}）
            </Btn>
          )}
          <Btn variant="ghost" onClick={() => go('workbench')}>
            返回工作台待办
          </Btn>
        </div>
      </div>

      {toast && (
        <div role="status" className="alert alert-soft alert-success flex items-center justify-between gap-3 text-xs">
          <span>{toast}</span>
          <button type="button" onClick={() => setToast('')} aria-label="关闭提示" className="btn btn-ghost btn-xs btn-circle">
            ✕
          </button>
        </div>
      )}

      {/* 在库结构统计条（阶段口径全部合法，四桶覆盖 9 个阶段） */}
      <div className="ws-rise [--i:1] stats stats-vertical w-full rounded-2xl border border-base-300 bg-base-100 shadow-[var(--shadow-paper)] sm:stats-horizontal">
        {STAT_BUCKETS.map((b) => (
          <div key={b.label} className="stat">
            <div className="stat-title text-xs">{b.label}</div>
            <div className="stat-value text-2xl tabular-nums">{candidates.filter((c) => b.stages.includes(c.status)).length}</div>
            <div className="stat-desc text-[11px]">{b.desc}</div>
          </div>
        ))}
        <div className="stat">
          <div className="stat-title text-xs">在库总量</div>
          <div className="stat-value text-2xl tabular-nums">{candidates.length}</div>
          <div className="stat-desc text-[11px]">当前候选人总数</div>
        </div>
      </div>

      {/* 多维筛选栏 */}
      <div className="ws-rise [--i:1] card card-border bg-base-100 shadow-[var(--shadow-paper)]">
        <div className="card-body gap-3 p-4 text-xs">
          <div className="flex flex-wrap items-center gap-2.5">
            <input
              type="search"
              value={kw}
              onChange={(e) => setKw(e.target.value)}
              placeholder="搜索姓名 / 岗位 / 简历 / 来源ID…"
              aria-label="搜索候选人姓名、岗位、简历文件或来源 ID"
              className="input input-sm w-full rounded-full sm:w-56"
            />

            <label className="flex items-center gap-1.5 text-base-content/60">
              <span className="whitespace-nowrap">应聘岗位</span>
              <select value={selectedPos} onChange={(e) => setSelectedPos(e.target.value)} className="select select-sm w-fit rounded-full">
                <option value="全部">全部（{positionOptions.length}）</option>
                {positionOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-1.5 text-base-content/60">
              <span className="whitespace-nowrap">渠道来源</span>
              <select value={selectedSource} onChange={(e) => setSelectedSource(e.target.value)} className="select select-sm w-fit rounded-full">
                <option value="全部">全部（{sourceOptions.length}）</option>
                {sourceOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-1.5 text-base-content/60">
              <span className="whitespace-nowrap">HR 负责人</span>
              <select value={selectedAssignee} onChange={(e) => setSelectedAssignee(e.target.value)} className="select select-sm w-fit rounded-full">
                <option value="全部">全部（{assigneeOptions.length}）</option>
                {assigneeOptions.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>

            {hasFilter && (
              <Btn variant="ghost" className="!h-8 !px-3" onClick={resetFilters}>
                重置筛选
              </Btn>
            )}
            <span className="ml-auto tabular-nums text-base-content/50">命中 {list.length} / {candidates.length} 人</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 border-t border-base-300 pt-2">
            <span className="mr-1 text-base-content/50">阶段</span>
            <button
              type="button"
              aria-pressed={selectedStage === '全部'}
              onClick={() => setSelectedStage('全部')}
              className={`btn btn-xs rounded-full ${selectedStage === '全部' ? 'btn-primary' : 'btn-ghost border border-base-300'}`}
            >
              全部 <span className="tabular-nums opacity-60">{candidates.length}</span>
            </button>
            {stageOptions.map((st) => (
              <button
                key={st}
                type="button"
                aria-pressed={selectedStage === st}
                onClick={() => setSelectedStage(st)}
                className={`btn btn-xs rounded-full ${selectedStage === st ? 'btn-primary' : 'btn-ghost border border-base-300'}`}
              >
                {st} <span className="tabular-nums opacity-60">{stageCount(st)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 候选人列表 */}
      <div className="ws-rise [--i:2] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-base-content/60">
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} disabled={!list.length} className="checkbox checkbox-sm" />
            <span>全选当前筛选结果（{list.length} 人）</span>
          </label>
          <span>共 {list.length} 人 · 点击卡片进入「一页贯通详情页」</span>
        </div>

        {list.map((c) => {
          const pos = findPos(c.positionId)
          const isSelected = selectedIds.includes(c.id)
          const ai = aiOf(c)
          const aiState = aiStateOf(c)
          const reasons = ai?.reasons ?? []
          const risks = ai?.risks ?? []
          const expanded = openAi.includes(c.id)

          return (
            <div
              key={c.id}
              role="button"
              tabIndex={0}
              aria-label={`${c.name}，${pos?.name ?? c.role}，阶段 ${c.status}，点击进入详情`}
              onClick={(e) => {
                if ((e.target as HTMLElement).closest('[data-row-action]')) return
                go('detail', c.id)
              }}
              onKeyDown={(e) => {
                if (e.target !== e.currentTarget) return // 焦点在勾选框等内部控件时，空格不应触发整行跳转
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  go('detail', c.id)
                }
              }}
              className={`group flex cursor-pointer flex-col justify-between gap-4 rounded-2xl border p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-base-content/25 hover:shadow-[var(--shadow-lift)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:flex-row lg:items-center ${
                isSelected ? 'border-primary/40 bg-base-200/60 ring-2 ring-primary/15' : 'border-base-300 bg-base-100 shadow-[var(--shadow-paper)]'
              }`}
            >
              {/* 左：选择框 + 基本信息 */}
              <div className="flex min-w-[300px] items-start gap-3.5">
                <div data-row-action className="pt-1">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(c.id)}
                    aria-label={`选择 ${c.name}`}
                    className="checkbox checkbox-sm cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-semibold text-base-content group-hover:underline">{c.name}</span>
                    <span className="text-xs text-base-content/60">· {c.exp}</span>
                    <span className="text-xs text-base-content/60">· {c.edu.split('·')[0]}</span>
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                    <Chip tone="neutral">{pos?.name ?? c.role}</Chip>
                    <Chip tone="ghost">
                      {c.source}（{c.sourceId}）
                    </Chip>
                    <Chip tone={ATTACH_TONE[c.attachmentType]} className={c.attachmentType === 'missing' ? 'ring-1 ring-error/40' : ''}>
                      {ATTACH_LABEL[c.attachmentType]}
                    </Chip>
                    <Chip tone={AI_TONE[aiState]}>{AI_LABEL[aiState]}</Chip>
                  </div>
                </div>
              </div>

              {/* 中：AI 初筛结论 + 可展开的推荐理由与风险 */}
              <div className="flex-1 space-y-1.5 border-t border-base-300 pt-3 text-xs lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-base-content/60">{ai?.looseMatch ?? '尚未运行 AI 宽松初筛，保留原始简历供人工查看'}</span>
                  <span className="font-bold tabular-nums text-base-content">
                    契合度 <strong className="text-success">{c.match}%</strong>
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full border border-base-300 bg-base-200 p-0.5">
                  <div className="h-full rounded-full bg-success transition-all duration-700 ease-out" style={{ width: `${c.match}%` }} />
                </div>

                {aiState === 'not-run' ? (
                  <div className="text-[11px] text-base-content/50">无 AI 结论：未知信息不自动淘汰，由 HR 人工判断是否联系。</div>
                ) : (
                  <>
                    <button
                      type="button"
                      data-row-action
                      aria-expanded={expanded}
                      aria-controls={`ai-panel-${c.id}`}
                      onClick={() => toggleAi(c.id)}
                      className="btn btn-ghost btn-xs -ml-2"
                    >
                      {expanded ? '收起理由与风险' : `展开推荐理由 ${reasons.length} 条 / 风险 ${risks.length} 条`}
                    </button>

                    {expanded && (
                      <div id={`ai-panel-${c.id}`} className="space-y-2 rounded-xl border border-base-300 bg-base-200/60 p-2.5">
                        <div>
                          <div className="font-semibold text-base-content/70">推荐理由</div>
                          <ul className="mt-0.5 list-disc space-y-0.5 pl-4 text-base-content/70">
                            {reasons.length ? reasons.map((r) => <li key={r}>{r}</li>) : <li>无</li>}
                          </ul>
                        </div>
                        <div>
                          <div className="font-semibold text-base-content/70">风险提示</div>
                          <ul className="mt-0.5 list-disc space-y-0.5 pl-4 text-base-content/70">
                            {risks.length ? risks.map((r) => <li key={r}>{r}</li>) : <li>无</li>}
                          </ul>
                        </div>
                        {c.attachmentType === 'missing' && (
                          <div className="font-medium text-error">附件原件缺失，仅平台文本可用；联系前需请候选人补交原件。</div>
                        )}
                        <div className="text-[11px] text-base-content/50">来源库最后更新：{c.sourceUpdatedAt ?? '未记录'}</div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* 右：阶段、负责人与操作 */}
              <div data-row-action className="flex shrink-0 items-center justify-between gap-3.5 border-t border-base-300 pt-3 lg:justify-end lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                <div className="text-right text-xs">
                  <Chip tone={STAGE_TONE[c.status] ?? 'ghost'}>{c.status}</Chip>
                  <div className="mt-1 text-[11px] text-base-content/60">负责人：{c.assignee}</div>
                  {c.nextAction && <div className="mt-0.5 max-w-[190px] text-[11px] text-base-content/50">下一步：{c.nextAction.text}</div>}
                </div>

                <Btn variant="outline" className="!h-8 !px-3.5" onClick={() => go('detail', c.id)}>
                  一页贯通详情
                </Btn>
              </div>
            </div>
          )
        })}

        {!list.length && (
          <div className="card card-border bg-base-100 shadow-[var(--shadow-paper)]">
            <div className="card-body">
              <Empty
                title="未检索到符合条件的候选人"
                hint="可放宽岗位 / 阶段 / 渠道 / 负责人筛选，或清空关键词后重试"
                action={hasFilter ? <Btn variant="ghost" onClick={resetFilters}>重置筛选条件</Btn> : undefined}
              />
            </div>
          </div>
        )}
      </div>

      {/* 批量分配负责人弹窗（统一使用 ui.tsx 的 Modal：焦点锁定 / Esc 关闭 / 点遮罩关闭） */}
      <Modal
        open={batchModal}
        onClose={() => setBatchModal(false)}
        title="批量分配 HR 负责人"
        sub={`已选 ${selectedIds.length} 位候选人，分配后立即生效并写入跟进记录`}
        footer={
          <>
            <Btn variant="ghost" onClick={() => setBatchModal(false)}>
              取消
            </Btn>
            <Btn variant="solid" onClick={handleBatchAssign} disabled={!canAssign || !selectedIds.length}>
              确认分配（{selectedIds.length} 人）
            </Btn>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          <Field label="指派给" htmlFor="batch-assignee" hint="仅 HR 具备候选人分配权限；分配结果会同步到候选人大池列表" required>
            <select id="batch-assignee" value={targetAssignee} onChange={(e) => setTargetAssignee(e.target.value)} className="select w-full">
              {assignableOptions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </Field>

          <div className="rounded-xl border border-base-300 bg-base-200/60 p-3">
            <div className="font-semibold text-base-content/70">待分配名单（{selectedIds.length} 人）</div>
            <ul className="mt-1 space-y-0.5 text-base-content/70">
              {candidates
                .filter((c) => selectedIds.includes(c.id))
                .map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2">
                    <span>
                      {c.name} · {c.role}
                    </span>
                    <span className="text-base-content/50">现负责人：{c.assignee}</span>
                  </li>
                ))}
            </ul>
          </div>

          {!canAssign && <div className="text-error">当前角色无「分配候选人」权限，请联系 HR 或管理员操作。</div>}
        </div>
      </Modal>
    </div>
  )
}
