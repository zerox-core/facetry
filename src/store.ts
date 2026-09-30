import { useSyncExternalStore } from 'react'
import { candidates, history, importPool, resumes } from './data'

// 演示数据层：直接改 data.ts 导出的数组/对象，commit() 时持久化到 localStorage 并通知重渲染
const KEY = 'facetry-demo-v1'

export type Rec = { score?: number; hit: string[]; asked: string[]; tags: string[]; note: string; secs: number }
/** 综合评价：只基于已评分题目与面试官记录，evidence 为引用的题目 id；供面试官复核，不自动做录用决定 */
export type Review = { overall: string; strengths: string[]; weaknesses: string[]; nextSteps: string[]; suggestion: string; evidence: string[]; at: string }
export type Room = { recs: Record<string, Rec>; sec: number; verdict: string; summary: string; savedAt?: string; obs?: string; review?: Review; talk?: Talk[]; shared?: boolean }

// 会话记录：语音转写、文字消息与文件。只作为评价的补充材料，报告仍以评分和备注为准
export type Talk = { id: string; who: '面试官' | '候选人'; kind: 'voice' | 'text' | 'file'; text: string; t: string; file?: { name: string; size: number; url?: string } }

/** 面试间实时通道：面试官与候选人（分享链接打开）在同一浏览器的不同窗口间同步。正式版替换为 WebRTC + 信令服务 */
export type LiveMsg =
  | { type: 'state'; name: string; role: string; round: string; idx: number; total: number; q: string; ended: boolean; sec: number }
  | { type: 'talk'; item: Talk }
  | { type: 'level'; who: Talk['who']; on: boolean }
  | { type: 'join' | 'leave' | 'hello' }
export function liveChannel(cid: string, f: (m: LiveMsg) => void) {
  if (typeof BroadcastChannel === 'undefined') return { send: (_: LiveMsg) => {}, close: () => {} }
  const ch = new BroadcastChannel(`facetry-room-${cid}`)
  ch.onmessage = (e) => f(e.data)
  return { send: (m: LiveMsg) => ch.postMessage(m), close: () => ch.close() }
}

export const picks: Record<string, string[]> = {}
export const rooms: Record<string, Room> = {}
const meta = { seq: 0 }

try {
  const raw = localStorage.getItem(KEY)
  if (raw) {
    const s = JSON.parse(raw)
    candidates.splice(0, candidates.length, ...s.candidates)
    history.splice(0, history.length, ...s.history)
    Object.assign(resumes, s.resumes)
    Object.assign(picks, s.picks)
    Object.assign(rooms, s.rooms)
    meta.seq = s.seq ?? 0
  }
} catch {
  localStorage.removeItem(KEY)
}

let version = 0
const subs = new Set<() => void>()

/** 只写盘不重渲染，用于面试间里高频的记录 */
export function save() {
  localStorage.setItem(KEY, JSON.stringify({ candidates, history, resumes, picks, rooms, seq: meta.seq }))
}
export function commit() {
  save()
  version += 1
  subs.forEach((f) => f())
}
export function useStore() {
  return useSyncExternalStore((cb) => { subs.add(cb); return () => subs.delete(cb) }, () => version)
}
export function resetDemo() {
  localStorage.removeItem(KEY)
  location.reload()
}

export const findC = (id: string) => candidates.find((c) => c.id === id)!
export const pickedOf = (id: string) => picks[id] ?? findC(id).qs.map((q) => q.id)
export function setPicked(id: string, v: string[]) { picks[id] = v; commit() }

export function addQuestion(cid: string, q: string, topic: string, points: string[] = [], follow: string[] = []) {
  const id = `${cid}-m${Date.now()}`
  findC(cid).qs.push({ id, topic, diff: '中等', basis: '面试官手动添加', q, points, answer: '', follow, flag: '' })
  picks[cid] = [...pickedOf(cid), id]
  commit()
}

export function importResume(): string {
  const { c, r } = importPool[meta.seq % importPool.length]
  const id = meta.seq < importPool.length ? c.id : `${c.id}-${meta.seq}`
  meta.seq += 1
  candidates.unshift({ ...c, id, qs: c.qs.map((q) => ({ ...q, id: `${id}-${q.id}` })) })
  resumes[id] = { ...r, sections: r.sections.map((s) => ({ ...s, lines: s.lines.map((l) => (l.q ? { ...l, q: l.q.map((x) => `${id}-${x}`) } : l)) })) }
  commit()
  return id
}

export function schedule(cid: string, slot: string) { findC(cid).slot = slot; commit() }

export function submitEvaluation(cid: string, avg: number, dur: string, verdict: string) {
  const c = findC(cid)
  c.status = '已评价'
  history.unshift({ cid, id: `R-${1000 + history.length}`, name: c.name, role: c.role.replace(/（.*）/, ''), date: '2026-09-30', score: Math.round(avg * 10) / 10, dur, verdict: verdict === '推荐录用' ? '推荐' : verdict })
  commit()
}
