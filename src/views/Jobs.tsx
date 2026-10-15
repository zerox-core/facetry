import type React from 'react'
import { useEffect, useState, type CSSProperties } from 'react'
import { candidates, JD_TEMPLATES, type JD, type Position } from '../data'
import { addJd, addPosition, demoNow, findJd, jds, positions, updateJd, updatePosition, useStore } from '../store'
import type { Go } from '../App'
import { Btn, Card, Chip, Empty, Field, Label, Modal, type Tone } from './ui'

/* ───────────── 岗位管理（模块 A / B5）─────────────
   在招岗位维护 + 来源库岗位标识（FR-A1）+ BPM 岗位草稿同步占位（FR-B5，P1，仅前端）。
   颜色一律走 daisyUI 语义色；状态胶囊按真实 status 渲染，不再写死成功色。 */

/** 岗位状态口径：只有「招募中」计入在招岗位与 HC 统计。
    荧光青柠落点：「招募中」是当前态 → 实底荧光小块（accent），点用墨色保证荧光底上的对比 */
const POS_STATUS: Record<Position['status'], { tone: Tone; dot: string; hint: string }> = {
  招募中: { tone: 'accent', dot: 'status-neutral', hint: '计入在招口径：候选人入口、约面与 HC 统计生效' },
  已暂停: { tone: 'ghost', dot: 'status-warning', hint: '已下架：不计入在招与 HC 口径，候选人关联保留，可随时恢复' },
  已归档: { tone: 'ghost', dot: 'status-neutral', hint: '仅作历史留存，不再进入在招口径，可恢复为招募中' },
}
const POS_STATUS_OPTIONS: Position['status'][] = ['招募中', '已暂停', '已归档']

/** 候选人阶段胶囊（阶段取值来自 data.ts 的 STAGES，这里只映射展示色调） */
const STAGE_TONE: Record<string, Tone> = {
  新入库: 'ghost',
  筛选中: 'info',
  待联系: 'ghost',
  约面中: 'neutral',
  面评中: 'info',
  待录取: 'success',
  已完成: 'success',
  搁置: 'ghost',
  已淘汰: 'error',
}

/** 日期一律按本地口径渲染 YYYY-MM-DD：经 toISOString 反推会按 UTC 差一天 */
function localDate(v?: string): string {
  if (!v) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return v
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 需要 form 属性把按钮关联到弹窗内表单时使用（ui.tsx 的 Btn 不接受 form 属性） */
function SubmitBtn({ form, disabled, children }: { form: string; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      form={form}
      disabled={disabled}
      className="btn btn-primary h-9 min-h-9 rounded-full px-4 text-xs font-medium tracking-tight"
    >
      {children}
    </button>
  )
}

/** HC 进度条：挂载后从 0 过渡到目标百分比（--dur-slow 600ms 档），不做无限循环动画 */
function HcBar({ pct, ariaLabel, className = 'mt-1' }: { pct: number; ariaLabel?: string; className?: string }) {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const raf = requestAnimationFrame(() => setWidth(pct))
    return () => cancelAnimationFrame(raf)
  }, [pct])
  return (
    <div
      className={`h-1 w-full overflow-hidden rounded-full bg-base-200 ${className}`}
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="motion-meter h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
    </div>
  )
}

type PosForm = {
  name: string
  jdId: string
  dept: string
  recruiter: string
  hiringManager: string
  hc: number
  hired: number
  status: Position['status']
}

type JdForm = {
  title: string
  dept: string
  exp: string
  edu: string
  salary: string
  skills: string[]
  summary: string
  responsibilities: string
  requirements: string
}

const emptyPosForm = (jdId: string): PosForm => ({
  name: '',
  jdId,
  dept: '技术部',
  recruiter: '林婉 (HRG)',
  hiringManager: '技术主管',
  hc: 2,
  hired: 0,
  status: '招募中',
})

const emptyJdForm = (dept: string): JdForm => ({
  title: '',
  dept,
  exp: '3-5 年',
  edu: '本科及以上',
  salary: '25k-35k · 14薪',
  skills: ['React / TypeScript'],
  summary: '负责业务核心链路研发与架构建设。',
  responsibilities: '负责核心业务系统的模块设计与代码实现。\n持续改善系统稳定性和用户体验。',
  requirements: '统招本科及以上，相关领域 3 年以上扎实经历。\n具备良好的团队协作与抗压能力。',
})

export default function Jobs({ go }: { go: Go }) {
  // 订阅 store：下架 / 恢复 / 换绑标尺等模块级改动后本页必须重渲染
  useStore()

  // 选中的岗位 ID（右翼白皮书直接原地联动展示其装配的 JD）
  const [selectedPosId, setSelectedPosId] = useState<string>(positions[0]?.id ?? '')
  const [editingPos, setEditingPos] = useState<Position | 'new' | null>(null)
  const [editingJd, setEditingJd] = useState<JD | 'new' | null>(null)
  // JD 弹窗由「新建/编辑岗位」表单唤起时记录来源，保存后只回填该表单，不误改当前选中的其他岗位
  const [jdLinkTarget, setJdLinkTarget] = useState<'pos-form' | null>(null)
  // 上下架的二次确认（破坏性操作必须确认并说明后果）
  const [confirmStatus, setConfirmStatus] = useState<{ pos: Position; next: Position['status'] } | null>(null)
  // 岗位 → 候选人入口
  const [candidatePanel, setCandidatePanel] = useState<Position | null>(null)
  // BPM 岗位草稿同步：P1 仅前端占位，不做任何接口调用
  const [bpmAttemptAt, setBpmAttemptAt] = useState<string | null>(null)
  const [bpmNotice, setBpmNotice] = useState(false)

  const [posForm, setPosForm] = useState<PosForm>(() => emptyPosForm(jds[0]?.id ?? ''))
  const [jdForm, setJdForm] = useState<JdForm>(() => emptyJdForm('技术部 · 业务研发组'))
  const [tagInput, setTagInput] = useState('')

  const activePos = positions.find((p) => p.id === selectedPosId) ?? positions[0]
  const boundJd = activePos ? findJd(activePos.jdId) : undefined

  const openCount = positions.filter((p) => p.status === '招募中').length
  const pausedCount = positions.filter((p) => p.status === '已暂停').length
  const archivedCount = positions.filter((p) => p.status === '已归档').length
  const recruiting = positions.filter((p) => p.status === '招募中')
  const totalHc = recruiting.reduce((acc, p) => acc + (p.hc || 0), 0)
  const totalHired = recruiting.reduce((acc, p) => acc + (p.hired || 0), 0)
  const hcRate = totalHc ? Math.min(100, Math.round((totalHired / totalHc) * 100)) : 0
  const boundCount = positions.filter((p) => !!findJd(p.jdId)).length

  /* ── 岗位弹窗 ── */
  const openNewPos = () => {
    setPosForm(emptyPosForm(boundJd?.id ?? jds[0]?.id ?? ''))
    setEditingPos('new')
  }

  const openEditPos = (p: Position) => {
    setPosForm({
      name: p.name,
      jdId: p.jdId,
      dept: p.dept,
      recruiter: p.recruiter,
      hiringManager: p.hiringManager,
      hc: p.hc,
      hired: p.hired,
      status: p.status,
    })
    setEditingPos(p)
  }

  const closePosModal = () => setEditingPos(null)

  const savePos = (e: React.FormEvent) => {
    e.preventDefault()
    if (!posForm.name.trim() || !posForm.jdId) return
    if (editingPos === 'new') {
      const created = addPosition({ ...posForm, name: posForm.name.trim() })
      setSelectedPosId(created.id)
    } else if (editingPos) {
      updatePosition(editingPos.id, { ...posForm, name: posForm.name.trim() })
    }
    setEditingPos(null)
  }

  /* ── JD 弹窗 ── */
  const openNewJd = (from: 'pos-form' | null) => {
    setJdForm(emptyJdForm(activePos?.dept || '技术部 · 创新业务组'))
    setJdLinkTarget(from)
    setEditingJd('new')
  }

  const openEditJd = (j: JD) => {
    setJdForm({
      title: j.title,
      dept: j.dept,
      exp: j.exp,
      edu: j.edu,
      salary: j.salary,
      skills: [...j.skills],
      summary: j.summary,
      responsibilities: j.responsibilities.join('\n'),
      requirements: j.requirements.join('\n'),
    })
    setJdLinkTarget(null)
    setEditingJd(j)
  }

  const closeJdModal = () => {
    setEditingJd(null)
    setJdLinkTarget(null)
  }

  const loadTemplate = (idx: number) => {
    const t = JD_TEMPLATES[idx]
    if (!t) return
    setJdForm({
      title: t.title,
      dept: t.dept,
      exp: t.exp,
      edu: t.edu,
      salary: t.salary,
      skills: [...t.skills],
      summary: t.summary,
      responsibilities: t.responsibilities.join('\n'),
      requirements: t.requirements.join('\n'),
    })
  }

  const saveJd = (e: React.FormEvent) => {
    e.preventDefault()
    if (!jdForm.title.trim()) return
    const payload = {
      title: jdForm.title.trim(),
      dept: jdForm.dept.trim(),
      exp: jdForm.exp.trim(),
      edu: jdForm.edu.trim(),
      salary: jdForm.salary.trim(),
      skills: jdForm.skills.filter(Boolean),
      summary: jdForm.summary.trim(),
      responsibilities: jdForm.responsibilities.split('\n').map((s) => s.trim()).filter(Boolean),
      requirements: jdForm.requirements.split('\n').map((s) => s.trim()).filter(Boolean),
    }
    if (editingJd === 'new') {
      const created = addJd(payload)
      // 只有从岗位表单唤起时才把新标尺回填给「正在创建/编辑的那个岗位」
      if (jdLinkTarget === 'pos-form') setPosForm((prev) => ({ ...prev, jdId: created.id }))
    } else if (editingJd) {
      updateJd(editingJd.id, payload)
    }
    closeJdModal()
  }

  const addTag = () => {
    const v = tagInput.trim()
    if (v && !jdForm.skills.includes(v)) {
      setJdForm((prev) => ({ ...prev, skills: [...prev.skills, v] }))
      setTagInput('')
    }
  }

  /* ── 上下架 / 岗位数据统计 ── */
  const applyStatusChange = () => {
    if (!confirmStatus) return
    updatePosition(confirmStatus.pos.id, { status: confirmStatus.next })
    setConfirmStatus(null)
  }

  const statForPos = (posId: string) => {
    const matched = candidates.filter((c) => c.positionId === posId)
    const sessions = matched.filter((c) => c.scheduleDetail)
    return {
      total: matched.length,
      inflight: matched.filter((c) => c.status === '约面中' || c.status === '面评中').length,
      sessions: sessions.length,
      scheduled: sessions.filter((c) => c.scheduleDetail?.status === 'scheduled').length,
    }
  }

  const panelCandidates = candidatePanel ? candidates.filter((c) => c.positionId === candidatePanel.id) : []

  /* ── 空态：一个岗位都没有时不留白 ── */
  if (!positions.length) {
    return (
      <div className="space-y-7">
        <h1 className="text-2xl font-bold tracking-tight text-base-content">岗位管理</h1>
        <Card className="p-2">
          <Empty
            title="暂无在招岗位"
            hint="岗位用于串联候选人、约面与录取申请；先新建一个岗位并装配标准 JD 标尺。"
            action={<Btn onClick={openNewPos}>新建岗位</Btn>}
          />
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-9">
      {/* 页头：标题 + 同步入口 + 岗位状态统计 */}
      <div className="ws-rise flex flex-col gap-7 border-b border-base-300 pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-base-content sm:text-3xl">在招岗位与能力标尺</h1>
            <Chip tone="ghost" title="只有招募中的岗位计入在招口径">
              在招 {openCount}
            </Chip>
            {pausedCount > 0 && <span className="text-xs text-base-content/60">已暂停 {pausedCount}</span>}
            {archivedCount > 0 && <span className="text-xs text-base-content/60">已归档 {archivedCount}</span>}
          </div>
          <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-base-content/60">
            岗位关联来源库岗位标识（FR-A1）· 装配标准 JD 标尺统一初筛与出题口径 · 已批准岗位可同步 BPM 生成草稿（FR-B5，P1）
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-4">
          <Btn variant="ghost" onClick={() => openNewJd(null)}>
            + 拟定新用人标尺 (JD)
          </Btn>
          <Btn variant="solid" onClick={openNewPos}>
            + 新建岗位
          </Btn>
        </div>
      </div>

      {/* BPM 岗位草稿同步：P1 前端占位，不调用任何接口 */}
      <Card className="ws-rise [--i:1] flex flex-col gap-4 p-5 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-base-content">BPM 岗位草稿同步</span>
            <Chip tone="info">草稿 · 待接入</Chip>
            <Chip tone="ghost">P1 · FR-B5</Chip>
          </div>
          <p className="mt-1.5 max-w-3xl text-xs leading-relaxed text-base-content/60">
            接入后按已批准岗位同步名称、职责与要求，生成岗位草稿再人工确认上架；与录取审批是两条独立对接，不互为前置条件。
          </p>
          <p className="mt-1 text-xs text-base-content/50">
            最近同步：
            {bpmAttemptAt
              ? `${bpmAttemptAt}（本地演示记录，未产生草稿）`
              : '暂无记录 · 接口待接入（BPM 认证与字段映射尚未开放）'}
          </p>
        </div>
        <Btn
          variant="outline"
          className="shrink-0"
          ariaLabel="从 BPM 同步岗位草稿（当前待接入）"
          onClick={() => {
            setBpmAttemptAt(demoNow())
            setBpmNotice(true)
          }}
        >
          从 BPM 同步岗位
        </Btn>
      </Card>

      {bpmNotice && (
        <div className="alert alert-soft alert-info ws-rise items-start text-xs" role="status">
          <span className="leading-relaxed">
            BPM 岗位同步（P1）尚未接入：本页只保留入口、草稿位与最近同步时间字段，未发起任何后端 / 接口调用。
            接入后将在此列出草稿（岗位名称 / 职责 / 要求）并支持人工确认上架。
          </span>
          <button type="button" className="btn btn-ghost btn-xs" onClick={() => setBpmNotice(false)}>
            知道了
          </button>
        </div>
      )}

      {/* 概览指标 */}
      <div className="ws-rise [--i:2] grid gap-5 sm:grid-cols-3">
        <Card className="p-5">
          <Label>在招岗位（招募中）</Label>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold tabular-nums tracking-tight text-base-content">
              {openCount} <span className="text-xs font-normal text-base-content/60">个岗位进行中</span>
            </span>
            <span className="text-xs font-semibold text-base-content">
              {totalHired} / {totalHc} HC
            </span>
          </div>
          <HcBar pct={hcRate} ariaLabel="在招岗位 HC 完成度" className="mt-2.5" />
          <p className="mt-2 text-xs text-base-content/50">
            已暂停 {pausedCount} · 已归档 {archivedCount}（不计入在招口径）
          </p>
        </Card>

        <Card className="p-5">
          <Label>标准用人标尺库 (JD Repository)</Label>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold tabular-nums tracking-tight text-base-content">
              {jds.length} <span className="text-xs font-normal text-base-content/60">套标准化指标</span>
            </span>
            <Chip tone="ghost">
              {boundCount} / {positions.length} 已装配
            </Chip>
          </div>
          <p className="mt-2 truncate text-xs text-base-content/60">
            已涵盖：{jds.map((j) => j.title).join('、') || '暂无标尺'}
          </p>
        </Card>

        <Card className="p-5">
          <Label>在池对标候选人</Label>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold tabular-nums tracking-tight text-base-content">
              {candidates.length} <span className="text-xs font-normal text-base-content/60">人全链路推进中</span>
            </span>
            <Btn variant="ghost" ariaLabel="前往候选人大池" onClick={() => go('candidates')}>
              前往人才库
            </Btn>
          </div>
          <p className="mt-2 text-xs text-base-content/60">
            {recruiting.reduce((acc, p) => acc + statForPos(p.id).inflight, 0)} 人在在招岗位的约面 / 面评环节
          </p>
        </Card>
      </div>

      {/* 主体：左翼岗位列表 + 右翼标尺白皮书 */}
      <div className="ws-rise [--i:3] grid items-start gap-9 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.18fr)]">
        <div className="space-y-5">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold tracking-tight text-base-content">业务岗位编制矩阵（{positions.length}）</h2>
            <span className="text-xs text-base-content/50">选中岗位后在右侧原地对标标尺</span>
          </div>

          <div className="stagger space-y-4">
            {positions.map((p, i) => {
              const jd = findJd(p.jdId)
              const stat = statForPos(p.id)
              const isSelected = p.id === activePos?.id
              const st = POS_STATUS[p.status]
              const hcPct = p.hc ? Math.min(100, Math.round((p.hired / p.hc) * 100)) : 0

              return (
                <div key={p.id} style={{ '--i': Math.min(i, 7) } as CSSProperties}>
                  <Card
                    className={`motion-pop p-0 hover:shadow-[var(--shadow-lift)] ${isSelected ? 'border-primary' : ''}`}
                  >
                    {/* 可点击区域：只承载信息，操作按钮放在下面的独立行，避免嵌套交互元素 */}
                    <div
                      role="button"
                      tabIndex={0}
                      aria-pressed={isSelected}
                      aria-label={`对标 ${p.name} 的能力标尺`}
                      onClick={() => setSelectedPosId(p.id)}
                      onKeyDown={(e) => {
                        if (e.target !== e.currentTarget) return
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setSelectedPosId(p.id)
                        }
                      }}
                      className="card-body cursor-pointer gap-0 rounded-2xl p-5 pb-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <Chip tone="ghost">
                          {p.dept} · {p.code}
                        </Chip>
                        <Chip tone={st.tone} title={st.hint}>
                          <span className={`status status-sm ${st.dot}`} aria-hidden="true" />
                          {p.status}
                        </Chip>
                      </div>

                      <h3 className="card-title mt-2.5 flex items-center justify-between text-base font-semibold tracking-tight text-base-content">
                        <span className="min-w-0">{p.name}</span>
                        {isSelected && <span className="text-xs font-semibold text-base-content/60">正在对标</span>}
                      </h3>

                      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                        <Chip tone="ghost" title={jd ? '该岗位初筛基准与 AI 出题依据' : '尚未装配标尺'}>
                          标尺：{jd ? `${jd.title}（${jd.code}）` : '未装配'}
                        </Chip>
                        <span className="text-base-content/60">{jd?.salary ?? '薪酬待定'}</span>
                      </div>

                      {/* 来源库岗位标识：只读 */}
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                        <span className="font-mono text-base-content">
                          来源库岗位标识：{p.sourcePositionId ?? '未关联'}
                        </span>
                        <span className="text-base-content/50">来自来源库，本地不可修改</span>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-5 border-t border-base-300 pt-3 text-xs text-base-content/60">
                        <div>
                          <div className="flex items-center justify-between text-xs">
                            <span>招聘 HC</span>
                            <span className="font-semibold text-base-content">
                              {p.hired} / {p.hc}
                            </span>
                          </div>
                          <HcBar pct={hcPct} ariaLabel={`${p.name} 的 HC 完成度`} />
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span>
                            负责 HR：<strong className="font-medium text-base-content">{p.recruiter.split(' ')[0]}</strong>
                          </span>
                          <span>建编 {localDate(p.createdAt)}</span>
                        </div>
                      </div>
                    </div>

                    {/* 操作行 */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-base-300 px-5 py-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <Btn
                          variant="ghost"
                          ariaLabel={`查看岗位 ${p.name} 的候选人（进入候选人大池按本岗位口径）`}
                          title="进入候选人大池，按本岗位筛选口径查看"
                          onClick={() => setCandidatePanel(p)}
                        >
                          已对标候选人 {stat.total} 人
                        </Btn>
                        <Btn
                          variant="ghost"
                          ariaLabel={`前往约面管理查看岗位 ${p.name} 的 ${stat.sessions} 场面试`}
                          title="前往约面管理：改期、取消与通知状态"
                          onClick={() => go('schedule')}
                        >
                          {stat.sessions} 场面试
                          {stat.scheduled > 0 && <span className="text-base-content/50">（{stat.scheduled} 场待进行）</span>}
                        </Btn>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <Btn variant="ghost" ariaLabel={`编辑岗位 ${p.name}`} onClick={() => openEditPos(p)}>
                          编辑
                        </Btn>
                        {p.status === '招募中' ? (
                          <Btn
                            variant="ghost"
                            className="text-error"
                            ariaLabel={`下架岗位 ${p.name}`}
                            onClick={() => setConfirmStatus({ pos: p, next: '已暂停' })}
                          >
                            下架
                          </Btn>
                        ) : (
                          <Btn
                            variant="ghost"
                            ariaLabel={`恢复岗位 ${p.name} 为招募中`}
                            onClick={() => setConfirmStatus({ pos: p, next: '招募中' })}
                          >
                            恢复
                          </Btn>
                        )}
                      </div>
                    </div>
                    </Card>
                </div>
              )
            })}
          </div>
        </div>

        {/* 右翼：标尺白皮书 */}
        <div className="sticky top-20">
          <Card className="p-7">
            {!boundJd ? (
              <Empty
                title="当前岗位尚未装配 JD 标尺"
                hint="请在表单中为该岗位选择或新建一份标准标尺；未装配标尺时初筛基准与 AI 出题无法联动。"
                action={
                  activePos && (
                    <Btn variant="solid" onClick={() => openEditPos(activePos)}>
                      去装配标尺
                    </Btn>
                  )
                }
              />
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-base-300 pb-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-mono text-xs font-semibold tracking-wide text-base-content">
                        {boundJd.code} · 标准能力白皮书
                      </span>
                      <Chip tone="ghost">最后修订 {localDate(boundJd.updatedAt)}</Chip>
                    </div>
                    <h3 className="mt-1 text-2xl font-bold tracking-tight text-base-content">{boundJd.title}</h3>
                    <p className="mt-1 text-xs text-base-content/60">
                      当前已装配至岗位：<strong className="text-base-content">{activePos?.name}</strong>
                    </p>
                    <p className="mt-1 font-mono text-xs text-base-content/60">
                      来源库岗位标识：{activePos?.sourcePositionId ?? '未关联'}
                      <span className="ml-1 font-sans text-base-content/50">（只读，来源库 / BPM 写入）</span>
                    </p>
                  </div>
                  <Btn variant="outline" onClick={() => openEditJd(boundJd)} ariaLabel="修订当前标尺">
                    修订标尺
                  </Btn>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-3 text-xs">
                  <Chip tone="neutral">薪酬范围 {boundJd.salary}</Chip>
                  <Chip tone="ghost">经验门槛 {boundJd.exp}</Chip>
                  <Chip tone="ghost">学历门槛 {boundJd.edu}</Chip>
                </div>

                <div className="mt-5">
                  <Label>核心考核技能基准（AI 定制出题依据）</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {boundJd.skills.map((s) => (
                      <span key={s} className="badge badge-sm badge-soft border-none font-medium">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-5 rounded-2xl bg-base-200/70 p-4 text-xs leading-relaxed text-base-content/80">
                  <strong className="font-semibold text-base-content">岗位定位：</strong>
                  {boundJd.summary || '尚未填写岗位定位。'}
                </div>

                <div className="mt-5">
                  <Label>岗位职责标准</Label>
                  <ul className="mt-2 list-disc space-y-2 pl-4 text-xs leading-relaxed text-base-content/80">
                    {boundJd.responsibilities.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>

                <div className="mt-5">
                  <Label>任职资格与考核要点（对标初筛基准）</Label>
                  <ul className="mt-2 list-disc space-y-2 pl-4 text-xs leading-relaxed text-base-content/80">
                    {boundJd.requirements.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>

                <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-base-300 pt-4">
                  <Field label="为该岗位更换装配标尺" htmlFor="pos-rebind" className="min-w-0 flex-1">
                    <select
                      id="pos-rebind"
                      value={activePos?.jdId ?? ''}
                      onChange={(e) => {
                        if (activePos) updatePosition(activePos.id, { jdId: e.target.value })
                      }}
                      className="select w-full max-w-xs"
                      aria-label="为该岗位更换装配标尺"
                    >
                      {jds.map((j) => (
                        <option key={j.id} value={j.id}>
                          {j.code} · {j.title}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              </>
            )}
          </Card>
        </div>
      </div>

      {/* 弹窗 1：新建 / 编辑岗位 */}
      <Modal
        open={!!editingPos && !jdLinkTarget}
        onClose={closePosModal}
        title={editingPos === 'new' ? '新建在招岗位' : '编辑在招岗位'}
        sub="装配一份标准 JD 作为初筛与出题的对标基准；岗位标识由来源库 / BPM 写入，本地不可修改"
        className="md:max-w-2xl"
        footer={
          <>
            <Btn variant="ghost" onClick={closePosModal}>
              取消
            </Btn>
            <SubmitBtn form="pos-form" disabled={!posForm.name.trim() || !posForm.jdId}>
              保存岗位
            </SubmitBtn>
          </>
        }
      >
        <form id="pos-form" onSubmit={savePos} className="space-y-5">
          <Field label="在招岗位名称" htmlFor="pos-name" required hint="例如：商业化大前端研发组 · 高级前端工程师">
            <input
              id="pos-name"
              required
              value={posForm.name}
              onChange={(e) => setPosForm({ ...posForm, name: e.target.value })}
              placeholder="填写对外使用的岗位名称"
              className="input w-full"
            />
          </Field>

          <Field label="装配标准能力标尺 (JD)" htmlFor="pos-jd" required hint="初筛基准、面试题与评价维度都按此标尺联动">
            <div className="flex items-center gap-3">
              <select
                id="pos-jd"
                value={posForm.jdId}
                onChange={(e) => setPosForm({ ...posForm, jdId: e.target.value })}
                className="select w-full"
              >
                {jds.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.code} · {j.title}（{j.exp} / {j.salary}）
                  </option>
                ))}
              </select>
              <Btn variant="ghost" className="shrink-0" onClick={() => openNewJd('pos-form')}>
                + 拟定新 JD
              </Btn>
            </div>
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="所属部门" htmlFor="pos-dept">
              <input
                id="pos-dept"
                value={posForm.dept}
                onChange={(e) => setPosForm({ ...posForm, dept: e.target.value })}
                className="input w-full"
              />
            </Field>
            <Field label="招聘编制 (HC)" htmlFor="pos-hc">
              <input
                id="pos-hc"
                type="number"
                min="1"
                value={posForm.hc}
                onChange={(e) => setPosForm({ ...posForm, hc: Number(e.target.value) })}
                className="input w-full"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="负责 HR" htmlFor="pos-recruiter">
              <input
                id="pos-recruiter"
                value={posForm.recruiter}
                onChange={(e) => setPosForm({ ...posForm, recruiter: e.target.value })}
                className="input w-full"
              />
            </Field>
            <Field label="用人主管 / 面试官" htmlFor="pos-manager">
              <input
                id="pos-manager"
                value={posForm.hiringManager}
                onChange={(e) => setPosForm({ ...posForm, hiringManager: e.target.value })}
                className="input w-full"
              />
            </Field>
          </div>

          <Field label="岗位状态" htmlFor="pos-status" hint={POS_STATUS[posForm.status].hint}>
            <select
              id="pos-status"
              value={posForm.status}
              onChange={(e) => setPosForm({ ...posForm, status: e.target.value as Position['status'] })}
              className="select w-full"
            >
              {POS_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="来源库岗位标识 (sourcePositionId)"
            htmlFor="pos-source"
            hint="只读：由来源库 / BPM 同步写入的岗位唯一识别码（形如 SRC-POS-…），工作台内不可修改。"
          >
            <input
              id="pos-source"
              readOnly
              aria-readonly="true"
              value={
                editingPos && editingPos !== 'new'
                  ? editingPos.sourcePositionId ?? '未关联来源库岗位'
                  : '本地新建岗位：保存后等待来源库 / BPM 同步写入'
              }
              className="input w-full bg-base-200 font-mono text-xs"
            />
          </Field>
        </form>
      </Modal>

      {/* 弹窗 2：拟定 / 修订 JD */}
      <Modal
        open={!!editingJd}
        onClose={closeJdModal}
        title={editingJd === 'new' ? '拟定用人能力标尺 (JD)' : '修订用人能力标尺 (JD)'}
        sub="左侧定义标准，右侧实时排印生成白皮书规格样张"
        className="md:max-w-4xl"
        footer={
          <>
            <Btn variant="ghost" onClick={closeJdModal}>
              取消
            </Btn>
            <SubmitBtn form="jd-form" disabled={!jdForm.title.trim()}>
              {editingJd === 'new' ? '发布用人标尺' : '保存修订'}
            </SubmitBtn>
          </>
        }
      >
        <div className="-mx-5 -my-4">
          <div className="flex flex-wrap items-center gap-3 border-b border-base-300 bg-base-200/60 px-5 py-3">
            <span className="text-xs text-base-content/60">套用模板：</span>
            {JD_TEMPLATES.map((tmpl, idx) => (
              <button
                key={tmpl.title}
                type="button"
                onClick={() => loadTemplate(idx)}
                className="btn btn-xs rounded-full"
              >
                {tmpl.title.slice(0, 6)}
              </button>
            ))}
          </div>

          <div className="grid md:grid-cols-2">
            <form id="jd-form" onSubmit={saveJd} className="space-y-5 border-base-300 p-6 md:border-r">
              <Field label="标尺职位名称" htmlFor="jd-title" required hint="用于岗位装配与能力对标展示">
                <input
                  id="jd-title"
                  required
                  value={jdForm.title}
                  onChange={(e) => setJdForm({ ...jdForm, title: e.target.value })}
                  placeholder="例如：高级前端开发工程师"
                  className="input w-full"
                />
              </Field>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="归属部门" htmlFor="jd-dept">
                  <input
                    id="jd-dept"
                    value={jdForm.dept}
                    onChange={(e) => setJdForm({ ...jdForm, dept: e.target.value })}
                    className="input w-full"
                  />
                </Field>
                <Field label="薪酬标准" htmlFor="jd-salary">
                  <input
                    id="jd-salary"
                    value={jdForm.salary}
                    onChange={(e) => setJdForm({ ...jdForm, salary: e.target.value })}
                    className="input w-full"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="经验门槛" htmlFor="jd-exp">
                  <input
                    id="jd-exp"
                    value={jdForm.exp}
                    onChange={(e) => setJdForm({ ...jdForm, exp: e.target.value })}
                    className="input w-full"
                  />
                </Field>
                <Field label="学历要求" htmlFor="jd-edu">
                  <input
                    id="jd-edu"
                    value={jdForm.edu}
                    onChange={(e) => setJdForm({ ...jdForm, edu: e.target.value })}
                    className="input w-full"
                  />
                </Field>
              </div>

              <Field label="岗位定位" htmlFor="jd-summary">
                <textarea
                  id="jd-summary"
                  rows={2}
                  value={jdForm.summary}
                  onChange={(e) => setJdForm({ ...jdForm, summary: e.target.value })}
                  className="textarea w-full leading-relaxed"
                />
              </Field>

              <Field label="核心考核技能" htmlFor="jd-tag" hint="输入技能后回车打标">
                <div className="flex flex-wrap gap-2 rounded-xl bg-base-200 p-2.5">
                  {jdForm.skills.map((s, idx) => (
                    <span key={s} className="badge badge-sm badge-soft gap-2 border-none bg-base-100 font-medium">
                      {s}
                      <button
                        type="button"
                        aria-label={`移除技能 ${s}`}
                        onClick={() => setJdForm({ ...jdForm, skills: jdForm.skills.filter((_, i) => i !== idx) })}
                        className="motion-pop cursor-pointer text-base-content/50 hover:text-error"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                  <input
                    id="jd-tag"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addTag()
                      }
                    }}
                    placeholder="输入技能后回车…"
                    className="min-w-[120px] flex-1 bg-transparent px-1 text-xs outline-none"
                  />
                </div>
              </Field>

              <Field label="核心职责" htmlFor="jd-resp" hint="每行一条">
                <textarea
                  id="jd-resp"
                  rows={3}
                  value={jdForm.responsibilities}
                  onChange={(e) => setJdForm({ ...jdForm, responsibilities: e.target.value })}
                  className="textarea w-full leading-relaxed"
                />
              </Field>

              <Field label="任职资格与考核重点" htmlFor="jd-req" hint="每行一条">
                <textarea
                  id="jd-req"
                  rows={3}
                  value={jdForm.requirements}
                  onChange={(e) => setJdForm({ ...jdForm, requirements: e.target.value })}
                  className="textarea w-full leading-relaxed"
                />
              </Field>
            </form>

            {/* 右侧规格样张 */}
            <div className="flex flex-col justify-between gap-5 bg-base-200/60 p-6">
              <div className="rounded-2xl bg-base-100 p-6 shadow-[var(--shadow-paper)]">
                <div className="border-b border-base-300 pb-3">
                  <span className="font-mono text-xs font-semibold tracking-wide text-base-content">
                    FACETRY SPEC SHEET · PRO V1.0
                  </span>
                  <h4 className="mt-1 text-xl font-semibold tracking-tight text-base-content">
                    {jdForm.title || '（职位标题待输入）'}
                  </h4>
                  <div className="mt-1.5 text-xs text-base-content/60">
                    {jdForm.dept} · {jdForm.exp} · {jdForm.edu} ·{' '}
                    <strong className="font-semibold text-base-content">{jdForm.salary}</strong>
                  </div>
                </div>

                <div className="mt-4">
                  <Label>岗位定位</Label>
                  <p className="mt-1 text-xs leading-relaxed text-base-content/80">{jdForm.summary || '（待输入）'}</p>
                </div>

                <div className="mt-4">
                  <Label>考核要项技能</Label>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {jdForm.skills.map((s) => (
                      <span key={s} className="badge badge-sm badge-soft border-none font-medium">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-4">
                  <Label>岗位职责要求</Label>
                  <ul className="mt-1.5 list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-base-content/80">
                    {jdForm.responsibilities
                      .split('\n')
                      .filter(Boolean)
                      .map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                  </ul>
                </div>

                <div className="mt-4">
                  <Label>考核指标</Label>
                  <ul className="mt-1.5 list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-base-content/80">
                    {jdForm.requirements
                      .split('\n')
                      .filter(Boolean)
                      .map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                  </ul>
                </div>
              </div>

              <p className="text-xs text-base-content/60">
                {jdLinkTarget === 'pos-form'
                  ? '保存后自动装配到正在创建的岗位，不影响其他岗位的标尺。'
                  : '修订已发布标尺会立即对所有装配该标尺的岗位生效。'}
              </p>
            </div>
          </div>
        </div>
      </Modal>

      {/* 弹窗 3：下架 / 恢复二次确认 */}
      <Modal
        open={!!confirmStatus}
        onClose={() => setConfirmStatus(null)}
        title={confirmStatus?.next === '已暂停' ? '确认下架该岗位？' : '确认恢复该岗位？'}
        sub={confirmStatus?.pos.name}
        footer={
          <>
            <Btn variant="ghost" onClick={() => setConfirmStatus(null)}>
              取消
            </Btn>
            <Btn
              variant={confirmStatus?.next === '已暂停' ? 'danger' : 'solid'}
              onClick={applyStatusChange}
              ariaLabel={confirmStatus?.next === '已暂停' ? '确认下架该岗位' : '确认恢复该岗位'}
            >
              {confirmStatus?.next === '已暂停' ? '确认下架' : '确认恢复'}
            </Btn>
          </>
        }
      >
        <p className="text-xs leading-relaxed text-base-content/80">
          {confirmStatus?.next === '已暂停' ? (
            <>
              下架后岗位状态变为「已暂停」：不再计入在招岗位与 HC 口径，但仍保留在列表中可查看。
              <br />
              该岗位已关联的候选人、面试场次与录取申请记录<b>全部保留</b>，可随时「恢复」为招募中；不会删除任何数据。
            </>
          ) : (
            <>
              恢复后岗位状态变为「招募中」，重新计入在招口径（HC 统计、候选人入口、约面统计）。
              <br />
              既有候选人关联与历史记录不变。
            </>
          )}
        </p>
      </Modal>

      {/* 弹窗 4：岗位候选人入口（带上岗位语义） */}
      <Modal
        open={!!candidatePanel}
        onClose={() => setCandidatePanel(null)}
        title={`岗位候选人 · ${candidatePanel?.name ?? ''}`}
        sub={`来源库岗位标识 ${candidatePanel?.sourcePositionId ?? '未关联'} · 共 ${panelCandidates.length} 人`}
        className="md:max-w-2xl"
        footer={
          <>
            <Btn variant="ghost" onClick={() => setCandidatePanel(null)}>
              关闭
            </Btn>
            <Btn
              variant="solid"
              ariaLabel="进入候选人大池按该岗位筛选"
              onClick={() => {
                setCandidatePanel(null)
                go('candidates')
              }}
            >
              进入候选人大池
            </Btn>
          </>
        }
      >
        {panelCandidates.length ? (
          <>
            <p className="mb-3 text-xs text-base-content/60">
              下列为「{candidatePanel?.name}」口径下的候选人。候选人大池暂未接收岗位参数，进入后请在「岗位」筛选中选择本岗位。
            </p>
            <ul className="list stagger">
              {panelCandidates.map((c, i) => (
                <li
                  key={c.id}
                  style={{ '--i': Math.min(i, 7) } as CSSProperties}
                  className="motion-pop list-row items-center gap-4 rounded-xl px-0 hover:bg-base-200/50"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-sm font-semibold text-base-content">{c.name}</span>
                      <Chip tone={STAGE_TONE[c.status] ?? 'ghost'}>{c.status}</Chip>
                      <span className="text-xs text-base-content/50">渠道 {c.source}</span>
                    </div>
                    <p className="mt-1 truncate text-xs text-base-content/60">
                      {c.nextAction ? `下一步：${c.nextAction.text} · ${c.nextAction.owner}` : c.aiScreening?.looseMatch || c.summary}
                    </p>
                  </div>
                  <Btn variant="ghost" ariaLabel={`查看候选人 ${c.name} 的详情`} onClick={() => go('detail', c.id)}>
                    详情
                  </Btn>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <Empty
            title="该岗位暂无候选人"
            hint="候选人由来源库同步后按岗位关联入库；可在候选人大池按渠道或阶段继续检索。"
            action={<Btn onClick={() => go('candidates')}>前往候选人大池</Btn>}
          />
        )}
      </Modal>
    </div>
  )
}
