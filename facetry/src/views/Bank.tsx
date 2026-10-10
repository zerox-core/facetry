import type React from 'react'
import { useEffect, useState } from 'react'
import { api } from '../api'
import { bankSearchCls, filterBank, PartCapsules } from '../components/BankBits'
import { Chip } from '../components/Chip'
import { ConfirmModal } from '../components/Modal'
import { toast } from '../components/Toast'
import { Select } from '../components/Select'
import { Btn, Card, SectionHead, Spinner } from '../components/ui'
import type { BankQuestion, BankQuestionInput, GeneratedQuestion, JobDescription } from '../types'
import { invalidateBank, shortPartName, useBank } from './shared'

const rise = (i: number) => ({ '--i': i } as React.CSSProperties)
const field =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
const lab = 'text-xs font-medium text-slate-600'

type FormState = { part: string; newPart: string; title: string; q: string; answer: string; material: string; jdId: string }
const emptyForm: FormState = { part: '', newPart: '', title: '', q: '', answer: '', material: '', jdId: '' }

/** AI 出题弹窗：选岗位 JD（或粘贴 JD）+ 自述要求 → 生成 → 勾选存入题库 */
function GenerateModal({
  initialJdId,
  parts,
  onClose,
  onSaved,
}: {
  initialJdId?: string
  parts: { key: string; name: string }[]
  onClose: () => void
  onSaved: (jdId: string) => void
}) {
  const [jds, setJds] = useState<JobDescription[]>([])
  const [jdId, setJdId] = useState(initialJdId || '')
  const [jdText, setJdText] = useState('')
  const [requirements, setRequirements] = useState('')
  const [count, setCount] = useState(5)
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<GeneratedQuestion[] | null>(null)
  const [checked, setChecked] = useState<Set<number>>(new Set())
  const [partSel, setPartSel] = useState<Record<number, string>>({})
  const [partNew, setPartNew] = useState<Record<number, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    void api
      .listJds()
      .then((r) => setJds(r.jds))
      .catch(() => {})
  }, [])

  const selectedJd = jds.find((j) => j.id === jdId)

  const generate = async () => {
    if (!jdId && !jdText.trim()) {
      toast('请选择岗位 JD 或粘贴 JD 内容')
      return
    }
    setBusy(true)
    setResults(null)
    try {
      const r = await api.generateBank({ jdId: jdId || undefined, jdText: jdId ? undefined : jdText.trim(), requirements: requirements.trim(), count })
      setResults(r.questions)
      setChecked(new Set(r.questions.map((_, i) => i)))
      // 分类：模型匹配到现有分类则预选；提议新分类则选「新分类」并带上建议名
      setPartSel(Object.fromEntries(r.questions.map((q, i) => [i, q.part || (q.partName ? '__SUGGESTED__' : 'CUST')])))
      setPartNew(Object.fromEntries(r.questions.map((q, i) => [i, q.partName || ''])))
    } catch (e) {
      toast(e instanceof Error ? e.message : '生成失败，请重试')
    } finally {
      setBusy(false)
    }
  }

  const saveSelected = async () => {
    if (!results) return
    const picked = results.filter((_, i) => checked.has(i))
    if (!picked.length) {
      toast('请勾选要保存的题目')
      return
    }
    setSaving(true)
    let ok = 0
    for (const q of picked.map((q) => ({ ...q, i: results.indexOf(q) }))) {
      try {
        const sel = partSel[q.i] ?? 'CUST'
        const part = sel === '__SUGGESTED__' || sel === '__NEW__' ? (partNew[q.i] || '').trim() : sel
        await api.addBankQuestion({ part, title: q.title, q: q.q, answer: q.answer, material: q.material || undefined, jdId: q.jdId || undefined })
        ok++
      } catch (e) {
        toast(e instanceof Error ? e.message : '保存失败，请重试')
      }
    }
    setSaving(false)
    invalidateBank()
    toast(`已保存 ${ok} 题到题库`)
    onSaved(jdId)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-[#1d2939]/50" onClick={onClose} />
      <div className="ws-paper login-fade relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl" role="dialog" aria-modal="true">
        <div className="flex items-center justify-between px-5 pt-4">
          <h3 className="text-base font-semibold text-slate-900">AI 生成题目</h3>
          <button type="button" onClick={onClose} aria-label="关闭" className="cursor-pointer text-slate-400 hover:text-slate-700">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12 M18 6L6 18" /></svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
          <label className={`block ${lab}`}>
            岗位 JD
            <div className="mt-1">
              <Select
                value={jdId}
                placeholder="— 粘贴 JD 内容 —"
                onChange={setJdId}
                options={[{ value: '', label: '— 粘贴 JD 内容 —' }, ...jds.map((j) => ({ value: j.id, label: j.title, hint: j.company || undefined }))]}
              />
            </div>
          </label>
          {!jdId && (
            <label className={`block ${lab}`}>
              JD 内容
              <textarea value={jdText} onChange={(e) => setJdText(e.target.value)} rows={5} placeholder="粘贴岗位 JD 全文…" className={`mt-1 ${field}`} />
            </label>
          )}
          {selectedJd && <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500 line-clamp-3">{selectedJd.content}</p>}
          <label className={`block ${lab}`}>
            出题要求（可选）
            <textarea value={requirements} onChange={(e) => setRequirements(e.target.value)} rows={2} placeholder="例如：偏工程实践，关注 RAG 与 Agent，难度中等" className={`mt-1 resize-none ${field}`} />
          </label>
          <div className={`flex items-center gap-3 ${lab}`}>
            题目数量
            <input type="range" min={1} max={10} value={count} onChange={(e) => setCount(Number(e.target.value))} className="flex-1 accent-blue-600" />
            <span className="w-6 text-center text-sm tabular-nums text-slate-900">{count}</span>
          </div>
          {busy && (
            <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2.5 text-sm text-blue-700">
              <Spinner /> 正在生成题目，大约需要几十秒…
            </div>
          )}
          {results && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-500">生成 {results.length} 题，勾选后存入题库（存入你的最小用户组，组内共享）</p>
              {results.map((q, i) => (
                <div key={i} className="rounded-lg bg-slate-50 px-4 py-3">
                  <div className="flex items-start gap-3">
                    <input type="checkbox" checked={checked.has(i)} onChange={(e) => setChecked((s) => { const n = new Set(s); if (e.target.checked) n.add(i); else n.delete(i); return n })} className="mt-1 shrink-0 accent-blue-600" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-slate-900">{q.title}</span>
                        <Select
                          size="sm"
                          className="w-36"
                          value={partSel[i] ?? 'CUST'}
                          onChange={(val) => setPartSel((s) => ({ ...s, [i]: val }))}
                          options={[
                            ...parts.map((p) => ({ value: p.key, label: p.name })),
                            ...(!parts.some((p) => p.key === 'CUST') ? [{ value: 'CUST', label: '自定义' }] : []),
                            ...(q.partName && !q.part ? [{ value: '__SUGGESTED__', label: `＋ 新分类：${q.partName}` }] : []),
                            { value: '__NEW__', label: '＋ 新分类…' },
                          ]}
                        />
                      </div>
                      <p className="mt-0.5 text-xs leading-5 text-slate-500">{q.q}</p>
                      {(partSel[i] === '__NEW__') && (
                        <input
                          value={partNew[i] || ''}
                          onChange={(e) => setPartNew((s) => ({ ...s, [i]: e.target.value }))}
                          placeholder="新分类名称"
                          maxLength={20}
                          className="mt-1.5 h-7 w-40 rounded-md border border-slate-200 bg-white px-2 text-xs outline-none focus:border-blue-500"
                        />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <Btn variant="ghost" onClick={onClose}>
            取消
          </Btn>
          {results ? (
            <Btn variant="accent" onClick={() => void saveSelected()} disabled={saving}>
              {saving ? '保存中…' : `保存选中（${checked.size}）`}
            </Btn>
          ) : (
            <Btn onClick={() => void generate()} disabled={busy}>
              {busy ? '生成中…' : '生成'}
            </Btn>
          )}
        </div>
      </div>
    </div>
  )
}

/** 题目共享范围标识 */
export function ScopeChip({ q }: { q: BankQuestion }) {
  if (!q.groupId) return <Chip tone="amber">仅自己</Chip>
  if (q.groupId === 'GLOBAL') return <Chip tone="slate">全局</Chip>
  return <Chip tone="blue">{q.groupName || '组内'}</Chip>
}

/** 添加 / 编辑题目的弹窗表单 */
function QuestionFormModal({
  initial,
  parts,
  onClose,
  onSaved,
}: {
  initial: BankQuestion | null
  parts: { key: string; name: string }[]
  onClose: () => void
  onSaved: () => void
}) {
  const [v, setV] = useState<FormState>(
    initial
      ? { part: initial.part, newPart: '', title: initial.title, q: initial.q, answer: initial.answer, material: initial.material || '', jdId: initial.jdId || '' }
      : emptyForm,
  )
  const [saving, setSaving] = useState(false)
  const [jds, setJds] = useState<JobDescription[]>([])
  const set = (k: keyof FormState) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    void api
      .listJds()
      .then((r) => setJds(r.jds))
      .catch(() => {})
  }, [])

  const submit = async () => {
    if (!v.title.trim() || !v.q.trim()) {
      toast('标题与题干为必填项')
      return
    }
    setSaving(true)
    const part = v.part === '__NEW__' ? v.newPart.trim() : v.part
    if (v.part === '__NEW__' && !part) {
      toast('请填写新分类名称')
      setSaving(false)
      return
    }
    const body: BankQuestionInput = {
      part,
      title: v.title.trim(),
      q: v.q.trim(),
      answer: v.answer.trim(),
      material: v.material.trim(),
      jdId: v.jdId,
    }
    try {
      if (initial) await api.updateBankQuestion(initial.id, body)
      else await api.addBankQuestion(body)
      invalidateBank()
      toast('已保存')
      onSaved()
      onClose()
    } catch (e) {
      toast(e instanceof Error ? e.message : '保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-[#1d2939]/50" onClick={onClose} />
      <div className="ws-paper login-fade relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl p-5" role="dialog" aria-modal="true">
        <h3 className="text-base font-semibold text-slate-900">{initial ? '编辑题目' : '添加题目'}</h3>
        <div className="mt-4 space-y-3">
          <label className={`block ${lab}`}>
            分类
            <div className="mt-1">
              <Select
                value={v.part}
                onChange={(val) => setV({ ...v, part: val })}
                options={[
                  ...parts.map((p) => ({ value: p.key, label: p.name })),
                  ...(!parts.some((p) => p.key === 'CUST') ? [{ value: 'CUST', label: '自定义' }] : []),
                  { value: '__NEW__', label: '＋ 新分类…' },
                  { value: '', label: '未分类（存入自定义）' },
                ]}
              />
            </div>
          </label>
          {v.part === '__NEW__' && (
            <label className={`block ${lab}`}>
              新分类名称
              <input value={v.newPart} onChange={set('newPart')} placeholder="例如：Docker 部署（创建后全组可用）" maxLength={20} className={`mt-1 ${field}`} />
            </label>
          )}
          <label className={`block ${lab}`}>
            所属岗位
            <div className="mt-1">
              <Select
                value={v.jdId}
                placeholder="通用题（不关联岗位）"
                onChange={(val) => setV({ ...v, jdId: val })}
                options={[{ value: '', label: '通用题（不关联岗位）' }, ...jds.map((j) => ({ value: j.id, label: j.title, hint: j.company || undefined }))]}
              />
            </div>
          </label>
          <label className={`block ${lab}`}>
            标题
            <input value={v.title} onChange={set('title')} placeholder="例如：项目深挖 · 架构取舍" className={`mt-1 ${field}`} />
          </label>
          <label className={`block ${lab}`}>
            题干
            <textarea value={v.q} onChange={set('q')} rows={3} placeholder="完整的提问内容" className={`mt-1 resize-none ${field}`} />
          </label>
          <label className={`block ${lab}`}>
            参考答案
            <textarea value={v.answer} onChange={set('answer')} rows={3} placeholder={'期望听到的要点，每行一条'} className={`mt-1 resize-none ${field}`} />
          </label>
          <label className={`block ${lab}`}>
            材料（可选）
            <textarea value={v.material} onChange={set('material')} rows={2} placeholder="出题参考的背景材料" className={`mt-1 resize-none ${field}`} />
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Btn variant="ghost" onClick={onClose}>
            取消
          </Btn>
          <Btn onClick={() => void submit()} disabled={saving}>
            {saving ? '保存中…' : '保存'}
          </Btn>
        </div>
      </div>
    </div>
  )
}

/** 岗位分组色：按 jdId 哈希取色相，稳定不随机 */
const jdHue = (id: string) => {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 360
  return h
}
const jdDot = (id: string) => (id ? { background: `hsl(${jdHue(id)} 65% 55%)` } : { background: '#94a3b8' })
const jdBar = (id: string) => (id ? { background: `hsl(${jdHue(id)} 70% 50%)` } : { background: '#64748b' })

/** 单题卡片 */
function BankItem({
  b,
  expanded,
  onToggle,
  onEdit,
  onRemove,
}: {
  b: BankQuestion
  expanded: boolean
  onToggle: () => void
  onEdit: () => void
  onRemove: () => void
}) {
  return (
    <li>
      <Card className="px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <button
            type="button"
            onClick={onToggle}
            className="min-w-0 flex-1 cursor-pointer text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Chip>{b.custom ? '自定义' : b.id}</Chip>
              <Chip tone="blue">{shortPartName(b.partName)}</Chip>
              <ScopeChip q={b} />
              {b.userName && <span className="text-xs text-slate-400">{b.userName}</span>}
              <span className="text-[15px] font-semibold text-slate-900">{b.title || b.q}</span>
            </div>
            {b.title && <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-slate-600">{b.q}</p>}
          </button>
          <div className="flex shrink-0 items-center gap-3 text-xs font-medium">
            <button
              type="button"
              onClick={onToggle}
              className="cursor-pointer text-slate-500 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              {expanded ? '收起' : '答案'}
            </button>
            {!b.readonly && (
              <>
                <button
                  type="button"
                  onClick={onEdit}
                  className="cursor-pointer text-blue-600 hover:text-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
                  编辑
                </button>
                <button
                  type="button"
                  onClick={onRemove}
                  className="cursor-pointer text-slate-400 hover:text-red-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
                  删除
                </button>
              </>
            )}
          </div>
        </div>
        {expanded && (
          <div className="login-fade mt-4 space-y-3 border-t border-slate-100 pt-4 text-sm leading-6">
            {b.answer && (
              <div>
                <div className="text-xs font-medium text-slate-500">参考答案</div>
                <p className="mt-1 whitespace-pre-wrap text-slate-700">{b.answer}</p>
              </div>
            )}
            {b.material && (
              <div>
                <div className="text-xs font-medium text-slate-500">材料</div>
                <p className="mt-1 whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 text-slate-600">{b.material}</p>
              </div>
            )}
            {!b.answer && !b.material && <p className="text-slate-400">暂无参考答案</p>}
          </div>
        )}
      </Card>
    </li>
  )
}

export default function Bank() {
  const { bank, error, reload } = useBank()
  const [part, setPart] = useState('')
  const [search, setSearch] = useState('')
  const [jdFilter, setJdFilter] = useState('ALL') // 'ALL' 全部 | '' 通用题 | jdId
  const [openId, setOpenId] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState(false)
  const [generating, setGenerating] = useState<string | null>(null)
  const [editing, setEditing] = useState<BankQuestion | null>(null)
  const [removing, setRemoving] = useState<BankQuestion | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [renamingPart, setRenamingPart] = useState(false)
  const [partNewName, setPartNewName] = useState('')

  // 岗位库「AI 出题」跳转而来时自动打开生成弹窗并预选该 JD
  useEffect(() => {
    const pending = sessionStorage.getItem('facetry-jd-generate')
    if (pending) {
      sessionStorage.removeItem('facetry-jd-generate')
      setGenerating(pending)
    }
  }, [])

  const list = bank ? filterBank(bank, part, search) : []

  // 岗位分组统计（从可见题目推导）
  const jdGroups = (() => {
    const m = new Map<string, { id: string; title: string; count: number }>()
    let common = 0
    for (const q of bank?.questions || []) {
      if (q.jdId) {
        const g = m.get(q.jdId)
        if (g) g.count++
        else m.set(q.jdId, { id: q.jdId, title: q.jdTitle || '岗位', count: 1 })
      } else common++
    }
    return { common, jds: [...m.values()].sort((a, b) => b.count - a.count || a.title.localeCompare(b.title, 'zh')) }
  })()

  // 分组后的展示区块：全部模式下按岗位分组，选中某岗位则单列
  const sections = (() => {
    const out: { id: string; title: string; questions: BankQuestion[] }[] = []
    if (jdFilter === 'ALL') {
      const commonQs = list.filter((q) => !q.jdId)
      if (commonQs.length) out.push({ id: '', title: '通用题', questions: commonQs })
      for (const g of jdGroups.jds) {
        const qs = list.filter((q) => q.jdId === g.id)
        if (qs.length) out.push({ id: g.id, title: g.title, questions: qs })
      }
    } else {
      const qs = jdFilter === '' ? list.filter((q) => !q.jdId) : list.filter((q) => q.jdId === jdFilter)
      out.push({ id: jdFilter, title: jdFilter === '' ? '通用题' : jdGroups.jds.find((g) => g.id === jdFilter)?.title || '岗位', questions: qs })
    }
    return out
  })()

  const doDelete = async () => {
    if (!removing) return
    setDeleting(true)
    try {
      await api.deleteBankQuestion(removing.id)
      invalidateBank()
      toast('题目已删除')
      setRemoving(null)
      await reload(true)
    } catch (e) {
      toast(e instanceof Error ? e.message : '删除失败，请重试')
    } finally {
      setDeleting(false)
    }
  }

  const toggleSection = (id: string) =>
    setCollapsed((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const navItem = (key: string, label: string, count: number) => (
    <button
      key={key || 'common'}
      type="button"
      onClick={() => setJdFilter(key)}
      className={`flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
        jdFilter === key ? 'bg-[#1d2939] font-medium text-white' : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      <span className="h-2 w-2 shrink-0 rounded-full" style={jdDot(key)} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className={`text-xs tabular-nums ${jdFilter === key ? 'text-white/60' : 'text-slate-400'}`}>{count}</span>
    </button>
  )

  return (
    <div className="space-y-6">
      <div className="ws-rise flex items-end justify-between" style={rise(0)}>
        <SectionHead title="通用题库" sub={bank ? `共 ${bank.questions.length} 题 · 按最小用户组共享` : ''} />
        <div className="mb-4 flex gap-2">
          <Btn variant="ghost" onClick={() => setGenerating('')} disabled={!bank}>
            ✦ AI 出题
          </Btn>
          <Btn variant="accent" onClick={() => setAdding(true)} disabled={!bank}>
            + 添加题目
          </Btn>
        </div>
      </div>

      {error && (
        <Card className="ws-rise px-5 py-4" style={rise(1)}>
          <div className="flex items-center justify-between">
            <p className="text-sm text-amber-700">{error}</p>
            <Btn variant="ghost" className="h-8 px-3 text-xs" onClick={() => void reload(true)}>
              重试
            </Btn>
          </div>
        </Card>
      )}

      {!bank && !error && (
        <Card className="ws-rise flex items-center justify-center gap-2 py-20 text-sm text-slate-400" style={rise(1)}>
          <Spinner /> 正在加载题库…
        </Card>
      )}

      {bank && (
        <div className="grid gap-6 lg:grid-cols-[230px_1fr]">
          {bank.questions.length === 0 && (
            <Card className="ws-rise px-5 py-4 lg:col-span-2" style={rise(1)}>
              <p className="text-sm text-slate-600">
                <span className="mr-2 rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-700">提示</span>
                尚未识别到你的组织，识别后将自动继承组内题库（含基础题），无需手动创建。你也可以先用右上角「+ 添加题目」或「✦ AI 出题」。
              </p>
            </Card>
          )}
          {/* 岗位导航 */}
          <aside className="ws-rise lg:sticky lg:top-20 lg:self-start" style={rise(1)}>
            <div className="lg:hidden">
              <Select
                value={jdFilter}
                onChange={setJdFilter}
                options={[
                  { value: 'ALL', label: `全部题目（${bank.questions.length}）` },
                  { value: '', label: `通用题（${jdGroups.common}）` },
                  ...jdGroups.jds.map((g) => ({ value: g.id, label: `${g.title}（${g.count}）` })),
                ]}
              />
            </div>
            <Card className="hidden p-2 lg:block">
              {navItem('ALL', '全部题目', bank.questions.length)}
              <div className="mt-2 px-3 pb-1 text-xs font-medium text-slate-400">通用</div>
              {navItem('', '通用题', jdGroups.common)}
              {jdGroups.jds.length > 0 && <div className="mt-2 px-3 pb-1 text-xs font-medium text-slate-400">按岗位</div>}
              {jdGroups.jds.map((g) => navItem(g.id, g.title, g.count))}
            </Card>
          </aside>

          <div className="min-w-0 space-y-6">
            <div className="ws-rise flex flex-wrap items-center gap-3" style={rise(2)}>
              <PartCapsules bank={bank} value={part} onChange={setPart} />
              {part && bank.parts.some((p) => p.key === part) && (
                <button
                  type="button"
                  onClick={() => {
                    setPartNewName(bank.parts.find((p) => p.key === part)?.name || '')
                    setRenamingPart(true)
                  }}
                  className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-full bg-white px-3 text-xs text-slate-500 shadow-sm hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  </svg>
                  重命名
                </button>
              )}
              <div className="flex-1" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索标题、题干或答案…" className={bankSearchCls} />
            </div>

            {sections.map((sec) => {
              const isCollapsed = collapsed.has(sec.id)
              return (
                <section key={sec.id || 'common'} className="ws-rise" style={rise(3)}>
                  <button
                    type="button"
                    onClick={() => toggleSection(sec.id)}
                    className="mb-3 flex w-full cursor-pointer items-center gap-2.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                  >
                    <span className="h-4 w-1 shrink-0 rounded-full" style={jdBar(sec.id)} />
                    <span className="text-[15px] font-semibold text-slate-900">{sec.title}</span>
                    <span className="text-xs text-slate-400 tabular-nums">{sec.questions.length} 题</span>
                    <svg viewBox="0 0 24 24" className={`ml-auto h-4 w-4 text-slate-400 transition-transform duration-150 ${isCollapsed ? '' : 'rotate-90'}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m9 6 6 6-6 6" />
                    </svg>
                  </button>
                  {!isCollapsed && (
                    <ol className="space-y-3">
                      {sec.questions.map((b) => (
                        <BankItem
                          key={b.id}
                          b={b}
                          expanded={openId === b.id}
                          onToggle={() => setOpenId(openId === b.id ? null : b.id)}
                          onEdit={() => setEditing(b)}
                          onRemove={() => setRemoving(b)}
                        />
                      ))}
                    </ol>
                  )}
                </section>
              )
            })}
            {!sections.some((s) => s.questions.length) && (
              <Card className="px-5 py-10 text-center text-sm text-slate-400">没有匹配的题目，点右上角「+ 添加题目」或「✦ AI 出题」录入</Card>
            )}
          </div>
        </div>
      )}

      {(adding || editing) && bank && (
        <QuestionFormModal
          initial={editing}
          parts={bank.parts}
          onClose={() => {
            setAdding(false)
            setEditing(null)
          }}
          onSaved={() => void reload(true)}
        />
      )}

      {generating !== null && bank && (
        <GenerateModal
          initialJdId={generating || undefined}
          parts={bank.parts}
          onClose={() => setGenerating(null)}
          onSaved={(jdId) => {
            // 保存后立刻刷新并把视图切到刚生成题目的岗位
            if (jdId) setJdFilter(jdId)
            void reload(true)
          }}
        />
      )}

      {renamingPart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-[#1d2939]/50" onClick={() => setRenamingPart(false)} />
          <div className="ws-paper login-fade relative w-full max-w-xs rounded-xl p-5" role="dialog" aria-modal="true">
            <h3 className="text-base font-semibold text-slate-900">重命名分类</h3>
            <input
              value={partNewName}
              onChange={(e) => setPartNewName(e.target.value)}
              maxLength={20}
              autoFocus
              placeholder="分类名称"
              className={`mt-3 ${field}`}
            />
            <p className="mt-2 text-xs text-slate-400">该分类下所有题目的分类名将一并更新</p>
            <div className="mt-4 flex justify-end gap-2">
              <Btn variant="ghost" onClick={() => setRenamingPart(false)}>
                取消
              </Btn>
              <Btn
                disabled={!partNewName.trim()}
                onClick={() => {
                  void (async () => {
                    try {
                      await api.renameBankPart(part, partNewName.trim())
                      invalidateBank()
                      toast('分类已重命名')
                      setRenamingPart(false)
                      await reload(true)
                    } catch (e) {
                      toast(e instanceof Error ? e.message : '重命名失败，请重试')
                    }
                  })()
                }}
              >
                保存
              </Btn>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!removing}
        title={`删除题目「${removing?.title || removing?.q.slice(0, 20) || ''}」？`}
        body="删除后不可恢复，已加入面试记录的题目不受影响。"
        confirmLabel={deleting ? '删除中…' : '确认删除'}
        danger
        onConfirm={() => void doDelete()}
        onCancel={() => setRemoving(null)}
      />
    </div>
  )
}
