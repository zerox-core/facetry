import type React from 'react'
import { useState } from 'react'
import { candidates, resumes } from '../data'
import { importResume, schedule } from '../store'
import type { Go } from '../App'
import { Btn } from './ui'

const STEPS = ['上传文件', '提取基本信息与经历', '比对岗位要求', '标注亮点与疑点', '生成定制题目']
const statusCls: Record<string, string> = { 待面试: 'bg-blue-50 text-blue-700', 待评价: 'bg-amber-50 text-amber-700', 已评价: 'bg-slate-100 text-slate-600' }
const SLOTS = ['今天 17:00', '明天 10:00', '明天 14:30', '10-08 15:00']

export default function Candidates({ go }: { go: Go }) {
  const [step, setStep] = useState(-1)
  const [fresh, setFresh] = useState<string>()
  const importing = step >= 0
  const [err, setErr] = useState('')
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

  return (
    <div>
      <div className="ws-rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">候选人</h1>
          <p className="mt-1.5 text-[15px] text-slate-500">由招聘系统同步，简历导入后自动解析并生成定制题目 · 支持 PDF、DOCX、TXT、图片，≤ 20 MB</p>
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
              <div className="mt-0.5 text-sm text-slate-600">匹配 {n.match}% · 亮点 {n.highlights.length} · 待核实 {n.risks.length} · {n.qs.length} 道定制题</div>
            </div>
            <Btn onClick={() => go('analysis', n.id)}>查看分析</Btn>
          </div>
        )
      })()}

      <div className="ws-rise [--i:2] mt-6 overflow-x-auto ws-paper rounded-xl">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead><tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500">
            <th className="px-5 py-2.5 font-medium">候选人</th><th className="font-medium">应聘岗位</th><th className="font-medium">来源</th><th className="font-medium">简历匹配</th><th className="font-medium">面试安排</th><th className="font-medium">状态</th><th className="px-5" />
          </tr></thead>
          <tbody>
            {candidates.map((c) => (
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
                <td className="tabular-nums text-slate-600" onClick={(e) => c.slot === '待安排' && e.stopPropagation()}>
                  {c.slot === '待安排' ? (
                    <select defaultValue="" onChange={(e) => schedule(c.id, e.target.value)} className="h-8 cursor-pointer rounded-md border border-dashed border-slate-300 bg-white px-2 text-sm text-slate-600 outline-none hover:border-slate-400 focus:border-blue-500">
                      <option value="" disabled>安排{c.round}…</option>
                      {SLOTS.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  ) : `${c.slot} · ${c.round}`}
                </td>
                <td><span className={`rounded px-2 py-0.5 text-xs ${statusCls[c.status]}`}>{c.status}</span></td>
                <td className="px-5 text-right" onClick={(e) => e.stopPropagation()}><Btn variant="ghost" onClick={() => go('room', c.id)}>面试间</Btn></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
