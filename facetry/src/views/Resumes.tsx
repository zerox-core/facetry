import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Go } from '../App'
import { Chip } from '../components/Chip'
import { ConfirmModal } from '../components/Modal'
import { toast } from '../components/Toast'
import { Btn, Card, SectionHead, Spinner } from '../components/ui'
import type { DirectoryUser, Session, SessionSummary } from '../types'
import { fmtTime, PhaseChip, ProgressBar, useSessions, useUpload } from './shared'

/** 分享弹窗：从用户目录勾选要分享的对象 */
function ShareModal({ session, onClose }: { session: Session; onClose: () => void }) {
  const [users, setUsers] = useState<DirectoryUser[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set(session.shares || []))
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    void api
      .listUsers()
      .then((r) => setUsers(r.users.filter((u) => u.id !== session.userId)))
      .catch((e) => toast(e instanceof Error ? e.message : '用户目录加载失败'))
  }, [session.userId])

  const kw = search.trim().toLowerCase()
  const list = users.filter((u) => !kw || u.name.toLowerCase().includes(kw) || u.groupName.toLowerCase().includes(kw))

  const save = async () => {
    setSaving(true)
    try {
      await api.patchSession(session.id, { shares: [...selected] })
      toast('分享设置已更新')
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
      <div className="ws-paper login-fade relative max-h-[80vh] w-full max-w-md overflow-hidden rounded-xl" role="dialog" aria-modal="true">
        <div className="flex items-center justify-between px-5 pt-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">分享简历</h3>
            <p className="mt-0.5 text-xs text-slate-400">「{session.name || session.fileName}」· 被分享的人可查看并记录评分</p>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭" className="cursor-pointer text-slate-400 hover:text-slate-700">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12 M18 6L6 18" /></svg>
          </button>
        </div>
        <div className="px-5 pt-3">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索姓名或部门…" className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
        </div>
        <div className="max-h-80 space-y-1.5 overflow-y-auto px-5 py-3">
          {list.map((u) => (
            <label key={u.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-slate-50">
              <input
                type="checkbox"
                checked={selected.has(u.id)}
                onChange={(e) =>
                  setSelected((s) => {
                    const n = new Set(s)
                    if (e.target.checked) n.add(u.id)
                    else n.delete(u.id)
                    return n
                  })
                }
                className="accent-blue-600"
              />
              {u.avatar ? (
                <img src={u.avatar} alt={u.name} referrerPolicy="no-referrer" className="h-7 w-7 rounded-full object-cover" />
              ) : (
                <span className="grid h-7 w-7 place-items-center rounded-full bg-slate-100 text-xs text-slate-500">{u.name[0]}</span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-slate-900">{u.name}</span>
                <span className="block truncate text-xs text-slate-400">{u.groupName || '未识别组织'}</span>
              </span>
            </label>
          ))}
          {!list.length && <p className="py-6 text-center text-sm text-slate-400">没有匹配的用户</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <Btn variant="ghost" onClick={onClose}>
            取消
          </Btn>
          <Btn variant="accent" onClick={() => void save()} disabled={saving}>
            {saving ? '保存中…' : '保存分享'}
          </Btn>
        </div>
      </div>
    </div>
  )
}

export default function Resumes({ go }: { go: Go }) {
  const { sessions, error, reload } = useSessions()
  const [removing, setRemoving] = useState<SessionSummary | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [sharing, setSharing] = useState<SessionSummary | null>(null)
  const [shareSession, setShareSession] = useState<Session | null>(null)
  const { uploading, pick, input } = useUpload((s) => go('review', s.id))

  // 打开分享弹窗时需要完整的 shares 字段，按 id 拉取一次
  useEffect(() => {
    if (!sharing) return
    let cancelled = false
    void api
      .getSession(sharing.id)
      .then((s) => !cancelled && setShareSession(s))
      .catch((e) => {
        toast(e instanceof Error ? e.message : '加载失败，请重试')
        if (!cancelled) setSharing(null)
      })
    return () => {
      cancelled = true
    }
  }, [sharing])

  const mine = (sessions || []).filter((s) => !s.sharedBy)
  const shared = (sessions || []).filter((s) => s.sharedBy && !s.viaSuper && !s.viaLeader)
  const leadView = (sessions || []).filter((s) => s.viaLeader)

  const doDelete = async () => {
    if (!removing) return
    setDeleting(true)
    try {
      await api.deleteSession(removing.id)
      toast(`已删除「${removing.name || removing.fileName}」`)
      setRemoving(null)
      await reload()
    } catch (e) {
      toast(e instanceof Error ? e.message : '删除失败，请重试')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-8">
      {input}
      <div className="ws-rise flex items-end justify-between" style={{ '--i': 0 } as React.CSSProperties}>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">简历库</h1>
          <p className="mt-1 text-sm text-slate-500">支持 PDF、Word、TXT 或图片，最大 20 MB。</p>
        </div>
        <Btn variant="accent" onClick={pick} disabled={uploading}>
          上传简历
        </Btn>
      </div>

      {uploading && (
        <Card className="ws-rise px-5 py-4" style={{ '--i': 1 } as React.CSSProperties}>
          <div className="flex items-center gap-3">
            <Spinner />
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-900">正在上传简历…</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full w-1/3 animate-pulse rounded-full bg-blue-600" />
              </div>
            </div>
          </div>
        </Card>
      )}

      {error && (
        <Card className="ws-rise px-5 py-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-amber-700">{error}</p>
            <Btn variant="ghost" className="h-8 px-3 text-xs" onClick={() => void reload()}>
              重试
            </Btn>
          </div>
        </Card>
      )}

      <section className="ws-rise" style={{ '--i': 2 } as React.CSSProperties}>
        <SectionHead title="全部简历" sub={sessions ? `共 ${mine.length} 份` : ''} />
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400">
                  <th className="px-5 py-3 font-medium">候选人</th>
                  <th className="px-5 py-3 font-medium">文件</th>
                  <th className="px-5 py-3 font-medium">岗位</th>
                  <th className="px-5 py-3 font-medium">评分进度</th>
                  <th className="px-5 py-3 font-medium">阶段</th>
                  <th className="px-5 py-3 font-medium">更新</th>
                  <th className="px-5 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {mine.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => go('review', s.id)}
                    className="cursor-pointer border-t border-slate-100 transition-colors duration-150 hover:bg-slate-50"
                  >
                    <td className="px-5 py-3.5 font-medium text-slate-900">{s.name || '待解析'}</td>
                    <td className="max-w-48 truncate px-5 py-3.5 text-slate-500">{s.fileName}</td>
                    <td className="px-5 py-3.5 text-slate-500">{s.role || '—'}</td>
                    <td className="px-5 py-3.5">
                      <ProgressBar scored={s.scoredCount} total={s.questionCount} />
                    </td>
                    <td className="px-5 py-3.5">
                      <PhaseChip phase={s.phase} questionCount={s.questionCount} jobState={s.jobState} />
                    </td>
                    <td className="px-5 py-3.5 text-slate-400 tabular-nums">{fmtTime(s.updatedAt)}</td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="inline-flex items-center gap-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSharing(s)
                          }}
                          className="cursor-pointer text-xs font-medium text-blue-600 hover:text-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                        >
                          分享
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setRemoving(s)
                          }}
                          className="cursor-pointer text-xs font-medium text-slate-400 hover:text-red-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                        >
                          删除
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
                {sessions && mine.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-14 text-center">
                      <p className="text-sm text-slate-500">简历库还是空的</p>
                      <Btn variant="ghost" className="mt-4" onClick={pick}>
                        上传第一份简历
                      </Btn>
                    </td>
                  </tr>
                )}
                {!sessions && !error && (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-sm text-slate-400">
                      正在加载…
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      {shared.length > 0 && (
        <section className="ws-rise" style={{ '--i': 3 } as React.CSSProperties}>
          <SectionHead title="与我共享" sub={`共 ${shared.length} 份`} />
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-400">
                    <th className="px-5 py-3 font-medium">候选人</th>
                    <th className="px-5 py-3 font-medium">文件</th>
                    <th className="px-5 py-3 font-medium">岗位</th>
                    <th className="px-5 py-3 font-medium">评分进度</th>
                    <th className="px-5 py-3 font-medium">阶段</th>
                    <th className="px-5 py-3 font-medium">更新</th>
                  </tr>
                </thead>
                <tbody>
                  {shared.map((s) => (
                    <tr
                      key={s.id}
                      onClick={() => go('review', s.id)}
                      className="cursor-pointer border-t border-slate-100 transition-colors duration-150 hover:bg-slate-50"
                    >
                      <td className="px-5 py-3.5">
                        <span className="font-medium text-slate-900">{s.name || '待解析'}</span>
                        <Chip tone="amber" className="ml-2">{s.sharedBy} 分享</Chip>
                      </td>
                      <td className="max-w-48 truncate px-5 py-3.5 text-slate-500">{s.fileName}</td>
                      <td className="px-5 py-3.5 text-slate-500">{s.role || '—'}</td>
                      <td className="px-5 py-3.5">
                        <ProgressBar scored={s.scoredCount} total={s.questionCount} />
                      </td>
                      <td className="px-5 py-3.5">
                        <PhaseChip phase={s.phase} questionCount={s.questionCount} jobState={s.jobState} />
                      </td>
                      <td className="px-5 py-3.5 text-slate-400 tabular-nums">{fmtTime(s.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </section>
      )}

      {leadView.length > 0 && (
        <section className="ws-rise" style={{ '--i': 4 } as React.CSSProperties}>
          <SectionHead title="组内成员简历" sub={`共 ${leadView.length} 份 · 负责人可见，只读`} />
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-400">
                    <th className="px-5 py-3 font-medium">候选人</th>
                    <th className="px-5 py-3 font-medium">文件</th>
                    <th className="px-5 py-3 font-medium">岗位</th>
                    <th className="px-5 py-3 font-medium">评分进度</th>
                    <th className="px-5 py-3 font-medium">阶段</th>
                    <th className="px-5 py-3 font-medium">更新</th>
                  </tr>
                </thead>
                <tbody>
                  {leadView.map((s) => (
                    <tr
                      key={s.id}
                      onClick={() => go('review', s.id)}
                      className="cursor-pointer border-t border-slate-100 transition-colors duration-150 hover:bg-slate-50"
                    >
                      <td className="px-5 py-3.5">
                        <span className="font-medium text-slate-900">{s.name || '待解析'}</span>
                        <Chip className="ml-2">{s.sharedBy} 的</Chip>
                      </td>
                      <td className="max-w-48 truncate px-5 py-3.5 text-slate-500">{s.fileName}</td>
                      <td className="px-5 py-3.5 text-slate-500">{s.role || '—'}</td>
                      <td className="px-5 py-3.5">
                        <ProgressBar scored={s.scoredCount} total={s.questionCount} />
                      </td>
                      <td className="px-5 py-3.5">
                        <PhaseChip phase={s.phase} questionCount={s.questionCount} jobState={s.jobState} />
                      </td>
                      <td className="px-5 py-3.5 text-slate-400 tabular-nums">{fmtTime(s.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </section>
      )}

      {sharing && shareSession && (
        <ShareModal
          session={shareSession}
          onClose={() => {
            setSharing(null)
            setShareSession(null)
          }}
        />
      )}

      <ConfirmModal
        open={!!removing}
        title={`删除「${removing?.name || removing?.fileName || ''}」？`}
        body="将同时删除该简历的原文文件、全部问题、评分与综合评价，删除后不可恢复。"
        confirmLabel={deleting ? '删除中…' : '确认删除'}
        danger
        onConfirm={() => void doDelete()}
        onCancel={() => setRemoving(null)}
      />
    </div>
  )
}
