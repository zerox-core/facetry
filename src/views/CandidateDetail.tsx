import { useState } from 'react'
import { STAGES, type Candidate, type CandidateStage, type JD, type Position } from '../data'
import {
  addCandidateNote,
  approvals,
  bindCandidatePosition,
  buildReviewFor,
  cancelSchedule,
  findC,
  findJd,
  findPos,
  pickedOf,
  positions,
  resendNotice,
  rooms,
  schedule,
  slotLabel,
  updateCandidateStage,
} from '../store'
import type { Go } from '../App'
import { Btn, Card } from './ui'
import ResumeDoc from './ResumeDoc'

type Props = { cid: string; go: Go }

// 岗位 / 标尺缺失时的兜底展示对象：不把数据静默绑到其他岗位或标尺上（store 的 findPos / findJd 找不到返回 undefined）
const emptyPos = (c: Candidate): Position => ({ id: '', code: '—', name: c.role, jdId: '', dept: '', recruiter: c.assignee, hiringManager: c.assignee, hc: 0, hired: 0, status: '招募中', createdAt: '' })
const emptyJd = (c: Candidate): JD => ({ id: '', code: '—', title: '未装配标尺', dept: c.role, exp: '—', edu: '—', salary: '—', skills: [], summary: '', responsibilities: [], requirements: [], updatedAt: '' })

// 审批轨状态中文标签：发起 / 处理中 / 通过 / 退回 / 拒绝 / 撤销如实展示（FR-C4）
const trackLabel: Record<string, string> = { pending: '流转中', approved: '✓ 已通过', returned: '↩ 已退回', rejected: '✕ 已拒绝', canceled: '⊘ 已撤销' }

// 聚合结论中文标签：单边通过（partial）不得显示为已录用，负向态如实展示（FR-C4）
const finalLabel: Record<string, string> = {
  approved: '✓ 双审批全部通过 (已完成)',
  partial: '⚠ 单边通过：另一侧仍在处理中',
  returned: '↩ 审批被退回，需补充材料后重走',
  rejected: '✕ 审批被拒绝',
  canceled: '⊘ 审批已撤销',
  processing: '⏳ 双流程并行流转中',
}

export default function CandidateDetail({ cid, go }: Props) {
  const foundC = findC(cid)
  const foundPos = findPos(foundC?.positionId)
  const foundJd = findJd(foundC?.jdId || foundPos?.jdId)
  const room = rooms[cid]
  const review = room?.review || buildReviewFor(cid)
  const app = approvals.find((a) => a.candidateId === cid)

  const [activeSection, setActiveSection] = useState<'resume' | 'screening' | 'notes' | 'interview' | 'review' | 'approval'>('resume')
  const [newNote, setNewNote] = useState('')
  const [showSwitchPos, setShowSwitchPos] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [schedDate, setSchedDate] = useState('2026-10-02 14:30')
  const [schedRound, setSchedRound] = useState('一面')
  const [schedChannel, setSchedChannel] = useState<'sms' | 'email'>('sms')

  // 找不到候选人时给出空态，避免把详情页静默绑到其他候选人
  if (!foundC) {
    return (
      <div className="ws-paper rounded-2xl p-12 text-center text-xs text-[#86868b]">
        未找到候选人记录（{cid}），可能已被来源库标记失效，请返回候选人大池重新选择。
      </div>
    )
  }

  const c = foundC
  const pos = foundPos ?? emptyPos(c)
  const jd = foundJd ?? emptyJd(c)

  const handleAddNote = () => {
    if (!newNote.trim()) return
    addCandidateNote(cid, newNote)
    setNewNote('')
  }

  const handleConfirmSchedule = () => {
    // 统一约面入口：同一候选人 + 轮次 + 时段重复提交时复用既有场次，不重复建场（幂等）
    schedule({ cid, slot: schedDate, round: schedRound, type: 'online', channel: schedChannel })
    setShowScheduleModal(false)
  }

  const handleStageChange = (targetStage: CandidateStage) => {
    updateCandidateStage(cid, targetStage)
  }

  return (
    <div className="space-y-6">
      {/* 顶部标题与行动导航 */}
      {/* 顶部黑曜石全景档案看板 (Obsidian Pro Candidate Hero) */}
      <div className="ws-rise obsidian-panel rounded-3xl p-6 sm:p-7 relative overflow-hidden text-white shadow-2xl">
        <div className="absolute -top-20 -right-20 w-72 h-72 bg-gradient-to-br from-violet-600/25 via-teal-500/15 to-transparent rounded-full blur-3xl pointer-events-none animate-pulse-glow" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 text-xs text-white/50">
              <button onClick={() => go('back')} className="cursor-pointer hover:text-white transition-colors">
                ← 返回{go.from}
              </button>
              <span>/</span>
              <span className="text-white/80">一页贯通全景档案</span>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight text-white">{c.name}</h1>
              <span className="text-lg font-medium text-white/70">{c.role}</span>
              <span className="rounded-full bg-white/[0.08] px-3 py-1 text-xs font-semibold text-white border border-white/10 backdrop-blur-md">
                在招编制: {pos.name}
              </span>
              <span className="rounded-full bg-white/[0.04] px-2.5 py-1 text-xs text-white/60">
                来源: {c.source} ({c.sourceId})
              </span>
              {c.attachmentType === 'original' && (
                <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-semibold text-emerald-300 border border-emerald-500/30">
                  原件已入库
                </span>
              )}
              {c.attachmentType === 'platform' && (
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-white/70 border border-white/10">
                  平台模板文件
                </span>
              )}
              {c.attachmentType === 'missing' && (
                <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-semibold text-amber-300 border border-amber-500/30">
                  附件缺失
                </span>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-white/60">
              <span>{c.exp}</span>
              <span>·</span>
              <span>{c.edu}</span>
              <span>·</span>
              <span>负责 HR: <strong className="text-white">{c.assignee}</strong></span>
              <span>·</span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                标尺契合度: <strong className="text-emerald-400 font-bold text-sm tabular-nums">{c.match}%</strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => setShowSwitchPos(true)}
              className="cursor-pointer rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-xs font-medium text-white hover:bg-white/[0.12] transition-all active:scale-95 backdrop-blur-md"
            >
              调岗换标尺 ↻
            </button>

            {c.status === '筛选中' && (
              <button
                onClick={() => handleStageChange('待联系')}
                className="cursor-pointer rounded-full bg-gradient-to-b from-white to-zinc-200 px-4 py-2 text-xs font-semibold text-black hover:brightness-105 transition-all shadow-md active:scale-95"
              >
                初筛通过，去约面 →
              </button>
            )}

            {c.status === '待联系' && (
              <button
                onClick={() => setShowScheduleModal(true)}
                className="cursor-pointer rounded-full bg-gradient-to-b from-white to-zinc-200 px-4 py-2 text-xs font-semibold text-black hover:brightness-105 transition-all shadow-md active:scale-95"
              >
                安排面试日程 →
              </button>
            )}

            {c.status === '约面中' && (
              <button
                onClick={() => go('room', c.id)}
                className="cursor-pointer rounded-full bg-gradient-to-b from-white to-zinc-200 px-4 py-2 text-xs font-semibold text-black hover:brightness-105 transition-all shadow-md active:scale-95"
              >
                进入考场（面试间） ↗
              </button>
            )}

            {c.status === '面评中' && (
              <button
                onClick={() => go('room', c.id)}
                className="cursor-pointer rounded-full bg-gradient-to-b from-white to-zinc-200 px-4 py-2 text-xs font-semibold text-black hover:brightness-105 transition-all shadow-md active:scale-95"
              >
                完成综合面评 ↗
              </button>
            )}

            {c.status === '待录取' && !app && (
              <button
                onClick={() => go('approvals')}
                className="cursor-pointer rounded-full bg-gradient-to-b from-white to-zinc-200 px-4 py-2 text-xs font-semibold text-black hover:brightness-105 transition-all shadow-md active:scale-95"
              >
                发起录取双审批 ↗
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 生命周期全景流转轴 (Stage Stepper) */}
      <div className="ws-rise [--i:1] ws-paper rounded-2xl p-4 border border-black/[0.07]">
        <div className="flex items-center justify-between text-xs font-semibold text-[#6e6e73] mb-3">
          <div className="flex items-center gap-2">
            <span>招聘生命周期流转</span>
            <span className="text-[11px] font-normal text-[#86868b]">（点击各阶段可手动跨阶段流转推进）</span>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-black/[0.04] px-2.5 py-0.5 text-xs font-semibold text-[#1d1d1f] ring-1 ring-inset ring-black/10">
            当前处于：{c.status}
          </span>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-9 gap-2 text-center text-xs">
          {STAGES.map((s, idx) => {
            const isCurrent = c.status === s
            const isPast = STAGES.indexOf(c.status) > idx
            return (
              <button
                key={s}
                onClick={() => handleStageChange(s)}
                className={`cursor-pointer rounded-xl p-2 transition-all ${
                  isCurrent
                    ? 'bg-gradient-to-b from-[#2c2c2e] to-[#161617] text-white font-semibold shadow-[0_2px_6px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.2)]'
                    : isPast
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/50 hover:bg-emerald-100/60'
                    : 'bg-[#f4f5f8] text-[#86868b] border border-black/[0.03] hover:text-[#1d1d1f] hover:bg-[#ebeeef]'
                }`}
              >
                <div className="text-[10px] opacity-75 font-mono">阶段 {idx + 1}</div>
                <div className="mt-0.5 font-medium">{s}</div>
              </button>
            )
          })}
        </div>
      </div>

      {/* 贯通模块粘性分段导航 (Tactile Sticky Anchor Segmented Track - 坚决不折行) */}
      <div className="sticky top-12 z-20 rounded-2xl p-1.5 bg-white/95 backdrop-blur-xl border border-black/[0.08] shadow-[0_6px_24px_-4px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="ws-segmented-track flex items-center rounded-xl p-1 overflow-x-auto no-scrollbar gap-1">
          {[
            { key: 'resume', label: '📄 简历原文与附件' },
            { key: 'screening', label: '🤖 AI 初筛与标尺' },
            { key: 'notes', label: `💬 沟通与跟进 (${c.notes.length})` },
            { key: 'interview', label: '📅 约面与题目清单' },
            { key: 'review', label: '📝 面评复盘报告' },
            { key: 'approval', label: `🏛️ 录取与双审批 ${app ? '(已发起)' : ''}` },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveSection(tab.key as any)}
              className={`shrink-0 flex-1 whitespace-nowrap cursor-pointer rounded-lg px-3.5 py-1.5 text-xs transition-all select-none active:scale-95 ${
                activeSection === tab.key
                  ? 'bg-gradient-to-b from-[#2c2c2e] to-[#161617] text-white shadow-[0_2px_8px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.25)] font-semibold'
                  : 'text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-black/[0.03]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ================= 一页贯通主区域 ================= */}
      <div className="space-y-8">
        {/* 区块 1：简历原文与附件 */}
        {(activeSection === 'resume' || activeSection === 'screening') && (
          <section className="ws-paper rounded-2xl p-6 border border-black/[0.05]">
            <div className="flex items-center justify-between pb-4 border-b border-black/[0.05]">
              <div>
                <h2 className="text-base font-semibold text-[#1d1d1f]">简历原文与附件展示</h2>
                <p className="mt-0.5 text-xs text-[#86868b]">
                  来源存储：MinIO 对象存储 · 文件标识：{c.sourceId}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {c.attachmentType === 'missing' && (
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-800 border border-amber-200">
                    ⚠ 原始附件文件缺失，展示平台结构化文本
                  </span>
                )}
                <Btn variant="ghost" className="!h-8 !px-3">
                  下载原件 ⤓
                </Btn>
              </div>
            </div>

            <div className="mt-5 rounded-xl overflow-hidden border border-black/[0.04] bg-[#fbfbfa]">
              <ResumeDoc c={c} />
            </div>
          </section>
        )}

        {/* 区块 2：AI 宽松初筛与岗位 JD 对标 */}
        {(activeSection === 'screening' || activeSection === 'resume') && (
          <section className="ws-paper rounded-2xl p-6 border border-black/[0.05] space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.05]">
              <div>
                <h2 className="text-base font-semibold text-[#1d1d1f]">AI 辅助初筛结论与标尺对标</h2>
                <p className="mt-0.5 text-xs text-[#86868b]">
                  基于岗位《{jd.title}》标准要求进行的宽松匹配，AI 仅供参考，不自动淘汰候选人
                </p>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                初筛契合度 {c.match}%
              </span>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl bg-emerald-500/[0.06] border border-emerald-500/10 p-4">
                <h3 className="text-xs font-semibold text-emerald-800 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  推荐理由与核心亮点 ({c.highlights.length})
                </h3>
                <ul className="mt-2 space-y-1.5 text-xs text-emerald-950">
                  {c.highlights.map((h) => (
                    <li key={h}>• {h}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl bg-amber-500/[0.06] border border-amber-500/10 p-4">
                <h3 className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  疑点与待核实事项 ({c.risks.length})
                </h3>
                <ul className="mt-2 space-y-1.5 text-xs text-amber-950">
                  {c.risks.map((r) => (
                    <li key={r}>• {r}</li>
                  ))}
                  {!c.risks.length && <li>暂无明显风险疑点</li>}
                </ul>
              </div>
            </div>

            <div className="pt-2 text-xs text-[#86868b]">
              <strong>JD 核心技能点阵核验：</strong>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {jd.skills.map((s) => {
                  const hit = c.skills.find((x) => s.includes(x.k) || x.k.includes(s.split('/')[0].trim()))
                  return (
                    <span
                      key={s}
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        hit
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50'
                          : 'bg-[#f5f5f7] text-[#86868b]'
                      }`}
                    >
                      {hit ? `✓ ${s} (${hit.v}分)` : s}
                    </span>
                  )
                })}
              </div>
            </div>
          </section>
        )}

        {/* 区块 3：沟通跟进记录 */}
        {(activeSection === 'notes' || activeSection === 'all' as any) && (
          <section className="ws-paper rounded-2xl p-6 border border-black/[0.05] space-y-4">
            <h2 className="text-base font-semibold text-[#1d1d1f]">团队沟通跟进记录</h2>

            <div className="flex gap-2">
              <input
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                placeholder="录入沟通意向、候选人期望薪资、面试反馈便签…"
                className="h-9 flex-1 rounded-xl border border-black/[0.08] bg-white px-3.5 text-xs outline-none focus:border-black/50"
              />
              <Btn onClick={handleAddNote}>+ 添加记录</Btn>
            </div>

            <div className="space-y-2.5 mt-4">
              {c.notes.map((n) => (
                <div key={n.id} className="rounded-xl bg-[#f5f5f7] p-3 text-xs flex items-start justify-between gap-4">
                  <div>
                    <div className="font-semibold text-[#1d1d1f]">{n.author}</div>
                    <div className="mt-1 text-[#515154] leading-relaxed">{n.content}</div>
                  </div>
                  <span className="text-[11px] text-[#86868b] shrink-0 font-mono">{n.time}</span>
                </div>
              ))}
            </div>

            {/* 责任人与下一步：阶段、负责人、下一步动作可查（FR-A4 / PRD 非功能「记录、负责人和下一步可查」） */}
            <div className="grid gap-3 sm:grid-cols-2 pt-1 border-t border-black/[0.05] text-xs">
              <div className="rounded-xl border border-black/[0.06] p-3 space-y-1">
                <div className="font-semibold text-[#1d1d1f]">下一步动作</div>
                {c.nextAction ? (
                  <>
                    <div className="text-[#515154] leading-relaxed">{c.nextAction.text}</div>
                    <div className="text-[11px] text-[#86868b]">责任人：{c.nextAction.owner} · 期限：{c.nextAction.dueAt}</div>
                  </>
                ) : (
                  <div className="text-[#86868b]">暂无登记，可在沟通后补充下一步与责任人。</div>
                )}
                <div className="text-[11px] text-[#86868b]">当前负责人：{c.assignee}</div>
              </div>
              <div className="rounded-xl border border-black/[0.06] p-3 space-y-1">
                <div className="font-semibold text-[#1d1d1f]">阶段流转历史（追加不覆盖）</div>
                <ol className="space-y-1">
                  {(c.stageHistory ?? []).map((h, i) => (
                    <li key={i} className="text-[11px] text-[#515154] leading-relaxed">
                      <span className="font-mono text-[#86868b]">{h.at}</span> · <b className="font-medium text-[#1d1d1f]">{h.stage}</b> · {h.by}
                      {h.reason ? ` · ${h.reason}` : ''}
                    </li>
                  ))}
                  {!c.stageHistory?.length && <li className="text-[11px] text-[#86868b]">暂无阶段流转记录。</li>}
                </ol>
                <div className="text-[11px] text-[#86868b] pt-1 border-t border-black/[0.04]">
                  来源库最后更新：{c.sourceUpdatedAt ?? '未知（来源侧未提供更新时间）'}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 区块 4：约面安排与本场出题 */}
        {(activeSection === 'interview' || activeSection === 'all' as any) && (
          <section className="ws-paper rounded-2xl p-6 border border-black/[0.05] space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.05]">
              <div>
                <h2 className="text-base font-semibold text-[#1d1d1f]">约面安排与定制试题</h2>
                <p className="mt-0.5 text-xs text-[#86868b]">
                  当前安排：{c.slot === '待安排' ? '未排期' : `${slotLabel(c.slot)} · ${c.round}`}
                </p>
              </div>

              {c.status === '约面中' && (
                <div className="flex items-center gap-2">
                  <Btn variant="ghost" className="!h-8 !px-3" onClick={() => resendNotice(c.id)}>
                    重发候选人通知
                  </Btn>
                  <Btn variant="ghost" className="!h-8 !px-3 text-red-600" onClick={() => cancelSchedule(c.id)}>
                    取消面试
                  </Btn>
                  <Btn variant="accent" className="!h-8 !px-3" onClick={() => go('room', c.id)}>
                    进入考场 ↗
                  </Btn>
                </div>
              )}
            </div>

            {/* 飞书与第三方通知卡片：场次、日程与通知异常全部显式展示（FR-B1 / FR-B2） */}
            {c.scheduleDetail && (
              <div className="rounded-xl bg-[#f4f5f8] border border-black/[0.06] p-4 text-xs space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-[#1d1d1f]">
                    场次 {c.scheduleDetail.interviewId} · {c.scheduleDetail.type === 'offline' ? '线下面试' : '线上飞书会议'} · {c.scheduleDetail.durationMin} 分钟 · 面试官 {c.scheduleDetail.interviewer}
                    {c.scheduleDetail.status === 'canceled' && <span className="ml-2 text-amber-700">（已取消，历史保留）</span>}
                  </span>
                  {c.scheduleDetail.feishuMeetingUrl && (
                    <a
                      href={c.scheduleDetail.feishuMeetingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#1d1d1f] font-semibold hover:underline"
                    >
                      {c.scheduleDetail.feishuMeetingUrl} ↗
                    </a>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[#515154]">
                  <span>飞书日历与会议：</span>
                  <strong className={c.scheduleDetail.feishuCalendarStatus === 'synced' ? 'text-emerald-700' : 'text-amber-700'}>
                    {c.scheduleDetail.feishuCalendarStatus === 'synced'
                      ? '已同步'
                      : c.scheduleDetail.feishuCalendarStatus === 'failed'
                      ? '同步失败（可重试，不重复建场）'
                      : '待同步（已提交飞书 API，等待回调）'}
                  </strong>
                </div>
                <div className="text-[#515154]">
                  候选人通知通道：{c.scheduleDetail.noticeChannel === 'sms' ? '短信服务 (第三方)' : '邮件 SMTP'} · 状态：
                  <strong className={c.scheduleDetail.noticeStatus === 'failed' ? 'text-red-600' : 'text-[#1d1d1f]'}>
                    {c.scheduleDetail.noticeStatus === 'sent'
                      ? '已发送待确认'
                      : c.scheduleDetail.noticeStatus === 'confirmed'
                      ? '候选人已确认'
                      : c.scheduleDetail.noticeStatus === 'failed'
                      ? `发送失败（已尝试 ${c.scheduleDetail.noticeAttempts} 次）`
                      : '待发送'}
                  </strong>
                </div>
                {c.scheduleDetail.failureReason && (
                  <div className="rounded-lg bg-red-50/70 border border-red-200/60 px-2.5 py-1.5 text-[11px] text-red-700">
                    异常原因：{c.scheduleDetail.failureReason}
                  </div>
                )}
                <div className="text-[11px] text-[#86868b] pt-1 border-t border-black/[0.04]">
                  改期 / 通知历史（{c.scheduleDetail.history.length} 条，追加不覆盖）：
                  {c.scheduleDetail.history.slice(-2).map((h) => ` ${h.at} ${h.by} ${h.action}${h.to ? `→${h.to}` : ''}`).join('；')}
                </div>
              </div>
            )}

            {/* 本场题单 */}
            <div className="space-y-3">
              <div className="text-xs font-semibold text-[#1d1d1f]">本场针对性命题清单 ({c.qs.length} 道)</div>
              {c.qs.map((q, idx) => (
                <div key={q.id} className="rounded-xl border border-black/[0.05] p-3.5 text-xs bg-white space-y-1.5">
                  <div className="font-medium text-[#1d1d1f]">
                    {idx + 1}. {q.q}
                  </div>
                  <div className="text-[11px] text-[#86868b] flex items-center gap-2">
                    <span className="rounded bg-black/[0.04] px-1.5 py-0.5">{q.topic}</span>
                    <span>出题依据: {q.basis}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 区块 5：综合面评复盘报告 */}
        {(activeSection === 'review' || activeSection === 'all' as any) && (
          <section className="ws-paper rounded-2xl p-6 border border-black/[0.05] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.05]">
              <h2 className="text-base font-semibold text-[#1d1d1f]">面试综合评价报告</h2>
              <span className="text-xs text-[#86868b]">面评时间：{room?.savedAt || '完成考场后生成'}</span>
            </div>

            {review ? (
              <div className="space-y-4 text-xs leading-relaxed text-[#1d1d1f]">
                <div className="rounded-xl bg-[#f5f5f7] p-4">
                  <div className="font-semibold text-sm mb-1">AI 汇总面评草稿（已由人工复核）</div>
                  <p className="text-[#515154]">{review.overall}</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/40 p-3.5">
                    <div className="font-semibold text-emerald-800">确认优势</div>
                    <ul className="mt-2 space-y-1 text-emerald-950">
                      {review.strengths.map((s, i) => (
                        <li key={i}>• {s}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-xl border border-amber-200/60 bg-amber-50/40 p-3.5">
                    <div className="font-semibold text-amber-800">待核实短板</div>
                    <ul className="mt-2 space-y-1 text-amber-950">
                      {review.weaknesses.map((w, i) => (
                        <li key={i}>• {w}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-[#86868b]">
                该候选人尚未完成面试，待面试结束后在此处生成面评报告。
              </div>
            )}
          </section>
        )}

        {/* 区块 6：录取与飞书/BPM 双审批跟踪 */}
        {(activeSection === 'approval' || activeSection === 'all' as any) && (
          <section className="ws-paper rounded-2xl p-6 border border-black/[0.05] space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.05]">
              <div>
                <h2 className="text-base font-semibold text-[#1d1d1f]">录取申请与双审批流（飞书 / BPM）</h2>
                <p className="mt-0.5 text-xs text-[#86868b]">
                  业务确认录取后显式发起，双流程均通过方可发放 Offer 办理入职
                </p>
              </div>

              {!app && (
                <Btn variant="solid" onClick={() => go('approvals')}>
                  + 发起录取审批申请
                </Btn>
              )}
            </div>

            {app ? (
              <div className="space-y-4">
                <div className="rounded-xl bg-[#f5f5f7] p-4 text-xs space-y-2">
                  <div className="flex items-center justify-between font-semibold">
                    <span>审批单号：{app.id}</span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] ${
                        app.finalStatus === 'approved'
                          ? 'bg-emerald-100 text-emerald-800'
                          : app.finalStatus === 'partial'
                          ? 'bg-amber-100 text-amber-800'
                          : app.finalStatus === 'returned' || app.finalStatus === 'rejected'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-black/[0.04] text-[#1d1d1f] ring-1 ring-inset ring-black/10'
                      }`}
                    >
                      {finalLabel[app.finalStatus] ?? '⏳ 审批流转中'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[#515154] pt-2 border-t border-black/[0.04]">
                    <div>拟定薪资：{app.salary}</div>
                    <div>拟定职级：{app.level}</div>
                    <div>发起 HR：{app.applicant}</div>
                    <div>预计到岗：{app.onboardDate}</div>
                  </div>
                </div>

                {/* 飞书与 BPM 双轨卡片 */}
                <div className="grid gap-4 sm:grid-cols-2 text-xs">
                  {/* 飞书审批 */}
                  <div className="rounded-xl border border-black/[0.06] p-4 bg-white space-y-2">
                    <div className="flex items-center justify-between font-semibold">
                      <span className="text-[#1d1d1f]">飞书审批流</span>
                      <span className="text-[#1d1d1f] font-semibold">{trackLabel[app.feishu.status] ?? app.feishu.status}</span>
                    </div>
                    <div className="text-[#86868b]">实例 ID: {app.feishu.instanceId}</div>
                    <div className="text-[#515154]">当前节点: {app.feishu.currentNode}</div>
                    <div className="text-[11px] text-[#86868b]">更新时间: {app.feishu.updateTime}</div>
                    {app.feishu.retryCount > 0 && <div className="text-[11px] text-amber-700">同步重试 {app.feishu.retryCount} 次（沿用原实例，未重复发起）</div>}
                    {app.feishu.lastError && <div className="text-[11px] text-red-600">最近异常：{app.feishu.lastError}</div>}
                  </div>

                  {/* BPM 内部 OA */}
                  <div className="rounded-xl border border-black/[0.06] p-4 bg-white space-y-2">
                    <div className="flex items-center justify-between font-semibold">
                      <span className="text-[#1d1d1f]">BPM (内部 OA) 录取流程</span>
                      <span className="text-[#1d1d1f] font-semibold">{trackLabel[app.bpm.status] ?? app.bpm.status}</span>
                    </div>
                    <div className="text-[#86868b]">流程编号: {app.bpm.processId}</div>
                    <div className="text-[#515154]">当前节点: {app.bpm.currentNode}</div>
                    <div className="text-[11px] text-[#86868b]">更新时间: {app.bpm.updateTime}</div>
                    {app.bpm.retryCount > 0 && <div className="text-[11px] text-amber-700">同步重试 {app.bpm.retryCount} 次（沿用原流程号，未重复发起）</div>}
                    {app.bpm.lastError && <div className="text-[11px] text-red-600">最近异常：{app.bpm.lastError}</div>}
                  </div>
                </div>

                {/* 申请材料核对清单：缺失 / 待补传逐项可见（FR-C1） */}
                <div className="rounded-xl border border-black/[0.06] p-4 bg-white text-xs space-y-2">
                  <div className="font-semibold text-[#1d1d1f]">申请材料核对清单</div>
                  <div className="flex flex-wrap gap-1.5">
                    {app.materials.map((m) => (
                      <span
                        key={m.key}
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          m.status === 'done' ? 'bg-emerald-50 text-emerald-800' : m.status === 'pending' ? 'bg-amber-50 text-amber-800' : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {m.status === 'done' ? '✓' : m.status === 'pending' ? '⏳ 待补传' : '✕ 缺失'} {m.name}
                        {m.required ? '' : '（选填）'}
                      </span>
                    ))}
                  </div>
                </div>

                {/* 两轨状态流转历史：退回 / 拒绝等负向结论带审批意见（FR-C4） */}
                <div className="grid gap-4 sm:grid-cols-2 text-xs">
                  {([['飞书审批', app.feishu], ['BPM (内部 OA)', app.bpm]] as const).map(([name, track]) => (
                    <div key={name} className="rounded-xl border border-black/[0.06] p-4 bg-white space-y-1.5">
                      <div className="font-semibold text-[#1d1d1f]">{name} · 流转历史（{track.history.length} 条）</div>
                      <ol className="space-y-1">
                        {track.history.map((h, i) => (
                          <li key={i} className="text-[11px] text-[#515154] leading-relaxed">
                            <span className="font-mono text-[#86868b]">{h.at}</span> · <b className="font-medium text-[#1d1d1f]">{trackLabel[h.status] ?? h.status}</b> · {h.node} · {h.by}
                            {h.comment ? ` · 意见：${h.comment}` : ''}
                          </li>
                        ))}
                      </ol>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-[#86868b]">
                尚未创建录取申请单。当面试综合评价通过且业务明确录用意向时，点击右上角发起申请。
              </div>
            )}
          </section>
        )}
      </div>

      {/* 调岗弹窗 */}
      {showSwitchPos && (
        <div className="ws-scrim fixed inset-0 z-50 grid place-items-center px-4" onClick={() => setShowSwitchPos(false)}>
          <div className="w-full max-w-md ws-paper rounded-2xl p-6 border border-black/[0.08] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-baseline justify-between border-b border-black/[0.06] pb-3">
              <h2 className="text-lg font-semibold text-[#1d1d1f]">调换在招岗位与装配标尺</h2>
              <button onClick={() => setShowSwitchPos(false)} className="cursor-pointer text-xs text-[#86868b]">✕</button>
            </div>
            <div className="mt-4 space-y-2.5">
              {positions.map((p) => {
                const targetJd = findJd(p.jdId)
                const isCur = c.positionId === p.id
                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      bindCandidatePosition(c.id, p.id)
                      setShowSwitchPos(false)
                    }}
                    className={`cursor-pointer rounded-xl border p-3.5 transition-all text-xs ${
                      isCur ? 'border-[#1d1d1f] bg-black/[0.03] font-semibold' : 'border-black/[0.06] bg-white hover:border-black/30'
                    }`}
                  >
                    <div className="flex justify-between">
                      <span>{p.name}</span>
                      {isCur && <span className="text-[#1d1d1f] font-semibold">当前岗位</span>}
                    </div>
                    <div className="mt-1 text-[#86868b]">标尺: {targetJd ? `${targetJd.title} (${targetJd.code})` : '该岗位尚未装配标尺'}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* 约面弹窗 */}
      {showScheduleModal && (
        <div className="ws-scrim fixed inset-0 z-50 grid place-items-center px-4" onClick={() => setShowScheduleModal(false)}>
          <div className="w-full max-w-md ws-paper rounded-2xl p-6 border border-black/[0.08] shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-baseline justify-between border-b border-black/[0.06] pb-3">
              <h2 className="text-lg font-semibold text-[#1d1d1f]">安排面试日程</h2>
              <button onClick={() => setShowScheduleModal(false)} className="cursor-pointer text-xs text-[#86868b]">✕</button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[#86868b] block mb-1">面试时间 (YYYY-MM-DD HH:mm)</label>
                <input
                  value={schedDate}
                  onChange={(e) => setSchedDate(e.target.value)}
                  className="h-9 w-full rounded-xl border border-black/[0.08] px-3 outline-none focus:border-black/50"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[#86868b] block mb-1">轮次</label>
                  <select
                    value={schedRound}
                    onChange={(e) => setSchedRound(e.target.value)}
                    className="h-9 w-full rounded-xl border border-black/[0.08] px-3 outline-none"
                  >
                    <option value="一面">一面 (专业初试)</option>
                    <option value="二面">二面 (架构复试)</option>
                    <option value="终面">终面 (业务总监)</option>
                    <option value="HR面">HR面</option>
                  </select>
                </div>
                <div>
                  <label className="text-[#86868b] block mb-1">候选人通知通道</label>
                  <select
                    value={schedChannel}
                    onChange={(e) => setSchedChannel(e.target.value as any)}
                    className="h-9 w-full rounded-xl border border-black/[0.08] px-3 outline-none"
                  >
                    <option value="sms">短信通道 (第三方)</option>
                    <option value="email">邮件通知 (SMTP)</option>
                  </select>
                </div>
              </div>
              <p className="text-[11px] text-[#86868b]">
                点击确认后将自动调用飞书 API 创建日程与视频会议，并通过选定通道向候选人发出邀约。
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Btn variant="ghost" onClick={() => setShowScheduleModal(false)}>取消</Btn>
              <Btn variant="solid" onClick={handleConfirmSchedule}>确认排期与通知</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
