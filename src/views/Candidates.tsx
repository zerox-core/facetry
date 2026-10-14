import type React from 'react'
import { useState } from 'react'
import { candidates, resumes, STAGES, type CandidateStage } from '../data'
import { batchAssign, findJd, findPos, positions, slotLabel, updateCandidateStage } from '../store'
import type { Go } from '../App'
import { Btn } from './ui'

const SOURCES = ['全部', '前程无忧', '猎聘', 'BOSS直聘', '内推', '影刀采集']
const ASSIGNEES = ['全部', '林婉 (HRG)', '赵静 (HR)', '未分配']

const stageCls: Record<string, string> = {
  新入库: 'bg-zinc-100 text-zinc-800 border-zinc-200/60 font-medium',
  待初筛: 'bg-amber-50 text-amber-800 border-amber-200/50',
  待约面: 'bg-purple-50 text-purple-800 border-purple-200/50',
  待面试: 'bg-zinc-800 text-white border-transparent font-medium shadow-2xs',
  待评价: 'bg-orange-50 text-orange-800 border-orange-200/50',
  待录取: 'bg-emerald-50 text-emerald-800 border-emerald-200/50',
  已录取: 'bg-emerald-600 text-white border-transparent',
  已淘汰: 'bg-black/[0.04] text-[#86868b] border-black/[0.06]',
}

export default function Candidates({ go }: { go: Go }) {
  const [kw, setKw] = useState('')
  const [selectedPos, setSelectedPos] = useState('全部')
  const [selectedStage, setSelectedStage] = useState('全部')
  const [selectedSource, setSelectedSource] = useState('全部')
  const [selectedAssignee, setSelectedAssignee] = useState('全部')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [batchModal, setBatchModal] = useState(false)
  const [targetAssignee, setTargetAssignee] = useState('林婉 (HRG)')

  const list = candidates.filter(
    (c) =>
      (selectedStage === '全部' || c.status === selectedStage) &&
      (selectedPos === '全部' || c.positionId === selectedPos) &&
      (selectedSource === '全部' || c.source === selectedSource) &&
      (selectedAssignee === '全部' || c.assignee === selectedAssignee) &&
      (!kw || c.name.includes(kw) || c.role.includes(kw) || resumes[c.id]?.file.includes(kw) || c.sourceId.includes(kw)),
  )

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === list.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(list.map((c) => c.id))
    }
  }

  const handleBatchAssign = () => {
    if (!selectedIds.length) return
    batchAssign(selectedIds, targetAssignee)
    setSelectedIds([])
    setBatchModal(false)
  }

  return (
    <div className="space-y-6">
      {/* 顶部标题与行动 */}
      <div className="ws-rise flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-black/[0.08] pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-[#1d1d1f]">候选人大池 · 全流程管理</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/[0.04] px-2.5 py-0.5 text-xs font-semibold text-[#1d1d1f] ring-1 ring-inset ring-black/10">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              在库人选 {candidates.length} 人
            </span>
          </div>
          <p className="mt-1.5 text-xs text-[#6e6e73]">
            影刀来源库落库 · 多渠道多维筛选 · AI 宽松初筛标识 · 详情页一页贯通
          </p>
        </div>

        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <Btn variant="solid" onClick={() => setBatchModal(true)}>
              批量分配负责人 ({selectedIds.length})
            </Btn>
          )}
          <Btn variant="ghost" onClick={() => go('workbench')}>
            ← 返回工作台待办
          </Btn>
        </div>
      </div>

      {/* 苹果深曜石数据条 (Obsidian KPI Metric Strip) */}
      <div className="ws-rise [--i:1] obsidian-panel rounded-2xl p-4 sm:p-5 text-white flex flex-wrap items-center justify-between gap-4 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-1/4 w-48 h-48 bg-gradient-to-br from-violet-600/20 to-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 flex-1">
          <div className="flex items-center gap-3">
            <div className="h-8 w-1 rounded-full bg-violet-400" />
            <div>
              <div className="text-[11px] text-white/50">新入库/初筛</div>
              <div className="text-xl font-bold text-white tabular-nums">{candidates.filter(c => c.status === '新入库' || c.status === '待初筛').length} <span className="text-xs text-white/40 font-normal">人</span></div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-8 w-1 rounded-full bg-amber-400" />
            <div>
              <div className="text-[11px] text-white/50">约面推进中</div>
              <div className="text-xl font-bold text-white tabular-nums">{candidates.filter(c => c.status === '待约面').length} <span className="text-xs text-white/40 font-normal">人</span></div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-8 w-1 rounded-full bg-emerald-400" />
            <div>
              <div className="text-[11px] text-white/50">面试与评价</div>
              <div className="text-xl font-bold text-white tabular-nums">{candidates.filter(c => c.status === '待面试' || c.status === '待评价').length} <span className="text-xs text-white/40 font-normal">人</span></div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-8 w-1 rounded-full bg-rose-400" />
            <div>
              <div className="text-[11px] text-white/50">录取与跟进</div>
              <div className="text-xl font-bold text-white tabular-nums">{candidates.filter(c => c.status === '跟进中' || c.status === '已发Offer').length} <span className="text-xs text-white/40 font-normal">人</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* 多维筛选栏 (按岗位/阶段/渠道/负责人/关键词) */}
      <div className="ws-rise [--i:1] ws-paper rounded-2xl p-4 border border-black/[0.05] space-y-3 text-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          <input
            value={kw}
            onChange={(e) => setKw(e.target.value)}
            placeholder="搜索姓名 / 岗位 / 简历 / 来源ID…"
            className="h-8 w-full sm:w-56 rounded-full border border-black/[0.08] bg-white px-3.5 text-xs text-[#1d1d1f] outline-none focus:border-black/50"
          />

          {/* 岗位筛选 */}
          <select
            value={selectedPos}
            onChange={(e) => setSelectedPos(e.target.value)}
            className="h-8 rounded-full border border-black/[0.08] bg-white px-3 text-xs outline-none"
          >
            <option value="全部">应聘岗位：全部</option>
            {positions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name.replace(/.*·\s*/, '')} ({p.code})
              </option>
            ))}
          </select>

          {/* 渠道筛选 */}
          <select
            value={selectedSource}
            onChange={(e) => setSelectedSource(e.target.value)}
            className="h-8 rounded-full border border-black/[0.08] bg-white px-3 text-xs outline-none"
          >
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                渠道来源：{s}
              </option>
            ))}
          </select>

          {/* 负责人筛选 */}
          <select
            value={selectedAssignee}
            onChange={(e) => setSelectedAssignee(e.target.value)}
            className="h-8 rounded-full border border-black/[0.08] bg-white px-3 text-xs outline-none"
          >
            {ASSIGNEES.map((a) => (
              <option key={a} value={a}>
                HR 负责人：{a}
              </option>
            ))}
          </select>
        </div>

        {/* 阶段胶囊条 */}
        <div className="pt-2 border-t border-black/[0.04] flex flex-wrap items-center gap-1.5">
          <span className="text-[#86868b] mr-1">阶段：</span>
          {['全部', ...STAGES].map((st) => (
            <button
              key={st}
              onClick={() => setSelectedStage(st)}
              className={`cursor-pointer rounded-full px-3 py-1 font-medium transition-all ${
                selectedStage === st
                  ? 'bg-[#1d1d1f] text-white shadow-2xs'
                  : 'bg-white text-[#86868b] border border-black/[0.06] hover:text-[#1d1d1f]'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* 候选人列表卡片 */}
      <div className="ws-rise [--i:2] space-y-3">
        <div className="flex items-center justify-between text-xs text-[#86868b] px-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedIds.length === list.length && list.length > 0}
              onChange={toggleSelectAll}
              className="rounded accent-[#1d1d1f]"
            />
            <span>全选本页 ({list.length} 人)</span>
          </label>
          <span>点击卡片进入「一页贯通详情页」</span>
        </div>

        {list.map((c) => {
          const pos = findPos(c.positionId)
          const isSelected = selectedIds.includes(c.id)

          return (
            <div
              key={c.id}
              onClick={() => go('detail', c.id)}
              className={`group cursor-pointer ws-paper rounded-2xl p-5 border transition-all duration-200 hover:-translate-y-0.5 hover:border-black/25 hover:shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                isSelected ? 'border-[#1d1d1f] ring-2 ring-black/10 bg-black/[0.015] shadow-xs' : 'border-black/[0.06]'
              }`}
            >
              {/* 左侧：选择框 + 基本信息 */}
              <div className="flex items-start gap-3.5 min-w-[300px]">
                <div onClick={(e) => e.stopPropagation()} className="pt-1">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(c.id)}
                    className="h-4 w-4 rounded accent-[#1d1d1f] cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-semibold text-[#1d1d1f] group-hover:text-black group-hover:underline transition-colors">
                      {c.name}
                    </span>
                    <span className="text-xs text-[#86868b]">·</span>
                    <span className="text-xs text-[#86868b]">{c.exp}</span>
                    <span className="text-xs text-[#86868b]">·</span>
                    <span className="text-xs text-[#86868b]">{c.edu.split('·')[0]}</span>
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-md bg-black/[0.04] px-2 py-0.5 text-[#1d1d1f] font-medium border border-black/5">
                      {pos.name}
                    </span>
                    <span className="rounded-md bg-black/[0.04] px-2 py-0.5 text-[#1d1d1f] border border-black/5">
                      {c.source} ({c.sourceId})
                    </span>
                    {c.attachmentType === 'missing' && (
                      <span className="rounded-md bg-amber-50 px-2 py-0.5 text-amber-800 ring-1 ring-inset ring-amber-600/20 font-medium">
                        附件缺失
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* 中间：AI 初筛宽松匹配度与理由 */}
              <div className="flex-1 border-t lg:border-t-0 lg:border-l border-black/[0.05] pt-3 lg:pt-0 lg:pl-6 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[#86868b] flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
                    AI 宽松初筛评定
                  </span>
                  <span className="font-bold text-[#1d1d1f] tabular-nums">契合度 <strong className="text-emerald-700">{c.match}%</strong></span>
                </div>
                <div className="h-2 w-full rounded-full bg-black/[0.04] overflow-hidden p-0.5 border border-black/5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-500 transition-all duration-700 ease-out"
                    style={{ width: `${c.match}%` }}
                  />
                </div>
                <div className="text-[11px] text-[#515154] line-clamp-1">
                  {c.aiScreening?.looseMatch || c.summary}
                </div>
              </div>

              {/* 右侧：阶段状态与操作 */}
              <div
                className="flex items-center justify-between lg:justify-end gap-3.5 border-t lg:border-t-0 lg:border-l border-black/[0.05] pt-3 lg:pt-0 lg:pl-6 shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="text-right text-xs">
                  <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${stageCls[c.status] || 'bg-black/[0.04] text-[#86868b]'}`}>
                    {c.status}
                  </span>
                  <div className="mt-1 text-[11px] text-[#86868b]">
                    负责人：{c.assignee}
                  </div>
                </div>

                <Btn
                  variant="solid"
                  className="!h-8 !px-3.5"
                  onClick={() => go('detail', c.id)}
                >
                  一页贯通详情 ↗
                </Btn>
              </div>
            </div>
          )
        })}

        {!list.length && (
          <div className="ws-paper rounded-2xl p-12 text-center text-xs text-[#86868b]">
            未检索到符合条件的候选人
          </div>
        )}
      </div>

      {/* 批量分配负责人弹窗 */}
      {batchModal && (
        <div className="ws-scrim fixed inset-0 z-50 grid place-items-center px-4" onClick={() => setBatchModal(false)}>
          <div className="w-full max-w-sm ws-paper rounded-2xl p-6 border border-black/[0.08] shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-baseline justify-between border-b border-black/[0.06] pb-3">
              <h2 className="text-base font-semibold text-[#1d1d1f]">批量分配 HR 负责人</h2>
              <button onClick={() => setBatchModal(false)} className="cursor-pointer text-xs text-[#86868b]">✕</button>
            </div>
            <div className="space-y-2 text-xs">
              <label className="text-[#86868b] block">已选 {selectedIds.length} 位候选人，指派给：</label>
              <select
                value={targetAssignee}
                onChange={(e) => setTargetAssignee(e.target.value)}
                className="h-9 w-full rounded-xl border border-black/[0.08] px-3 bg-white outline-none"
              >
                <option value="林婉 (HRG)">林婉 (HRG)</option>
                <option value="赵静 (HR)">赵静 (HR)</option>
                <option value="张晴 (招聘)">张晴 (招聘)</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Btn variant="ghost" onClick={() => setBatchModal(false)}>取消</Btn>
              <Btn variant="solid" onClick={handleBatchAssign}>确认分配</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
