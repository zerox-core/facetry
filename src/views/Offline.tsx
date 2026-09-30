import { useEffect, useRef, useState } from 'react'
import { resumes } from '../data'
import { findC, liveChannel, pickedOf, rooms, save, submitEvaluation, type Rec, type Review, type Talk } from '../store'
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

export default function Offline({ cid, go }: { cid: string; go: Go }) {
  const c = findC(cid)
  const picked = pickedOf(cid)
  const saved = rooms[cid]
  const locked = c.status === '已评价'
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
  const [sec, setSec] = useState(saved?.sec ?? 0)
  const [obs, setObs] = useState(saved?.obs ?? '')
  const [review, setReview] = useState<Review | undefined>(saved?.review)
  const [reviewing, setReviewing] = useState(false)
  // 分享面试间：候选人通过链接进入后，双方语音自动转写进会话记录；未分享时只记录面试官一侧
  const [shared, setShared] = useState(saved?.shared ?? false)
  const [talk, setTalk] = useState<Talk[]>(saved?.talk ?? [])
  const [peer, setPeer] = useState(false)
  const [peerTalking, setPeerTalking] = useState(false)
  const peerInterim = ''
  const [shareOpen, setShareOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [left, setLeft] = useState<'resume' | 'talk'>('resume')
  const [unread, setUnread] = useState(0)
  // 窗口形态：窗口 / 全屏 / 最小化（只保留呼吸的顶栏）
  const [mode, setMode] = useState<'win' | 'full' | 'min'>('win')
  const [warn, setWarn] = useState('')
  const [paused, setPaused] = useState(false)
  const right = useRef<HTMLDivElement>(null)
  const q = qs[idx]
  useEffect(() => {
    if (done || paused || locked) return
    const t = setInterval(() => {
      setSec((s) => s + 1)
      setRecs((m) => ({ ...m, [q.id]: { ...empty, ...m[q.id], secs: (m[q.id]?.secs ?? 0) + 1 } }))
    }, 1000)
    return () => clearInterval(t)
  }, [done, paused, locked, q?.id])
  // 每次变更写入本地，刷新不丢
  useEffect(() => { rooms[cid] = { ...rooms[cid], recs, sec, verdict, summary, savedAt, obs, review }; save() }, [cid, recs, sec, verdict, summary, savedAt, obs, review])
  const ch = useRef<ReturnType<typeof liveChannel>>(null)
  const addTalk = (item: Talk, broadcast = true) => {
    setTalk((l) => (l.some((x) => x.id === item.id) ? l : [...l, item]))
    if (left !== 'talk') setUnread((n) => n + 1)
    if (broadcast && shared) ch.current?.send({ type: 'talk', item })
  }
  const voice = useVoice((text) => addTalk({ id: uid(), who: '面试官', kind: 'voice', text, t: clock() }))
  // 进入面试间即开始记录面试官语音；暂停、结束或只读时停止
  useEffect(() => { if (!locked && !done && !paused) voice.start(); else voice.stop() }, [locked, done, paused])
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
    cn.send({ type: 'hello' })
    return () => cn.close()
  }, [cid])
  useEffect(() => { if (shared) ch.current?.send({ type: 'state', name: c.name, role: c.role, round: c.round, idx, total: qs.length, q: q?.q ?? '', ended: done, sec }) }, [shared, peer, idx, done, sec])
  useEffect(() => { if (shared) ch.current?.send({ type: 'level', who: '面试官', on: voice.speaking }) }, [shared, voice.speaking])
  useEffect(() => { rooms[cid] = { ...rooms[cid], talk, shared }; save() }, [talk, shared])
  useEffect(() => { if (left === 'talk') setUnread(0) }, [left, talk.length])
  const link = `${location.origin}${location.pathname}?join=${cid}`
  const share = () => { setShared(true); ch.current?.send({ type: 'hello' }) }
  const copy = () => { share(); navigator.clipboard?.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600) }).catch(() => {}) }
  const files = async (fs: File[]) => { for (const f of fs) addTalk({ id: uid(), who: '面试官', kind: 'file', text: f.name, t: clock(), file: await readFile(f) }) }
  const setWin = (m: 'win' | 'full' | 'min') => {
    if (m === 'full') document.documentElement.requestFullscreen?.().catch(() => {})
    else if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    setMode(m)
  }
  useEffect(() => {
    const f = () => setMode((m) => (document.fullscreenElement ? 'full' : m === 'full' ? 'win' : m))
    document.addEventListener('fullscreenchange', f)
    return () => document.removeEventListener('fullscreenchange', f)
  }, [])
  const touch = () => setSavedAt(now())

  const rec = (q && recs[q.id]) || empty
  const set = (patch: Partial<Rec>) => { if (locked) return; setRecs((m) => ({ ...m, [q.id]: { ...empty, ...m[q.id], ...patch } })); touch() }
  const flip = (k: 'hit' | 'asked' | 'tags', v: string) => set({ [k]: rec[k].includes(v) ? rec[k].filter((x) => x !== v) : [...rec[k], v] })
  const scored = qs.filter((x) => recs[x.id]?.score).length
  const avg = scored ? qs.reduce((a, x) => a + (recs[x.id]?.score ?? 0), 0) / scored : 0
  const move = (i: number) => { setIdx(i); setShowAns(false); setDone(false); right.current?.scrollTo({ top: 0, behavior: 'smooth' }) }
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
  const genReview = () => { setReviewing(true); setTimeout(() => { setReview(buildReview()); setReviewing(false); touch() }, 1200) }
  // 导出 Markdown 完整记录：评分、备注、参考要点、排除状态与综合评价
  const exportMd = () => {
    const excluded = c.qs.filter((x) => !qs.includes(x))
    const md = [
      `# 面试记录 · ${c.name}`, '', `- 岗位：${c.role}`, `- 轮次：${c.round} · ${c.slot}`, `- 用时：${mmss(sec)} · 已评 ${scored}/${qs.length} · 均分 ${scored ? avg.toFixed(1) : '–'}`, `- 结论：${verdict || '未选择'}`, '',
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
  const toEval = () => { setDone(true); if (!summary) setSummary(gen()) }
  const submit = () => {
    if (!verdict) return setWarn('请先选择综合结论')
    if (unscored && warn !== 'confirm') return setWarn('confirm')
    submitEvaluation(cid, avg, mmss(sec), verdict)
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

  return (
    <div className={`ws-canvas flex flex-col ${mode === 'min' ? 'min-h-screen' : 'h-screen'}`}>
      {/* 会话栏 */}
      <div className={`flex ws-bar h-16 shrink-0 items-center gap-5 px-6 text-white ${mode === 'min' ? 'ws-breathe sticky top-0 z-30' : ''}`}>
        <button onClick={() => go('back')} className="cursor-pointer text-sm text-white/55 transition-colors hover:text-white">← {go.from}</button>
        <span className="h-5 w-px bg-white/15" />
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-amber-400 text-sm font-semibold text-[#1d2939]">{c.name[0]}</span>
          <div className="leading-tight">
            <div className="text-[15px] font-semibold text-white">{c.name}</div>
            <div className="text-xs text-white/55">{c.role} · {c.round} · 面试官 王磊</div>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {/* 语音记录状态：说话时音量条起伏 */}
          <button onClick={() => voice.toggle()} disabled={locked || done} title={canTranscribe ? '面试官语音会自动转写进会话记录' : '当前浏览器不支持语音转写，仅显示音量'} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-white/80 transition-colors hover:bg-white/10 disabled:cursor-default disabled:opacity-50">
            <VoiceBars level={voice.level} on={voice.status === 'on'} />
            <span className="hidden xl:inline">{voice.status === 'on' ? (voice.speaking ? '正在记录' : '语音记录中') : voice.status === 'denied' ? '麦克风未授权' : voice.status === 'asking' ? '请求麦克风…' : '语音已关闭'}</span>
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
                  {shared && <button onClick={() => { setShared(false); setPeer(false); ch.current?.send({ type: 'state', name: c.name, role: c.role, round: c.round, idx, total: qs.length, q: '', ended: true, sec }) }} className="cursor-pointer text-slate-400 hover:text-slate-700">停止分享</button>}
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
          <button onClick={() => setPaused(!paused)} className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/15 px-3 py-1.5 text-sm tabular-nums text-white/85 transition-colors hover:bg-white/10">
            <span className={`h-2 w-2 rounded-full ${paused || done ? 'bg-white/30' : 'animate-pulse bg-red-400'}`} />{mmss(sec)}<span className="text-white/45">{paused ? '继续' : '暂停'}</span>
          </button>
          {!done && <Btn className="!bg-white !text-[#1d2939] hover:!bg-slate-100" onClick={toEval}>结束面试</Btn>}
          {/* 窗口形态 */}
          <div className="flex rounded-lg border border-white/15 p-0.5">
            {([['win', '窗口', '▢'], ['full', '全屏', '⤢'], ['min', '最小化', '—']] as const).map(([k, t, g]) => (
              <button key={k} onClick={() => setWin(k)} title={t} aria-label={t} className={`grid h-7 w-7 cursor-pointer place-items-center rounded-md text-sm transition-colors ${mode === k ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white'}`}>{g}</button>
            ))}
          </div>
        </div>
      </div>

      <div className={`flex min-h-0 flex-1 flex-col lg:flex-row ${mode === 'min' ? 'hidden' : ''}`}>
        {/* 左：可交互简历 */}
        <section className={`flex min-h-0 flex-col border-slate-200 transition-[flex-basis] duration-300 lg:border-r ${wide ? 'lg:basis-[62%]' : 'lg:basis-[46%]'} h-1/2 shrink-0 lg:h-auto`}>
          <div className="flex h-12 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-5">
            <div className="flex gap-3 text-sm">
              {([['resume', '简历'], ['talk', '会话记录']] as const).map(([k, t]) => (
                <button key={k} onClick={() => setLeft(k)} className={`relative cursor-pointer transition-colors ${left === k ? 'font-semibold text-slate-900' : 'text-slate-500 hover:text-slate-800'}`}>
                  {t}{k === 'talk' && <span className="ml-1 tabular-nums text-slate-400">{talk.length}</span>}
                  {k === 'talk' && unread > 0 && left !== 'talk' && <span className="absolute -right-2 -top-0.5 h-1.5 w-1.5 rounded-full bg-amber-400" />}
                </button>
              ))}
            </div>
            <div className={`flex rounded-md bg-slate-100 p-0.5 text-[13px] ${left === 'talk' ? 'hidden' : ''}`}>
              {([['all', '全部标注'], ['hi', '亮点'], ['risk', '疑点']] as const).map(([k, t]) => (
                <button key={k} onClick={() => setFilter(k)} className={`cursor-pointer rounded px-2.5 py-1 transition ${filter === k ? 'bg-white font-medium text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                  {t}<span className="ml-1 tabular-nums text-slate-400">{count[k]}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setWide(!wide)} className="ml-auto hidden cursor-pointer text-sm text-slate-500 hover:text-slate-900 lg:block">{wide ? '还原' : '放大简历'}</button>
          </div>
          {left === 'talk' && (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex items-center gap-3 border-b border-slate-100 bg-white px-5 py-3">
                <Speaker name="王" speaking={voice.speaking} size="h-8 w-8 text-sm" tone="bg-[#1d2939] text-white" />
                <Speaker name={c.name} speaking={peerTalking} size="h-8 w-8 text-sm" tone={peer ? 'bg-amber-400 text-[#1d2939]' : 'bg-slate-200 text-slate-500'} />
                <p className="min-w-0 flex-1 text-xs leading-5 text-slate-500">{shared ? (peer ? '候选人已进入，双方发言自动转写' : '已分享，等待候选人打开链接') : '未分享面试间：只记录你的语音，候选人发言可手动补充'}</p>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                <TalkList items={talk} me="面试官" interim={voice.interim ? { who: '面试官', text: voice.interim } : peerInterim ? { who: '候选人', text: peerInterim } : null} empty={canTranscribe ? '开口说话即可自动记录；会话记录只作为评价的补充' : '当前浏览器不支持语音转写，可用文字补充记录'} />
              </div>
              <div className="shrink-0 border-t border-slate-100 bg-white p-3">
                {!locked && <Composer onText={(text) => addTalk({ id: uid(), who: '面试官', kind: 'text', text, t: clock() })} onFiles={files} placeholder={shared ? '发送给候选人…' : '补充记录，例如候选人的回答…'} />}
              </div>
            </div>
          )}
          <div className={`min-h-0 flex-1 overflow-y-auto px-6 py-6 ${left === 'talk' ? 'hidden' : ''}`}>
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

        {/* 右：提问与记录 */}
        <section className="flex min-h-0 flex-1 flex-col bg-[#fffdf9]">
          <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-slate-200 px-4">
            {qs.map((x, i) => {
              const cur = !done && i === idx
              const s = recs[x.id]?.score
              return (
                <button key={x.id} onClick={() => move(i)} className={`relative flex shrink-0 cursor-pointer items-center gap-2 px-3 py-3.5 text-sm transition-colors duration-150 after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-amber-400 after:transition-transform after:duration-300 ${cur ? 'text-slate-900 after:scale-x-100' : 'text-slate-500 after:scale-x-0 hover:text-slate-800'}`}>
                  <span className={`grid h-5 w-5 place-items-center rounded-full text-[11px] tabular-nums ${s ? 'bg-blue-600 text-white' : cur ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>{s ?? i + 1}</span>
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
                <div className="flex items-baseline justify-between"><h1 className="text-[22px] font-semibold text-slate-900">面试评价</h1>{locked && <span className="text-sm text-slate-500">已提交 · 只读</span>}</div>
                <div className="mt-6 grid grid-cols-3 divide-x divide-slate-200 rounded-xl border border-slate-200">
                  {[['用时', mmss(sec)], ['已评题目', `${scored} / ${qs.length}`], ['平均分', scored ? avg.toFixed(1) : '–']].map(([k, v]) => (
                    <div key={k} className="px-5 py-4"><div className="text-sm text-slate-500">{k}</div><div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{v}</div></div>
                  ))}
                </div>
                <ol className="mt-8 divide-y divide-slate-100 border-y border-slate-100">
                  {qs.map((x, i) => {
                    const r = recs[x.id] ?? empty
                    return (
                      <li key={x.id}>
                        <button onClick={() => move(i)} className="flex w-full cursor-pointer gap-4 py-4 text-left hover:bg-slate-50">
                          <span className="w-6 pt-0.5 text-sm tabular-nums text-slate-400">{i + 1}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[15px] leading-6 text-slate-900">{x.q}</p>
                            <p className="mt-1 text-sm text-slate-500">{[`用时 ${mmss(r.secs)}`, `要点 ${r.hit.length}/${x.points.length}`, ...r.tags, r.note].filter(Boolean).join(' · ')}</p>
                          </div>
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
                  {!locked && <button onClick={genReview} disabled={reviewing} className="cursor-pointer text-sm text-blue-600 hover:text-blue-800 disabled:cursor-default disabled:text-slate-400">{reviewing ? '生成中…' : review ? '重新生成' : '生成综合评价'}</button>}
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
                      {review.evidence.map((id) => { const i = qs.findIndex((x) => x.id === id); return i < 0 ? null : <button key={id} onClick={() => move(i)} className="cursor-pointer rounded bg-blue-50 px-1.5 py-0.5 text-blue-700 hover:bg-blue-100">第 {i + 1} 题</button> })}
                      <span className="ml-auto">{review.at} 生成 · 辅助意见，不自动作录用决定</span>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 rounded-lg border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-400">根据已评分题目、备注与整体观察生成；未评分和已排除的题不计入。</p>
                )}

                <div className="mt-8 flex items-baseline justify-between">
                  <h2 className="text-[15px] font-semibold text-slate-900">综合评语</h2>
                  {!locked && <button onClick={() => { setSummary(gen()); touch() }} className="cursor-pointer text-sm text-slate-500 hover:text-slate-900">根据记录重新生成</button>}
                </div>
                <textarea value={summary} readOnly={locked} onChange={(e) => { setSummary(e.target.value); touch() }} rows={5} className="mt-3 w-full resize-none rounded-lg border border-slate-200 px-4 py-3 text-[15px] leading-7 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                <h2 className="mt-8 text-[15px] font-semibold text-slate-900">综合结论</h2>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {['推荐录用', '待定', '不推荐'].map((v) => (
                    <button key={v} disabled={locked} onClick={() => { setVerdict(v); setWarn(''); touch() }} className={`h-11 cursor-pointer rounded-lg border text-sm ${verdict === v ? 'border-blue-600 bg-blue-50 font-medium text-blue-800' : 'border-slate-200 text-slate-600 hover:border-slate-400'}`}>{v}</button>
                  ))}
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
            ) : (
              <>
                <Btn variant="ghost" onClick={() => move(0)}>返回题目</Btn>
                <Btn variant="ghost" onClick={exportMd}>导出记录</Btn>
                {locked ? <Btn className="ml-auto" onClick={() => go('back')}>返回{go.from}</Btn> : (
                  <>
                    <span className={`ml-auto text-sm ${warn ? 'text-amber-700' : 'text-slate-400'}`}>{warn === 'confirm' ? `还有 ${unscored} 题未评分，再次点击确认提交` : warn || (savedAt ? `已自动保存 ${savedAt}` : '')}</span>
                    <Btn variant="accent" onClick={submit}>{warn === 'confirm' ? '仍然提交' : verdict ? `提交评价：${verdict}` : '提交评价'}</Btn>
                  </>
                )}
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
