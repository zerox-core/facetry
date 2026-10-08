import { useEffect, useRef, useState } from 'react'
import { resumes } from '../data'
import { commit, elapsedOf, findC, liveChannel, pickedOf, rooms, save, submitEvaluation, type Rec, type Review, type Room, type Talk } from '../store'
import { canTranscribe, clock, readFile, uid, useVoice } from '../voice'
import { Composer, Speaker, TalkList, VoiceBars } from './live'
import type { Go } from '../App'
import { Btn } from './ui'
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
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[#141c2b] text-white">
      <Speaker name={name} speaking={talking} size={big ? 'h-32 w-32 text-4xl' : 'h-14 w-14 text-xl'} tone={peer ? 'bg-amber-400 text-[#1d2939]' : 'bg-white/15 text-white'} />
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
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[#141c2b] text-white">
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
  // 已提交评价（跟进中 / 已结束）的面试间是只读记录：结果不可再修改
  const locked = c.status === '跟进中' || c.status === '已结束' || (c.status as string) === '已评价'
  const lines = resumes[c.id].sections.flatMap((s) => s.lines).filter((l) => l.mark)
  const count = { all: lines.length, hi: lines.filter((l) => l.mark === 'hi').length, risk: lines.filter((l) => l.mark === 'risk').length }
  // 屏幕可能朝向候选人：遮挡分析结论、参考答案与减分信号
  const [cover, setCover] = useState(false)
  const qs = c.qs.filter((q) => !picked.length || picked.includes(q.id))
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
  useEffect(() => { if (entered) ch.current?.send({ type: 'state', name: c.name, role: c.role, round: c.round, idx, total: qs.length, q: q?.q ?? '', ended: done, sec: elapsed }) }, [entered, shared, peer, idx, done, elapsed])
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
      c.risks.length ? `简历待核实项：${c.risks[0]}${recs[qs.find((x) => x.topic === '简历核实')?.id ?? '']?.note ? '（已追问，见记录）' : '（建议下一轮继续确认）'}。` : '',
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
      nextSteps: [...weak, ...miss].flatMap((x) => x.follow.filter((f) => !recs[x.id]?.asked.includes(f)).slice(0, 1)).slice(0, 3),
      suggestion: rated.length < qs.length / 2 ? '覆盖率不足一半，证据不充分，建议安排下一轮再做结论。' : weak.length ? '证据基本充分，建议结合偏弱项在下一轮定向验证后再做结论。' : '证据较充分，可结合团队需求复核后做结论。',
      evidence: [...good, ...weak].map((x) => x.id),
      at: now(),
    }
  }
  // 报告由已保存的评分与记录推导，提交前后都可以生成 / 重新生成
  const genReview = () => { setReviewing(true); setTimeout(() => { setReview(buildReview()); setReviewing(false); touch() }, 1200) }
  // 导出 Markdown 完整记录：评分、备注、参考要点、排除状态与综合评价
  const exportMd = () => {
    const excluded = c.qs.filter((x) => !qs.includes(x))
    const md = [
      `# 面试记录 · ${c.name}`, '', `- 岗位：${c.role}`, `- 轮次：${c.round} · ${c.slot}`, `- 用时：${mmss(elapsed)} · 已评 ${scored}/${qs.length} · 均分 ${scored ? avg.toFixed(1) : '–'}`, `- 结论：${verdict || '未选择'}`, '',
      '## 题目记录', '',
      ...qs.flatMap((x, i) => { const r = recs[x.id] ?? empty; return [`### ${i + 1}. ${x.q}`, '', `- 类型：${x.topic} · 依据：${x.basis}`, `- 评分：${r.score ?? '未评分'} · 用时 ${mmss(r.secs)}`, `- 命中要点：${r.hit.length ? r.hit.join('；') : '无'}`, `- 参考要点：${x.points.join('；') || '无'}`, r.tags.length ? `- 标签：${r.tags.join('、')}` : '', r.note ? `- 备注：${r.note}` : '', ''].filter((l, j, a) => l !== '' || j === a.length - 1) }),
      ...(excluded.length ? ['## 已排除题目', '', ...excluded.map((x) => `- ${x.q}`), ''] : []),
      '## 面试官整体观察', '', obs || '（无）', '',
      '## 综合评语', '', summary || '（无）', '',
      ...(talk.length ? ['## 会话记录（补充材料）', '', ...talk.map((m) => `- [${m.t}] ${m.who}${m.kind === 'voice' ? '（语音）' : ''}：${m.kind === 'file' ? `[文件] ${m.file?.name}` : m.text}`), ''] : []),
      ...(review ? ['## 综合评价（辅助意见，供复核）', '', review.overall, '', '**优势**', ...review.strengths.map((t) => `- ${t}`), '', '**待验证或不足**', ...review.weaknesses.map((t) => `- ${t}`), '', '**下一轮建议**', ...review.nextSteps.map((t) => `- ${t}`), '', `**复核建议**：${review.suggestion}`, ''] : []),
    ].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([md], { type: 'text/markdown' }))
    a.download = `${c.name}-面试记录.md`
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
  const submit = () => {
    if (!verdict) {
      setWarn('请先选择综合结论')
      setMiss('verdict')
      verdictRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    if (unscored && warn !== 'confirm') {
      setWarn('confirm')
      setMiss('questions')
      listRef.current?.scrollIntoView({ behavior: 'smooth' })
      return
    }
    setMiss('')
    submitEvaluation(cid, avg, mmss(elapsed), verdict)
    go('result', cid, { replace: true })
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
  const pick = (qid: string) => { const i = qs.findIndex((x) => x.id === qid); if (i >= 0) move(i) }
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
      <div className={`flex h-12 shrink-0 items-center gap-2.5 border-b px-4 ${dark ? 'border-white/10' : 'border-slate-200'}`}>
        <Speaker name="王" speaking={micOn && voice.speaking} size="h-7 w-7 text-xs" tone={dark ? 'bg-amber-400 text-[#1d2939]' : 'bg-[#1d2939] text-white'} />
        <Speaker name={c.name} speaking={peerTalking} size="h-7 w-7 text-xs" tone={peer ? 'bg-amber-400 text-[#1d2939]' : dark ? 'bg-white/15 text-white' : 'bg-slate-200 text-slate-500'} />
        <span className={`min-w-0 flex-1 truncate text-xs ${dark ? 'text-white/50' : 'text-slate-500'}`}>{paused ? '已暂停 · 记录挂起' : done ? '面试已结束' : !micOn ? '仅记录候选人' : shared ? (peer ? '双方发言自动转写' : '等待候选人进入') : '记录面试官语音'}</span>
        {voice.status === 'on' && micOn && <VoiceBars level={voice.level} on className={dark ? 'bg-emerald-400' : 'bg-blue-500'} />}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <TalkList items={talk} me="面试官" interim={interim} dark={dark} empty={canTranscribe ? '开口说话即可自动记录，转写会实时出现在这里' : '当前浏览器不支持语音转写，可用文字补充记录'} />
      </div>
      <div className={`shrink-0 p-3 ${dark ? '' : 'border-t border-slate-100'}`}>
        {!locked && <Composer onText={(text) => addTalk({ id: uid(), who: '面试官', kind: 'text', text, t: clock() })} onFiles={files} dark={dark} placeholder={shared ? '发送给候选人…' : '补充记录，例如候选人的回答…'} />}
      </div>
    </>
  )

  return (
    <div className="ws-canvas flex h-screen flex-col">
      {/* 顶栏：摄像头状态 · 语音记录状态 · 分享 · 候选人画面三态 */}
      <div className="flex ws-bar h-16 shrink-0 items-center gap-5 px-6 text-white">
        <button onClick={tryLeave} className="cursor-pointer text-sm text-white/55 transition-colors hover:text-white">← {go.from}</button>
        <span className="h-5 w-px bg-white/15" />
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-amber-400 text-sm font-semibold text-[#1d2939]">{c.name[0]}</span>
          <div className="leading-tight">
            <div className="text-[15px] font-semibold text-white">{c.name}</div>
            <div className="text-xs text-white/55">{c.role} · {c.round} · 面试官 王磊</div>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {/* 摄像头：面试官可开可不开，默认不开（要看简历与题目） */}
          <button onClick={() => setCamOn(!camOn)} disabled={locked || !entered} title={camOn ? '点击关闭摄像头' : '点击开启摄像头：候选人可以看到你'} className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/15 px-2.5 py-1.5 text-sm text-white/80 transition-colors hover:bg-white/10 disabled:cursor-default disabled:opacity-50">
            <span className={`h-1.5 w-1.5 rounded-full ${camOn ? 'bg-emerald-400' : 'bg-white/30'}`} />摄像头{camOn ? '开' : '关'}
          </button>
          {/* 语音记录状态：关闭麦克风后记录不停，只是不再录入面试官的声音 */}
          <button onClick={() => setMicOn(!micOn)} disabled={locked || done || !entered} title={micOn ? '点击关闭麦克风：会话记录不会停，只是不再录入你的声音' : '点击开启麦克风：你的发言会一起转写'} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-white/80 transition-colors hover:bg-white/10 disabled:cursor-default disabled:opacity-50">
            <VoiceBars level={micOn ? voice.level : 0} on={micOn && voice.status === 'on'} />
            <span className="hidden xl:inline">{micLabel}</span>
          </button>
          <div className="relative">
            <button onClick={() => setShareOpen(!shareOpen)} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors ${shared ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200' : 'border-white/15 text-white/80 hover:bg-white/10'}`}>
              {shared ? <><Speaker name={c.name} speaking={peerTalking} size="h-5 w-5 text-[10px]" tone={peer ? 'bg-emerald-400 text-[#1d2939]' : 'bg-white/20 text-white'} />{peer ? '候选人在线' : '等待候选人'}</> : '分享面试间'}
            </button>
            {shareOpen && (
              <div className="login-fade absolute right-0 top-full z-40 mt-2 w-[340px] rounded-xl bg-white p-4 text-slate-800 shadow-[var(--shadow-lift)]">
                <div className="text-[15px] font-semibold text-slate-900">分享面试间</div>
                <p className="mt-1 text-sm leading-6 text-slate-500">候选人打开链接后开启摄像头和麦克风，双方发言会自动转写进会话记录。候选人只能看到题干与会话。</p>
                <div className="mt-3 flex gap-2">
                  <input readOnly value={link} onFocus={(e) => e.target.select()} className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-600 outline-none" />
                  <Btn className="!h-9" onClick={copy}>{copied ? '已复制' : '复制链接'}</Btn>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <button onClick={() => { share(); window.open(link, 'facetry-join') }} className="cursor-pointer text-blue-600 hover:text-blue-800">以候选人视角打开 ↗</button>
                  {shared && <button onClick={() => { setShared(false); setPeer(false); ch.current?.send({ type: 'state', name: c.name, role: c.role, round: c.round, idx, total: qs.length, q: '', ended: true, sec: elapsed }) }} className="cursor-pointer text-slate-400 hover:text-slate-700">停止分享</button>}
                </div>
                {!shared && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">未分享时计时与面试官语音记录照常进行，但无法自动记录候选人的现场发言。</p>}
              </div>
            )}
          </div>
          <div className="hidden items-center gap-3 2xl:flex">
            <span className="text-sm text-white/55">进度</span>
            <div className="h-1.5 w-32 rounded-full bg-white/10"><div className="h-full rounded-full bg-amber-400 transition-[width] duration-700 ease-[var(--ease-out)]" style={{ width: `${(scored / qs.length) * 100}%` }} /></div>
            <span className="text-sm tabular-nums text-white">{scored}/{qs.length}</span>
          </div>
          <button onClick={() => setCover(!cover)} className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm transition ${cover ? 'border-amber-400/60 bg-amber-400/15 text-amber-200' : 'border-white/15 text-white/80 hover:bg-white/10'}`}>{cover ? '已遮挡分析' : '遮挡分析'}</button>
          <button onClick={togglePause} disabled={locked || done || !entered} title={paused ? '继续面试：计时重新开始' : '暂停面试：计时挂起，之后可直接返回工作台'} className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/15 px-3 py-1.5 text-sm tabular-nums text-white/85 transition-colors hover:bg-white/10 disabled:cursor-default disabled:opacity-50">
            <span className={`h-2 w-2 rounded-full ${paused || done || !entered ? 'bg-white/30' : 'animate-pulse bg-red-400'}`} />{mmss(elapsed)}<span className="text-white/45">{paused ? '继续' : '暂停'}</span>
          </button>
          {!done && <Btn className="!bg-white !text-[#1d2939] hover:!bg-slate-100" onClick={toEval}>结束面试</Btn>}
          {/* 候选人画面：小窗 / 全屏面对面 / 收起 */}
          <div className="relative">
            <div className="flex rounded-lg border border-white/15 p-0.5">
              {([['win', '小窗：候选人画面缩在右下角', '▢'], ['full', '全屏面对面：候选人画面 + 对话面板', '⤢'], ['min', '收起候选人画面', '—']] as const).map(([k, t, g]) => (
                <button key={k} onClick={() => setMode(k)} title={t} aria-label={t} className={`grid h-7 w-7 cursor-pointer place-items-center rounded-md text-sm transition-colors ${mode === k ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white'}`}>{g}</button>
              ))}
            </div>
            {coach && (
              <div className="login-fade absolute right-0 top-full z-40 mt-2 w-64 rounded-xl bg-white p-3.5 text-sm leading-6 text-slate-700 shadow-[var(--shadow-lift)]">
                <span className="absolute -top-1 right-6 h-2 w-2 rotate-45 bg-white" />
                候选人画面在这里切换：小窗瞄一眼、全屏面对面、减号收起只看简历。
              </div>
            )}
          </div>
        </div>
      </div>

      {mode === 'full' ? (
        /* 全屏面对面：候选人画面为主，右侧常驻对话面板；开着摄像头时右下角有自己的画面，可互换主画面 */
        <div className="flex min-h-0 flex-1 bg-[#0f1622]">
          <div className="relative min-w-0 flex-1">
            {fullView === 'self' && camOn ? <SelfView stream={camStream} label="我（面试官）" /> : <PeerView name={c.name} peer={peer} talking={peerTalking} big />}
            {camOn && (
              <div className="absolute bottom-24 right-6 h-36 w-56 overflow-hidden rounded-xl shadow-[var(--shadow-lift)] ring-1 ring-white/20">
                {fullView === 'self' ? <PeerView name={c.name} peer={peer} talking={peerTalking} /> : <SelfView stream={camStream} label="我（面试官）" />}
              </div>
            )}
            <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-3">
              <span className="text-sm text-white/50">全屏面对面 · 简历与题目已隐藏</span>
              {camOn && <button onClick={() => setFullView(fullView === 'peer' ? 'self' : 'peer')} className="ws-press cursor-pointer rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/15">{fullView === 'peer' ? '看我的画面' : '看候选人'}</button>}
              <button onClick={() => setMode('win')} className="ws-press cursor-pointer rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/15">返回小窗</button>
            </div>
          </div>
          <aside className="flex w-96 shrink-0 flex-col bg-[#141c2b] text-white">
            {talkPanel(true)}
          </aside>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          {/* 左：可交互简历 */}
          <section className={`flex min-h-0 flex-col border-slate-200 transition-[flex-basis] duration-300 lg:border-r ${wide ? 'lg:basis-[52%]' : 'lg:basis-[34%]'} h-1/2 shrink-0 lg:h-auto`}>
            <div className="flex h-12 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-5">
              <span className="text-sm font-semibold text-slate-900">简历</span>
              <div className="flex rounded-md bg-slate-100 p-0.5 text-[13px]">
                {([['all', '全部标注'], ['hi', '亮点'], ['risk', '疑点']] as const).map(([k, t]) => (
                  <button key={k} onClick={() => setFilter(k)} className={`cursor-pointer rounded px-2.5 py-1 transition ${filter === k ? 'bg-white font-medium text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                    {t}<span className="ml-1 tabular-nums text-slate-400">{count[k]}</span>
                  </button>
                ))}
              </div>
              <button onClick={() => setWide(!wide)} className="ml-auto hidden cursor-pointer text-sm text-slate-500 hover:text-slate-900 lg:block">{wide ? '还原' : '放大简历'}</button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
              {!cover && <div className="mx-auto max-w-[640px] ws-paper rounded-xl px-5 py-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-semibold text-slate-900">自动分析</span>
                  <span className="text-sm text-slate-500">岗位匹配 <b className="font-semibold tabular-nums text-slate-900">{c.match}%</b></span>
                </div>
                <p className="mt-1.5 text-sm leading-6 text-slate-600">{c.summary}</p>
                <p className="mt-2 text-xs text-slate-400">点击带标注的段落，右侧跳到对应题目</p>
              </div>}
              <div className="mx-auto mt-4 max-w-[640px] overflow-hidden ws-paper rounded-xl">
                <ResumeDoc c={c} active={done ? undefined : q?.id} onPick={pick} filter={cover ? 'none' : filter} />
              </div>
            </div>
          </section>

          {/* 中：提问与记录 */}
          <section className="flex min-h-0 flex-1 flex-col bg-[#fffdf9]">
            <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-slate-200 px-4">
              {qs.map((x, i) => {
                const cur = !done && i === idx
                const s = recs[x.id]?.score
                const missing = miss === 'questions' && !s
                return (
                  <button key={x.id} onClick={() => move(i)} className={`relative flex shrink-0 cursor-pointer items-center gap-2 px-3 py-3.5 text-sm transition-colors duration-150 after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-amber-400 after:transition-transform after:duration-300 ${cur ? 'text-slate-900 after:scale-x-100' : 'text-slate-500 after:scale-x-0 hover:text-slate-800'}`}>
                    <span className={`grid h-5 w-5 place-items-center rounded-full text-[11px] tabular-nums ${s ? 'bg-blue-600 text-white' : missing ? 'bg-amber-400 text-[#1d2939]' : cur ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>{s ?? i + 1}</span>
                    <span className={cur ? 'font-medium' : ''}>{x.topic}</span>
                  </button>
                )
              })}
              <button onClick={toEval} className={`relative ml-auto shrink-0 cursor-pointer px-3 py-3.5 text-sm ${done ? 'font-medium text-slate-900 after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-amber-400' : 'text-slate-500 hover:text-slate-800'}`}>评价</button>
            </nav>

            <div ref={right} className="min-h-0 flex-1 overflow-y-auto">
              {!done ? (
                <div key={idx} className="ws-rise mx-auto max-w-[760px] px-8 py-8">
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <span className="tabular-nums">第 {idx + 1} / {qs.length} 题</span><span>·</span><span>{q.diff}</span><span>·</span><span className="tabular-nums">本题 {mmss(rec.secs)}</span>
                  </div>
                  <h1 className="mt-3 text-[22px] font-semibold leading-[1.5] text-slate-900">{q.q}</h1>
                  <p className="mt-3 inline-flex items-center gap-2 rounded-md bg-blue-50 px-2.5 py-1 text-sm text-blue-800">出题依据 · {q.basis}</p>

                  <div className="mt-8 grid gap-6 md:grid-cols-2">
                    <div>
                      <div className="flex items-baseline justify-between">
                        <h2 className="text-[15px] font-semibold text-slate-900">考察要点</h2>
                        <span className="text-xs tabular-nums text-slate-400">命中 {rec.hit.length}/{q.points.length}</span>
                      </div>
                      {!q.points.length && <p className="mt-3 rounded-lg border border-dashed border-slate-200 px-3 py-2.5 text-sm text-slate-400">手动添加的题目，未设置考察要点</p>}
                      <ul className="mt-3 space-y-2">
                        {q.points.map((p) => {
                          const on = rec.hit.includes(p)
                          return (
                            <li key={p}>
                              <button onClick={() => flip('hit', p)} className={`flex w-full cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 text-left text-sm leading-6 transition ${on ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-slate-200 text-slate-700 hover:border-slate-300'}`}>
                                <span className={`mt-1 grid h-4 w-4 shrink-0 place-items-center rounded border text-[10px] ${on ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300'}`}>{on ? '✓' : ''}</span>{p}
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                    <div>
                      <h2 className="text-[15px] font-semibold text-slate-900">追问</h2>
                      {!q.follow.length && <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-400">暂无预设追问</p>}
                      <ul className="mt-3 space-y-2">
                        {q.follow.map((f) => {
                          const on = rec.asked.includes(f)
                          return (
                            <li key={f}>
                              <button onClick={() => flip('asked', f)} className={`flex w-full cursor-pointer items-start justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2.5 text-left text-sm leading-6 transition hover:bg-slate-100 ${on ? 'text-slate-400' : 'text-slate-800'}`}>
                                <span>{f}</span><span className="shrink-0 text-xs text-slate-400">{on ? '已问' : '标记已问'}</span>
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                      {!cover && q.flag && <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2.5 text-sm leading-6 text-amber-900"><b className="font-medium">减分信号</b>　{q.flag}</p>}
                    </div>
                  </div>

                  {!cover && q.answer && <div className="mt-6 rounded-lg border border-slate-200">
                    <button onClick={() => setShowAns(!showAns)} className="flex w-full cursor-pointer items-center justify-between px-4 py-3 text-sm font-medium text-slate-700">参考答案<span className="text-slate-400">{showAns ? '收起' : '展开'}</span></button>
                    {showAns && <p className="border-t border-slate-100 px-4 py-3 text-sm leading-7 text-slate-600">{q.answer}</p>}
                  </div>}

                  <div className="mt-10 border-t border-slate-200 pt-8">
                    <div className="flex items-baseline justify-between"><h2 className="text-[15px] font-semibold text-slate-900">本题记录</h2><span className="text-xs text-slate-400">快捷键：1–5 评分 · ← → 切题</span></div>
                    <div className="mt-4 grid grid-cols-5 gap-2">
                      {LEVELS.map((t, i) => {
                        const on = rec.score === i + 1
                        return (
                          <button key={t} onClick={() => set({ score: i + 1 })} className={`cursor-pointer rounded-lg border px-2 py-2.5 text-center transition ${on ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 hover:border-slate-400'}`}>
                            <div className={`text-lg font-semibold tabular-nums ${on ? '' : 'text-slate-900'}`}>{i + 1}</div>
                            <div className={`text-xs ${on ? 'text-blue-100' : 'text-slate-500'}`}>{t}</div>
                          </button>
                        )
                      })}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {TAGS.map((t) => {
                        const on = rec.tags.includes(t)
                        return <button key={t} onClick={() => flip('tags', t)} className={`cursor-pointer rounded-full border px-3 py-1 text-sm transition ${on ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600 hover:border-slate-400'}`}>{t}</button>
                      })}
                    </div>
                    <textarea value={rec.note} onChange={(e) => set({ note: e.target.value })} rows={4} placeholder="记录候选人的回答要点…" readOnly={locked} className="mt-4 w-full resize-none rounded-lg border border-slate-200 px-4 py-3 text-[15px] leading-7 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                  </div>
                </div>
              ) : (
                <div key={idx} className="ws-rise mx-auto max-w-[760px] px-8 py-8">
                  <div className="flex items-baseline justify-between"><h1 className="text-[22px] font-semibold text-slate-900">面试评价</h1>{locked && <span className="rounded bg-slate-100 px-2 py-0.5 text-sm text-slate-500">已提交 · 结果不可修改</span>}</div>
                  <div className="mt-6 grid grid-cols-3 divide-x divide-slate-200 rounded-xl border border-slate-200">
                    {[['用时', mmss(elapsed)], ['已评题目', `${scored} / ${qs.length}`], ['平均分', scored ? avg.toFixed(1) : '–']].map(([k, v]) => (
                      <div key={k} className="px-5 py-4"><div className="text-sm text-slate-500">{k}</div><div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{v}</div></div>
                    ))}
                  </div>
                  <ol ref={listRef} className="mt-8 divide-y divide-slate-100 border-y border-slate-100">
                    {qs.map((x, i) => {
                      const r = recs[x.id] ?? empty
                      const missing = miss === 'questions' && !r.score
                      return (
                        <li key={x.id} className={missing ? 'login-fade bg-amber-50/70' : ''}>
                          <button onClick={() => move(i)} disabled={locked} className={`flex w-full gap-4 px-2 py-4 text-left ${locked ? 'cursor-default' : 'cursor-pointer hover:bg-slate-50'}`}>
                            <span className="w-6 pt-0.5 text-sm tabular-nums text-slate-400">{i + 1}</span>
                            <div className="min-w-0 flex-1">
                              <p className="text-[15px] leading-6 text-slate-900">{x.q}</p>
                              <p className="mt-1 text-sm text-slate-500">{[`用时 ${mmss(r.secs)}`, `要点 ${r.hit.length}/${x.points.length}`, ...r.tags, r.note].filter(Boolean).join(' · ')}</p>
                            </div>
                            {missing && <span className="shrink-0 self-center rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">未评分</span>}
                            <span className="w-8 text-right text-xl font-semibold tabular-nums text-slate-900">{r.score ?? <span className="text-slate-300">–</span>}</span>
                          </button>
                        </li>
                      )
                    })}
                  </ol>
                  <h2 className="mt-8 text-[15px] font-semibold text-slate-900">整体观察</h2>
                  <textarea value={obs} readOnly={locked} onChange={(e) => { setObs(e.target.value); touch() }} rows={3} placeholder="补充题目之外的观察，例如沟通方式、学习意愿…（会作为综合评价的依据）" className="mt-3 w-full resize-none rounded-lg border border-slate-200 px-4 py-3 text-[15px] leading-7 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />

                  <div className="mt-8 flex items-baseline justify-between">
                    <h2 className="text-[15px] font-semibold text-slate-900">综合评价</h2>
                    <button onClick={genReview} disabled={reviewing} className="cursor-pointer text-sm text-blue-600 hover:text-blue-800 disabled:cursor-default disabled:text-slate-400">{reviewing ? '生成中…' : review ? '重新生成报告' : '生成综合评价'}</button>
                  </div>
                  {reviewing ? (
                    <div className="mt-3 space-y-2 rounded-xl border border-slate-200 p-5">{[92, 78, 60].map((w) => <div key={w} className="h-3 animate-pulse rounded bg-slate-100" style={{ width: `${w}%` }} />)}</div>
                  ) : review ? (
                    <div className="login-fade mt-3 rounded-xl border border-slate-200 p-5">
                      <p className="text-[15px] leading-7 text-slate-800">{review.overall}</p>
                      <div className="mt-4 grid gap-4 sm:grid-cols-3">
                        {([['优势', review.strengths, 'bg-emerald-500'], ['待验证或不足', review.weaknesses, 'bg-amber-500'], ['下一轮建议', review.nextSteps, 'bg-blue-500']] as const).map(([t, list, dot]) => (
                          <div key={t}>
                            <h3 className="flex items-center gap-1.5 text-sm font-medium text-slate-900"><span className={`h-1.5 w-1.5 rounded-full ${dot}`} />{t}</h3>
                            <ul className="mt-1.5 space-y-1 text-sm leading-6 text-slate-600">{list.length ? list.map((x) => <li key={x}>{x}</li>) : <li className="text-slate-400">暂无</li>}</ul>
                          </div>
                        ))}
                      </div>
                      <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-700"><b className="font-medium">复核建议</b>　{review.suggestion}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
                        依据
                        {review.evidence.map((id) => { const i = qs.findIndex((x) => x.id === id); return i < 0 ? null : <button key={id} onClick={() => move(i)} disabled={locked} className="cursor-pointer rounded bg-blue-50 px-1.5 py-0.5 text-blue-700 hover:bg-blue-100 disabled:cursor-default">第 {i + 1} 题</button> })}
                        <span className="ml-auto">{review.at} 生成 · 辅助意见，不自动作录用决定</span>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 rounded-lg border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-400">根据已评分题目、备注与整体观察生成；未评分和已排除的题不计入。{locked && '提交后仍可随时重新生成。'}</p>
                  )}

                  <div className="mt-8 flex items-baseline justify-between">
                    <h2 className="text-[15px] font-semibold text-slate-900">综合评语</h2>
                    {!locked && <button onClick={() => { setSummary(gen()); touch() }} className="cursor-pointer text-sm text-slate-500 hover:text-slate-900">根据记录重新生成</button>}
                  </div>
                  <textarea value={summary} readOnly={locked} onChange={(e) => { setSummary(e.target.value); touch() }} rows={5} className="mt-3 w-full resize-none rounded-lg border border-slate-200 px-4 py-3 text-[15px] leading-7 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                  <div ref={verdictRef} className={`mt-8 rounded-xl transition ${miss === 'verdict' ? 'login-fade p-3 ring-2 ring-amber-400' : ''}`}>
                    <h2 className="text-[15px] font-semibold text-slate-900">综合结论{miss === 'verdict' && <span className="ml-2 text-sm font-normal text-amber-700">必填：请选择一个结论再提交</span>}</h2>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {['推荐录用', '待定', '不推荐'].map((v) => (
                        <button key={v} disabled={locked} onClick={() => { setVerdict(v); setWarn(''); setMiss(''); touch() }} className={`h-11 cursor-pointer rounded-lg border text-sm ${verdict === v ? 'border-blue-600 bg-blue-50 font-medium text-blue-800' : 'border-slate-200 text-slate-600 hover:border-slate-400'}`}>{v}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2 border-t border-slate-200 bg-[#fffdf9] px-6 py-3">
              {!done ? (
                <>
                  <Btn variant="ghost" onClick={() => move(Math.max(0, idx - 1))}>上一题</Btn>
                  <span className="ml-auto text-sm text-slate-400">{savedAt ? `已自动保存 ${savedAt}` : '记录会自动保存'}</span>
                  {idx < qs.length - 1 ? <Btn variant="accent" onClick={() => move(idx + 1)}>下一题 →</Btn> : <Btn variant="accent" onClick={toEval}>去评价 →</Btn>}
                </>
              ) : locked ? (
                <>
                  <Btn variant="ghost" onClick={exportMd}>导出记录</Btn>
                  <span className="ml-auto text-sm text-slate-400">结果已提交，不可再返回面试间修改 · 报告可随时重新生成</span>
                  <Btn onClick={() => go('back')}>返回{go.from}</Btn>
                </>
              ) : (
                <>
                  <Btn variant="ghost" onClick={() => move(0)}>返回题目</Btn>
                  <Btn variant="ghost" onClick={exportMd}>导出记录</Btn>
                  <span className={`ml-auto text-sm ${warn ? 'text-amber-700' : 'text-slate-400'}`}>{warn === 'confirm' ? `还有 ${unscored} 题未评分，再次点击确认提交` : warn || (savedAt ? `已自动保存 ${savedAt}` : '')}</span>
                  <Btn variant="accent" onClick={submit}>{warn === 'confirm' ? '仍然提交' : verdict ? `提交评价：${verdict}` : '提交评价'}</Btn>
                </>
              )}
            </div>
          </section>

          {/* 右：常驻对话面板（不等候选人进入，转写流式实时出现） */}
          <aside className="flex max-h-[38vh] flex-col border-t border-slate-200 bg-white lg:max-h-none lg:w-80 lg:shrink-0 lg:border-l lg:border-t-0">
            {talkPanel(false)}
          </aside>
        </div>
      )}

      {/* 候选人画面小窗：开着摄像头可切换看自己；底部气泡滚动显示最新一句 */}
      {mode === 'win' && (
        <div className="login-fade fixed bottom-6 right-6 z-30 h-44 w-72 overflow-hidden rounded-xl shadow-[var(--shadow-lift)] ring-1 ring-black/20">
          {winView === 'self' && camOn ? <SelfView stream={camStream} label="我（面试官）" /> : <PeerView name={c.name} peer={peer} talking={peerTalking} />}
          {lastBubble && (
            <p className="absolute bottom-1.5 left-1.5 right-12 truncate rounded-lg bg-black/55 px-2.5 py-1.5 text-[11px] leading-4 text-white/90">
              <span className="text-white/55">{lastBubble.who}：</span>{lastBubble.text}
            </p>
          )}
          <div className="absolute right-1.5 top-1.5 flex gap-1">
            {camOn && <button onClick={() => setWinView(winView === 'peer' ? 'self' : 'peer')} title={winView === 'peer' ? '切换看我的画面' : '切换看候选人'} className="grid h-6 w-6 cursor-pointer place-items-center rounded bg-black/40 text-xs text-white/80 hover:text-white">⇄</button>}
            <button onClick={() => setMode('full')} title="全屏面对面" className="grid h-6 w-6 cursor-pointer place-items-center rounded bg-black/40 text-xs text-white/80 hover:text-white">⤢</button>
            <button onClick={() => setMode('min')} title="收起" className="grid h-6 w-6 cursor-pointer place-items-center rounded bg-black/40 text-xs text-white/80 hover:text-white">—</button>
          </div>
        </div>
      )}

      {/* 进入面试间的二次确认：确认后才计时、上报在线、按勾选开麦开摄像头 */}
      {!entered && !locked && (
        <div className="ws-scrim fixed inset-0 z-50 grid place-items-center px-4">
          <div className="login-fade w-full max-w-md ws-paper rounded-xl p-6">
            <h1 className="text-lg font-semibold text-slate-900">进入面试间</h1>
            <p className="mt-1.5 text-sm text-slate-500">{c.name} · {c.role} · {c.round}</p>
            <p className="mt-4 rounded-lg bg-slate-50 px-3.5 py-3 text-sm leading-6 text-slate-600">进入即开始计时，在线状态会同步给候选人。面试未结束时离开会转为后台进行、计时继续，工作台会出现悬浮入口可随时回来；先暂停再离开则完全挂起。</p>
            <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm text-slate-700">
              <input type="checkbox" checked={micDraft} onChange={(e) => setMicDraft(e.target.checked)} className="mt-0.5 h-4 w-4 accent-blue-600" />
              <span>开启麦克风<span className="block text-xs leading-5 text-slate-400">你的发言自动转写进会话记录；面试中可随时关闭，关闭后仅记录候选人</span></span>
            </label>
            <label className="mt-3 flex cursor-pointer items-start gap-3 text-sm text-slate-700">
              <input type="checkbox" checked={camDraft} onChange={(e) => setCamDraft(e.target.checked)} className="mt-0.5 h-4 w-4 accent-blue-600" />
              <span>开启我的摄像头<span className="block text-xs leading-5 text-slate-400">候选人可以看到你；要看简历与题目时可保持关闭</span></span>
            </label>
            <div className="mt-6 flex justify-end gap-2">
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
            <h1 className="text-lg font-semibold text-slate-900">当前面试未结束，是否返回工作台？</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">返回后面试会在后台继续计时，记录与出题进度都会保留；工作台右下角会出现悬浮入口，点一下即可回到面试间（不再询问）。</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">如需完全挂起，请先点顶栏的「暂停」再离开；结束面试后离开则正常收尾，不会出现悬浮入口。</p>
            <div className="mt-6 flex justify-end gap-2">
              <Btn variant="ghost" onClick={() => go('back')}>返回工作台</Btn>
              <Btn variant="accent" onClick={() => setLeaveAsk(false)}>继续面试</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
