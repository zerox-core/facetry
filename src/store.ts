import { useSyncExternalStore } from 'react'
import { bank, bankCats, candidates, history, importPool, resumes, TODAY } from './data'

// 演示数据层：直接改 data.ts 导出的数组/对象，commit() 时持久化到 localStorage 并通知重渲染
// v2：候选人状态机 + ISO 时间格式 + 题库结构升级，旧 KEY 的缓存数据格式不兼容，直接换新 KEY 丢弃
const KEY = 'facetry-demo-v2'

export type Rec = { score?: number; hit: string[]; asked: string[]; tags: string[]; note: string; secs: number }
/** 综合评价：只基于已评分题目与面试官记录，evidence 为引用的题目 id；供面试官复核，不自动做录用决定 */
export type Review = { overall: string; strengths: string[]; weaknesses: string[]; nextSteps: string[]; suggestion: string; evidence: string[]; at: string }
// 计时为「累计秒数 + 运行段起点时间戳」模型：sec 为已结算秒数，since 为当前运行段开始的 epoch ms（暂停/未开始为 null）。
// 离开面试间后计时在后台继续（since 保持），悬浮入口与面试间用同一公式 elapsedOf 还原已进行时长。
export type Room = {
  recs: Record<string, Rec>; sec: number; verdict: string; summary: string
  savedAt?: string; obs?: string; review?: Review; talk?: Talk[]; shared?: boolean
  entered?: boolean; paused?: boolean; since?: number | null; micOn?: boolean; camOn?: boolean; winMode?: 'min' | 'win' | 'full'
}

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
    if (s.bank) bank.splice(0, bank.length, ...s.bank)
    if (s.bankCats) bankCats.splice(0, bankCats.length, ...s.bankCats)
    meta.seq = s.seq ?? 0
  }
} catch {
  localStorage.removeItem(KEY)
}

let version = 0
const subs = new Set<() => void>()

/** 只写盘不重渲染，用于面试间里高频的记录 */
export function save() {
  localStorage.setItem(KEY, JSON.stringify({ candidates, history, resumes, picks, rooms, bank, bankCats, seq: meta.seq }))
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

/** 面试已进行时长（秒）：已结算的 sec + 当前运行段（since 起）至今 */
export const elapsedOf = (r?: Room) => Math.max(0, Math.floor((r?.sec ?? 0) + (r?.since ? (Date.now() - r.since) / 1000 : 0)))
/** 正在后台进行的面试：已进入、运行中（未暂停）、未结束、候选人未到面后阶段。工作台的悬浮入口依赖它 */
export const runningRoomId = () =>
  candidates.find((c) => {
    const r = rooms[c.id]
    return !!(r?.entered && !r.paused && r.since != null && !r.verdict && !['跟进中', '已结束', '已评价'].includes(c.status))
  })?.id

// —— 面试安排：slot 统一为 'YYYY-MM-DD HH:mm'，未约面为 '待安排' ——
export const slotDate = (slot: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(slot)
  return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : null
}
const todayD = () => { const [y, mo, d] = TODAY.split('-').map(Number); return new Date(y, mo - 1, d) }
/** 展示用：今天 14:30 / 明天 16:00 / 10-08 15:00；未约面原样返回 */
export const slotLabel = (slot: string): string => {
  const d = slotDate(slot)
  if (!d) return slot
  const t = slot.slice(11)
  const diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - todayD().getTime()) / 86400000)
  return diff === 0 ? `今天 ${t}` : diff === 1 ? `明天 ${t}` : `${slot.slice(5, 10)} ${t}`
}
/** 安排面试：写入时间；待约面的候选人自动进入待面试 */
export function schedule(cid: string, slot: string) {
  const c = findC(cid)
  c.slot = slot
  if (c.status === '待约面') c.status = '待面试'
  commit()
}
/** 状态流转：跟进中 ↔ 已结束（发 offer / 流程关闭）等，由面试官在结果页操作 */
export function setStatus(cid: string, status: string) { findC(cid).status = status; commit() }

/** 手动录入题目（候选人分析页与题库页共用） */
export function addQuestion(cid: string, q: { q: string; topic: string; diff?: string; basis?: string; points?: string[]; answer?: string; follow?: string[]; flag?: string }) {
  const id = `${cid}-m${Date.now()}`
  findC(cid).qs.push({ id, topic: q.topic, diff: q.diff ?? '中等', basis: q.basis ?? '面试官手动添加', q: q.q, points: q.points ?? [], answer: q.answer ?? '', follow: q.follow ?? [], flag: q.flag ?? '' })
  picks[cid] = [...pickedOf(cid), id]
  commit()
}

/** 题库：手动录入一题（完整结构） */
export function addBankItem(item: { cat: string; q: string; tag: string; diff: string; points: string[]; answer: string; follow: string[]; flag: string }) {
  bank.unshift({ id: `b${Date.now()}`, hot: '0', ...item })
  commit()
}
/** 题库：新建自定义分类 */
export function addBankCat(name: string) {
  const n = name.trim()
  if (n && !bankCats.includes(n)) { bankCats.push(n); commit() }
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

/** 提交评价：结果从此不可修改，候选人进入「跟进中」（过渡态，可能二面 / 等 offer） */
export function submitEvaluation(cid: string, avg: number, dur: string, verdict: string) {
  const c = findC(cid)
  c.status = '跟进中'
  // 结算计时并停表：面试正常结束，后台悬浮入口随之消失
  const room = rooms[cid]
  if (room) { room.sec = elapsedOf(room); room.since = null; room.paused = false }
  history.unshift({ cid, id: `R-${1000 + history.length}`, name: c.name, role: c.role.replace(/（.*）/, ''), date: TODAY, score: Math.round(avg * 10) / 10, dur, verdict: verdict === '推荐录用' ? '推荐' : verdict })
  commit()
}

/** 生成 / 重新生成综合评价：可在面试间评价页与结果分析页随时调用；只基于已保存的评分与记录 */
export function buildReviewFor(cid: string): Review | undefined {
  const c = findC(cid)
  const room = rooms[cid]
  if (!c || !room) return undefined
  const picked = pickedOf(cid)
  const qs = c.qs.filter((q) => !picked.length || picked.includes(q.id))
  const recs = room.recs
  const obs = room.obs ?? ''
  const rated = qs.filter((x) => recs[x.id]?.score)
  const scored = rated.length
  const avg = scored ? rated.reduce((a, x) => a + recs[x.id].score!, 0) / scored : 0
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
    at: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
  }
}
