import type React from 'react'
import { useState } from 'react'
import { candidates, JD_TEMPLATES, type JD, type Position } from '../data'
import { addJd, addPosition, commit, findJd, jds, positions, updateJd, updatePosition } from '../store'
import type { Go } from '../App'
import { Btn, Card } from './ui'

export default function Jobs({ go }: { go: Go }) {
  // 选中的岗位 ID（右翼白皮书直接原地联动展示其装配的 JD）
  const [selectedPosId, setSelectedPosId] = useState<string>(positions[0]?.id ?? '')
  const [editingPos, setEditingPos] = useState<Position | 'new' | null>(null)
  const [editingJd, setEditingJd] = useState<JD | 'new' | null>(null)

  const activePos = positions.find((p) => p.id === selectedPosId) || positions[0]
  const boundJd = activePos ? findJd(activePos.jdId) : jds[0]

  // 岗位弹窗表单状态
  const [posForm, setPosForm] = useState({
    name: '',
    jdId: jds[0]?.id ?? '',
    dept: '技术部',
    recruiter: '林婉 (HRG)',
    hiringManager: '技术主管',
    hc: 2,
    hired: 0,
    status: '招募中' as Position['status'],
  })

  // JD 抽屉表单状态
  const [jdForm, setJdForm] = useState({
    title: '',
    dept: '技术部 · 业务研发组',
    exp: '3-5 年',
    edu: '本科及以上',
    salary: '25k-35k · 14薪',
    skills: ['React', 'TypeScript', '工程化'],
    summary: '',
    responsibilities: '主导核心业务系统前端架构设计与性能调优。\n沉淀跨业务通用组件与工程规范。',
    requirements: '3 年以上大型中后台研发经验，精通核心技术栈。\n具备量化性能调优战果与架构抽象能力。',
  })
  const [tagInput, setTagInput] = useState('')

  // 打开新建岗位
  const openNewPos = () => {
    setPosForm({
      name: '',
      jdId: boundJd?.id ?? jds[0]?.id ?? '',
      dept: '技术部',
      recruiter: '林婉 (HRG)',
      hiringManager: '技术主管',
      hc: 2,
      hired: 0,
      status: '招募中',
    })
    setEditingPos('new')
  }

  // 打开编辑岗位
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

  // 保存岗位
  const savePos = (e: React.FormEvent) => {
    e.preventDefault()
    if (!posForm.name.trim()) return
    if (editingPos === 'new') {
      const created = addPosition(posForm)
      setSelectedPosId(created.id)
    } else if (editingPos) {
      updatePosition(editingPos.id, posForm)
    }
    setEditingPos(null)
  }

  // 打开新建 JD
  const openNewJd = () => {
    setJdForm({
      title: '',
      dept: activePos?.dept || '技术部 · 创新业务组',
      exp: '3-5 年',
      edu: '本科及以上',
      salary: '25k-35k · 14薪',
      skills: ['React / TypeScript', '性能调优', '架构设计'],
      summary: '负责业务核心链路研发与架构建设。',
      responsibilities: '负责核心业务系统的模块设计与代码实现。\n持续改善系统稳定性和用户体验。',
      requirements: '统招本科及以上，相关领域 3 年以上扎实经历。\n具备良好的团队协作与抗压能力。',
    })
    setEditingJd('new')
  }

  // 打开编辑 JD
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
    setEditingJd(j)
  }

  // 载入模板
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

  // 保存 JD
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
      // 如果当前选中了岗位，且在编辑岗位时触发，则自动关联
      if (activePos) {
        updatePosition(activePos.id, { jdId: created.id })
      }
    } else if (editingJd) {
      updateJd(editingJd.id, payload)
    }
    setEditingJd(null)
  }

  // 添加 Skill 标签
  const addTag = () => {
    const v = tagInput.trim()
    if (v && !jdForm.skills.includes(v)) {
      setJdForm((prev) => ({ ...prev, skills: [...prev.skills, v] }))
      setTagInput('')
    }
  }

  // 统计在招岗位下的候选人
  const countForPos = (posId: string) => {
    const matched = candidates.filter((c) => c.positionId === posId)
    return {
      total: matched.length,
      waitMeet: matched.filter((c) => c.status === '待面试').length,
      waitEval: matched.filter((c) => c.status === '待评价').length,
    }
  }

  // 全局概览统计
  const totalHc = positions.reduce((acc, p) => acc + (p.hc || 0), 0)
  const totalHired = positions.reduce((acc, p) => acc + (p.hired || 0), 0)
  const hcRate = totalHc ? Math.round((totalHired / totalHc) * 100) : 0

  return (
    <div className="space-y-8">
      {/* 顶部：编制与能力标尺标题区 */}
      <div className="ws-rise flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-black/[0.08] pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-[#1d1d1f] sm:text-3xl">
              在招编制与能力标尺
            </h1>
            <span className="inline-flex items-center rounded-full bg-black/[0.04] px-2.5 py-0.5 text-xs font-semibold text-[#1d1d1f] ring-1 ring-inset ring-black/10">
              {positions.length} 个岗位招募中
            </span>
          </div>
          <p className="mt-1.5 text-xs text-[#6e6e73] max-w-2xl leading-relaxed">
            业务编制配属用人标尺白皮书 · 自动对齐 AI 初筛阈值 · 面试定制题目与评价维度统一
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Btn variant="ghost" onClick={openNewJd}>
            + 拟定新用人标尺 (JD)
          </Btn>
          <Btn variant="solid" onClick={openNewPos}>
            + 新增在招岗位
          </Btn>
        </div>
      </div>

      {/* 顶部横幅：Apple Bento 概览指标行 (3联卡片) */}
      <div className="ws-rise [--i:1] grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl bg-white p-5 border border-black/[0.04] shadow-2xs">
          <span className="text-[11px] font-medium text-[#86868b]">总在招岗位编制</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold tracking-tight text-[#1d1d1f] tabular-nums">
              {positions.length} <span className="text-xs font-normal text-[#86868b]">个职位进行中</span>
            </span>
            <span className="text-xs font-semibold text-[#1d1d1f]">{totalHired} / {totalHc} HC</span>
          </div>
          <div className="mt-2.5 h-1 w-full rounded-full bg-[#f5f5f7] overflow-hidden">
            <div className="h-full bg-[#1d1d1f] rounded-full" style={{ width: `${hcRate}%` }} />
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 border border-black/[0.04] shadow-2xs">
          <span className="text-[11px] font-medium text-[#86868b]">标准用人标尺库 (JD Repository)</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold tracking-tight text-[#1d1d1f] tabular-nums">
              {jds.length} <span className="text-xs font-normal text-[#86868b]">套标准化指标</span>
            </span>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">100% 覆盖</span>
          </div>
          <p className="mt-2 text-[11px] text-[#86868b] truncate">
            已涵盖：前端架构、Go 分布式、B 端商业化、大模型应用
          </p>
        </div>

        <div className="rounded-2xl bg-white p-5 border border-black/[0.04] shadow-2xs">
          <span className="text-[11px] font-medium text-[#86868b]">当前在池对标候选人</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold tracking-tight text-[#1d1d1f] tabular-nums">
              {candidates.length} <span className="text-xs font-normal text-[#86868b]">人全链路推进中</span>
            </span>
            <button
              onClick={() => go('candidates', undefined)}
              className="text-xs font-semibold text-[#1d1d1f] hover:underline"
            >
              前往人才库 ↗
            </button>
          </div>
          <p className="mt-2 text-[11px] text-[#86868b]">
            各岗位均严格绑定 JD 规范，初筛与题目实时联动
          </p>
        </div>
      </div>

      {/* 主体布局大重构：联动双翼工作台 (Master-Detail Asymmetric Split) */}
      <div className="ws-rise [--i:2] grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.18fr)] items-start">
        {/* 左翼：在招编制列表 (Master List) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold tracking-tight text-[#1d1d1f] uppercase text-[11px]">
              业务在招编制矩阵 ({positions.length})
            </h2>
            <span className="text-xs text-[#86868b]">点击岗位原地对标右侧标尺</span>
          </div>

          <div className="space-y-3.5">
            {positions.map((p) => {
              const jd = findJd(p.jdId)
              const stat = countForPos(p.id)
              const isSelected = p.id === activePos?.id
              const hcPct = Math.min(100, Math.round((p.hired / (p.hc || 1)) * 100))

              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedPosId(p.id)}
                  className={`group cursor-pointer rounded-2xl bg-white p-5 transition-all relative ${
                    isSelected
                      ? 'border-2 border-[#1d1d1f] shadow-md ring-2 ring-black/10'
                      : 'border border-black/[0.04] shadow-2xs hover:border-black/[0.08] hover:shadow-sm'
                  }`}
                >
                  {/* 顶部信息 */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="rounded-full bg-[#f5f5f7] px-2.5 py-0.5 text-[11px] font-medium text-[#86868b]">
                      {p.dept} · {p.code}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      {p.status}
                    </span>
                  </div>

                  {/* 岗位大字 */}
                  <h3 className="mt-2.5 text-base font-semibold tracking-tight text-[#1d1d1f] flex items-center justify-between">
                    <span>{p.name}</span>
                    {isSelected && (
                      <span className="text-xs font-semibold text-[#1d1d1f]">正在对标 ➔</span>
                    )}
                  </h3>

                  {/* 装配的 JD 标尺微型胶囊 */}
                  <div className="mt-3 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-black/[0.04] px-2.5 py-1 text-xs font-medium text-[#1d1d1f] ring-1 ring-inset ring-black/10">
                      <span>📋</span>
                      {jd.title} ({jd.code})
                    </span>
                    <span className="text-xs text-[#86868b]">{jd.salary}</span>
                  </div>

                  {/* HC 进度与协同人 */}
                  <div className="mt-4 grid grid-cols-2 gap-4 border-t border-black/[0.04] pt-3 text-xs text-[#86868b]">
                    <div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span>招聘 HC</span>
                        <span className="font-semibold text-[#1d1d1f]">{p.hired} / {p.hc}</span>
                      </div>
                      <div className="mt-1 h-1 w-full rounded-full bg-[#f5f5f7] overflow-hidden">
                        <div className="h-full rounded-full bg-[#1d1d1f]" style={{ width: `${hcPct}%` }} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span>负责 HR: <strong className="font-medium text-[#1d1d1f]">{p.recruiter.split(' ')[0]}</strong></span>
                      <button
                        onClick={(e) => { e.stopPropagation(); openEditPos(p) }}
                        className="text-[#86868b] hover:text-[#1d1d1f] font-medium underline"
                      >
                        编辑
                      </button>
                    </div>
                  </div>

                  {/* 候选人快捷漏斗 */}
                  <div className="mt-3 flex items-center justify-between border-t border-black/[0.04] pt-2.5 text-[11px]">
                    <button
                      onClick={(e) => { e.stopPropagation(); go('candidates', undefined) }}
                      className="text-[#1d1d1f] hover:underline font-medium flex items-center gap-1"
                    >
                      已对标候选人: <strong className="font-bold">{stat.total}</strong> 人
                    </button>
                    {stat.waitMeet > 0 && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-800 font-medium text-[10px]">
                        {stat.waitMeet} 位待面试
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 右翼：原地展开的用人能力白皮书 (Interactive Detail Spec Sheet - Sticky) */}
        <div className="sticky top-20">
          <Card className="p-7 shadow-sm border border-black/[0.05] rounded-3xl bg-white">
            {/* 白皮书抬头 */}
            <div className="flex items-start justify-between border-b border-black/[0.06] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-[#1d1d1f] tracking-wide">
                    {boundJd.code} · 标准能力白皮书
                  </span>
                  <span className="rounded-full bg-[#f5f5f7] px-2 py-0.5 text-[10px] text-[#86868b]">
                    最后修订: {boundJd.updatedAt}
                  </span>
                </div>
                <h3 className="mt-1 text-2xl font-bold tracking-tight text-[#1d1d1f]">
                  {boundJd.title}
                </h3>
                <p className="mt-1 text-xs text-[#86868b]">
                  当前已装配至在招岗位：<strong className="text-[#1d1d1f]">{activePos?.name}</strong>
                </p>
              </div>

              {/* 右侧微操作 */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openEditJd(boundJd)}
                  className="cursor-pointer rounded-full bg-[#f5f5f7] px-3 py-1.5 text-xs font-medium text-[#1d1d1f] hover:bg-[#e8e8ed] transition-colors"
                >
                  修订标尺 ✎
                </button>
              </div>
            </div>

            {/* 硬性门槛徽章栏 */}
            <div className="mt-5 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-amber-50 px-3 py-1 font-semibold text-amber-800">
                薪酬范围：{boundJd.salary}
              </span>
              <span className="rounded-full bg-[#f5f5f7] px-3 py-1 font-medium text-[#1d1d1f]">
                经验门槛：{boundJd.exp}
              </span>
              <span className="rounded-full bg-[#f5f5f7] px-3 py-1 font-medium text-[#1d1d1f]">
                学历门槛：{boundJd.edu}
              </span>
            </div>

            {/* 核心考核技能刻度 */}
            <div className="mt-5">
              <span className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider">
                核心考核技能基准 (AI 定制出题依据)
              </span>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {boundJd.skills.map((s) => (
                  <span key={s} className="rounded-full bg-[#f5f5f7] px-3 py-1 text-xs font-medium text-[#1d1d1f]">
                    {s}
                  </span>
                ))}
              </div>
            </div>

            {/* 定位摘要 */}
            <div className="mt-5 rounded-2xl bg-[#f5f5f7]/70 p-4 text-xs text-[#1d1d1f]/80 leading-relaxed">
              <strong className="font-semibold text-[#1d1d1f]">岗位定位：</strong>
              {boundJd.summary || '负责核心业务系统的模块设计与代码实现，推动团队架构演进。'}
            </div>

            {/* 职责清单 */}
            <div className="mt-5">
              <span className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider">
                岗位职责标准
              </span>
              <ul className="mt-2 list-disc space-y-1.5 pl-4 text-xs text-[#1d1d1f]/80 leading-relaxed">
                {boundJd.responsibilities.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>

            {/* 任职资格与初筛考核点 */}
            <div className="mt-5">
              <span className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider">
                任职资格与考核要点（对标初筛基准）
              </span>
              <ul className="mt-2 list-disc space-y-1.5 pl-4 text-xs text-[#1d1d1f]/80 leading-relaxed">
                {boundJd.requirements.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>

            {/* 底部换绑小工具 */}
            <div className="mt-6 flex items-center justify-between border-t border-black/[0.04] pt-4 text-xs">
              <span className="text-[#86868b]">为该岗位更换装配标尺：</span>
              <select
                value={activePos?.jdId}
                onChange={(e) => {
                  if (activePos) updatePosition(activePos.id, { jdId: e.target.value })
                }}
                className="rounded-full bg-[#f5f5f7] px-3 py-1 text-xs font-medium text-[#1d1d1f] outline-none border-0"
              >
                {jds.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.code} · {j.title}
                  </option>
                ))}
              </select>
            </div>
          </Card>
        </div>
      </div>

      {/* 弹窗 1：新建 / 编辑在招编制 */}
      {editingPos && (
        <div className="ws-scrim fixed inset-0 z-50 flex items-center justify-center p-4">
          <Card className="login-fade max-h-[90vh] w-full max-w-lg overflow-y-auto p-8 shadow-2xl rounded-3xl">
            <div className="flex items-center justify-between border-b border-black/[0.06] pb-4">
              <div>
                <h3 className="text-xl font-semibold tracking-tight text-[#1d1d1f]">
                  {editingPos === 'new' ? '新建在招岗位编制' : '编辑岗位编制'}
                </h3>
                <p className="mt-0.5 text-xs text-[#86868b]">装配一份标准 JD 作为能力考核与初筛对标基准</p>
              </div>
              <button
                onClick={() => setEditingPos(null)}
                className="grid h-7 w-7 cursor-pointer place-items-center rounded-full bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={savePos} className="mt-5 space-y-4 text-xs">
              <div>
                <label className="font-medium text-[#1d1d1f]">在招岗位名称 *</label>
                <input
                  required
                  value={posForm.name}
                  onChange={(e) => setPosForm({ ...posForm, name: e.target.value })}
                  placeholder="例如：商业化大前端研发组 · 高级前端工程师"
                  className="mt-1.5 h-10 w-full rounded-xl bg-[#f5f5f7] px-3.5 text-sm outline-none focus:ring-2 focus:ring-black/20"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="font-medium text-[#1d1d1f]">装配标准能力标尺 (JD) *</label>
                  <button
                    type="button"
                    onClick={() => openNewJd()}
                    className="cursor-pointer text-xs font-medium text-[#1d1d1f] hover:underline"
                  >
                    + 拟定新 JD
                  </button>
                </div>
                <select
                  value={posForm.jdId}
                  onChange={(e) => setPosForm({ ...posForm, jdId: e.target.value })}
                  className="mt-1.5 h-10 w-full rounded-xl bg-[#f5f5f7] px-3 text-sm outline-none focus:ring-2 focus:ring-black/20"
                >
                  {jds.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.code} · {j.title} ({j.exp} / {j.salary})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-medium text-[#1d1d1f]">所属部门</label>
                  <input
                    value={posForm.dept}
                    onChange={(e) => setPosForm({ ...posForm, dept: e.target.value })}
                    className="mt-1.5 h-10 w-full rounded-xl bg-[#f5f5f7] px-3.5 text-sm outline-none focus:ring-2 focus:ring-black/20"
                  />
                </div>
                <div>
                  <label className="font-medium text-[#1d1d1f]">招聘编制 (HC)</label>
                  <input
                    type="number"
                    min="1"
                    value={posForm.hc}
                    onChange={(e) => setPosForm({ ...posForm, hc: Number(e.target.value) })}
                    className="mt-1.5 h-10 w-full rounded-xl bg-[#f5f5f7] px-3.5 text-sm outline-none focus:ring-2 focus:ring-black/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-medium text-[#1d1d1f]">负责 HR</label>
                  <input
                    value={posForm.recruiter}
                    onChange={(e) => setPosForm({ ...posForm, recruiter: e.target.value })}
                    className="mt-1.5 h-10 w-full rounded-xl bg-[#f5f5f7] px-3.5 text-sm outline-none focus:ring-2 focus:ring-black/20"
                  />
                </div>
                <div>
                  <label className="font-medium text-[#1d1d1f]">用人主管 / 面试官</label>
                  <input
                    value={posForm.hiringManager}
                    onChange={(e) => setPosForm({ ...posForm, hiringManager: e.target.value })}
                    className="mt-1.5 h-10 w-full rounded-xl bg-[#f5f5f7] px-3.5 text-sm outline-none focus:ring-2 focus:ring-black/20"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-black/[0.06]">
                <Btn variant="ghost" onClick={() => setEditingPos(null)}>取消</Btn>
                <Btn variant="solid">保存编制</Btn>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* 弹窗 2：拟定 / 修订 JD 抽屉 (Bifold Spec Sheet) */}
      {editingJd && (
        <div className="ws-scrim fixed inset-0 z-50 flex items-center justify-center p-4">
          <Card className="login-fade max-h-[92vh] w-full max-w-4xl overflow-hidden p-0 shadow-2xl rounded-3xl flex flex-col">
            <div className="flex items-center justify-between border-b border-black/[0.06] bg-[#f5f5f7]/70 px-8 py-4">
              <div>
                <h3 className="text-lg font-semibold tracking-tight text-[#1d1d1f]">
                  {editingJd === 'new' ? '拟定用人能力标尺 (JD)' : '修订用人能力标尺 (JD)'}
                </h3>
                <span className="text-xs text-[#86868b]">左侧定义标准，右侧实时排印生成白皮书规格样张</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-[#86868b]">套用模板:</span>
                {JD_TEMPLATES.map((tmpl, idx) => (
                  <button
                    key={tmpl.title}
                    type="button"
                    onClick={() => loadTemplate(idx)}
                    className="cursor-pointer rounded-full bg-white px-3 py-1 text-xs font-medium text-[#1d1d1f] shadow-2xs border border-black/[0.05] hover:border-black/30"
                  >
                    {tmpl.title.slice(0, 4)}…
                  </button>
                ))}
                <button
                  onClick={() => setEditingJd(null)}
                  className="ml-3 grid h-7 w-7 cursor-pointer place-items-center rounded-full bg-black/5 text-[#86868b] hover:text-[#1d1d1f]"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="grid flex-1 overflow-y-auto md:grid-cols-2">
              <form onSubmit={saveJd} id="jd-form" className="space-y-4 border-r border-black/[0.06] p-7 text-xs">
                <div>
                  <label className="font-medium text-[#1d1d1f]">标尺职位名称 *</label>
                  <input
                    required
                    value={jdForm.title}
                    onChange={(e) => setJdForm({ ...jdForm, title: e.target.value })}
                    placeholder="例如：高级前端开发工程师"
                    className="mt-1.5 h-10 w-full rounded-xl bg-[#f5f5f7] px-3.5 text-sm outline-none focus:ring-2 focus:ring-black/20"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-medium text-[#1d1d1f]">归属部门</label>
                    <input
                      value={jdForm.dept}
                      onChange={(e) => setJdForm({ ...jdForm, dept: e.target.value })}
                      className="mt-1.5 h-10 w-full rounded-xl bg-[#f5f5f7] px-3.5 text-sm outline-none focus:ring-2 focus:ring-black/20"
                    />
                  </div>
                  <div>
                    <label className="font-medium text-[#1d1d1f]">薪酬标准</label>
                    <input
                      value={jdForm.salary}
                      onChange={(e) => setJdForm({ ...jdForm, salary: e.target.value })}
                      className="mt-1.5 h-10 w-full rounded-xl bg-[#f5f5f7] px-3.5 text-sm outline-none focus:ring-2 focus:ring-black/20"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-medium text-[#1d1d1f]">经验门槛</label>
                    <input
                      value={jdForm.exp}
                      onChange={(e) => setJdForm({ ...jdForm, exp: e.target.value })}
                      className="mt-1.5 h-10 w-full rounded-xl bg-[#f5f5f7] px-3.5 text-sm outline-none focus:ring-2 focus:ring-black/20"
                    />
                  </div>
                  <div>
                    <label className="font-medium text-[#1d1d1f]">学历要求</label>
                    <input
                      value={jdForm.edu}
                      onChange={(e) => setJdForm({ ...jdForm, edu: e.target.value })}
                      className="mt-1.5 h-10 w-full rounded-xl bg-[#f5f5f7] px-3.5 text-sm outline-none focus:ring-2 focus:ring-black/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-medium text-[#1d1d1f]">核心考核技能 (回车键打标)</label>
                  <div className="mt-1.5 flex flex-wrap gap-1.5 rounded-xl bg-[#f5f5f7] p-2.5">
                    {jdForm.skills.map((s, idx) => (
                      <span key={s} className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs text-[#1d1d1f] shadow-2xs">
                        {s}
                        <button
                          type="button"
                          onClick={() => setJdForm({ ...jdForm, skills: jdForm.skills.filter((_, i) => i !== idx) })}
                          className="cursor-pointer text-[#86868b] hover:text-red-500"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                    <input
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                      placeholder="输入技能后回车…"
                      className="min-w-[120px] flex-1 bg-transparent text-xs outline-none px-1"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-medium text-[#1d1d1f]">核心职责 (每行一条)</label>
                  <textarea
                    rows={3}
                    value={jdForm.responsibilities}
                    onChange={(e) => setJdForm({ ...jdForm, responsibilities: e.target.value })}
                    className="mt-1.5 w-full rounded-xl bg-[#f5f5f7] p-3 text-xs outline-none focus:ring-2 focus:ring-black/20 leading-relaxed"
                  />
                </div>

                <div>
                  <label className="font-medium text-[#1d1d1f]">任职资格与考核重点 (每行一条)</label>
                  <textarea
                    rows={3}
                    value={jdForm.requirements}
                    onChange={(e) => setJdForm({ ...jdForm, requirements: e.target.value })}
                    className="mt-1.5 w-full rounded-xl bg-[#f5f5f7] p-3 text-xs outline-none focus:ring-2 focus:ring-black/20 leading-relaxed"
                  />
                </div>
              </form>

              {/* 右侧规格样张 */}
              <div className="bg-[#f5f5f7]/60 p-7 flex flex-col justify-between">
                <div className="rounded-2xl bg-white p-6 shadow-sm border border-black/[0.04]">
                  <div className="border-b border-black/[0.06] pb-3">
                    <span className="font-mono text-[10px] text-[#1d1d1f] uppercase tracking-wider font-semibold">
                      FACETRY SPEC SHEET · PRO V1.0
                    </span>
                    <h4 className="mt-1 text-xl font-semibold tracking-tight text-[#1d1d1f]">
                      {jdForm.title || '（职位标题待输入）'}
                    </h4>
                    <div className="mt-1.5 text-xs text-[#86868b]">
                      {jdForm.dept} · {jdForm.exp} · {jdForm.edu} · <strong className="text-[#1d1d1f] font-semibold">{jdForm.salary}</strong>
                    </div>
                  </div>

                  <div className="mt-4">
                    <span className="text-[11px] font-semibold text-[#86868b] uppercase">考核要项技能</span>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {jdForm.skills.map((s) => (
                        <span key={s} className="rounded-full bg-[#f5f5f7] px-2.5 py-0.5 text-[11px] text-[#1d1d1f] font-medium">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4">
                    <span className="text-[11px] font-semibold text-[#86868b] uppercase">岗位职责要求</span>
                    <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs text-[#1d1d1f]/80 leading-relaxed">
                      {jdForm.responsibilities.split('\n').filter(Boolean).map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-4">
                    <span className="text-[11px] font-semibold text-[#86868b] uppercase">考核指标</span>
                    <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs text-[#1d1d1f]/80 leading-relaxed">
                      {jdForm.requirements.split('\n').filter(Boolean).map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="mt-4 text-xs text-[#86868b]">
                  发布后将立即对所有装配该 JD 的在招岗位生效
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-black/[0.06] bg-white px-8 py-4">
              <Btn variant="ghost" onClick={() => setEditingJd(null)}>取消</Btn>
              <Btn variant="solid" onClick={() => (document.getElementById('jd-form') as HTMLFormElement)?.requestSubmit()}>
                发布用人标尺
              </Btn>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
