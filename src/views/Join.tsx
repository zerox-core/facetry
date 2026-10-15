import { useEffect, useRef, useState } from 'react'
import { findC, liveChannel, type LiveMsg, type Talk } from '../store'
import { canTranscribe, clock, readFile, uid, useVoice } from '../voice'
import { Composer, Speaker, TalkList, VoiceBars } from './live'
import { Btn, Modal } from './ui'

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

/** 候选人面试间：通过面试官分享的链接（?join=候选人 id）进入，只能看到题干与会话，看不到任何分析与评分 */
export default function Join({ cid }: { cid: string }) {
  const c = findC(cid)
  const [phase, setPhase] = useState<'lobby' | 'in' | 'left'>('lobby')
  const [media, setMedia] = useState<MediaStream | null>(null)
  const [cam, setCam] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [leaveAsk, setLeaveAsk] = useState(false)
  const [st, setSt] = useState<Extract<LiveMsg, { type: 'state' }> | null>(null)
  const [talk, setTalk] = useState<Talk[]>([])
  const [peer, setPeer] = useState(false)
  const [peerTalking, setPeerTalking] = useState(false)
  const video = useRef<HTMLVideoElement>(null)
  const ch = useRef<ReturnType<typeof liveChannel>>(null)

  const add = (item: Talk) => { setTalk((l) => [...l, item]); ch.current?.send({ type: 'talk', item }) }
  const voice = useVoice((text) => add({ id: uid(), who: '候选人', kind: 'voice', text, t: clock() }), media)

  useEffect(() => {
    if (phase !== 'in') return
    const c = liveChannel(cid, (m) => {
      if (m.type === 'state') { setSt(m); setPeer(true) }
      else if (m.type === 'talk') setTalk((l) => (l.some((x) => x.id === m.item.id) ? l : [...l, m.item]))
      else if (m.type === 'level') setPeerTalking(m.on)
      else if (m.type === 'hello') c.send({ type: 'join' })
      else if (m.type === 'leave') setPeer(false)
    })
    ch.current = c
    c.send({ type: 'join' })
    const bye = () => c.send({ type: 'leave' })
    window.addEventListener('beforeunload', bye)
    return () => { bye(); window.removeEventListener('beforeunload', bye); c.close() }
  }, [phase, cid])

  useEffect(() => { ch.current?.send({ type: 'level', who: '候选人', on: voice.speaking }) }, [voice.speaking])
  useEffect(() => { if (video.current && media) video.current.srcObject = media }, [media, cam, phase])
  useEffect(() => { if (phase === 'in' && media?.getAudioTracks().length) voice.start() }, [phase, media])

  // 先申请摄像头 + 麦克风；摄像头被拒则退回仅麦克风；都被拒仍可文字参与。请求期间禁用按钮防重复
  const enter = async () => {
    if (busy) return
    setBusy(true)
    setErr('')
    let s: MediaStream | null = null
    try { s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }); setCam(true) } catch {
      try { s = await navigator.mediaDevices.getUserMedia({ audio: true }); setErr('未获得摄像头权限，将仅使用麦克风') } catch { setErr('未获得摄像头和麦克风权限，可以用文字参与') }
    }
    setMedia(s)
    setPhase('in')
    setBusy(false)
  }
  const leave = () => { voice.stop(); media?.getTracks().forEach((t) => t.stop()); setMedia(null); setPhase('left') }
  const toggleCam = () => { const t = media?.getVideoTracks()[0]; if (t) { t.enabled = !t.enabled; setCam(t.enabled) } }
  const toggleMic = () => { const t = media?.getAudioTracks()[0]; if (!t) return; t.enabled = voice.status !== 'on'; voice.toggle() }
  const files = async (fs: File[]) => { for (const f of fs) add({ id: uid(), who: '候选人', kind: 'file', text: f.name, t: clock(), file: await readFile(f) }) }

  if (!c) return <Center title="面试间不存在" sub="链接可能已失效，请联系面试官重新分享" />
  if (phase === 'left') return <Center title="你已离开面试间" sub="感谢参与，结果会由招聘同事另行通知" action={<button onClick={() => setPhase('lobby')} className="motion-pop mt-6 h-10 cursor-pointer rounded-lg border border-base-content/15 px-4 text-sm text-base-content/80 hover:bg-base-content/10">重新进入</button>} />

  if (phase === 'lobby') return (
    <Center
      title={`${c.name}，你好`}
      sub={`${c.role} · ${c.round} · 面试官 王磊`}
      action={
        <div className="mt-8 w-full max-w-sm text-left">
          <ul className="space-y-3 text-sm text-base-content/60">
            <li>· 进入前会请求摄像头和麦克风权限</li>
            <li>· 你的发言会实时转写成文字，作为面试记录的补充</li>
            <li>· 可以发送文字、文件或图片（例如作品截图）</li>
          </ul>
          <button onClick={enter} disabled={busy} className="motion-pop mt-6 h-11 w-full cursor-pointer rounded-lg bg-neutral text-sm font-medium text-neutral-content hover:bg-neutral/90 disabled:cursor-not-allowed disabled:opacity-60">{busy ? '正在请求设备权限…' : '开启设备并进入面试间'}</button>
        </div>
      }
    />
  )

  const ended = st?.ended
  return (
    <div className="ws-bar flex h-screen flex-col text-base-content">
      <header className="flex h-14 shrink-0 items-center gap-4 border-b border-base-content/10 px-6">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-neutral text-sm font-bold text-neutral-content">F</span>
        <span className="font-semibold">面试间</span>
        <span className="text-sm text-base-content/50">{c.role} · {c.round}</span>
        <span className={`ml-auto flex items-center gap-2.5 text-sm ${peer ? 'text-base-content/80' : 'text-base-content/50'}`}><span className={`h-1.5 w-1.5 rounded-full ${peer ? 'animate-pulse bg-error' : 'bg-base-content/30'}`} />{peer ? `面试进行中 ${mmss(st?.sec ?? 0)}` : '等待面试官'}</span>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <main className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-9 p-8">
          {err && <p role="alert" className="login-fade absolute left-1/2 top-4 -translate-x-1/2 rounded-lg bg-warning/15 px-3 py-1.5 text-sm text-warning">{err}</p>}
          <div className="flex flex-col items-center gap-4">
            <Speaker name="王" speaking={peerTalking} size="h-24 w-24 text-3xl" tone="bg-base-content/10 text-base-content" />
            <div className="text-sm text-base-content/70">面试官 王磊 {peerTalking && <span className="text-success">· 正在说话</span>}</div>
          </div>
          <div key={st?.idx} className="ws-rise w-full max-w-2xl rounded-xl bg-base-content/5 px-6 py-5 ring-1 ring-base-content/10">
            {st && !ended ? (
              <>
                <div className="flex items-center justify-between text-sm text-base-content/50"><span className="tabular-nums">第 {st.idx + 1} / {st.total} 题</span><span>请听面试官提问后作答</span></div>
                <p className="mt-2 text-[22px] font-semibold leading-[1.5]">{st.q}</p>
              </>
            ) : (
              <p className="text-center text-base-content/60">{ended ? '面试已结束，感谢参与' : '面试官进入后，题目会显示在这里'}</p>
            )}
          </div>

          {/* 本人画面 */}
          <div className={`absolute bottom-24 right-6 h-32 w-48 overflow-hidden rounded-xl bg-base-200/75 ring-2 transition-colors duration-150 ${voice.speaking ? 'ring-success' : 'ring-base-content/10'}`}>
            {media?.getVideoTracks().length && cam ? <video ref={video} autoPlay muted playsInline className="h-full w-full -scale-x-100 object-cover" /> : <div className="grid h-full place-items-center"><Speaker name={c.name} speaking={voice.speaking} size="h-12 w-12 text-lg" tone="bg-base-content/10 text-base-content" /></div>}
            <span className="absolute bottom-1.5 left-2 flex items-center gap-2.5 rounded bg-base-200/75 px-1.5 py-0.5 text-[11px]">我 <VoiceBars level={voice.level} on={voice.status === 'on'} className="bg-success" /></span>
          </div>

          <div className="absolute bottom-6 flex items-center gap-3">
            <Ctl on={voice.status === 'on'} onClick={toggleMic} disabled={!media?.getAudioTracks().length}>{voice.status === 'on' ? '麦克风开' : '麦克风关'}</Ctl>
            <Ctl on={cam} onClick={toggleCam} disabled={!media?.getVideoTracks().length}>{cam ? '摄像头开' : '摄像头关'}</Ctl>
            <button onClick={() => setLeaveAsk(true)} className="motion-pop h-10 cursor-pointer rounded-full bg-error/90 px-5 text-sm font-medium text-error-content hover:bg-error">离开</button>
          </div>
        </main>

        <aside className="flex h-2/5 min-h-0 flex-col border-t border-base-content/10 lg:h-auto lg:w-[360px] lg:border-l lg:border-t-0">
          <div className="flex h-12 shrink-0 items-center justify-between px-5 text-sm"><span className="font-medium">会话</span><span className="text-xs text-base-content/50">{canTranscribe ? '语音自动转写' : '当前浏览器不支持转写'}</span></div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
            <TalkList dark items={talk} me="候选人" interim={voice.interim ? { who: '候选人', text: voice.interim } : null} empty="还没有会话内容" />
          </div>
          <div className="shrink-0 p-4 pt-0"><Composer dark onText={(text) => add({ id: uid(), who: '候选人', kind: 'text', text, t: clock() })} onFiles={files} placeholder="发送文字、文件或图片…" /></div>
        </aside>
      </div>

      {/* 离开面试间是收尾动作：二次确认后再关设备，避免误触掉线 */}
      <Modal
        open={leaveAsk}
        onClose={() => setLeaveAsk(false)}
        title="确认离开面试间？"
        sub="离开后麦克风与摄像头会立即关闭"
        footer={
          <>
            <Btn variant="ghost" onClick={() => setLeaveAsk(false)}>继续面试</Btn>
            <Btn variant="danger" onClick={() => { setLeaveAsk(false); leave() }}>确认离开</Btn>
          </>
        }
      >
        <ul className="space-y-2.5 text-sm leading-6 text-base-content/70">
          <li>· 麦克风与摄像头立即关闭，本轮语音转写停止</li>
          <li>· 已发送的文字与文件会保留在面试记录里</li>
          <li>· 需要继续时可由面试官重新分享链接，或在本页重新进入</li>
        </ul>
      </Modal>
    </div>
  )
}

function Ctl({ on, children, onClick, disabled }: { on: boolean; children: string; onClick: () => void; disabled?: boolean }) {
  return <button onClick={onClick} disabled={disabled} aria-pressed={on} className={`motion-pop h-10 cursor-pointer rounded-full px-4 text-sm disabled:cursor-not-allowed disabled:opacity-40 ${on ? 'bg-base-content/10 text-base-content hover:bg-base-content/15' : 'bg-base-content text-base-100 hover:bg-base-content/90'}`}>{children}</button>
}

function Center({ title, sub, action }: { title: string; sub: string; action?: React.ReactNode }) {
  return (
    <div className="ws-bar flex min-h-screen flex-col items-center justify-center px-6 text-center text-base-content">
      <span className="grid h-10 w-10 place-items-center rounded-lg bg-neutral text-lg font-bold text-neutral-content">F</span>
      <h1 className="ws-rise mt-6 text-2xl font-semibold">{title}</h1>
      <p className="ws-rise mt-2 text-base-content/60 [--i:1]">{sub}</p>
      {action}
    </div>
  )
}
