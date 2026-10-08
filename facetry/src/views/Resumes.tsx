import { useState } from 'react'
import { api } from '../api'
import type { Go } from '../App'
import { ConfirmModal } from '../components/Modal'
import { toast } from '../components/Toast'
import { Btn, Card, SectionHead, Spinner } from '../components/ui'
import type { SessionSummary } from '../types'
import { fmtTime, PhaseChip, ProgressBar, useSessions, useUpload } from './shared'

export default function Resumes({ go }: { go: Go }) {
  const { sessions, error, reload } = useSessions()
  const [removing, setRemoving] = useState<SessionSummary | null>(null)
  const [deleting, setDeleting] = useState(false)
  const { uploading, pick, input } = useUpload((s) => go('review', s.id))

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
        <SectionHead title="全部简历" sub={sessions ? `共 ${sessions.length} 份` : ''} />
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
                {(sessions || []).map((s) => (
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
                      <PhaseChip phase={s.phase} questionCount={s.questionCount} />
                    </td>
                    <td className="px-5 py-3.5 text-slate-400 tabular-nums">{fmtTime(s.updatedAt)}</td>
                    <td className="px-5 py-3.5 text-right">
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
                    </td>
                  </tr>
                ))}
                {sessions && sessions.length === 0 && (
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
