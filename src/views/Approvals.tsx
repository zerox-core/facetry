import { useState } from 'react'
import { candidates } from '../data'
import { approvals, createApproval, updateApprovalNode } from '../store'
import type { Go } from '../App'
import { Btn, Card } from './ui'

export default function Approvals({ go }: { go: Go }) {
  const [showModal, setShowModal] = useState(false)
  const [selectedCid, setSelectedCid] = useState(candidates.find((c) => c.status === '待录取')?.id || candidates[0].id)
  const [salary, setSalary] = useState('32k · 14薪 + 绩效')
  const [level, setLevel] = useState('P7 资深研发工程师')
  const [onboardDate, setOnboardDate] = useState('2026-11-01')
  const [toast, setToast] = useState('')

  const eligibleCandidates = candidates.filter((c) => ['待评价', '待录取', '跟进中'].includes(c.status) && !c.approvalId)

  const handleSubmitApproval = () => {
    const c = candidates.find((x) => x.id === selectedCid)
    if (!c) return
    createApproval({
      candidateId: c.id,
      salary,
      level,
      onboardDate,
      materials: [
        `技术与综合面评报告 (${c.match}% 契合)`,
        `${c.edu.split('·')[0].trim()} 学历验证证书`,
        '背景调查授权书与近半年薪资证明',
      ],
    })
    setShowModal(false)
    setToast(`已显式提交 ${c.name} 的录取申请，已并行发起飞书审批与 BPM 流程。`)
    setTimeout(() => setToast(''), 3500)
  }

  return (
    <div className="space-y-6">
      {/* 顶部标题栏 */}
      <div className="ws-rise flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-black/[0.08] pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-[#1d1d1f]">录取流程与双审批中心</h1>
            <span className="inline-flex items-center rounded-full bg-black/[0.04] px-2.5 py-0.5 text-xs font-semibold text-[#1d1d1f] ring-1 ring-inset ring-black/10">
              流转中 {approvals.filter((a) => a.finalStatus === 'processing').length} 单
            </span>
          </div>
          <p className="mt-1.5 text-xs text-[#6e6e73]">
            录用意向显式发起 · 飞书审批与内部 BPM 并行双轨流转 · 自动幂等防重复发起
          </p>
        </div>

        <Btn variant="solid" onClick={() => setShowModal(true)}>
          + 发起录取申请
        </Btn>
      </div>

      {toast && (
        <div className="login-fade rounded-2xl bg-emerald-50 px-4 py-3 text-xs text-emerald-800 border border-emerald-200/60 flex items-center justify-between">
          <span>✓ {toast}</span>
          <button onClick={() => setToast('')} className="cursor-pointer text-emerald-600">
            ✕
          </button>
        </div>
      )}

      {/* 审批概览指标 (黑曜石科技对比感) */}
      <div className="ws-rise [--i:1] grid gap-4 sm:grid-cols-3">
        {/* 流转中 - 深曜黑高光主卡 */}
        <div className="obsidian-panel rounded-2xl p-5 text-white shadow-xl relative overflow-hidden group hover:-translate-y-0.5 transition-transform duration-200">
          <div className="absolute top-0 right-0 w-28 h-28 bg-rose-500/15 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center justify-between text-xs text-white/60">
            <span>流转审批中 (重点催办)</span>
            <span className="h-2 w-2 rounded-full bg-rose-400 animate-pulse" />
          </div>
          <div className="mt-2 text-3xl font-bold tracking-tight text-white tabular-nums">
            {approvals.filter((a) => a.finalStatus === 'processing').length} <span className="text-sm font-normal text-white/50">份</span>
          </div>
          <div className="mt-2 text-[11px] text-white/60">任一必需审批未完成不标为录用</div>
        </div>

        {/* 双审批完成 - 极光翡翠卡 */}
        <div className="ws-paper rounded-2xl p-5 border border-black/[0.06] border-l-4 border-l-emerald-500 shadow-sm hover:-translate-y-0.5 transition-transform duration-200">
          <div className="text-xs text-[#86868b] flex items-center justify-between">
            <span>双审批完成 (正式录用)</span>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
              全绿已归档
            </span>
          </div>
          <div className="mt-2 text-3xl font-bold tracking-tight text-emerald-700 tabular-nums">
            {approvals.filter((a) => a.finalStatus === 'approved').length} <span className="text-sm font-normal text-[#86868b]">份</span>
          </div>
          <div className="mt-2 text-[11px] text-[#86868b]">飞书与 BPM 均已签署生效</div>
        </div>

        {/* 已发起总单 - 深石墨卡 */}
        <div className="ws-paper rounded-2xl p-5 border border-black/[0.06] border-l-4 border-l-black/40 shadow-sm hover:-translate-y-0.5 transition-transform duration-200">
          <div className="text-xs text-[#86868b]">累计发起申请单</div>
          <div className="mt-2 text-3xl font-bold tracking-tight text-[#1d1d1f] tabular-nums">
            {approvals.length} <span className="text-sm font-normal text-[#86868b]">份</span>
          </div>
          <div className="mt-2 text-[11px] text-[#86868b]">关联在招岗位编制与全场面评</div>
        </div>
      </div>

      {/* 申请单列表 */}
      <div className="ws-rise [--i:2] space-y-4">
        {approvals.map((app) => (
          <div
            key={app.id}
            className="ws-paper rounded-2xl p-6 border border-black/[0.05] hover:border-black/25 transition-all space-y-4"
          >
            {/* 顶行：单号与基本盘 */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-black/[0.05]">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs font-semibold text-[#1d1d1f] bg-black/[0.04] px-2 py-0.5 rounded-md ring-1 ring-inset ring-black/10">{app.id}</span>
                <span className="text-base font-semibold text-[#1d1d1f]">{app.candidateName}</span>
                <span className="text-xs text-[#86868b]">应聘：{app.positionName}</span>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    app.finalStatus === 'approved'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/50'
                      : app.finalStatus === 'rejected'
                      ? 'bg-amber-50 text-amber-800 border border-amber-200/50'
                      : 'bg-black/[0.04] text-[#1d1d1f] border border-black/10 ring-1 ring-inset ring-black/5'
                  }`}
                >
                  {app.finalStatus === 'approved'
                    ? '✓ 双审批全部通过 (已正式录用)'
                    : app.finalStatus === 'rejected'
                    ? '✕ 审批被驳回 / 撤销'
                    : '⏳ 双流程并行流转中'}
                </span>
                <Btn
                  variant="ghost"
                  className="!h-8 !px-3"
                  onClick={() => go('detail', app.candidateId)}
                >
                  查看候选人贯通详情 ↗
                </Btn>
              </div>
            </div>

            {/* 中间：拟定待遇与材料 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs rounded-xl bg-[#f5f5f7] p-3.5 text-[#515154]">
              <div>
                <span className="text-[#86868b]">拟定薪酬：</span>
                <span className="font-semibold text-[#1d1d1f]">{app.salary}</span>
              </div>
              <div>
                <span className="text-[#86868b]">拟定职级：</span>
                <span className="font-semibold text-[#1d1d1f]">{app.level}</span>
              </div>
              <div>
                <span className="text-[#86868b]">发起人：</span>
                <span>{app.applicant}</span>
              </div>
              <div>
                <span className="text-[#86868b]">预计入职：</span>
                <span>{app.onboardDate}</span>
              </div>
            </div>

            {/* 下部：飞书审批与 BPM 内部流程双轨卡片 */}
            <div className="grid gap-4 sm:grid-cols-2 text-xs">
              {/* 飞书审批卡片 */}
              <div className="rounded-xl border border-black/[0.06] p-4 bg-white space-y-2">
                <div className="flex items-center justify-between font-semibold">
                  <span className="text-[#1d1d1f] flex items-center gap-1.5">
                    <span className="text-[#1d1d1f]">●</span>
                    飞书审批流
                  </span>
                  <span
                    className={`font-semibold ${
                      app.feishu.status === 'approved' ? 'text-emerald-700' : 'text-[#1d1d1f]'
                    }`}
                  >
                    {app.feishu.status === 'approved' ? '✓ 节点已通过' : '流转审批中'}
                  </span>
                </div>
                <div className="text-[11px] text-[#86868b]">实例编码: {app.feishu.instanceId}</div>
                <div className="text-[#1d1d1f]">当前节点: {app.feishu.currentNode}</div>
                <div className="text-[11px] text-[#86868b]">审批人: {app.feishu.approver} · 更新: {app.feishu.updateTime}</div>

                {app.feishu.status !== 'approved' && (
                  <div className="pt-2 border-t border-black/[0.04] flex justify-end gap-2">
                    <button
                      onClick={() => updateApprovalNode(app.id, 'feishu', 'approved')}
                      className="cursor-pointer text-xs font-semibold text-emerald-700 hover:underline"
                    >
                      [模拟] 飞书审批通过 →
                    </button>
                  </div>
                )}
              </div>

              {/* BPM OA 流程卡片 */}
              <div className="rounded-xl border border-black/[0.06] p-4 bg-white space-y-2">
                <div className="flex items-center justify-between font-semibold">
                  <span className="text-[#1d1d1f] flex items-center gap-1.5">
                    <span className="text-[#1d1d1f]">●</span>
                    BPM 内部 OA 录取流程
                  </span>
                  <span
                    className={`font-semibold ${
                      app.bpm.status === 'approved' ? 'text-emerald-700' : 'text-[#1d1d1f]'
                    }`}
                  >
                    {app.bpm.status === 'approved' ? '✓ OA 已归档通过' : '内部流转中'}
                  </span>
                </div>
                <div className="text-[11px] text-[#86868b]">流程单号: {app.bpm.processId}</div>
                <div className="text-[#1d1d1f]">当前处理: {app.bpm.currentNode}</div>
                <div className="text-[11px] text-[#86868b]">经办: {app.bpm.approver} · 更新: {app.bpm.updateTime}</div>

                {app.bpm.status !== 'approved' && (
                  <div className="pt-2 border-t border-black/[0.04] flex justify-end gap-2">
                    <button
                      onClick={() => updateApprovalNode(app.id, 'bpm', 'approved')}
                      className="cursor-pointer text-xs font-semibold text-emerald-700 hover:underline"
                    >
                      [模拟] BPM 审批通过 →
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* 证明材料列表 */}
            <div className="text-[11px] text-[#86868b]">
              <span>附带证明与材料：</span>
              <span className="text-[#515154]">{app.materials.join('； ')}</span>
            </div>
          </div>
        ))}

        {!approvals.length && (
          <div className="ws-paper rounded-2xl p-12 text-center text-xs text-[#86868b]">
            暂无录取申请记录
          </div>
        )}
      </div>

      {/* 发起录取申请向导弹窗 */}
      {showModal && (
        <div
          className="ws-scrim fixed inset-0 z-50 grid place-items-center px-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="w-full max-w-lg ws-paper rounded-2xl p-6 border border-black/[0.08] shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-baseline justify-between border-b border-black/[0.06] pb-3">
              <div>
                <h2 className="text-lg font-semibold text-[#1d1d1f]">发起正式录取审批申请</h2>
                <p className="mt-0.5 text-xs text-[#86868b]">
                  业务面试通过后显式提交，自动生成飞书审批与 BPM 流程单号
                </p>
              </div>
              <button onClick={() => setShowModal(false)} className="cursor-pointer text-xs text-[#86868b]">
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="text-[#86868b] block mb-1">选择拟录用候选人</label>
                <select
                  value={selectedCid}
                  onChange={(e) => setSelectedCid(e.target.value)}
                  className="h-9 w-full rounded-xl border border-black/[0.08] px-3 bg-white outline-none focus:border-black/50"
                >
                  {eligibleCandidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {c.role} (阶段: {c.status})
                    </option>
                  ))}
                  {!eligibleCandidates.length && (
                    <option value={candidates[0].id}>{candidates[0].name} (已选)</option>
                  )}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[#86868b] block mb-1">拟定薪资待遇</label>
                  <input
                    value={salary}
                    onChange={(e) => setSalary(e.target.value)}
                    className="h-9 w-full rounded-xl border border-black/[0.08] px-3 bg-white outline-none focus:border-black/50"
                  />
                </div>
                <div>
                  <label className="text-[#86868b] block mb-1">定级标准</label>
                  <input
                    value={level}
                    onChange={(e) => setLevel(e.target.value)}
                    className="h-9 w-full rounded-xl border border-black/[0.08] px-3 bg-white outline-none focus:border-black/50"
                  />
                </div>
              </div>

              <div>
                <label className="text-[#86868b] block mb-1">预计到岗入职日期</label>
                <input
                  type="date"
                  value={onboardDate}
                  onChange={(e) => setOnboardDate(e.target.value)}
                  className="h-9 w-full rounded-xl border border-black/[0.08] px-3 bg-white outline-none focus:border-black/50"
                />
              </div>

              <div className="rounded-xl bg-[#f5f5f7] p-3 text-[11px] text-[#515154] space-y-1">
                <div className="font-semibold text-[#1d1d1f]">自动附带审批材料：</div>
                <div>✓ 完整技术与综合面评结论与试题依据</div>
                <div>✓ 候选人原件简历及学历认证核查结果</div>
                <div>✓ 飞书与 BPM 权限校验通过（双向幂等，重复提交不产生废单）</div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-black/[0.04]">
              <Btn variant="ghost" onClick={() => setShowModal(false)}>
                取消
              </Btn>
              <Btn variant="solid" onClick={handleSubmitApproval}>
                确认显式发起双审批
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
