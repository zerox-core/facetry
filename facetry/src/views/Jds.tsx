import type React from 'react'
import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import type { Go } from '../App'
import { Chip } from '../components/Chip'
import { ConfirmModal } from '../components/Modal'
import { toast } from '../components/Toast'
import { Btn, Card, Spinner } from '../components/ui'
import type { JobDescription, JobDescriptionInput } from '../types'
import { fmtTime } from './shared'

const rise = (i: number) => ({ '--i': i } as React.CSSProperties)
const field =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
const lab = 'text-xs font-medium text-slate-600'

type FormState = { title: string; company: string; tags: string; requirements: string; content: string }

function JdFormModal({ initial, onClose, onSaved }: { initial: JobDescription | null; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = useState<FormState>(
    initial
      ? { title: initial.title, company: initial.company, tags: initial.tags.join('，'), requirements: initial.requirements, content: initial.content }
      : { title: '', company: '', tags: '', requirements: '', content: '' },
  )
  const [saving, setSaving] = useState(false)
  const set = (k: keyof FormState) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = async () => {
    if (!v.title.trim() || !v.content.trim()) {
      toast('岗位名称与 JD 内容为必填项')
      return
    }
    setSaving(true)
    const body: JobDescriptionInput = {
      title: v.title.trim(),
      company: v.company.trim(),
      content: v.content.trim(),
      requirements: v.requirements.trim(),
      tags: v.tags.split(/[,，、]/).map((x) => x.trim()).filter(Boolean),
    }
    try {
      if (initial) await api.updateJd(initial.id, body)
      else await api.addJd(body)
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
      <div className="ws-paper login-fade relative max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-xl p-5" role="dialog" aria-modal="true">
        <h3 className="text-base font-semibold text-slate-900">{initial ? '编辑岗位' : '新建岗位'}</h3>
        <p className="mt-1 text-xs text-slate-400">保存后自动按你的最小用户组共享，同组同事可见</p>
        <div className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
            <label className={`block ${lab}`}>
              岗位名称
              <input value={v.title} onChange={set('title')} placeholder="例如：AI 管培生（信息方向）" className={`mt-1 ${field}`} />
            </label>
            <label className={`block ${lab}`}>
              公司 / 部门
              <input value={v.company} onChange={set('company')} placeholder="可选" className={`mt-1 ${field}`} />
            </label>
          </div>
          <label className={`block ${lab}`}>
            标签（用逗号分隔）
            <input value={v.tags} onChange={set('tags')} placeholder="例如：AI，校招，珠海" className={`mt-1 ${field}`} />
          </label>
          <label className={`block ${lab}`}>
            任职要求
            <textarea value={v.requirements} onChange={set('requirements')} rows={2} placeholder="学历、经验、技能等硬性要求" className={`mt-1 resize-none ${field}`} />
          </label>
          <label className={`block ${lab}`}>
            JD 正文
            <textarea value={v.content} onChange={set('content')} rows={8} placeholder="岗位职责与要求的完整描述，将用于 AI 出题" className={`mt-1 ${field}`} />
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

export default function Jds({ go }: { go: Go }) {
  const [jds, setJds] = useState<JobDescription[] | null>(null)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<JobDescription | null>(null)
  const [removing, setRemoving] = useState<JobDescription | null>(null)
  const [deleting, setDeleting] = useState(false)

  const reload = useCallback(async () => {
    try {
      const r = await api.listJds()
      setJds(r.jds)
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败，请重试')
    }
  }, [])
  useEffect(() => {
    void reload()
  }, [reload])

  const doDelete = async () => {
    if (!removing) return
    setDeleting(true)
    try {
      await api.deleteJd(removing.id)
      toast('岗位已删除')
      setRemoving(null)
      await reload()
    } catch (e) {
      toast(e instanceof Error ? e.message : '删除失败，请重试')
    } finally {
      setDeleting(false)
    }
  }

  const kw = search.trim().toLowerCase()
  const list = (jds || []).filter(
    (j) => !kw || j.title.toLowerCase().includes(kw) || j.company.toLowerCase().includes(kw) || j.content.toLowerCase().includes(kw) || j.tags.some((t) => t.toLowerCase().includes(kw)),
  )

  const toBank = (jd: JobDescription) => {
    sessionStorage.setItem('facetry-jd-generate', jd.id)
    go('bank')
  }

  return (
    <div className="space-y-6">
      <div className="ws-rise flex items-end justify-between" style={rise(0)}>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">岗位库</h1>
          <p className="mt-1 text-sm text-slate-500">岗位 JD 按最小用户组共享；选中 JD 可让 AI 生成题库题目。</p>
        </div>
        <Btn variant="accent" onClick={() => setAdding(true)} disabled={!jds}>
          + 新建岗位
        </Btn>
      </div>

      {error && (
        <Card className="ws-rise px-5 py-4" style={rise(1)}>
          <div className="flex items-center justify-between">
            <p className="text-sm text-amber-700">{error}</p>
            <Btn variant="ghost" className="h-8 px-3 text-xs" onClick={() => void reload()}>
              重试
            </Btn>
          </div>
        </Card>
      )}

      {!jds && !error && (
        <Card className="ws-rise flex items-center justify-center gap-2 py-20 text-sm text-slate-400" style={rise(1)}>
          <Spinner /> 正在加载岗位…
        </Card>
      )}

      {jds && (
        <>
          <div className="ws-rise" style={rise(1)}>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索岗位、公司或标签…" className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:w-80" />
          </div>
          <ol className="ws-rise space-y-3" style={rise(2)}>
            {list.map((j) => {
              const expanded = openId === j.id
              return (
                <li key={j.id}>
                  <Card className="px-5 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <button type="button" onClick={() => setOpenId(expanded ? null : j.id)} className="min-w-0 flex-1 cursor-pointer text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[15px] font-semibold text-slate-900">{j.title}</span>
                          {j.company && <Chip>{j.company}</Chip>}
                          <Chip tone={j.readonly ? 'amber' : 'blue'}>{j.groupName ? `${j.groupName}共享` : '仅自己'}</Chip>
                          {j.tags.map((t) => (
                            <Chip key={t}>{t}</Chip>
                          ))}
                        </div>
                        <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-slate-600">{j.content}</p>
                      </button>
                      <div className="flex shrink-0 items-center gap-3 text-xs font-medium">
                        <button type="button" onClick={() => toBank(j)} className="cursor-pointer text-amber-600 hover:text-amber-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
                          AI 出题
                        </button>
                        {!j.readonly && (
                          <>
                            <button type="button" onClick={() => setEditing(j)} className="cursor-pointer text-blue-600 hover:text-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
                              编辑
                            </button>
                            <button type="button" onClick={() => setRemoving(j)} className="cursor-pointer text-slate-400 hover:text-red-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
                              删除
                            </button>
                          </>
                        )}
                        <span className="text-slate-300 tabular-nums">{fmtTime(j.updatedAt)}</span>
                      </div>
                    </div>
                    {expanded && (
                      <div className="login-fade mt-4 space-y-3 border-t border-slate-100 pt-4 text-sm leading-6">
                        {j.requirements && (
                          <div>
                            <div className="text-xs font-medium text-slate-500">任职要求</div>
                            <p className="mt-1 whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 text-slate-700">{j.requirements}</p>
                          </div>
                        )}
                        <div>
                          <div className="text-xs font-medium text-slate-500">JD 正文</div>
                          <p className="mt-1 whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 text-slate-700">{j.content}</p>
                        </div>
                        <p className="text-xs text-slate-400">
                          由 {j.userName} 维护 · 更新于 {fmtTime(j.updatedAt)}
                        </p>
                      </div>
                    )}
                  </Card>
                </li>
              )
            })}
            {!list.length && (
              <li>
                <Card className="px-5 py-10 text-center text-sm text-slate-400">
                  {jds.length ? '没有匹配的岗位' : '还没有岗位 JD，点右上角「新建岗位」录入'}
                </Card>
              </li>
            )}
          </ol>
        </>
      )}

      {(adding || editing) && <JdFormModal initial={editing} onClose={() => { setAdding(false); setEditing(null) }} onSaved={() => void reload()} />}

      <ConfirmModal
        open={!!removing}
        title={`删除岗位「${removing?.title || ''}」？`}
        body="删除后同组同事将不再看到该岗位，已生成的题库题目不受影响。"
        confirmLabel={deleting ? '删除中…' : '确认删除'}
        danger
        onConfirm={() => void doDelete()}
        onCancel={() => setRemoving(null)}
      />
    </div>
  )
}
