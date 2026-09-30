import { useEffect, useRef, useState } from 'react'

type SR = { lang: string; continuous: boolean; interimResults: boolean; start(): void; stop(): void; onresult: ((e: any) => void) | null; onend: (() => void) | null; onerror: ((e: any) => void) | null }
const SRClass: (new () => SR) | undefined = typeof window !== 'undefined' ? ((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition) : undefined
export const canTranscribe = !!SRClass

/**
 * 麦克风：实时音量（驱动说话动效）+ 浏览器语音转写。
 * 权限被拒或浏览器不支持转写时不抛错，通过 status 告知界面，改用文字输入兜底。
 */
export function useVoice(onFinal: (text: string) => void, stream?: MediaStream | null) {
  const [status, setStatus] = useState<'off' | 'asking' | 'on' | 'denied'>('off')
  const [level, setLevel] = useState(0)
  const [interim, setInterim] = useState('')
  const ref = useRef<{ stream?: MediaStream; own?: boolean; ctx?: AudioContext; raf?: number; sr?: SR; want?: boolean }>({})
  const cb = useRef(onFinal)
  cb.current = onFinal

  const stop = () => {
    const r = ref.current
    r.want = false
    if (r.raf) cancelAnimationFrame(r.raf)
    r.sr?.stop()
    r.ctx?.close().catch(() => {})
    if (r.own) r.stream?.getTracks().forEach((t) => t.stop())
    ref.current = {}
    setLevel(0)
    setInterim('')
    setStatus('off')
  }

  const start = async () => {
    if (ref.current.want) return
    setStatus('asking')
    try {
      const own = !stream
      const s = stream ?? (await navigator.mediaDevices.getUserMedia({ audio: true }))
      const ctx = new AudioContext()
      const an = ctx.createAnalyser()
      an.fftSize = 512
      ctx.createMediaStreamSource(s).connect(an)
      const buf = new Uint8Array(an.fftSize)
      let last = 0
      const tick = (t: number) => {
        an.getByteTimeDomainData(buf)
        let sum = 0
        for (const v of buf) sum += (v - 128) ** 2
        const rms = Math.min(1, Math.sqrt(sum / buf.length) / 40)
        // 约 20fps 更新即可，避免整页高频重渲染
        if (t - last > 50) { setLevel((p) => p * 0.5 + rms * 0.5); last = t }
        ref.current.raf = requestAnimationFrame(tick)
      }
      ref.current = { stream: s, own, ctx, want: true, raf: requestAnimationFrame(tick) }
      if (SRClass) {
        const sr = new SRClass()
        sr.lang = 'zh-CN'
        sr.continuous = true
        sr.interimResults = true
        sr.onresult = (e) => {
          let tmp = ''
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const r = e.results[i]
            if (r.isFinal) { const text = r[0].transcript.trim(); if (text) cb.current(text) } else tmp += r[0].transcript
          }
          setInterim(tmp)
        }
        // 浏览器会在静音一段时间后自动结束，保持会话持续转写
        sr.onend = () => { if (ref.current.want) try { sr.start() } catch { /* 已在运行 */ } }
        sr.onerror = () => {}
        sr.start()
        ref.current.sr = sr
      }
      setStatus('on')
    } catch {
      setStatus('denied')
    }
  }

  useEffect(() => stop, [])
  return { status, level, interim, speaking: level > 0.12, start, stop, toggle: () => (ref.current.want ? stop() : start()) }
}

export const clock = () => new Date().toLocaleTimeString('zh-CN', { hour12: false })
export const uid = () => Math.random().toString(36).slice(2, 10)
export const fmtSize = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`)

/** 读取上传文件：图片转为 dataURL 以便预览与跨窗口同步（限 2 MB），其余只保留文件名与大小 */
export function readFile(f: File): Promise<{ name: string; size: number; url?: string }> {
  return new Promise((ok) => {
    if (!f.type.startsWith('image/') || f.size > 2 * 1024 * 1024) return ok({ name: f.name, size: f.size })
    const r = new FileReader()
    r.onload = () => ok({ name: f.name, size: f.size, url: String(r.result) })
    r.readAsDataURL(f)
  })
}
