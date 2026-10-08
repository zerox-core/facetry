import type React from 'react'
import { useEffect, useState } from 'react'
import { api } from '../api'
import { bankSearchCls, filterBank, PartCapsules } from '../components/BankBits'
import { Chip } from '../components/Chip'
import { ConfirmModal } from '../components/Modal'
import { toast } from '../components/Toast'
import { Btn, Card, SectionHead, Spinner } from '../components/ui'
import type { BankQuestion, BankQuestionInput } from '../types'
import { invalidateBank, shortPartName, useBank } from './shared'

const rise = (i: number) => ({ '--i': i } as React.CSSProperties)
const field =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
const lab = 'text-xs font-medium text-slate-600'

type FormState = { part: string; title: string; q: string; answer: string; material: string }
const emptyForm: FormState = { part: '', title: '', q: '', answer: '', material: '' }

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
    initial ? { part: initial.part, title: initial.title, q: initial.q, answer: initial.answer, material: initial.material || '' } : emptyForm,
  )
  const [saving, setSaving] = useState(false)
  const set = (k: keyof FormState) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = async () => {
    if (!v.title.trim() || !v.q.trim()) {
      toast('标题与题干为必填项')
      return
    }
    setSaving(true)
    const body: BankQuestionInput = {
      part: v.part || undefined,
      title: v.title.trim(),
      q: v.q.trim(),
      answer: v.answer.trim(),
      material: v.material.trim(),
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
            <select value={v.part} onChange={set('part')} className={`mt-1 h-10 ${field}`}>
              {parts.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.name}
                </option>
              ))}
              <option value="CUST">自定义</option>
              <option value="">未分类（存入自定义）</option>
            </select>
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

export default function Bank() {
  const { bank, error, reload } = useBank()
  const [part, setPart] = useState('')
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<BankQuestion | null>(null)
  const [removing, setRemoving] = useState<BankQuestion | null>(null)
  const [deleting, setDeleting] = useState(false)

  const list = bank ? filterBank(bank, part, search) : []

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

  return (
    <div className="space-y-6">
      <div className="ws-rise flex items-end justify-between" style={rise(0)}>
        <SectionHead title="通用题库" sub={bank ? `共 ${bank.questions.length} 题` : ''} />
        <Btn variant="accent" className="mb-4" onClick={() => setAdding(true)} disabled={!bank}>
          + 添加题目
        </Btn>
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
        <>
          <div className="ws-rise flex flex-wrap items-center gap-3" style={rise(1)}>
            <PartCapsules bank={bank} value={part} onChange={setPart} />
            <div className="flex-1" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索标题、题干或答案…" className={bankSearchCls} />
          </div>

          <ol className="ws-rise space-y-3" style={rise(2)}>
            {list.map((b) => {
              const expanded = openId === b.id
              return (
                <li key={b.id}>
                  <Card className="px-5 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <button
                        type="button"
                        onClick={() => setOpenId(expanded ? null : b.id)}
                        className="min-w-0 flex-1 cursor-pointer text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <Chip>{b.custom ? '自定义' : b.id}</Chip>
                          <Chip tone="blue">{shortPartName(b.partName)}</Chip>
                          <span className="text-[15px] font-semibold text-slate-900">{b.title || b.q}</span>
                        </div>
                        {b.title && <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-slate-600">{b.q}</p>}
                      </button>
                      <div className="flex shrink-0 items-center gap-3 text-xs font-medium">
                        <button
                          type="button"
                          onClick={() => setOpenId(expanded ? null : b.id)}
                          className="cursor-pointer text-slate-500 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                        >
                          {expanded ? '收起' : '答案'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditing(b)}
                          className="cursor-pointer text-blue-600 hover:text-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                        >
                          编辑
                        </button>
                        <button
                          type="button"
                          onClick={() => setRemoving(b)}
                          className="cursor-pointer text-slate-400 hover:text-red-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                        >
                          删除
                        </button>
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
            })}
            {!list.length && (
              <li>
                <Card className="px-5 py-10 text-center text-sm text-slate-400">
                  没有匹配的题目，点右上角「+ 添加题目」录入
                </Card>
              </li>
            )}
          </ol>
        </>
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
