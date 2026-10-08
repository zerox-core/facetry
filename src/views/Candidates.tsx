import type React from 'react'
import { useState } from 'react'
import { candidates, resumes, STATUS, TODAY } from '../data'
import { importResume, schedule, slotLabel } from '../store'
import type { Go } from '../App'
import { Btn } from './ui'

const STEPS = ['上传文件', '提取基本信息与经历', '比对岗位要求', '标注亮点与疑点', '生成定制题目']
const statusCls: Record<string, string> = { 待约面: 'bg-slate-100 text-slate-600', 待面试: 'bg-blue-50 text-blue-700', 待评价: 'bg-amber-50 text-amber-700', 跟进中: 'bg-emerald-50 text-emerald-700', 已结束: 'bg-slate-100 text-slate-500' }
const ROLES = ['前端', '后端', '算法', '产品']
const roleOf = (role: string) => ROLES.find((r) => role.includes(r)) ?? '其他'
// 快速可选场次：基于演示「今天」推算
const [y, m, d] = TODAY.split('-').map(Number)
const isoDay = (offset: number) => { const t = new Date(y, m - 1, d + offset); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}` }
const QUICK = [[`今天 17:00`, `${isoDay(0)} 17:00`], [`明天 10:00`, `${isoDay(1)} 10:00`], [`明天 14:30`, `${isoDay(1)} 14:30`], [`10-08 15:00`, '2026-10-08 15:00']] as const

export default function Candidates({ go }: { go: Go }) {
  const [step, setStep] = useState(-1)
  const [fresh, setFresh] = useState<string>()
  const importing = step >= 0
  const [err, setErr] = useState('')
  const [kw, setKw] = useState('')
  const [role, setRole] = useState('全部')
  const [st, setSt] = useState('全部')
  const [schedFor, setSchedFor] = useState<string>() // 正在安排日程的候选人 id
  const [date, setDate] = useState(isoDay(1))
  const [time, setTime] = useState('10:00')

  // 与正式服务一致的文件校验：PDF / DOCX / TXT / 图片，≤ 20 MB
  const run = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (!/\.(pdf|docx|txt|png|jpe?g)$/i.test(f.name)) return setErr(`不支持「${f.name}」，请上传 PDF、DOCX、TXT、PNG 或 JPG`)
    if (f.size > 20 * 1024 * 1024) return setErr(`「${f.name}」超过 20 MB`)
    setErr('')
    let i = 0
    setStep(0)
    setFresh(undefined)
    const t = setInterval(() => {
      i += 1
      if (i < STEPS.length) return setStep(i)
      clearInterval(t)
      setFresh(importResume())
      setStep(-1)
    }, 700)
  }

  const list = candidates.filter((c) =>
    (st === '全部' || c.status === st) &&
    (role === '全部' || roleOf(c.role) === role) &&
    (!kw || c.name.includes(kw) || c.role.includes(kw) || resumes[c.id]?.file.includes(kw)),
  )
  const schedC = schedFor ? candidates.find((c) => c.id === schedFor) : undefined
  const confirmSchedule = (slot: string) => { if (schedFor) schedule(schedFor, slot); setSchedFor(undefined) }

  return (
    <div>
      <div className="ws-rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">候选人</h1>
        </div>
        <label className={`inline-flex h-10 cursor-pointer items-center rounded-lg px-4 text-sm font-medium text-white ${importing ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}>
          {importing ? '正在解析简历…' : '导入简历'}
          <input type="file" accept=".pdf,.docx,.txt,.png,.jpg,.jpeg" className="sr-only" disabled={importing} onChange={run} />
        </label>
      </div>

      {err && <p className="login-fade mt-4 rounded-lg bg-amber-50 px-4 py-2.5 text-sm text-amber-800">{err}</p>}
      {importing && (
        <div className="ws-rise mt-6 ws-paper rounded-xl px-5 py-4">
          <div className="text-[15px] font-medium text-slate-900">正在分析简历</div>
          <ol className="mt-3 grid gap-2 sm:grid-cols-5">
            {STEPS.map((s, i) => (
              <li key={s} className="text-sm">
                <div className={`h-1 rounded-full transition-colors ${i < step ? 'bg-blue-600' : i === step ? 'animate-pulse bg-blue-300' : 'bg-slate-100'}`} />
                <div className={`mt-2 ${i <= step ? 'text-slate-800' : 'text-slate-400'}`}>{s}</div>
              </li>
            ))}
          </ol>
        </div>
      )}
      {fresh && !importing && (() => {
        const n = candidates.find((c) => c.id === fresh)!
        return (
          <div className="mt-6 flex flex-wrap items-center gap-4 rounded-xl border border-blue-200 bg-blue-50 px-5 py-4">
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-medium text-slate-900">已生成候选人：{n.name} · {n.role}</div>
              <div className="mt-0.5 text-sm text-slate-600">匹配 {n.match}% · 亮点 {n.highlights.length} · 待核实 {n.risks.length} · {n.qs.length} 道定制题 · 待约面</div>
            </div>
            <Btn onClick={() => go('analysis', n.id)}>查看分析</Btn>
          </div>
        )
      })()}

      {/* 搜索与筛选 */}
      <div className="ws-rise [--i:1] mt-6 flex flex-wrap items-center gap-2">
        <input value={kw} onChange={(e) => setKw(e.target.value)} placeholder="搜索姓名 / 岗位 / 简历文件…" className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-600 sm:w-56" />
        <span className="mx-1 hidden h-4 w-px bg-slate-200 sm:inline" />
        {['全部', ...ROLES].map((r) => (
          <button key={r} onClick={() => setRole(r)} className={`cursor-pointer rounded-full border px-3 py-1 text-sm transition ${role === r ? 'border-[#1d2939] bg-[#1d2939] text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>{r}</button>
        ))}
        <span className="mx-1 hidden h-4 w-px bg-slate-200 sm:inline" />
        {['全部', ...STATUS].map((s) => (
          <button key={s} onClick={() => setSt(s)} className={`cursor-pointer rounded-full border px-3 py-1 text-sm transition ${st === s ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>{s}</button>
        ))}
      </div>

      <div className="ws-rise [--i:2] mt-4 overflow-x-auto ws-paper rounded-xl">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead><tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500">
            <th className="px-5 py-2.5 font-medium">候选人</th><th className="font-medium">应聘岗位</th><th className="font-medium">来源</th><th className="font-medium">简历匹配</th><th className="font-medium">面试安排</th><th className="font-medium">状态</th><th className="px-5 text-right font-medium">操作</th>
          </tr></thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id} onClick={() => go('analysis', c.id)} className={`cursor-pointer border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50 ${fresh === c.id ? 'bg-blue-50/50' : ''}`}>
                <td className="px-5 py-4">
                  <div className="font-medium text-slate-900">{c.name}{fresh === c.id && <span className="ml-2 rounded bg-blue-600 px-1.5 py-0.5 text-[11px] font-normal text-white">新</span>}</div>
                  <div className="mt-0.5 text-xs text-slate-400">{resumes[c.id].file}</div>
                </td>
                <td className="text-slate-700">{c.role}<div className="text-xs text-slate-400">{c.exp} · {c.edu}</div></td>
                <td className="text-slate-600">{c.source}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${c.match}%` }} /></div>
                    <span className="tabular-nums text-slate-700">{c.match}%</span>
                  </div>
                </td>
                <td className="tabular-nums text-slate-600">
                  {c.slot === '待安排' ? <span className="text-slate-400">待安排 · {c.round}</span> : `${slotLabel(c.slot)} · ${c.round}`}
                </td>
                <td><span className={`rounded px-2 py-0.5 text-xs ${statusCls[c.status]}`}>{c.status}</span></td>
                <td className="px-5 text-right" onClick={(e) => e.stopPropagation()}>
                  {c.status === '待约面' && <Btn className="!h-8 !px-3" onClick={() => { setSchedFor(c.id); setDate(isoDay(1)); setTime('10:00') }}>加入日程</Btn>}
                  {c.status === '待面试' && <Btn className="!h-8 !px-3" variant="ghost" onClick={() => { setSchedFor(c.id); setDate(c.slot.slice(0, 10)); setTime(c.slot.slice(11)) }}>改期</Btn>}
                  {c.status === '待评价' && <Btn className="!h-8 !px-3" variant="ghost" onClick={() => go('room', c.id)}>去评价</Btn>}
                  {['跟进中', '已结束'].includes(c.status) && <Btn className="!h-8 !px-3" variant="ghost" onClick={() => go('result', c.id)}>看结果</Btn>}
                </td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan={7} className="px-5 py-10 text-center text-sm text-slate-400">没有符合条件的候选人</td></tr>}
          </tbody>
        </table>
      </div>

      {/* 加入日程 / 改期 */}
      {schedC && (
        <div className="ws-scrim fixed inset-0 z-50 grid place-items-center px-4" onClick={() => setSchedFor(undefined)}>
          <div className="login-fade w-full max-w-md ws-paper rounded-xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold text-slate-900">{schedC.status === '待约面' ? '加入日程' : '调整时间'}</h2>
              <button onClick={() => setSchedFor(undefined)} className="cursor-pointer text-sm text-slate-500 hover:text-slate-900">取消</button>
            </div>
            <p className="mt-1.5 text-sm text-slate-500">{schedC.name} · {schedC.role} · {schedC.round}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {QUICK.map(([label, v]) => {
                const cur = `${date} ${time}` === v
                return <button key={v} onClick={() => { setDate(v.slice(0, 10)); setTime(v.slice(11)) }} className={`cursor-pointer rounded-lg border px-3 py-2 text-sm tabular-nums transition ${cur ? 'border-blue-600 bg-blue-50 font-medium text-blue-800' : 'border-slate-200 text-slate-600 hover:border-slate-400'}`}>{label}</button>
              })}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <input type="date" value={date} min={isoDay(0)} onChange={(e) => setDate(e.target.value)} className="h-10 rounded-lg border border-slate-200 px-3 text-sm tabular-nums outline-none focus:border-blue-600" />
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-10 rounded-lg border border-slate-200 px-3 text-sm tabular-nums outline-none focus:border-blue-600" />
            </div>
            <div className="mt-5 flex justify-end">
              <Btn variant="accent" onClick={() => confirmSchedule(`${date} ${time}`)}>确认安排 · {slotLabel(`${date} ${time}`)}</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
