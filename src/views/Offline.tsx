import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { resumes } from '../data'
import { can, commit, confirmReview, currentUser, elapsedOf, findC, liveChannel, pickedOf, rooms, save, submitEvaluation, type Rec, type Review, type Room, type Talk } from '../store'
import { canTranscribe, clock, readFile, uid, useVoice } from '../voice'
import { Composer, Speaker, TalkList, VoiceBars } from './live'
import type { Go } from '../App'
import { Btn, Chip, Empty, Modal } from './ui'
import ResumeDoc from './ResumeDoc'

const LEVELS = ['不达标', '偏弱', '符合预期', '良好', '超出预期']
const TAGS = ['有具体数据', '思路清晰', '有深度', '回答含糊', '与简历不符']
const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

const empty: Rec = { hit: [], asked: [], tags: [], note: '', secs: 0 }
const now = () => new Date().toLocaleTimeString('zh-CN', { hour12: false })
const newRoom = (): Room => ({ recs: {}, sec: 0, verdict: '', summary: '' })

/** 候选人画面：演示环境以头像 + 说话动效代替，正式版走 WebRTC 视频 */
function PeerView({ name, peer, talking, big = false }: { name: string; peer: boolean; talking: boolean; big?: boolean }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-black text-white">
      <Speaker name={name} speaking={talking} size={big ? 'h-32 w-32 text-4xl' : 'h-14 w-14 text-xl'} tone={peer ? 'bg-warning text-warning-content' : 'bg-white/15 text-white'} />
      <div className={`text-white/70 ${big ? 'text-base' : 'text-xs'}`}>{peer ? `候选人 ${name}${talking ? ' · 正在说话' : ''}` : '等待候选人进入'}</div>
    </div>
  )
}

/** 面试官自己的摄像头画面：手动开启后，全屏与小窗都能看到自己；不可用时退回头像占位 */
function SelfView({ stream, label }: { stream: MediaStream | null; label: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => { if (ref.current) ref.current.srcObject = stream }, [stream])
  if (!stream) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-black text-white">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-white/15 text-lg font-semibold">王</span>
        <span className="px-2 text-center text-xs text-white/50">{label} · 摄像头不可用</span>
      </div>
    )
  }
  return (
    <div className="relative h-full w-full bg-black">
      <video ref={ref} autoPlay muted playsInline className="h-full w-full -scale-x-100 object-cover" />
      <span className="absolute bottom-1.5 left-1.5 rounded bg-black/50 px-1.5 py-0.5 text-[11px] text-white/85">{label}</span>
    </div>
  )
}

export default function Offline({ cid, go }: { cid: string; go: Go }) {
  const c = findC(cid)
  const picked = pickedOf(cid)
  const saved = rooms[cid]
  // 已提交评价（待录取 / 已完成 / 搁置）的面试间是只读记录：结果不可再修改
  const locked = !!c && (c.status === '待录取' || c.status === '已完成' || c.status === '搁置')
  const lines = (c ? (resumes[c.id]?.sections ?? []) : []).flatMap((s) => s.lines).filter((l) => l.mark)
  const count = { all: lines.length, hi: lines.filter((l) => l.mark === 'hi').length, risk: lines.filter((l) => l.mark === 'risk').length }
  // 屏幕可能朝向候选人：遮挡分析结论、参考答案与减分信号
  const [cover, setCover] = useState(false)
  const qs = (c?.qs ?? []).filter((q) => !picked.length || picked.includes(q.id))
  const [idx, setIdx] = useState(0)
  const [filter, setFilter] = useState<'all' | 'hi' | 'risk'>('all')
  const [wide, setWide] = useState(false)
  const [done, setDone] = useState(locked)
  const [showAns, setShowAns] = useState(false)
  const [recs, setRecs] = useState<Record<string, Rec>>(saved?.recs ?? {})
  const [verdict, setVerdict] = useState(saved?.verdict ?? '')
  const [summary, setSummary] = useState(saved?.summary ?? '')
  const [savedAt, setSavedAt] = useState(saved?.savedAt)
  const [obs, setObs] = useState(saved?.obs ?? '')
  const [review, setReview] = useState<Review | undefined>(saved?.review)
  const [reviewing, setReviewing] = useState(false)
  // FR-B3：AI 只能产出草稿，必须人工确认；确认中防重复点击，失败要给可读原因
  const [reviewAsk, setReviewAsk] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [reviewErr, setReviewErr] = useState('')
  // 破坏性动作的二次确认与提交防抖
  const [endAsk, setEndAsk] = useState(false)
  const [submitAsk, setSubmitAsk] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [summaryAsk, setSummaryAsk] = useState(false) // 重新生成综合评语会覆盖手写内容
  const [regenAsk, setRegenAsk] = useState(false) // 重新生成评价报告会覆盖（含已确认结论）
  // 分享面试间：候选人通过链接进入后，双方语音自动转写进会话记录；未分享时只记录面试官一侧
  const [shared, setShared] = useState(saved?.shared ?? false)
  const [talk, setTalk] = useState<Talk[]>(saved?.talk ?? [])
  const [peer, setPeer] = useState(false)
  const [peerTalking, setPeerTalking] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  // 进入面试间的二次确认：确认后才计时、上报在线、按勾选开麦。
  // 已进入过（含后台进行中回来）直接进入，不再询问
  const [entered, setEntered] = useState(locked || !!saved?.entered)
  const [micOn, setMicOn] = useState(saved?.micOn ?? true)
  const [micDraft, setMicDraft] = useState(true)
  const [camOn, setCamOn] = useState(saved?.camOn ?? false)
  const [camDraft, setCamDraft] = useState(false)
  // 候选人画面：小窗（瞄一眼）/ 全屏（面对面，隐藏简历与题目）/ 收起（只看简历）
  const [mode, setMode] = useState<'win' | 'full' | 'min'>(saved?.winMode ?? 'min')
  const [winView, setWinView] = useState<'peer' | 'self'>('peer') // 小窗看候选人还是看自己
  const [fullView, setFullView] = useState<'peer' | 'self'>('peer') // 全屏主画面
  const [camStream, setCamStream] = useState<MediaStream | null>(null)
  const camRef = useRef<MediaStream | null>(null)
  const [coach, setCoach] = useState(false)
  const [warn, setWarn] = useState('')
  const [miss, setMiss] = useState<'' | 'verdict' | 'questions'>('')
  const [paused, setPaused] = useState(saved?.paused ?? false)
  const [leaveAsk, setLeaveAsk] = useState(false) // 未结束返回工作台的确认弹窗
  const [, forceTick] = useState(0)
  const right = useRef<HTMLDivElement>(null)
  const verdictRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLOListElement>(null)
  const q = qs[idx]
  // 已进行时长：累计秒数 + 当前运行段（时间戳模型，离开面试间后台继续走）
  const elapsed = elapsedOf(rooms[cid])
  const pausedRef = useRef(paused)
  pausedRef.current = paused
  const qRef = useRef(q?.id)
  qRef.current = q?.id
  // 秒级心跳：刷新计时显示；运行中累加本题用时
  useEffect(() => {
    if (!entered || done || locked) return
    const t = setInterval(() => {
      forceTick((x) => x + 1)
      if (!pausedRef.current && qRef.current) setRecs((m) => ({ ...m, [qRef.current!]: { ...empty, ...m[qRef.current!], secs: (m[qRef.current!]?.secs ?? 0) + 1 } }))
    }, 1000)
    return () => clearInterval(t)
  }, [entered, done, locked])
  // 每次变更写入本地，刷新不丢；计时先结算进 sec 再重开运行段，避免重复累计
  useEffect(() => {
    const rm = rooms[cid]
    const running = rm?.since != null
    rooms[cid] = { ...rm, recs, verdict, summary, savedAt, obs, review, sec: elapsedOf(rm), since: running ? Date.now() : null }
    save()
  }, [cid, recs, verdict, summary, savedAt, obs, review])
  // 进入状态 / 麦克风 / 摄像头 / 画面模式持久化：后台回来后原样恢复
  useEffect(() => {
    const rm = rooms[cid]
    if (!rm) return
    rm.entered = entered; rm.micOn = micOn; rm.camOn = camOn; rm.winMode = mode; rm.paused = paused
    save()
  }, [cid, entered, micOn, camOn, mode, paused])
  const ch = useRef<ReturnType<typeof liveChannel>>(null)
  const addTalk = (item: Talk, broadcast = true) => {
    setTalk((l) => (l.some((x) => x.id === item.id) ? l : [...l, item]))
    if (broadcast && shared) ch.current?.send({ type: 'talk', item })
  }
  const voice = useVoice((text) => addTalk({ id: uid(), who: '面试官', kind: 'voice', text, t: clock() }))
  const voiceRef = useRef(voice)
  voiceRef.current = voice
  // 语音记录：进入后按麦克风状态转写面试官语音；关闭麦克风后记录不停，只录候选人
  useEffect(() => { if (entered && micOn && !locked && !done && !paused) voice.start(); else voice.stop() }, [entered, micOn, locked, done, paused])
  // 离开面试间（含挂后台）立即停麦，回到面试间时上面的效应会按状态重新开启
  useEffect(() => () => voiceRef.current.stop(), [])
  // 面试官摄像头：手动开启后取流，关闭或离开时立即释放
  useEffect(() => {
    let dead = false
    if (camOn && entered && !locked) {
      navigator.mediaDevices?.getUserMedia({ video: true }).then((s) => {
        if (dead) { s.getTracks().forEach((t) => t.stop()); return }
        camRef.current = s
        setCamStream(s)
      }).catch(() => setCamStream(null))
    } else {
      camRef.current?.getTracks().forEach((t) => t.stop())
      camRef.current = null
      setCamStream(null)
    }
    return () => { dead = true }
  }, [camOn, entered, locked])
  useEffect(() => () => { camRef.current?.getTracks().forEach((t) => t.stop()) }, [])
  const sharedRef = useRef(shared)
  sharedRef.current = shared
  useEffect(() => {
    const cn = liveChannel(cid, (m) => {
      if (!sharedRef.current) return
      if (m.type === 'join') setPeer(true)
      else if (m.type === 'leave') { setPeer(false); setPeerTalking(false) }
      else if (m.type === 'level') setPeerTalking(m.on)
      else if (m.type === 'talk') addTalk(m.item, false)
    })
    ch.current = cn
    return () => cn.close()
  }, [cid])
  // 面试官确认进入后上报在线：候选人侧从「等待面试官」变为「面试进行中」
  useEffect(() => { if (entered) ch.current?.send({ type: 'hello' }) }, [entered])
  useEffect(() => { if (entered) ch.current?.send({ type: 'state', name: c?.name ?? '', role: c?.role ?? '', round: c?.round ?? '', idx, total: qs.length, q: q?.q ?? '', ended: done, sec: elapsed }) }, [entered, shared, peer, idx, done, elapsed])
  useEffect(() => { if (entered) ch.current?.send({ type: 'level', who: '面试官', on: micOn && voice.speaking }) }, [entered, micOn, voice.speaking])
  useEffect(() => { rooms[cid] = { ...rooms[cid], talk, shared }; save() }, [talk, shared])
  const link = `${location.origin}${location.pathname}?join=${cid}`
  const share = () => { setShared(true); ch.current?.send({ type: 'hello' }) }
  const copy = () => { share(); navigator.clipboard?.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600) }).catch(() => {}) }
  const files = async (fs: File[]) => { for (const f of fs) addTalk({ id: uid(), who: '面试官', kind: 'file', text: f.name, t: clock(), file: await readFile(f) }) }
  // 首次进入的轻引导：指向候选人画面的三态开关，延迟出现、点任意处消失
  useEffect(() => {
    if (!entered || locked || localStorage.getItem('facetry-room-coach')) return
    const t = setTimeout(() => setCoach(true), 800)
    return () => clearTimeout(t)
  }, [entered, locked])
  useEffect(() => {
    if (!coach) return
    const dismiss = () => { setCoach(false); localStorage.setItem('facetry-room-coach', '1') }
    const t = setTimeout(dismiss, 9000)
    window.addEventListener('pointerdown', dismiss)
    return () => { clearTimeout(t); window.removeEventListener('pointerdown', dismiss) }
  }, [coach])
  const touch = () => setSavedAt(now())

  const rec = (q && recs[q.id]) || empty
  const set = (patch: Partial<Rec>) => { if (locked) return; if (patch.score) setMiss(''); setRecs((m) => ({ ...m, [q.id]: { ...empty, ...m[q.id], ...patch } })); touch() }
  const flip = (k: 'hit' | 'asked' | 'tags', v: string) => set({ [k]: rec[k].includes(v) ? rec[k].filter((x) => x !== v) : [...rec[k], v] })
  const scored = qs.filter((x) => recs[x.id]?.score).length
  const avg = scored ? qs.reduce((a, x) => a + (recs[x.id]?.score ?? 0), 0) / scored : 0
  const move = (i: number) => {
    if (locked) return
    // 从评价页退回题目：若仍在面试中（未暂停未提交），计时重新开段
    const rm = rooms[cid]
    if (done && rm && !paused && !rm.verdict && rm.since == null) rm.since = Date.now()
    setIdx(i); setShowAns(false); setDone(false); right.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const unscored = qs.length - scored
  const gen = () => {
    const by = (f: (n: number) => boolean) => qs.filter((x) => recs[x.id]?.score && f(recs[x.id].score!)).map((x) => x.topic)
    const good = by((n) => n >= 4), weak = by((n) => n <= 2)
    const tagCount: Record<string, number> = {}
    qs.forEach((x) => recs[x.id]?.tags.forEach((t) => (tagCount[t] = (tagCount[t] ?? 0) + 1)))
    const tags = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t)
    const hit = qs.reduce((a, x) => a + (recs[x.id]?.hit.length ?? 0), 0), total = qs.reduce((a, x) => a + x.points.length, 0)
    return [
      `本场共 ${qs.length} 题，已评 ${scored} 题，平均 ${avg.toFixed(1)} 分，考察要点命中 ${hit}/${total}。`,
      good.length ? `表现较好：${[...new Set(good)].join('、')}。` : '',
      weak.length ? `需要关注：${[...new Set(weak)].join('、')}。` : '',
      tags.length ? `面试印象：${tags.join('、')}。` : '',
      c?.risks.length ? `简历待核实项：${c.risks[0]}${recs[qs.find((x) => x.topic === '简历核实')?.id ?? '']?.note ? '（已追问，见记录）' : '（建议下一轮继续确认）'}。` : '',
    ].filter(Boolean).join('\n')
  }
  // 综合评价：只看已评分题目；被排除或未评分的题不计入，也不当作低分
  const buildReview = (): Review => {
    const rated = qs.filter((x) => recs[x.id]?.score)
    const good = rated.filter((x) => recs[x.id].score! >= 4), weak = rated.filter((x) => recs[x.id].score! <= 2)
    const cite = (x: (typeof qs)[number]) => `「${x.topic}」${recs[x.id].score} 分${recs[x.id].note ? `，记录：${recs[x.id].note.slice(0, 40)}` : ''}`
    const miss = qs.filter((x) => !recs[x.id]?.score)
    return {
      overall: rated.length
        ? `本场覆盖 ${rated.length}/${qs.length} 题，均分 ${avg.toFixed(1)}。${good.length ? `在${good.map((x) => x.topic).join('、')}上有实际证据支撑；` : ''}${weak.length ? `${weak.map((x) => x.topic).join('、')}表现偏弱。` : '未出现明显短板。'}${obs ? `面试官观察：${obs.slice(0, 60)}` : ''}`
        : '尚无评分记录，无法形成有依据的评价。',
      strengths: good.map(cite),
      weaknesses: [...weak.map(cite), ...(miss.length ? [`${miss.map((x) => x.topic).join('、')} 未评分，相关能力未验证`] : [])],
      nextSteps: [...weak, ...miss].flatMap((x) => (x.follow ?? []).filter((f) => !recs[x.id]?.asked.includes(f)).slice(0, 1)).slice(0, 3),
      suggestion: rated.length < qs.length / 2 ? '覆盖率不足一半，证据不充分，建议安排下一轮再做结论。' : weak.length ? '证据基本充分，建议结合偏弱项在下一轮定向验证后再做结论。' : '证据较充分，可结合团队需求复核后做结论。',
      evidence: [...good, ...weak].map((x) => x.id),
      at: now(),
      draft: true, // AI 辅助草稿，须经面试官 / HR 人工确认后作为面评结论（FR-B3）
    }
  }
  // 报告由已保存的评分与记录推导，提交前后都可以生成 / 重新生成
  const genReview = () => { setReviewing(true); setTimeout(() => { setReview(buildReview()); setReviewing(false); touch() }, 1200) }
  // 重新生成会覆盖现有报告（已确认的会回到待确认）：先二次确认
  const askGenReview = () => { if (review) setRegenAsk(true); else genReview() }
  // 导出 Markdown 完整记录：评分、备注、参考要点、排除状态与综合评价
  const exportMd = () => {
    const excluded = (c?.qs ?? []).filter((x) => !qs.includes(x))
    const reviewTitle = review
      ? `## 综合评价（${review.draft ? 'AI 草稿 · 待人工确认，未作为面评结论' : `已人工确认：${review.confirmedBy ?? '—'} ${review.confirmedAt ?? '—'}`}）`
      : ''
    const md = [
      `# 面试记录 · ${c?.name}`, '', `- 岗位：${c?.role}`, `- 轮次：${c?.round} · ${c?.slot}`, `- 用时：${mmss(elapsed)} · 已评 ${scored}/${qs.length} · 均分 ${scored ? avg.toFixed(1) : '–'}`, `- 结论：${verdict || '未选择'}`, '',
      '## 题目记录', '',
      ...qs.flatMap((x, i) => { const r = recs[x.id] ?? empty; return [`### ${i + 1}. ${x.q}`, '', `- 类型：${x.topic} · 依据：${x.basis}`, `- 评分：${r.score ?? '未评分'} · 用时 ${mmss(r.secs)}`, `- 命中要点：${r.hit.length ? r.hit.join('；') : '无'}`, `- 参考要点：${x.points.join('；') || '无'}`, r.tags.length ? `- 标签：${r.tags.join('、')}` : '', r.note ? `- 备注：${r.note}` : '', ''].filter((l, j, a) => l !== '' || j === a.length - 1) }),
      ...(excluded.length ? ['## 已排除题目', '', ...excluded.map((x) => `- ${x.q}`), ''] : []),
      '## 面试官整体观察', '', obs || '（无）', '',
      '## 综合评语', '', summary || '（无）', '',
      ...(talk.length ? ['## 会话记录（补充材料）', '', ...talk.map((m) => `- [${m.t}] ${m.who}${m.kind === 'voice' ? '（语音）' : ''}：${m.kind === 'file' ? `[文件] ${m.file?.name}` : m.text}`), ''] : []),
      ...(review ? [reviewTitle, '', review.overall, '', '**优势**', ...review.strengths.map((t) => `- ${t}`), '', '**待验证或不足**', ...review.weaknesses.map((t) => `- ${t}`), '', '**下一轮建议**', ...review.nextSteps.map((t) => `- ${t}`), '', `**复核建议**：${review.suggestion}`, ''] : []),
    ].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([md], { type: 'text/markdown' }))
    a.download = `${c?.name ?? cid}-面试记录.md`
    a.click()
    URL.revokeObjectURL(a.href)
  }
  // 结束面试进入评价：结算计时停表（此后离开不再出现后台悬浮入口）
  const toEval = () => {
    const rm = rooms[cid]
    if (rm) { rm.sec = elapsedOf(rm); rm.since = null }
    setDone(true)
    if (!summary) setSummary(gen())
  }
  // 收尾是有后果的动作：未结束时先二次确认再停表（已在评价页则直接切回）
  const askEnd = () => { if (done || locked) { toEval(); return } setMiss(''); setEndAsk(true) }
  // 提交评价：二次确认后置 loading 并禁用按钮，防止重复提交
  const doSubmit = () => {
    if (submitting) return
    setMiss('')
    setSubmitting(true)
    setTimeout(() => { submitEvaluation(cid, avg, mmss(elapsed), verdict); go('result', cid, { replace: true }) }, 500)
  }
  const submit = () => {
    if (submitting) return
    if (!verdict) {
      setWarn('请先选择综合结论')
      setMiss('verdict')
      verdictRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    setWarn('')
    // 未评分的题在列表里高亮，便于确认窗口打开时对照
    setMiss(unscored ? 'questions' : '')
    setSubmitAsk(true)
  }
  // 人工确认 AI 综合评价草稿（FR-B3）：确认后才作为面评结论，并记录确认人与确认时间
  const doConfirmReview = () => {
    if (confirming) return
    setConfirming(true)
    setReviewErr('')
    const r = confirmReview(cid, currentUser.name)
    setConfirming(false)
    setReviewAsk(false)
    if (!r) { setReviewErr('确认失败：本场评价记录已失效，请返回面试间重新生成综合评价后再确认。'); return }
    setReview({ ...r })
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (done || el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || el.tagName === 'SELECT') return
      if (/^[1-5]$/.test(e.key)) set({ score: Number(e.key) })
      else if (e.key === 'ArrowRight' && idx < qs.length - 1) move(idx + 1)
      else if (e.key === 'ArrowLeft' && idx > 0) move(idx - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  // 找不到候选人时给出空态（findC 找不到返回 undefined），避免把面试间静默绑到其他候选人
  if (!c) {
    return (
      <div className="grid h-full min-h-[320px] place-items-center bg-base-200 text-sm text-base-content/70">
        未找到候选人 {cid} 的记录，可能已被来源库标记失效。
      </div>
    )
  }

  const pick = (qid: string) => { const i = qs.findIndex((x) => x.id === qid); if (i >= 0) move(i) }
  // 面评确认权限（FR-B3）：HR / 面试官可确认 AI 草稿，其他角色只能查看
  const canConfirmReview = can('evaluation:submit')
  const enterRoom = () => {
    setMicOn(micDraft); setCamOn(camDraft); setEntered(true)
    const rm = (rooms[cid] ??= newRoom())
    rm.entered = true; rm.micOn = micDraft; rm.camOn = camDraft
    // 进入即恢复运行：清掉可能残留的暂停态并确保计时开段——否则离开后既不弹返回确认、工作台也不出悬浮入口
    if (rm.paused) { rm.paused = false; setPaused(false) }
    if (rm.since == null) rm.since = Date.now()
    commit()
  }
  // 暂停 / 继续：暂停即结算停表，此时离开不会有后台悬浮入口；继续则重新开段
  const togglePause = () => {
    const rm = (rooms[cid] ??= newRoom())
    if (paused) { rm.since = Date.now(); rm.paused = false; setPaused(false) } else { rm.sec = elapsedOf(rm); rm.since = null; rm.paused = true; setPaused(true) }
    commit()
  }
  // 未结束、未暂停的面试不允许直接返回：确认后挂后台（计时继续 + 工作台悬浮入口）
  const tryLeave = () => { if (locked || !entered || done || paused) go('back'); else setLeaveAsk(true) }

  const micLabel = !micOn ? '仅记录候选人' : voice.status === 'on' ? (voice.speaking ? '正在记录' : '语音记录中') : voice.status === 'denied' ? '麦克风未授权' : voice.status === 'asking' ? '请求麦克风…' : '语音已关闭'
  // 流式转写：识别中的半截话实时显示为虚线气泡
  const live_ = entered && !locked && !done && !paused
  const interim = live_ && micOn && voice.interim ? { who: '面试官' as const, text: voice.interim } : null
  const lastItem = talk[talk.length - 1]
  const lastBubble = interim ?? (lastItem ? { who: lastItem.who, text: lastItem.kind === 'file' ? `[文件] ${lastItem.file?.name ?? lastItem.text}` : lastItem.text } : null)
  // 对话面板：小窗 / 收起 / 全屏都常驻，不等候选人进入
  const talkPanel = (dark = false) => (
    <>
      <div className={`flex h-12 shrink-0 items-center gap-3.5 border-b px-4 ${dark ? 'border-white/10' : 'border-base-300'}`}>
        <Speaker name="王" speaking={micOn && voice.speaking} size="h-7 w-7 text-xs" tone={dark ? 'bg-warning text-warning-content' : 'bg-base-content text-base-100'} />
        <Speaker name={c.name} speaking={peerTalking} size="h-7 w-7 text-xs" tone={peer ? 'bg-warning text-warning-content' : dark ? 'bg-white/15 text-white' : 'bg-base-300 text-base-content/60'} />
        <span className={`min-w-0 flex-1 truncate text-xs ${dark ? 'text-white/50' : 'text-base-content/60'}`}>{paused ? '已暂停 · 记录挂起' : done ? '面试已结束' : !micOn ? '仅记录候选人' : shared ? (peer ? '双方发言自动转写' : '等待候选人进入') : '记录面试官语音'}</span>
        {voice.status === 'on' && micOn && <VoiceBars level={voice.level} on className="bg-accent" />}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <TalkList items={talk} me="面试官" interim={interim} dark={dark} empty={canTranscribe ? '开口说话即可自动记录，转写会实时出现在这里' : '当前浏览器不支持语音转写，可用文字补充记录'} />
      </div>
      <div className={`shrink-0 p-3 ${dark ? '' : 'border-t border-base-300'}`}>
        {!locked && <Composer onText={(text) => addTalk({ id: uid(), who: '面试官', kind: 'text', text, t: clock() })} onFiles={files} dark={dark} placeholder={shared ? '发送给候选人…' : '补充记录，例如候选人的回答…'} />}
      </div>
    </>
  )

  return (
    <div className="ws-canvas flex h-screen flex-col">
      {/* 沉浸式专业考场顶栏 (High-Density Dark Pro HUD) */}
      <header className="flex h-16 shrink-0 items-center justify-between gap-5 px-6 bg-base-100 text-base-content border-b border-base-content/10 shadow-lg z-30">
        {/* 左侧：返回与候选人/岗位基本盘 */}
        <div className="flex items-center gap-5 min-w-[280px]">
          <button
            onClick={tryLeave}
            className="cursor-pointer motion-pop text-xs font-medium text-base-content/70 hover:text-base-content px-2 py-1 rounded-lg hover:bg-base-content/10 transition-colors"
          >
            ← 挂起返回
          </button>
          <span className="h-5 w-px bg-base-content/15" />
          <div className="flex items-center gap-4">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-warning text-sm font-bold text-warning-content">
              {c.name[0]}
            </span>
            <div className="leading-tight">
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-base-content">{c.name}</span>
                <span className="rounded bg-base-content/10 px-1.5 py-0.5 text-[10px] font-medium text-base-content/90">
                  {c.round}
                </span>
                <span className="rounded bg-success/20 px-1.5 py-0.5 text-[10px] text-success">
                  {c.status}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-3 text-xs text-base-content/60">
                <span>{c.role}</span>
                <span>·</span>
                <span className="text-base-content/50">标尺: {c.jdId}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 中间：实时考场出题进度与打分 HUD */}
        <div className="hidden lg:flex items-center gap-7 rounded-xl bg-base-content/5 border border-base-content/10 px-4 py-2 text-xs">
          <div className="flex items-center gap-3.5">
            <span className="text-base-content/60">试题进度:</span>
            <div className="flex items-center gap-2.5">
              <button
                disabled={idx <= 0}
                onClick={() => move(idx - 1)}
                aria-label="上一题"
                className="cursor-pointer motion-pop text-base-content/60 hover:text-base-content disabled:opacity-30 disabled:cursor-default"
              >
                ‹
              </button>
              <span className="font-bold text-base-content tabular-nums">
                {idx + 1} / {qs.length}
              </span>
              <button
                disabled={idx >= qs.length - 1}
                onClick={() => move(idx + 1)}
                aria-label="下一题"
                className="cursor-pointer motion-pop text-base-content/60 hover:text-base-content disabled:opacity-30 disabled:cursor-default"
              >
                ›
              </button>
            </div>
            <div className="h-1.5 w-20 rounded-full bg-base-content/10 overflow-hidden ml-1">
              <div
                className="motion-meter h-full rounded-full bg-accent"
                style={{ width: `${((idx + 1) / qs.length) * 100}%` }}
              />
            </div>
          </div>

          <span className="h-3.5 w-px bg-base-content/15" />

          <div className="flex items-center gap-3">
            <span className="text-base-content/60">已评/均分:</span>
            <span className="font-bold text-success tabular-nums">
              {scored}/{qs.length} 题
            </span>
            {scored > 0 && (
              <span className="rounded bg-success/20 px-1.5 py-0.2 text-[10px] text-success">
                {avg.toFixed(1)}分
              </span>
            )}
          </div>

          <span className="h-3.5 w-px bg-base-content/15" />

          <div className="flex items-center gap-2.5 text-base-content/70">
            <span>当前考核:</span>
            <span className="rounded bg-base-content/10 px-2 py-0.5 text-base-content font-medium">
              {q?.topic || '综合'}
            </span>
          </div>
        </div>

        {/* 右侧：计时器、ASR、连线与主行动按钮 */}
        <div className="flex items-center gap-4">
          {/* 计时器 */}
          <button
            onClick={togglePause}
            disabled={locked || done || !entered}
            title={paused ? '继续计时' : '暂停计时'}
            aria-label={paused ? '继续计时' : '暂停计时'}
            className="flex cursor-pointer motion-pop items-center gap-3 rounded-xl bg-base-content/10 border border-base-content/10 px-3 py-1.5 text-xs tabular-nums text-base-content hover:bg-base-content/15 transition-colors disabled:opacity-50"
          >
            <span className={`h-2 w-2 rounded-full ${paused || done || !entered ? 'bg-base-content/20' : 'animate-pulse bg-accent'}`} />
            <span className="font-mono font-semibold">{mmss(elapsed)}</span>
            <span className="text-base-content/50 text-[11px]">{paused ? '继续' : '暂停'}</span>
          </button>

          {/* 实时语音 ASR */}
          <button
            onClick={() => setMicOn(!micOn)}
            disabled={locked || done || !entered}
            className="hidden sm:flex cursor-pointer motion-pop items-center gap-3 rounded-xl bg-base-content/10 border border-base-content/10 px-2.5 py-1.5 text-xs text-base-content/90 hover:bg-base-content/15 transition-colors disabled:opacity-50"
            title="麦克风与实时 ASR 转写"
            aria-label={micLabel}
          >
            <VoiceBars level={micOn ? voice.level : 0} on={micOn && voice.status === 'on'} />
            <span className="hidden xl:inline">{micLabel}</span>
            <span className="xl:hidden">{micOn && voice.status === 'on' ? '录音中' : '录音关'}</span>
          </button>

          {/* 摄像头开关 */}
          <button
            onClick={() => setCamOn(!camOn)}
            aria-label={camOn ? '关闭摄像头' : '开启摄像头'}
            disabled={locked || !entered}
            className="flex cursor-pointer motion-pop items-center gap-2.5 rounded-xl bg-base-content/10 border border-base-content/10 px-2.5 py-1.5 text-xs text-base-content/80 hover:bg-base-content/15 transition-colors disabled:opacity-50"
          >
            <span className={`h-1.5 w-1.5 rounded-full ${camOn ? 'bg-accent' : 'bg-base-content/20'}`} />
            摄像头{camOn ? '开' : '关'}
          </button>

          {/* 候选人连线 / 分享 */}
          <div className="relative">
            <button
              onClick={() => setShareOpen(!shareOpen)}
              className={`flex cursor-pointer motion-pop items-center gap-3 rounded-xl border px-3 py-1.5 text-xs transition-colors ${
                shared
                  ? 'border-success/40 bg-success/15 text-success'
                  : 'border-base-content/15 bg-base-content/10 text-base-content hover:bg-base-content/15'
              }`}
            >
              {shared ? (
                <>
                  <Speaker
                    name={c.name}
                    speaking={peerTalking}
                    size="h-4 w-4 text-[9px]"
                    tone={peer ? 'bg-success text-success-content' : 'bg-base-content/10 text-base-content/50'}
                  />
                  <span>{peer ? '候选人在线' : '等待连线'}</span>
                </>
              ) : (
                '分享考场'
              )}
            </button>

            {shareOpen && (
              <div className="login-fade absolute right-0 top-full z-40 mt-2 w-[340px] rounded-xl border border-base-300 bg-base-100 p-4 text-base-content shadow-[var(--shadow-lift)]">
                <div className="text-sm font-semibold text-base-content">候选人协同链接</div>
                <p className="mt-1 text-xs text-base-content/60">
                  候选人打开此链接后，双方语音自动转写，仅能看到题干与对话，隐藏所有打分。
                </p>
                <div className="mt-3 flex gap-3">
                  <input
                    readOnly
                    value={link}
                    onFocus={(e) => e.target.select()}
                    className="h-8 min-w-0 flex-1 rounded-lg border border-base-300 bg-base-200 px-2.5 text-xs text-base-content/70 outline-none"
                  />
                  <Btn className="!h-8 !px-3" onClick={copy}>
                    {copied ? '已复制' : '复制'}
                  </Btn>
                </div>
                <div className="mt-2.5 flex items-center justify-between text-xs">
                  <button
                    onClick={() => {
                      share()
                      window.open(link, 'facetry-join')
                    }}
                    className="cursor-pointer motion-pop font-medium text-base-content hover:underline"
                  >
                    候选人视角打开 ↗
                  </button>
                  {shared && (
                    <button
                      onClick={() => {
                        setShared(false)
                        setPeer(false)
                      }}
                      className="cursor-pointer motion-pop text-base-content/50 hover:text-base-content/80"
                    >
                      停止分享
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 结束面试主按钮 */}
          {!done && (
            <Btn
              variant="solid"
              className="!h-8 !px-3.5"
              onClick={askEnd}
            >
              结束考场 ↗
            </Btn>
          )}

          {/* 模式切换 (小窗 / 全屏 / 隐藏) */}
          <div className="flex rounded-xl bg-base-content/10 p-0.5 border border-base-content/10">
            {([['win', '小窗'], ['full', '全屏'], ['min', '收起']] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setMode(k)}
                className={`px-2 py-1 cursor-pointer motion-pop rounded-lg text-xs transition-colors ${
                  mode === k ? 'bg-base-content text-base-100 font-semibold' : 'text-base-content/60 hover:text-base-content'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {mode === 'full' ? (
        /* 全屏面对面：候选人画面为主，右侧常驻对话面板；开着摄像头时右下角有自己的画面，可互换主画面 */
        <div className="flex min-h-0 flex-1 bg-base-200">
          <div className="relative min-w-0 flex-1">
            {fullView === 'self' && camOn ? <SelfView stream={camStream} label="我（面试官）" /> : <PeerView name={c.name} peer={peer} talking={peerTalking} big />}
            {camOn && (
              <div className="absolute bottom-24 right-6 h-36 w-56 overflow-hidden rounded-xl shadow-[var(--shadow-lift)] ring-1 ring-white/20">
                {fullView === 'self' ? <PeerView name={c.name} peer={peer} talking={peerTalking} /> : <SelfView stream={camStream} label="我（面试官）" />}
              </div>
            )}
            <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-4">
              <span className="text-sm text-white/50">全屏面对面 · 简历与题目已隐藏</span>
              {camOn && <button onClick={() => setFullView(fullView === 'peer' ? 'self' : 'peer')} className="cursor-pointer motion-pop rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/15">{fullView === 'peer' ? '看我的画面' : '看候选人'}</button>}
              <button onClick={() => setMode('win')} className="cursor-pointer motion-pop rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/15">返回小窗</button>
            </div>
          </div>
          <aside className="flex w-96 shrink-0 flex-col bg-base-content text-base-100">
            {talkPanel(true)}
          </aside>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          {/* 左：可交互简历 */}
          <section className={`flex min-h-0 flex-col border-base-300 transition-[flex-basis] duration-300 lg:border-r ${wide ? 'lg:basis-[52%]' : 'lg:basis-[34%]'} h-1/2 shrink-0 lg:h-auto`}>
            <div className="flex h-12 shrink-0 items-center gap-4 border-b border-base-300 bg-base-100 px-5">
              <span className="text-sm font-semibold text-base-content">简历</span>
              <div className="flex rounded-md bg-base-200 p-0.5 text-[13px]">
                {([['all', '全部标注'], ['hi', '亮点'], ['risk', '疑点']] as const).map(([k, t]) => (
                  <button key={k} onClick={() => setFilter(k)} className={`cursor-pointer motion-pop rounded px-2.5 py-1 transition ${filter === k ? 'border border-base-300 bg-base-100 font-medium text-base-content' : 'text-base-content/60 hover:text-base-content'}`}>
                    {t}<span className="ml-1 tabular-nums text-base-content/50">{count[k]}</span>
                  </button>
                ))}
              </div>
              <button onClick={() => setWide(!wide)} className="ml-auto hidden cursor-pointer motion-pop text-sm text-base-content/60 hover:text-base-content lg:block">{wide ? '还原' : '放大简历'}</button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
              {!cover && <div className="mx-auto max-w-[640px] ws-paper rounded-xl px-5 py-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-semibold text-base-content">自动分析</span>
                  <span className="text-sm text-base-content/60">岗位匹配 <b className="font-semibold tabular-nums text-base-content">{c.match}%</b></span>
                </div>
                <p className="mt-1.5 text-sm leading-6 text-base-content/70">{c.summary}</p>
                <p className="mt-2 text-xs text-base-content/50">点击带标注的段落，右侧跳到对应题目</p>
              </div>}
              <div className="mx-auto mt-4 max-w-[640px] overflow-hidden ws-paper rounded-xl">
                <ResumeDoc c={c} active={done ? undefined : q?.id} onPick={pick} filter={cover ? 'none' : filter} />
              </div>
            </div>
          </section>

          {/* 中：提问与记录 */}
          <section className="flex min-h-0 flex-1 flex-col bg-base-100">
            <nav className="stagger flex shrink-0 gap-2 overflow-x-auto border-b border-base-300 px-4">
              {qs.map((x, i) => {
                const cur = !done && i === idx
                const s = recs[x.id]?.score
                const missing = miss === 'questions' && !s
                return (
                  <button key={x.id} onClick={() => move(i)} style={{ '--i': Math.min(i, 7) } as CSSProperties} className={`relative flex shrink-0 cursor-pointer motion-pop items-center gap-3 px-3 py-3.5 text-sm transition-colors duration-150 after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-accent after:transition-transform after:duration-300 ${cur ? 'text-base-content after:scale-x-100' : 'text-base-content/60 after:scale-x-0 hover:text-base-content'}`}>
                    <span className={`grid h-5 w-5 place-items-center rounded-full text-[11px] tabular-nums ${s ? 'bg-base-content text-base-100' : missing ? 'bg-warning text-warning-content' : cur ? 'bg-accent text-accent-content' : 'bg-base-200 text-base-content/60'}`}>{s ?? i + 1}</span>
                    <span className={cur ? 'font-medium' : ''}>{x.topic}</span>
                  </button>
                )
              })}
              <button onClick={askEnd} className={`relative ml-auto shrink-0 cursor-pointer motion-pop px-3 py-3.5 text-sm ${done ? 'font-medium text-base-content after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-accent' : 'text-base-content/60 hover:text-base-content'}`}>评价</button>
            </nav>

            <div ref={right} className="min-h-0 flex-1 overflow-y-auto">
              {!done ? (
                qs.length === 0 ? (
                  <Empty
                    title="本场还没有题目"
                    hint="回到候选人页勾选本轮要考察的题目，或从题库装载后再进入面试间。"
                    action={<Btn variant="ghost" onClick={() => go('back')}>返回{go.from}</Btn>}
                  />
                ) : (
                <div key={idx} className="ws-rise mx-auto max-w-[760px] px-8 py-8">
                  <div className="flex items-center gap-3 text-sm text-base-content/60">
                    <span className="tabular-nums">第 {idx + 1} / {qs.length} 题</span><span>·</span><span>{q.diff}</span><span>·</span><span className="tabular-nums">本题 {mmss(rec.secs)}</span>
                  </div>
                  <h1 className="mt-3 text-[22px] font-semibold leading-[1.5] text-base-content">{q.q}</h1>
                  <p className="mt-3 inline-flex items-center gap-3 rounded-md bg-base-content/5 px-2.5 py-1 text-sm text-base-content border border-base-content/10 font-medium">出题依据 · {q.basis}</p>

                  <div className="mt-8 grid gap-7 md:grid-cols-2">
                    <div>
                      <div className="flex items-baseline justify-between">
                        <h2 className="text-[15px] font-semibold text-base-content">考察要点</h2>
                        <span className="text-xs tabular-nums text-base-content/50">命中 {rec.hit.length}/{q.points.length}</span>
                      </div>
                      {!q.points.length && <p className="mt-3 rounded-lg border border-dashed border-base-300 px-3 py-2.5 text-sm text-base-content/50">手动添加的题目，未设置考察要点</p>}
                      <ul className="stagger mt-3 space-y-3">
                        {q.points.map((p, i) => {
                          const on = rec.hit.includes(p)
                          return (
                            <li key={p} style={{ '--i': Math.min(i, 7) } as CSSProperties}>
                              <button onClick={() => flip('hit', p)} className={`flex w-full cursor-pointer motion-pop items-start gap-4 rounded-lg border px-3 py-2.5 text-left text-sm leading-6 transition ${on ? 'border-success/50 bg-success/15 text-success' : 'border-base-300 text-base-content/80 hover:border-base-content/25'}`}>
                                <span className={`mt-1 grid h-4 w-4 shrink-0 place-items-center rounded border text-[10px] ${on ? 'border-success bg-success text-success-content' : 'border-base-content/30'}`}>{on ? '✓' : ''}</span>{p}
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                    <div>
                      <h2 className="text-[15px] font-semibold text-base-content">追问</h2>
                      {!q.follow?.length && <p className="mt-3 rounded-lg bg-base-200 px-3 py-2.5 text-sm text-base-content/50">暂无预设追问</p>}
                      <ul className="stagger mt-3 space-y-3">
                        {(q.follow ?? []).map((f, i) => {
                          const on = rec.asked.includes(f)
                          return (
                            <li key={f} style={{ '--i': Math.min(i, 7) } as CSSProperties}>
                              <button onClick={() => flip('asked', f)} className={`flex w-full cursor-pointer motion-pop items-start justify-between gap-4 rounded-lg bg-base-200 px-3 py-2.5 text-left text-sm leading-6 transition hover:bg-base-content/10 ${on ? 'text-base-content/50' : 'text-base-content'}`}>
                                <span>{f}</span><span className="shrink-0 text-xs text-base-content/50">{on ? '已问' : '标记已问'}</span>
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                      {!cover && q.flag && <p className="mt-3 rounded-lg border border-warning/50 bg-warning/10 px-3 py-2.5 text-sm leading-6 text-warning"><b className="font-medium">减分信号</b>　{q.flag}</p>}
                    </div>
                  </div>

                  {!cover && q.answer && <div className="mt-6 rounded-lg border border-base-300">
                    <button onClick={() => setShowAns(!showAns)} className="flex w-full cursor-pointer motion-pop items-center justify-between px-4 py-3 text-sm font-medium text-base-content/80">参考答案<span className="text-base-content/50">{showAns ? '收起' : '展开'}</span></button>
                    {showAns && <p className="border-t border-base-300 px-4 py-3 text-sm leading-7 text-base-content/70">{q.answer}</p>}
                  </div>}

                  <div className="mt-10 border-t border-base-300 pt-8">
                    <div className="flex items-baseline justify-between"><h2 className="text-[15px] font-semibold text-base-content">本题记录</h2><span className="text-xs text-base-content/50">快捷键：1–5 评分 · ← → 切题</span></div>
                    <div className="mt-4 grid grid-cols-5 gap-3">
                      {LEVELS.map((t, i) => {
                        const on = rec.score === i + 1
                        return (
                          <button key={t} onClick={() => set({ score: i + 1 })} className={`cursor-pointer motion-pop rounded-lg border px-2 py-2.5 text-center transition ${on ? 'border-base-content bg-base-content text-base-100' : 'border-base-300 hover:border-base-content/35'}`}>
                            <div className={`text-lg font-semibold tabular-nums ${on ? '' : 'text-base-content'}`}>{i + 1}</div>
                            <div className={`text-xs ${on ? 'text-base-100/80' : 'text-base-content/60'}`}>{t}</div>
                          </button>
                        )
                      })}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-3">
                      {TAGS.map((t) => {
                        const on = rec.tags.includes(t)
                        return <button key={t} onClick={() => flip('tags', t)} className={`cursor-pointer motion-pop rounded-full border px-3 py-1 text-sm transition ${on ? 'border-base-content bg-base-content text-base-100' : 'border-base-300 text-base-content/70 hover:border-base-content/35'}`}>{t}</button>
                      })}
                    </div>
                    <textarea value={rec.note} onChange={(e) => set({ note: e.target.value })} rows={4} placeholder="记录候选人的回答要点…" readOnly={locked} className="mt-4 w-full resize-none rounded-lg border border-base-300 px-4 py-3 text-[15px] leading-7 outline-none placeholder:text-base-content/50 focus:border-primary/60 focus:ring-2 focus:ring-primary/15" />
                  </div>
                </div>
                )
              ) : (
                <div key={idx} className="ws-rise mx-auto max-w-[760px] px-8 py-8">
                  <div className="flex items-baseline justify-between"><h1 className="text-[22px] font-semibold text-base-content">面试评价</h1>{locked && <span className="rounded bg-base-200 px-2 py-0.5 text-sm text-base-content/60">已提交 · 结果不可修改</span>}</div>
                  <div className="mt-6 grid grid-cols-3 divide-x divide-base-300 rounded-xl border border-base-300">
                    {[['用时', mmss(elapsed)], ['已评题目', `${scored} / ${qs.length}`], ['平均分', scored ? avg.toFixed(1) : '–']].map(([k, v]) => (
                      <div key={k} className="px-5 py-4"><div className="text-sm text-base-content/60">{k}</div><div className="mt-1 text-2xl font-semibold tabular-nums text-base-content">{v}</div></div>
                    ))}
                  </div>
                  <ol ref={listRef} className="stagger mt-8 divide-y divide-base-300 border-y border-base-300">
                    {qs.map((x, i) => {
                      const r = recs[x.id] ?? empty
                      const missing = miss === 'questions' && !r.score
                      return (
                        <li key={x.id} style={{ '--i': Math.min(i, 7) } as CSSProperties} className={missing ? 'login-fade bg-warning/10' : ''}>
                          <button onClick={() => move(i)} disabled={locked} className={`flex w-full gap-5 px-2 py-4 text-left ${locked ? 'cursor-default' : 'cursor-pointer motion-pop hover:bg-base-content/5'}`}>
                            <span className="w-6 pt-0.5 text-sm tabular-nums text-base-content/50">{i + 1}</span>
                            <div className="min-w-0 flex-1">
                              <p className="text-[15px] leading-6 text-base-content">{x.q}</p>
                              <p className="mt-1 text-sm text-base-content/60">{[`用时 ${mmss(r.secs)}`, `要点 ${r.hit.length}/${x.points.length}`, ...r.tags, r.note].filter(Boolean).join(' · ')}</p>
                            </div>
                            {missing && <span className="shrink-0 self-center rounded bg-warning/15 px-1.5 py-0.5 text-xs text-warning">未评分</span>}
                            <span className="w-8 text-right text-xl font-semibold tabular-nums text-base-content">{r.score ?? <span className="text-base-content/40">–</span>}</span>
                          </button>
                        </li>
                      )
                    })}
                  </ol>
                  <h2 className="mt-8 text-[15px] font-semibold text-base-content">整体观察</h2>
                  <textarea value={obs} readOnly={locked} onChange={(e) => { setObs(e.target.value); touch() }} rows={3} placeholder="补充题目之外的观察，例如沟通方式、学习意愿…（会作为综合评价的依据）" className="mt-3 w-full resize-none rounded-lg border border-base-300 px-4 py-3 text-[15px] leading-7 outline-none placeholder:text-base-content/50 focus:border-primary/60 focus:ring-2 focus:ring-primary/15" />

                  <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-[15px] font-semibold text-base-content">综合评价</h2>
                    <button onClick={askGenReview} disabled={reviewing} className="cursor-pointer motion-pop text-sm font-medium text-base-content hover:underline disabled:cursor-default disabled:text-base-content/50">{reviewing ? '生成中…' : review ? '重新生成报告' : '生成综合评价'}</button>
                  </div>
                  {reviewErr && <p className="mt-3 rounded-lg border border-warning/50 bg-warning/10 px-3 py-2 text-sm leading-6 text-base-content/80">{reviewErr}</p>}
                  {reviewing ? (
                    <div className="mt-3 space-y-3 rounded-xl border border-base-300 p-5">{[92, 78, 60].map((w) => <div key={w} className="h-3 animate-pulse rounded bg-base-200" style={{ width: `${w}%` }} />)}</div>
                  ) : review ? (
                    /* 已确认（success 边框）与未确认草稿（warning 边框 + 徽标）视觉区分，草稿不得当作最终结论 */
                    <div className={`login-fade mt-3 rounded-xl border p-5 ${review.draft ? 'border-warning/60 bg-warning/5' : 'border-success/40 bg-success/5'}`}>
                      <div className="flex flex-wrap items-center gap-3 border-b border-base-content/10 pb-3">
                        <Chip tone={review.draft ? 'warning' : 'success'}>{review.draft ? 'AI 草稿 · 待人工确认' : '已人工确认'}</Chip>
                        <span className="text-xs leading-5 text-base-content/60">
                          {review.draft
                            ? `${review.at} 由 AI 依据本场评分与备注辅助生成，未经人工确认前不作为面评结论`
                            : `${review.confirmedBy ?? '—'} 于 ${review.confirmedAt ?? '—'} 人工确认，已作为正式面评结论保存`}
                        </span>
                        {review.draft && (
                          <Btn
                            className="ml-auto !h-8 !px-3"
                            variant="accent"
                            onClick={() => setReviewAsk(true)}
                            disabled={!canConfirmReview}
                            title={canConfirmReview ? '确认为正式面评结论并记录确认人与时间' : `当前角色（${currentUser.role}）无面评确认权限`}
                          >
                            人工确认
                          </Btn>
                        )}
                      </div>
                      <p className="mt-3 text-[15px] leading-7 text-base-content">{review.overall}</p>
                      <div className="mt-4 grid gap-5 sm:grid-cols-3">
                        {([['优势', review.strengths, 'bg-success'], ['待验证或不足', review.weaknesses, 'bg-warning'], ['下一轮建议', review.nextSteps, 'bg-info']] as const).map(([t, list, dot]) => (
                          <div key={t}>
                            <h3 className="flex items-center gap-2.5 text-sm font-medium text-base-content"><span className={`h-1.5 w-1.5 rounded-full ${dot}`} />{t}</h3>
                            <ul className="mt-1.5 space-y-2 text-sm leading-6 text-base-content/70">{list.length ? list.map((x) => <li key={x}>{x}</li>) : <li className="text-base-content/50">暂无</li>}</ul>
                          </div>
                        ))}
                      </div>
                      <p className="mt-4 rounded-lg bg-base-200 px-3 py-2 text-sm leading-6 text-base-content/80"><b className="font-medium">复核建议</b>　{review.suggestion}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-2.5 text-xs text-base-content/50">
                        依据
                        {review.evidence.map((id) => { const i = qs.findIndex((x) => x.id === id); return i < 0 ? null : <button key={id} onClick={() => move(i)} disabled={locked} className="cursor-pointer motion-pop rounded bg-base-content/5 border border-base-content/10 px-1.5 py-0.5 text-xs font-medium text-base-content hover:bg-base-content/10 disabled:cursor-default">第 {i + 1} 题</button> })}
                        <span className="ml-auto">{review.at} 生成 · AI 辅助意见，不自动作录用决定{review.draft ? '' : ` · ${review.confirmedBy ?? ''} ${review.confirmedAt ?? ''} 已确认`}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 rounded-lg border border-dashed border-base-300 px-4 py-3 text-sm text-base-content/50">根据已评分题目、备注与整体观察生成，产出为「AI 草稿 · 待人工确认」；未评分和已排除的题不计入。{locked && '提交后仍可随时重新生成。'}</p>
                  )}

                  <div className="mt-8 flex items-baseline justify-between">
                    <h2 className="text-[15px] font-semibold text-base-content">综合评语</h2>
                    {!locked && <button onClick={() => setSummaryAsk(true)} className="cursor-pointer motion-pop text-sm text-base-content/60 hover:text-base-content">根据记录重新生成</button>}
                  </div>
                  <textarea value={summary} readOnly={locked} onChange={(e) => { setSummary(e.target.value); touch() }} rows={5} className="mt-3 w-full resize-none rounded-lg border border-base-300 px-4 py-3 text-[15px] leading-7 outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15" />
                  <div ref={verdictRef} className={`mt-8 rounded-xl transition ${miss === 'verdict' ? 'login-fade p-3 ring-2 ring-warning' : ''}`}>
                    <h2 className="text-[15px] font-semibold text-base-content">综合结论{miss === 'verdict' && <span className="ml-2 text-sm font-normal text-warning">必填：请选择一个结论再提交</span>}</h2>
                    <div className="mt-3 grid grid-cols-3 gap-3">
                      {['推荐录用', '待定', '不推荐'].map((v) => (
                        <button key={v} disabled={locked} onClick={() => { setVerdict(v); setWarn(''); setMiss(''); touch() }} className={`h-11 cursor-pointer motion-pop rounded-lg border text-sm ${verdict === v ? 'border-base-content/50 bg-base-content/10 font-semibold text-base-content ring-1 ring-base-content/15' : 'border-base-300 text-base-content/70 hover:border-base-content/35'}`}>{v}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-3 border-t border-base-300 bg-base-100 px-6 py-3">
              {!done ? (
                qs.length === 0 ? (
                  <>
                    <span className="ml-auto text-sm text-base-content/50">本场还没有题目，先回去勾选题目再进面试间</span>
                    <Btn variant="ghost" onClick={() => go('back')}>返回{go.from}</Btn>
                  </>
                ) : (
                <>
                  <Btn variant="ghost" onClick={() => move(Math.max(0, idx - 1))}>上一题</Btn>
                  <span className="ml-auto text-sm text-base-content/50">{savedAt ? `已自动保存 ${savedAt}` : '记录会自动保存'}</span>
                  {idx < qs.length - 1 ? <Btn variant="accent" onClick={() => move(idx + 1)}>下一题 →</Btn> : <Btn variant="accent" onClick={askEnd}>去评价 →</Btn>}
                </>
                )
              ) : locked ? (
                <>
                  <Btn variant="ghost" onClick={exportMd}>导出记录</Btn>
                  <span className="ml-auto text-sm text-base-content/50">结果已提交，不可再返回面试间修改 · 报告可随时重新生成</span>
                  <Btn onClick={() => go('back')}>返回{go.from}</Btn>
                </>
              ) : (
                <>
                  <Btn variant="ghost" onClick={() => move(0)}>返回题目</Btn>
                  <Btn variant="ghost" onClick={exportMd}>导出记录</Btn>
                  <span className={`ml-auto text-sm ${warn ? 'text-warning' : 'text-base-content/50'}`}>{warn || (unscored ? `还有 ${unscored} 题未评分，提交前可先补填` : savedAt ? `已自动保存 ${savedAt}` : '记录会自动保存')}</span>
                  <Btn variant="accent" onClick={submit} loading={submitting} disabled={submitting}>{verdict ? `提交评价：${verdict}` : '提交评价'}</Btn>
                </>
              )}
            </div>
          </section>

          {/* 右：常驻对话面板（不等候选人进入，转写流式实时出现） */}
          <aside className="flex max-h-[38vh] flex-col border-t border-base-300 bg-base-100 lg:max-h-none lg:w-80 lg:shrink-0 lg:border-l lg:border-t-0">
            {talkPanel(false)}
          </aside>
        </div>
      )}

      {/* 候选人画面小窗：开着摄像头可切换看自己；底部气泡滚动显示最新一句 */}
      {mode === 'win' && (
        <div className="login-fade fixed bottom-6 right-6 z-30 h-44 w-72 overflow-hidden rounded-xl shadow-[var(--shadow-lift)] ring-1 ring-base-300">
          {winView === 'self' && camOn ? <SelfView stream={camStream} label="我（面试官）" /> : <PeerView name={c.name} peer={peer} talking={peerTalking} />}
          {lastBubble && (
            <p className="absolute bottom-1.5 left-1.5 right-12 truncate rounded-lg bg-black/55 px-2.5 py-1.5 text-[11px] leading-4 text-white/90">
              <span className="text-white/55">{lastBubble.who}：</span>{lastBubble.text}
            </p>
          )}
          <div className="absolute right-1.5 top-1.5 flex gap-2">
            {camOn && <button onClick={() => setWinView(winView === 'peer' ? 'self' : 'peer')} title={winView === 'peer' ? '切换看我的画面' : '切换看候选人'} aria-label={winView === 'peer' ? '切换看我的画面' : '切换看候选人'} className="grid h-6 w-6 cursor-pointer motion-pop place-items-center rounded bg-black/40 text-xs text-white/80 hover:text-white">⇄</button>}
            <button onClick={() => setMode('full')} title="全屏面对面" aria-label="全屏面对面" className="grid h-6 w-6 cursor-pointer motion-pop place-items-center rounded bg-black/40 text-xs text-white/80 hover:text-white">⤢</button>
            <button onClick={() => setMode('min')} title="收起" aria-label="收起" className="grid h-6 w-6 cursor-pointer motion-pop place-items-center rounded bg-black/40 text-xs text-white/80 hover:text-white">—</button>
          </div>
        </div>
      )}

      {/* 进入面试间的二次确认：确认后才计时、上报在线、按勾选开麦开摄像头 */}
      {!entered && !locked && (
        <div className="ws-scrim fixed inset-0 z-50 grid place-items-center px-4">
          <div className="login-fade w-full max-w-md ws-paper rounded-xl p-6">
            <h1 className="text-lg font-semibold text-base-content">进入面试间</h1>
            <p className="mt-1.5 text-sm text-base-content/60">{c.name} · {c.role} · {c.round}</p>
            <p className="mt-4 rounded-lg bg-base-200 px-3.5 py-3 text-sm leading-6 text-base-content/70">进入即开始计时，在线状态会同步给候选人。面试未结束时离开会转为后台进行、计时继续，工作台会出现悬浮入口可随时回来；先暂停再离开则完全挂起。</p>
            <label className="mt-4 flex cursor-pointer items-start gap-4 text-sm text-base-content/80">
              <input type="checkbox" checked={micDraft} onChange={(e) => setMicDraft(e.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" />
              <span>开启麦克风<span className="block text-xs leading-5 text-base-content/50">你的发言自动转写进会话记录；面试中可随时关闭，关闭后仅记录候选人</span></span>
            </label>
            <label className="mt-3 flex cursor-pointer items-start gap-4 text-sm text-base-content/80">
              <input type="checkbox" checked={camDraft} onChange={(e) => setCamDraft(e.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" />
              <span>开启我的摄像头<span className="block text-xs leading-5 text-base-content/50">候选人可以看到你；要看简历与题目时可保持关闭</span></span>
            </label>
            <div className="mt-6 flex justify-end gap-3">
              <Btn variant="ghost" onClick={() => go('back')}>暂不进入</Btn>
              <Btn variant="accent" onClick={enterRoom}>进入面试间</Btn>
            </div>
          </div>
        </div>
      )}

      {/* 面试未结束返回工作台的确认：确认后挂后台继续计时，工作台出现悬浮入口 */}
      {leaveAsk && (
        <div className="ws-scrim fixed inset-0 z-50 grid place-items-center px-4">
          <div className="login-fade w-full max-w-md ws-paper rounded-xl p-6">
            <h1 className="text-lg font-semibold text-base-content">当前面试未结束，是否返回工作台？</h1>
            <p className="mt-3 text-sm leading-6 text-base-content/70">返回后面试会在后台继续计时，记录与出题进度都会保留；工作台右下角会出现悬浮入口，点一下即可回到面试间（不再询问）。</p>
            <p className="mt-2 text-sm leading-6 text-base-content/60">如需完全挂起，请先点顶栏的「暂停」再离开；结束面试后离开则正常收尾，不会出现悬浮入口。</p>
            <div className="mt-6 flex justify-end gap-3">
              <Btn variant="ghost" onClick={() => go('back')}>返回工作台</Btn>
              <Btn variant="accent" onClick={() => setLeaveAsk(false)}>继续面试</Btn>
            </div>
          </div>
        </div>
      )}

      {/* 结束面试的二次确认：说明后果（停表、只读、进入待录取） */}
      <Modal
        open={endAsk}
        onClose={() => setEndAsk(false)}
        title="结束本场面试，进入评价？"
        sub="结束后计时停表，离开不会再出现后台悬浮入口"
        footer={
          <>
            <Btn variant="ghost" onClick={() => setEndAsk(false)}>继续面试</Btn>
            <Btn variant="accent" onClick={() => { setEndAsk(false); toEval() }}>结束并进入评价</Btn>
          </>
        }
      >
        <ul className="space-y-2.5 text-sm leading-6 text-base-content/70">
          <li>· 计时立即停止，已记录的评分、备注与会话记录全部保留</li>
          <li>· 未评分的题目保留为「未评分」，可在评价页补填后再提交</li>
          <li>· 提交评价后评分与结论不可修改，候选人流转到「待录取」</li>
        </ul>
      </Modal>

      {/* 提交评价的二次确认：确认期间按钮 loading，防止重复提交 */}
      <Modal
        open={submitAsk}
        onClose={() => { if (!submitting) setSubmitAsk(false) }}
        title="提交面试评价？"
        sub={verdict ? `综合结论：${verdict}` : '尚未选择综合结论'}
        footer={
          <>
            <Btn variant="ghost" disabled={submitting} onClick={() => setSubmitAsk(false)}>再检查一下</Btn>
            <Btn variant="accent" loading={submitting} onClick={doSubmit}>确认提交</Btn>
          </>
        }
      >
        <ul className="space-y-2.5 text-sm leading-6 text-base-content/70">
          <li>· 提交后评分与结论不可修改，面试间转为只读记录</li>
          <li>· 综合得分 {scored ? avg.toFixed(1) : '–'} 分，已评 {scored}/{qs.length} 题</li>
          <li>· 候选人流转到「待录取」；AI 综合评价仍需人工确认后才作为面评结论</li>
        </ul>
        {unscored > 0 && (
          <p className="mt-3 rounded-lg border border-warning/50 bg-warning/10 px-3 py-2 text-xs leading-5 text-base-content/70">
            还有 {unscored} 题未评分，提交后这些题目会保留为「未评分」，也会出现在评价记录里。
          </p>
        )}
      </Modal>

      {/* 重新生成综合评语会覆盖手写内容：二次确认后再覆盖 */}
      <Modal
        open={summaryAsk}
        onClose={() => setSummaryAsk(false)}
        title="用本场记录重新生成综合评语？"
        sub="当前综合评语会被覆盖，且无法撤销"
        footer={
          <>
            <Btn variant="ghost" onClick={() => setSummaryAsk(false)}>保留现有评语</Btn>
            <Btn variant="accent" onClick={() => { setSummary(gen()); touch(); setSummaryAsk(false) }}>覆盖并重新生成</Btn>
          </>
        }
      >
        <p className="text-sm leading-6 text-base-content/70">生成内容只依据已评分题目、备注与整体观察；你手动补充的措辞会被替换，请先确认不需要保留当前文本。</p>
      </Modal>

      {/* 重新生成评价报告会覆盖现有内容：二次确认后再生成 */}
      <Modal
        open={regenAsk}
        onClose={() => setRegenAsk(false)}
        title="重新生成综合评价报告？"
        sub={review && !review.draft ? '当前报告已人工确认，重新生成后会回到「待人工确认」' : '当前报告会被覆盖'}
        footer={
          <>
            <Btn variant="ghost" onClick={() => setRegenAsk(false)}>保留现有报告</Btn>
            <Btn variant="accent" onClick={() => { setRegenAsk(false); genReview() }}>覆盖并重新生成</Btn>
          </>
        }
      >
        <p className="text-sm leading-6 text-base-content/70">重新生成只依据本场已评分题目、备注与整体观察，不改动评分与结论；报告内容会被替换，需要再次人工确认后才作为面评结论。</p>
      </Modal>

      {/* AI 综合评价草稿的人工确认（FR-B3）：确认后记录确认人与确认时间 */}
      <Modal
        open={reviewAsk}
        onClose={() => { if (!confirming) setReviewAsk(false) }}
        title="确认 AI 综合评价草稿"
        sub="FR-B3：AI 辅助生成的评价必须经人工确认后才作为面评结论"
        footer={
          <>
            <Btn variant="ghost" disabled={confirming} onClick={() => setReviewAsk(false)}>取消</Btn>
            <Btn variant="accent" loading={confirming} onClick={doConfirmReview}>确认并保存</Btn>
          </>
        }
      >
        <p className="text-sm leading-6 text-base-content/70">
          该报告由 AI 依据本场评分、备注与整体观察生成，当前标记为「AI 草稿 · 待人工确认」。确认后标记为「已人工确认」并记录确认人（{currentUser.name}）与确认时间，可作为面评结论使用。
        </p>
        <p className="mt-2 text-xs leading-5 text-base-content/50">
          报告内容仍可随时重新生成（重新生成后会回到「待人工确认」状态）；AI 只提供辅助证据，不会自动作录用决定，也不触发审批。
        </p>
      </Modal>
    </div>
  )
}
