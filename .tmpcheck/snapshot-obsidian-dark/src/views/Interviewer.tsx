import { useState, type CSSProperties } from 'react'
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
import { Btn, Chip, Empty, Modal } from './ui'
import ResumeDoc from './ResumeDoc'

const TOPICS = ['技术深挖', '项目细节', '简历核实', '行为面试']
// 表单控件：不再抹掉浏览器/全局焦点环，键盘 :focus-visible 保持可见
const field =
  'w-full rounded-xl border border-base-300 bg-base-100 px-3.5 py-2 text-xs leading-6 text-base-content placeholder:text-base-content/50 focus:border-accent focus:ring-2 focus:ring-accent/30'

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
  const [pendingPos, setPendingPos] = useState<string>() // 待确认切换的目标岗位（避免误触即调岗）
  // 打开调岗弹窗时清空待选状态，避免上次的选择残留
  const openSwitchPos = () => { setPendingPos(undefined); setShowSwitchPos(true) }
  const [activeDeckTab, setActiveDeckTab] = useState<'picked' | 'bank'>('picked')
  const [draft, setDraft] = useState({ q: '', topic: TOPICS[0], points: '', follow: '' })

  // 找不到候选人时给出空态，避免面试间静默绑到其他候选人
  if (!foundC) {
    return (
      <div className="ws-paper rounded-2xl p-12 text-center text-xs text-base-content/60">
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
  const bankLeft = bank.filter((b) => !used.has(b.q))
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
    <div className="space-y-7">
      {/* 顶部标题与行动控制台 */}
      <div className="ws-rise flex flex-col md:flex-row md:items-end justify-between gap-5 border-b border-base-300 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center rounded-full bg-base-content/5 px-2.5 py-0.5 text-xs font-semibold text-base-content border border-base-300">
              {pos.name}
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-4">
            <h1 className="text-2xl font-bold tracking-tight text-base-content">
              {c.name} · {c.role}
            </h1>
            <span className="rounded-full bg-base-content/5 px-3 py-1 text-xs font-semibold text-base-content border border-base-300">
              对标标尺: {jd.code}
            </span>
            {!foundJd && <Chip tone="warning">该岗位尚未装配标尺</Chip>}
            {!foundPos && <Chip tone="info">岗位档案缺失</Chip>}
            <span className="rounded-full bg-success/15 px-3 py-1 text-xs font-semibold text-success">
              契合度 {c.match}%
            </span>
          </div>
          <p className="mt-1 text-xs text-base-content/60">
            {slotLabel(c.slot)} · {c.round} · 亮点 {c.highlights.length} 项 · 待核实 {c.risks.length} 处 · 针对性命题 {c.qs.length} 道
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Btn variant="ghost" onClick={() => go('back')}>
            ← 返回{go.from}
          </Btn>
          {roomBtn}
        </div>
      </div>

      {/* 顶层黑曜石 HUD 标尺对齐看板 (Obsidian Alignment Strip) */}
      <div className="ws-rise [--i:1] obsidian-panel rounded-2xl p-4 text-base-content flex flex-wrap items-center justify-between gap-5 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-1/3 w-60 h-60 bg-gradient-to-br from-secondary/20 to-success/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-wrap items-center gap-7 text-xs">
          <div className="flex items-center gap-3">
            <span className="text-base-content/60">年限门槛:</span>
            <span className="font-semibold text-base-content">{c.exp}</span>
            <span className="rounded-full bg-success/20 px-2 py-0.5 text-[10px] text-success font-medium border border-success/30">
              达标 (JD: {jd.exp})
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-base-content/60">学历门槛:</span>
            <span className="font-semibold text-base-content">{c.edu.split('·')[0]}</span>
            <span className="rounded-full bg-success/20 px-2 py-0.5 text-[10px] text-success font-medium border border-success/30">
              符合 (JD: {jd.edu})
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-base-content/60">技能覆盖:</span>
            {jd.skills.slice(0, 4).map((s) => {
              const hit = c.skills.find((x) => s.includes(x.k) || x.k.includes(s.split('/')[0].trim()))
              return (
                <span
                  key={s}
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${
                    hit
                      ? 'bg-success/20 text-success border border-success/30'
                      : 'bg-white/10 text-base-content/60 border border-white/5'
                  }`}
                >
                  {hit ? `✓ ${s}` : s}
                </span>
              )
            })}
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-pressed={sidebarOpen}
            className={`motion-pop cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-medium border ${
              sidebarOpen
                ? 'bg-accent text-accent-content border-accent font-semibold'
                : 'bg-white/10 text-base-content border-white/15 hover:bg-white/20'
            }`}
          >
            {sidebarOpen ? '隐藏 JD 标尺常驻栏 ⇥' : '展开 JD 标尺常驻栏 ⇤'}
          </button>
          <button
            onClick={openSwitchPos}
            className="motion-pop cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium text-base-content/80 hover:text-base-content hover:bg-white/10 underline-offset-4 hover:underline"
          >
            换岗对标 ↻
          </button>
        </div>
      </div>

      {/* 核心三栏 Studio 布局 (Apple 3-Column Pro Studio Layout) */}
      <div
        className={`ws-rise [--i:2] grid gap-7 transition-all duration-300 ${
          sidebarOpen
            ? 'grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)_380px]'
            : 'grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_400px]'
        }`}
      >
        {/* 左栏（常驻用人标尺面板 JD Inspector Panel） */}
        {sidebarOpen && (
          <aside className="ws-paper rounded-2xl p-5 border border-base-300 space-y-6 lg:sticky lg:top-16 lg:h-[calc(100vh-6rem)] lg:overflow-y-auto">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] font-semibold text-base-content">{jd.code}</span>
                <span className="rounded-full bg-base-content/5 px-2 py-0.5 text-[10px] text-base-content/60">常驻对照</span>
              </div>
              <h3 className="mt-1 text-base font-semibold tracking-tight text-base-content">{jd.title}</h3>
              <p className="mt-0.5 text-xs text-base-content/60">{jd.dept} · 用人基准</p>
            </div>

            <div className="rounded-xl bg-base-200 p-3 text-xs space-y-2.5">
              <div className="flex justify-between">
                <span className="text-base-content/60">薪酬范畴</span>
                <span className="font-semibold text-warning">{jd.salary}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-base-content/60">编制要求</span>
                <span className="text-base-content">
                  {jd.exp} · {jd.edu}
                </span>
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-base-content">岗位核心职责</div>
              <ul className="mt-2 list-disc space-y-2.5 pl-4 text-xs text-base-content/60">
                {jd.responsibilities.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>

            <div>
              <div className="text-xs font-semibold text-base-content">
                考核标准与出题依据
              </div>
              <ul className="mt-2 list-disc space-y-2.5 pl-4 text-xs text-base-content/60">
                {jd.requirements.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>

            <div className="pt-2 border-t border-base-300">
              <button
                onClick={openSwitchPos}
                className="motion-pop w-full cursor-pointer rounded-xl bg-base-content/5 py-2 text-center text-xs font-medium text-base-content hover:bg-base-content/10"
              >
                调换对标岗位与标尺 ↻
              </button>
            </div>
          </aside>
        )}

        {/* 中栏（沉浸式履历精读与深挖透镜 Resume Slate） */}
        <main className="space-y-7">
          {/* 综合评价与亮点透镜 */}
          <div className="ws-paper rounded-2xl p-6 border border-base-300">
            <h2 className="text-base font-semibold tracking-tight text-base-content">AI 标尺对标深度结论</h2>
            <p className="mt-2 text-xs leading-relaxed text-base-content/60">{c.summary}</p>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div className="rounded-xl bg-success/10 border border-success/25 p-3.5">
                <h3 className="flex items-center gap-2.5 text-xs font-semibold text-success">
                  <span className="h-2 w-2 rounded-full bg-success" aria-hidden="true" />
                  能力亮点 ({c.highlights.length})
                </h3>
                <ul className="mt-2 space-y-2.5 text-xs text-base-content/70">
                  {c.highlights.map((h) => (
                    <li key={h}>• {h}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl bg-warning/10 border border-warning/25 p-3.5">
                <h3 className="flex items-center gap-2.5 text-xs font-semibold text-warning">
                  <span className="h-2 w-2 rounded-full bg-warning" aria-hidden="true" />
                  重点待核实 / 疑点 ({c.risks.length})
                </h3>
                <ul className="mt-2 space-y-2.5 text-xs text-base-content/70">
                  {c.risks.map((h) => (
                    <li key={h}>• {h}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* 简历正文透镜 */}
          <div className="ws-paper overflow-hidden rounded-2xl border border-base-300 p-1">
            <div className="border-b border-base-300 px-5 py-3 flex items-center justify-between text-xs text-base-content/60">
              <span>候选人简历原文（已按 JD 标尺高亮穿透）</span>
              <span>鼠标悬停右侧题目可联动定位依据</span>
            </div>
            <div className="max-h-[800px] overflow-y-auto">
              <ResumeDoc c={c} active={hover} />
            </div>
          </div>
        </main>

        {/* 右栏（出题工作台与题库 Question Deck & Bank Studio） */}
        <aside className="space-y-5 lg:sticky lg:top-16 lg:h-[calc(100vh-6rem)] lg:overflow-y-auto">
          {/* Deck 顶栏选项卡 */}
          <div className="ws-paper rounded-2xl p-4 border border-base-300">
            <div className="flex items-center justify-between">
              <div className="flex rounded-full bg-base-content/5 p-0.5 border border-base-300">
                <button
                  onClick={() => setActiveDeckTab('picked')}
                  aria-pressed={activeDeckTab === 'picked'}
                  className={`motion-pop cursor-pointer rounded-full px-3 py-1 text-xs font-medium ${
                    activeDeckTab === 'picked'
                      ? 'bg-base-300 text-base-content'
                      : 'text-base-content/60 hover:text-base-content hover:bg-base-content/10'
                  }`}
                >
                  本场题单 ({picked.length})
                </button>
                <button
                  onClick={() => setActiveDeckTab('bank')}
                  aria-pressed={activeDeckTab === 'bank'}
                  className={`motion-pop cursor-pointer rounded-full px-3 py-1 text-xs font-medium ${
                    activeDeckTab === 'bank'
                      ? 'bg-base-300 text-base-content'
                      : 'text-base-content/60 hover:text-base-content hover:bg-base-content/10'
                  }`}
                >
                  题库补充
                </button>
              </div>

              <button
                onClick={() => setAdding(!adding)}
                aria-expanded={adding}
                className="motion-pop cursor-pointer rounded-full px-2 py-1 text-xs font-medium text-base-content hover:bg-base-content/10 hover:underline"
              >
                {adding ? '取消' : '+ 自拟题目'}
              </button>
            </div>

            {/* 新增题目抽屉 */}
            {adding && (
              <div className="mt-4 border-t border-base-300 pt-4 space-y-4">
                <div className="text-xs font-semibold text-base-content">自拟考察试题</div>
                <textarea
                  autoFocus
                  value={draft.q}
                  onChange={(e) => setDraft({ ...draft, q: e.target.value })}
                  rows={2}
                  placeholder="输入要向候选人考察的问题…"
                  className={field}
                />
                <div className="flex flex-wrap gap-2.5">
                  {TOPICS.map((t) => (
                    <button
                      key={t}
                      onClick={() => setDraft({ ...draft, topic: t })}
                      aria-pressed={draft.topic === t}
                      className={`motion-pop cursor-pointer rounded-full px-2.5 py-0.5 text-xs ${
                        draft.topic === t
                          ? 'bg-accent text-accent-content font-medium'
                          : 'bg-base-200 text-base-content/60 hover:text-base-content hover:bg-base-content/10'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <div className="grid gap-3">
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
                <div className="flex flex-wrap items-center justify-end gap-3">
                  {!draft.q.trim() && <span className="text-[11px] text-error">请先填写题干</span>}
                  <Btn onClick={submit} disabled={!draft.q.trim()}>加入本场出题</Btn>
                </div>
              </div>
            )}
          </div>

          {/* 选项卡一：本场已选出题单 */}
          {activeDeckTab === 'picked' ? (
            <div className="space-y-4 stagger">
              <div className="text-xs font-medium text-base-content/60 px-1">
                依据《{jd.title}》定制的 {c.qs.length} 道针对性题目（已选 {picked.length} 道入场）
              </div>

              {c.qs.length === 0 ? (
                <Empty title="本场还没有题目" hint="从下方「题库补充」装载标准题，或点上方「+ 自拟题目」新增一道。" />
              ) : (
                c.qs.map((q, i) => {
                  const on = picked.includes(q.id)
                  return (
                  <div
                    key={q.id}
                    onMouseEnter={() => setHover(q.id)}
                    onMouseLeave={() => setHover(undefined)}
                    style={{ '--i': Math.min(i, 7) } as CSSProperties}
                    className={`motion-pop group ws-paper rounded-2xl p-4 border ${
                      on
                        ? 'border-base-content/30 hover:border-base-content/50'
                        : 'border-base-300 opacity-60 bg-base-200/60'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggle(q.id)}
                        aria-label={`选入本场题单：${q.q}`}
                        className="mt-1 h-4 w-4 shrink-0 rounded cursor-pointer accent-accent"
                      />
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-medium leading-relaxed ${on ? 'text-base-content' : 'text-base-content/60'}`}>
                          <span className="mr-1.5 tabular-nums text-base-content/60">{i + 1}.</span>
                          {q.q}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2.5 text-[10px]">
                          <span className="rounded-full bg-base-content/5 px-2 py-0.5 font-medium text-base-content">
                            {q.topic}
                          </span>
                          <span className="text-base-content/60">{q.basis}</span>
                        </div>

                        {q.points && q.points.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-base-300 text-[11px] text-base-content/60">
                            <span className="font-medium text-base-content">考察要点：</span>
                            {q.points.join('；')}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  )
                })
              )}
            </div>
          ) : (
            /* 选项卡二：团队题库补充 */
            <div className="space-y-3.5 stagger">
              <div className="text-xs font-medium text-base-content/60 px-1">
                标准能力题库储备（点击直接装载进本候选人题本）
              </div>
              {bankLeft.length ? (
                bankLeft.map((b, i) => (
                  <div
                    key={b.q}
                    style={{ '--i': Math.min(i, 7) } as CSSProperties}
                    className="motion-pop ws-paper rounded-2xl p-3.5 border border-base-300 hover:border-base-content/30 flex items-start justify-between gap-4"
                  >
                    <div className="text-xs text-base-content leading-relaxed">
                      <div className="font-medium">{b.q}</div>
                      <div className="mt-1 flex items-center gap-3 text-[10px] text-base-content/60">
                        <span className="rounded bg-base-content/5 px-1.5 py-0.5">{b.cat}</span>
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
                      aria-label={`装载题库题目：${b.q}`}
                      className="motion-pop cursor-pointer shrink-0 rounded-full bg-base-content/5 px-2.5 py-1 text-xs font-semibold text-base-content hover:bg-base-content/10 border border-base-300"
                    >
                      + 装载
                    </button>
                  </div>
                ))
              ) : (
                <Empty title="题库里没有可装载的新题" hint="本场题目已覆盖现有题库，可用上方「+ 自拟题目」补充题目。" />
              )}
            </div>
          )}
        </aside>
      </div>

      {/* 调整对标岗位与用人标尺弹窗 */}
      <Modal
        open={showSwitchPos}
        onClose={() => setShowSwitchPos(false)}
        title="重新选择对标在招岗位"
        sub="切换后将即时继承新岗位的考核标尺与评价维度"
        footer={
          <>
            {pendingPos && pendingPos !== c.positionId && (
              <span className="mr-auto text-xs text-base-content/60">调岗会即时替换考核标尺与评价维度，请在下一步确认</span>
            )}
            <Btn variant="ghost" onClick={() => { setPendingPos(undefined); setShowSwitchPos(false) }}>
              取消
            </Btn>
            <Btn
              variant="accent"
              disabled={!pendingPos || pendingPos === c.positionId}
              onClick={() => {
                if (!pendingPos) return
                bindCandidatePosition(c.id, pendingPos)
                setPendingPos(undefined)
                setShowSwitchPos(false)
              }}
            >
              确认调岗
            </Btn>
          </>
        }
      >
        <div className="space-y-3.5 stagger">
          {positions.length === 0 && <Empty title="还没有在招岗位" hint="先到岗位管理创建岗位并装配标尺，再回来对标。" />}
          {positions.map((p, i) => {
            const targetJd = findJd(p.jdId)
            const isCur = c.positionId === p.id
            const on = pendingPos === p.id
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={on}
                onClick={() => setPendingPos(p.id)}
                style={{ '--i': Math.min(i, 7) } as CSSProperties}
                className={`motion-pop w-full cursor-pointer rounded-xl border p-3.5 text-left ${
                  on
                    ? 'border-accent bg-base-content/10'
                    : isCur
                      ? 'border-base-content/30 bg-base-content/5 hover:border-base-content/50'
                      : 'border-base-300 bg-base-100 hover:border-base-content/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-base-content text-xs">{p.name}</span>
                  {isCur && (
                    <span className="rounded-full bg-base-content px-2 py-0.5 text-[10px] text-base-100">当前岗位</span>
                  )}
                  {!isCur && on && (
                    <span className="rounded-full bg-base-content/10 px-2 py-0.5 text-[10px] text-base-content">待确认切换</span>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-base-content/60">
                  <span>{p.dept}</span>
                  <span>·</span>
                  <span className="text-base-content font-medium">
                    装配标尺: {targetJd ? `${targetJd.title} (${targetJd.code})` : '该岗位尚未装配标尺'}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </Modal>
    </div>
  )
}
