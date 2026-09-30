import { useEffect, useRef, useState } from 'react'
import type { Talk } from '../store'
import { fmtSize } from '../voice'

/** 音量条：5 根，随实时音量起伏；静音时保持低位 */
export function VoiceBars({ level, on = true, className = 'bg-emerald-400' }: { level: number; on?: boolean; className?: string }) {
  return (
    <span className="inline-flex h-4 items-center gap-[3px]" aria-hidden>
      {[0.55, 0.85, 1, 0.8, 0.5].map((k, i) => (
        <span key={i} className={`w-[3px] rounded-full transition-[height] duration-100 ${on ? className : 'bg-white/25'}`} style={{ height: on ? `${Math.max(3, Math.min(16, 3 + level * 26 * k))}px` : '3px' }} />
      ))}
    </span>
  )
}

/** 说话者头像：说话时外圈扩散声波 */
export function Speaker({ name, speaking, size = 'h-16 w-16 text-xl', tone = 'bg-amber-400 text-[#1d2939]' }: { name: string; speaking: boolean; size?: string; tone?: string }) {
  return (
    <span className={`relative grid shrink-0 place-items-center rounded-full font-semibold ${size} ${tone}`}>
      {speaking && <><span className="voice-ring absolute inset-0 rounded-full ring-2 ring-emerald-400" /><span className="voice-ring absolute inset-0 rounded-full ring-2 ring-emerald-400 [animation-delay:.6s]" /></>}
      <span className={`absolute -inset-1 rounded-full ring-2 transition-colors duration-150 ${speaking ? 'ring-emerald-400' : 'ring-transparent'}`} />
      {name[0]}
    </span>
  )
}

/** 会话流：语音转写、文字消息与文件。me 决定哪一方靠右 */
export function TalkList({ items, me, interim, dark = false, empty }: { items: Talk[]; me: Talk['who']; interim?: { who: Talk['who']; text: string } | null; dark?: boolean; empty: string }) {
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => { end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }) }, [items.length, interim?.text])
  const sub = dark ? 'text-white/40' : 'text-slate-400'
  if (!items.length && !interim?.text) return <p className={`px-2 py-10 text-center text-sm ${sub}`}>{empty}</p>
  return (
    <div className="space-y-3">
      {items.map((m) => {
        const mine = m.who === me
        const bubble = mine
          ? dark ? 'bg-amber-400 text-[#1d2939]' : 'bg-[#1d2939] text-white'
          : dark ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-800'
        return (
          <div key={m.id} className={`login-fade flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
            <span className={`mb-1 text-[11px] ${sub}`}>{m.who} · {m.t}{m.kind === 'voice' && ' · 语音转写'}</span>
            {m.kind === 'file' && m.file ? (
              m.file.url
                ? <img src={m.file.url} alt={m.file.name} className="max-h-40 max-w-[220px] rounded-lg object-cover" />
                : <span className={`flex max-w-[260px] items-center gap-2 rounded-lg px-3 py-2 text-sm ${bubble}`}><span className="rounded bg-black/10 px-1.5 py-0.5 text-[11px]">{m.file.name.split('.').pop()?.toUpperCase()}</span><span className="truncate">{m.file.name}</span><span className="shrink-0 opacity-60">{fmtSize(m.file.size)}</span></span>
            ) : (
              <p className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-6 ${bubble}`}>{m.text}</p>
            )}
          </div>
        )
      })}
      {interim?.text && (
        <div className={`flex flex-col ${interim.who === me ? 'items-end' : 'items-start'}`}>
          <span className={`mb-1 text-[11px] ${sub}`}>{interim.who} · 正在识别…</span>
          <p className={`max-w-[85%] rounded-lg border border-dashed px-3 py-2 text-sm leading-6 ${dark ? 'border-white/20 text-white/60' : 'border-slate-300 text-slate-500'}`}>{interim.text}</p>
        </div>
      )}
      <div ref={end} />
    </div>
  )
}

/** 输入区：文字 + 上传文件或图片 */
export function Composer({ onText, onFiles, dark = false, placeholder = '输入文字消息…' }: { onText: (t: string) => void; onFiles: (f: File[]) => void; dark?: boolean; placeholder?: string }) {
  const [v, setV] = useState('')
  const send = () => { if (v.trim()) { onText(v.trim()); setV('') } }
  const box = dark ? 'border-white/15 bg-white/5 text-white placeholder:text-white/35 focus-within:border-amber-400/60' : 'border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus-within:border-blue-500'
  return (
    <div className={`flex items-end gap-2 rounded-lg border px-2 py-1.5 transition-colors ${box}`}>
      <label title="上传文件或图片" className={`grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-md text-lg transition-colors ${dark ? 'text-white/60 hover:bg-white/10' : 'text-slate-500 hover:bg-slate-100'}`}>
        +
        <input type="file" multiple accept="image/*,.pdf,.doc,.docx,.txt,.md,.zip" className="sr-only" onChange={(e) => { onFiles([...(e.target.files ?? [])]); e.target.value = '' }} />
      </label>
      <textarea value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} rows={1} placeholder={placeholder} className="max-h-24 min-h-8 flex-1 resize-none bg-transparent py-1 text-sm leading-6 outline-none" />
      <button onClick={send} disabled={!v.trim()} className={`ws-press h-8 shrink-0 cursor-pointer rounded-md px-3 text-sm font-medium disabled:cursor-default disabled:opacity-40 ${dark ? 'bg-amber-400 text-[#1d2939]' : 'bg-blue-600 text-white'}`}>发送</button>
    </div>
  )
}
