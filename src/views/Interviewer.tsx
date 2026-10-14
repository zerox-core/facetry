import { useState } from 'react'
import { bank, type Candidate, type JD, type Position } from '../data'
import {
  addQuestion,
  bindCandidatePosition,
  findC,
  findJd,
  findPos,
  pickedOf,
  positions,
  setPicked as savePicked,
  slotLabel,
} from '../store'
import type { Go } from '../App'
import { Btn } from './ui'
import ResumeDoc from './ResumeDoc'

const TOPICS = ['技术深挖', '项目细节', '简历核实', '行为面试']
const field =
  'w-full rounded-xl border border-black/[0.08] bg-white px-3.5 py-2 text-xs leading-6 outline-none placeholder:text-[#86868b] focus:border-black/50 focus:ring-2 focus:ring-black/10'

type Props = { cid: string; go: Go }

// 岗位 / 标尺缺失时的兜底展示对象：不把面试间静默绑到其他岗位或标尺上（FR-A4）
const emptyPos = (c: Candidate): Position => ({ id: '', code: '—', name: c.role, jdId: '', dept: '', recruiter: c.assignee, hiringManager: c.assignee, hc: 0, hired: 0, status: '招募中', createdAt: '' })
const emptyJd = (c: Candidate): JD => ({ id: '', code: '—', title: '未装配标尺', dept: c.role, exp: '—', edu: '—', salary: '—', skills: [], summary: '', responsibilities: [], requirements: [], updatedAt: '' })

export default function Interviewer({ cid, go }: Props) {
  const foundC = findC(cid)
  const foundPos = findPos(foundC?.positionId)
  const foundJd = findJd(foundC?.jdId || foundPos?.jdId)
  const picked = pickedOf(cid)
  const setPicked = (v: string[]) => savePicked(cid, v)
  const [hover, setHover] = useState<string>()
  const [adding, setAdding] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true) // 是否展开左侧 JD 白皮书常驻栏
  const [showSwitchPos, setShowSwitchPos] = useState(false)
  const [activeDeckTab, setActiveDeckTab] = useState<'picked' | 'bank'>('picked')
  const [draft, setDraft] = useState({ q: '', topic: TOPICS[0], points: '', follow: '' })

  // 找不到候选人时给出空态，避免面试间静默绑到其他候选人
  if (!foundC) {
    return (
      <div className="ws-paper rounded-2xl p-12 text-center text-xs text-[#86868b]">
        未找到候选人记录（{cid}），可能已被来源库标记失效，请返回工作台重新选择。
      </div>
    )
  }

  const c = foundC
  const pos = foundPos ?? emptyPos(c)
  const jd = foundJd ?? emptyJd(c)

  const submit = () => {
    if (!draft.q.trim()) return
    const lines = (v: string) =>
      v
        .split('\n')
        .map((x) => x.trim())
        .filter(Boolean)
    addQuestion(cid, {
      q: draft.q.trim(),
      topic: draft.topic,
      points: lines(draft.points),
      follow: lines(draft.follow),
    })
    setDraft({ q: '', topic: draft.topic, points: '', follow: '' })
    setAdding(false)
  }
  const used = new Set(c.qs.map((q) => q.q))
  const toggle = (id: string) =>
    setPicked(picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id])

  const roomBtn =
    c.status === '约面中' ? (
      <Btn variant="accent" onClick={() => go('room', cid)}>
        进入面试间（{picked.length} 题）
      </Btn>
    ) : c.status === '面评中' ? (
      <Btn variant="accent" onClick={() => go('room', cid)}>
        去补填评价
      </Btn>
    ) : c.status === '待联系' ? (
      <Btn variant="ghost" onClick={() => go('room', cid)}>
        进入面试间（{picked.length} 题）
      </Btn>
    ) : (
      <Btn variant="ghost" onClick={() => go('room', cid)}>
        面试记录（已提交）
      </Btn>
    )

  return (
    <div className="space-y-6">
      {/* 顶部标题与行动控制台 */}
      <div className="ws-rise flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-black/[0.06] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-black/[0.04] px-2.5 py-0.5 text-xs font-semibold text-[#1d1d1f] border border-black/10">
              {pos.name}
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-[#1d1d1f]">
              {c.name} · {c.role}
            </h1>
            <span className="rounded-full bg-black/[0.04] px-3 py-1 text-xs font-semibold text-[#1d1d1f] border border-black/10">
              对标标尺: {jd.code}
            </span>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              契合度 {c.match}%
            </span>
          </div>
          <p className="mt-1 text-xs text-[#86868b]">
            {slotLabel(c.slot)} · {c.round} · 亮点 {c.highlights.length} 项 · 待核实 {c.risks.length} 处 · 针对性命题 {c.qs.length} 道
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Btn variant="ghost" onClick={() => go('back')}>
            ← 返回{go.from}
          </Btn>
          {roomBtn}
        </div>
      </div>

      {/* 顶层黑曜石 HUD 标尺对齐看板 (Obsidian Alignment Strip) */}
      <div className="ws-rise [--i:1] obsidian-panel rounded-2xl p-4 text-white flex flex-wrap items-center justify-between gap-4 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-1/3 w-60 h-60 bg-gradient-to-br from-violet-600/15 to-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-wrap items-center gap-6 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-white/60">年限门槛:</span>
            <span className="font-semibold text-white">{c.exp}</span>
            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-300 font-medium border border-emerald-500/30">
              达标 (JD: {jd.exp})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-white/60">学历门槛:</span>
            <span className="font-semibold text-white">{c.edu.split('·')[0]}</span>
            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-300 font-medium border border-emerald-500/30">
              符合 (JD: {jd.edu})
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-white/60">技能覆盖:</span>
            {jd.skills.slice(0, 4).map((s) => {
              const hit = c.skills.find((x) => s.includes(x.k) || x.k.includes(s.split('/')[0].trim()))
              return (
                <span
                  key={s}
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${
                    hit
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-white/10 text-white/60 border border-white/5'
                  }`}
                >
                  {hit ? `✓ ${s}` : s}
                </span>
              )
            })}
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={`cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-medium transition-all border ${
              sidebarOpen
                ? 'bg-white text-black border-white shadow-xs font-semibold'
                : 'bg-white/10 text-white border-white/15 hover:bg-white/20'
            }`}
          >
            {sidebarOpen ? '隐藏 JD 标尺常驻栏 ⇥' : '展开 JD 标尺常驻栏 ⇤'}
          </button>
          <button
            onClick={() => setShowSwitchPos(true)}
            className="cursor-pointer text-xs font-medium text-white/80 hover:text-white underline-offset-4 hover:underline"
          >
            换岗对标 ↻
          </button>
        </div>
      </div>

      {/* 核心三栏 Studio 布局 (Apple 3-Column Pro Studio Layout) */}
      <div
        className={`ws-rise [--i:2] grid gap-6 transition-all duration-300 ${
          sidebarOpen
            ? 'grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)_380px]'
            : 'grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_400px]'
        }`}
      >
        {/* 左栏（常驻用人标尺面板 JD Inspector Panel） */}
        {sidebarOpen && (
          <aside className="ws-paper rounded-2xl p-5 border border-black/[0.04] space-y-5 lg:sticky lg:top-16 lg:h-[calc(100vh-6rem)] lg:overflow-y-auto">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] font-semibold text-[#1d1d1f]">{jd.code}</span>
                <span className="rounded-full bg-black/[0.04] px-2 py-0.5 text-[10px] text-[#86868b]">常驻对照</span>
              </div>
              <h3 className="mt-1 text-base font-semibold tracking-tight text-[#1d1d1f]">{jd.title}</h3>
              <p className="mt-0.5 text-xs text-[#86868b]">{jd.dept} · 用人基准</p>
            </div>

            <div className="rounded-xl bg-[#f5f5f7] p-3 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-[#86868b]">薪酬范畴</span>
                <span className="font-semibold text-amber-800">{jd.salary}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#86868b]">编制要求</span>
                <span className="text-[#1d1d1f]">
                  {jd.exp} · {jd.edu}
                </span>
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-[#1d1d1f]">岗位核心职责</div>
              <ul className="mt-2 list-disc space-y-1.5 pl-4 text-xs text-[#515154]">
                {jd.responsibilities.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>

            <div>
              <div className="text-xs font-semibold text-[#1d1d1f]">
                考核标准与出题依据
              </div>
              <ul className="mt-2 list-disc space-y-1.5 pl-4 text-xs text-[#515154]">
                {jd.requirements.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>

            <div className="pt-2 border-t border-black/[0.04]">
              <button
                onClick={() => setShowSwitchPos(true)}
                className="w-full cursor-pointer rounded-xl bg-black/[0.03] py-2 text-center text-xs font-medium text-[#1d1d1f] hover:bg-black/[0.06] transition-colors"
              >
                调换对标岗位与标尺 ↻
              </button>
            </div>
          </aside>
        )}

        {/* 中栏（沉浸式履历精读与深挖透镜 Resume Slate） */}
        <main className="space-y-6">
          {/* 综合评价与亮点透镜 */}
          <div className="ws-paper rounded-2xl p-6 border border-black/[0.04]">
            <h2 className="text-base font-semibold tracking-tight text-[#1d1d1f]">AI 标尺对标深度结论</h2>
            <p className="mt-2 text-xs leading-relaxed text-[#515154]">{c.summary}</p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-emerald-500/[0.06] border border-emerald-500/10 p-3.5">
                <h3 className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  能力亮点 ({c.highlights.length})
                </h3>
                <ul className="mt-2 space-y-1.5 text-xs text-emerald-950">
                  {c.highlights.map((h) => (
                    <li key={h}>• {h}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl bg-amber-500/[0.06] border border-amber-500/10 p-3.5">
                <h3 className="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  重点待核实 / 疑点 ({c.risks.length})
                </h3>
                <ul className="mt-2 space-y-1.5 text-xs text-amber-950">
                  {c.risks.map((h) => (
                    <li key={h}>• {h}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* 简历正文透镜 */}
          <div className="ws-paper overflow-hidden rounded-2xl border border-black/[0.04] p-1">
            <div className="border-b border-black/[0.04] px-5 py-3 flex items-center justify-between text-xs text-[#86868b]">
              <span>候选人简历原文（已按 JD 标尺高亮穿透）</span>
              <span>鼠标悬停右侧题目可联动定位依据</span>
            </div>
            <div className="max-h-[800px] overflow-y-auto">
              <ResumeDoc c={c} active={hover} />
            </div>
          </div>
        </main>

        {/* 右栏（出题工作台与题库 Question Deck & Bank Studio） */}
        <aside className="space-y-4 lg:sticky lg:top-16 lg:h-[calc(100vh-6rem)] lg:overflow-y-auto">
          {/* Deck 顶栏选项卡 */}
          <div className="ws-paper rounded-2xl p-4 border border-black/[0.04]">
            <div className="flex items-center justify-between">
              <div className="flex rounded-full bg-black/[0.04] p-0.5 border border-black/[0.06]">
                <button
                  onClick={() => setActiveDeckTab('picked')}
                  className={`cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-all ${
                    activeDeckTab === 'picked'
                      ? 'bg-white text-[#1d1d1f] shadow-2xs'
                      : 'text-[#86868b] hover:text-[#1d1d1f]'
                  }`}
                >
                  本场题单 ({picked.length})
                </button>
                <button
                  onClick={() => setActiveDeckTab('bank')}
                  className={`cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-all ${
                    activeDeckTab === 'bank'
                      ? 'bg-white text-[#1d1d1f] shadow-2xs'
                      : 'text-[#86868b] hover:text-[#1d1d1f]'
                  }`}
                >
                  题库补充
                </button>
              </div>

              <button
                onClick={() => setAdding(!adding)}
                className="cursor-pointer text-xs font-medium text-[#1d1d1f] hover:underline"
              >
                {adding ? '取消' : '+ 自拟题目'}
              </button>
            </div>

            {/* 新增题目抽屉 */}
            {adding && (
              <div className="mt-4 border-t border-black/[0.06] pt-4 space-y-3">
                <div className="text-xs font-semibold text-[#1d1d1f]">自拟考察试题</div>
                <textarea
                  autoFocus
                  value={draft.q}
                  onChange={(e) => setDraft({ ...draft, q: e.target.value })}
                  rows={2}
                  placeholder="输入要向候选人考察的问题…"
                  className={field}
                />
                <div className="flex flex-wrap gap-1.5">
                  {TOPICS.map((t) => (
                    <button
                      key={t}
                      onClick={() => setDraft({ ...draft, topic: t })}
                      className={`cursor-pointer rounded-full px-2.5 py-0.5 text-xs transition-all ${
                        draft.topic === t
                          ? 'bg-[#1d1d1f] text-white'
                          : 'bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f]'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <div className="grid gap-2">
                  <input
                    value={draft.points}
                    onChange={(e) => setDraft({ ...draft, points: e.target.value })}
                    placeholder="考核要点 (选填)"
                    className={field}
                  />
                  <input
                    value={draft.follow}
                    onChange={(e) => setDraft({ ...draft, follow: e.target.value })}
                    placeholder="追问思路 (选填)"
                    className={field}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Btn onClick={submit}>加入本场出题</Btn>
                </div>
              </div>
            )}
          </div>

          {/* 选项卡一：本场已选出题单 */}
          {activeDeckTab === 'picked' ? (
            <div className="space-y-3">
              <div className="text-xs font-medium text-[#86868b] px-1">
                依据《{jd.title}》定制的 {c.qs.length} 道针对性题目（已选 {picked.length} 道入场）
              </div>

              {c.qs.map((q, i) => {
                const on = picked.includes(q.id)
                return (
                  <div
                    key={q.id}
                    onMouseEnter={() => setHover(q.id)}
                    onMouseLeave={() => setHover(undefined)}
                    className={`group ws-paper rounded-2xl p-4 border transition-all ${
                      on
                        ? 'border-black/20 hover:border-black/40 shadow-xs'
                        : 'border-black/[0.04] opacity-60 bg-[#f5f5f7]/60'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggle(q.id)}
                        className="mt-1 h-4 w-4 shrink-0 rounded cursor-pointer accent-[#1d1d1f]"
                      />
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-medium leading-relaxed ${on ? 'text-[#1d1d1f]' : 'text-[#86868b]'}`}>
                          <span className="mr-1.5 tabular-nums text-[#86868b]">{i + 1}.</span>
                          {q.q}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
                          <span className="rounded-full bg-black/[0.04] px-2 py-0.5 font-medium text-[#1d1d1f]">
                            {q.topic}
                          </span>
                          <span className="text-[#86868b]">{q.basis}</span>
                        </div>

                        {q.points && q.points.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-black/[0.04] text-[11px] text-[#86868b]">
                            <span className="font-medium text-[#1d1d1f]">考察要点：</span>
                            {q.points.join('；')}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            /* 选项卡二：团队题库补充 */
            <div className="space-y-2.5">
              <div className="text-xs font-medium text-[#86868b] px-1">
                标准能力题库储备（点击直接装载进本候选人题本）
              </div>
              {bank
                .filter((b) => !used.has(b.q))
                .map((b) => (
                  <div
                    key={b.q}
                    className="ws-paper rounded-2xl p-3.5 border border-black/[0.04] hover:border-black/20 transition-all flex items-start justify-between gap-3"
                  >
                    <div className="text-xs text-[#1d1d1f] leading-relaxed">
                      <div className="font-medium">{b.q}</div>
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-[#86868b]">
                        <span className="rounded bg-black/[0.04] px-1.5 py-0.5">{b.cat}</span>
                        <span>难度: {b.diff}</span>
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        addQuestion(cid, {
                          q: b.q,
                          topic: b.cat === '综合' ? '行为面试' : '技术深挖',
                          diff: b.diff,
                          basis: `团队题库 · ${b.cat}`,
                          points: b.points,
                          answer: b.answer,
                          follow: b.follow,
                          flag: b.flag,
                        })
                      }
                      className="cursor-pointer shrink-0 rounded-full bg-black/[0.05] px-2.5 py-1 text-xs font-semibold text-[#1d1d1f] hover:bg-black/10 border border-black/10"
                    >
                      + 装载
                    </button>
                  </div>
                ))}
            </div>
          )}
        </aside>
      </div>

      {/* 调整对标岗位与用人标尺弹窗 */}
      {showSwitchPos && (
        <div
          className="ws-scrim fixed inset-0 z-50 grid place-items-center px-4"
          onClick={() => setShowSwitchPos(false)}
        >
          <div
            className="login-fade w-full max-w-md ws-paper rounded-2xl p-6 border border-black/[0.08] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-baseline justify-between border-b border-black/[0.06] pb-3">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-[#1d1d1f]">重新选择对标在招岗位</h2>
                <p className="mt-0.5 text-xs text-[#86868b]">切换后将即时继承新岗位的考核标尺与评价维度</p>
              </div>
              <button
                onClick={() => setShowSwitchPos(false)}
                className="cursor-pointer text-xs text-[#86868b] hover:text-[#1d1d1f]"
              >
                ✕
              </button>
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
                    className={`cursor-pointer rounded-xl border p-3.5 transition-all ${
                      isCur
                        ? 'border-[#1d1d1f] bg-black/[0.03] shadow-xs'
                        : 'border-black/[0.06] bg-white hover:border-black/30'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[#1d1d1f] text-xs">{p.name}</span>
                      {isCur && (
                        <span className="rounded-full bg-[#1d1d1f] px-2 py-0.5 text-[10px] text-white">当前岗位</span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-[#86868b]">
                      <span>{p.dept}</span>
                      <span>·</span>
                      <span className="text-[#1d1d1f] font-medium">
                        📋 装配标尺: {targetJd ? `${targetJd.title} (${targetJd.code})` : '该岗位尚未装配标尺'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mt-5 flex justify-end">
              <Btn variant="ghost" onClick={() => setShowSwitchPos(false)}>
                取消
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
