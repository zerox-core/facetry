import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import type { Go } from '../App'
import { EmptyState, InterviewStatusChip, fmtDT, fmtHM, fmtMD, rise, sideStateLabels, weekdayLabels } from '../components/recruit'
import { Btn, Card, SectionHead, Spinner } from '../components/ui'
import type { Interview, Todos } from '../types'

/** 待办工作台：问候 + 四个待办区块 + 未来 7 天面试时间线 */
export default function Todo({ go, user }: { go: Go; user: string }) {
  const [todos, setTodos] = useState<Todos | null>(null)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    try {
      setTodos(await api.todos())
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败，请重试')
    }
  }, [])
  useEffect(() => {
    void reload()
  }, [reload])

  const todayCount = useMemo(() => {
    if (!todos) return 0
    const now = new Date()
    return todos.upcomingInterviews.filter((i) => {
      const d = new Date(i.startAt)
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate() && i.status !== 'canceled'
    }).length
  }, [todos])

  // 未来 7 天按天分组
  const days = useMemo(() => {
    if (!todos) return []
    const map = new Map<string, Interview[]>()
    for (const iv of todos.upcomingInterviews) {
      if (iv.status === 'canceled') continue
      const key = iv.startAt.slice(0, 10)
      const arr = map.get(key) || []
      arr.push(iv)
      map.set(key, arr)
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, list]) => {
        const d = new Date(key + 'T00:00:00')
        list.sort((a, b) => a.startAt.localeCompare(b.startAt))
        return { key, label: `${fmtMD(key)} ${weekdayLabels[d.getDay()]}`, list }
      })
  }, [todos])

  const hour = new Date().getHours()
  const greet = hour < 6 ? '夜深了' : hour < 12 ? '早上好' : hour < 18 ? '下午好' : '晚上好'

  return (
    <div className="space-y-8">
      <div className="ws-rise" style={rise(0)}>
        <h1 className="text-2xl font-semibold text-slate-900">
          {greet}，{user}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {todos
            ? todayCount
              ? `今天有 ${todayCount} 场面试，先从最紧急的事开始。`
              : '今天没有面试安排，可以专注筛选和跟进。'
            : '正在整理今天的待办…'}
        </p>
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

      {!todos && !error && (
        <Card className="ws-rise flex items-center justify-center gap-2 py-20 text-sm text-slate-400" style={rise(1)}>
          <Spinner /> 正在加载待办…
        </Card>
      )}

      {todos && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {/* 待初筛 */}
            <Card className="ws-rise overflow-hidden" style={rise(1)}>
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
                <span className="text-sm font-medium text-slate-900">待初筛</span>
                <span className="text-xs text-slate-400 tabular-nums">{todos.toScreen.length} 条</span>
              </div>
              <ul className="divide-y divide-slate-100">
                {todos.toScreen.map((t) => (
                  <li key={t.matchId} onClick={() => go('candidate', t.candidateId)} className="flex cursor-pointer items-center gap-3 px-5 py-3 transition-colors hover:bg-slate-50">
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-medium text-slate-900">{t.candidateName}</span>
                      <span className="ml-2 text-xs text-slate-400">{t.positionTitle}</span>
                    </div>
                    <span className="text-xs text-slate-400">{t.verdict || '待 AI 初筛'}</span>
                    <span className="shrink-0 text-xs text-slate-300 tabular-nums">{fmtMD(t.createdAt)}</span>
                  </li>
                ))}
                {!todos.toScreen.length && <EmptyState title="没有待初筛的候选人" hint="关联岗位后系统会自动发起 AI 初筛" />}
              </ul>
            </Card>

            {/* 待联系 */}
            <Card className="ws-rise overflow-hidden" style={rise(2)}>
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
                <span className="text-sm font-medium text-slate-900">待联系</span>
                <span className="text-xs text-slate-400 tabular-nums">{todos.toContact.length} 人</span>
              </div>
              <ul className="divide-y divide-slate-100">
                {todos.toContact.map((t) => (
                  <li key={t.candidateId} onClick={() => go('candidate', t.candidateId)} className="flex cursor-pointer items-center gap-3 px-5 py-3 transition-colors hover:bg-slate-50">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">{t.candidateName}</span>
                    <span className="shrink-0 text-xs text-slate-300 tabular-nums">入库 {fmtMD(t.updatedAt)}</span>
                  </li>
                ))}
                {!todos.toContact.length && <EmptyState title="没有待联系的候选人" hint="初筛「合适」的候选人流转到待联系后会出现在这里" />}
              </ul>
            </Card>

            {/* 待面评 */}
            <Card className="ws-rise overflow-hidden" style={rise(3)}>
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
                <span className="text-sm font-medium text-slate-900">待面评</span>
                <span className="text-xs text-slate-400 tabular-nums">{todos.toFeedback.length} 场</span>
              </div>
              <ul className="divide-y divide-slate-100">
                {todos.toFeedback.map((iv) => (
                  <li key={iv.id} onClick={() => go('interviews')} className="flex cursor-pointer items-center gap-3 px-5 py-3 transition-colors hover:bg-slate-50">
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-medium text-slate-900">{iv.candidateName}</span>
                      <span className="ml-2 text-xs text-slate-400">
                        {iv.positionTitle} · {iv.round}
                      </span>
                    </div>
                    <InterviewStatusChip status={iv.status} />
                    <span className="shrink-0 text-xs text-slate-300 tabular-nums">{fmtDT(iv.startAt)}</span>
                  </li>
                ))}
                {!todos.toFeedback.length && <EmptyState title="没有待填写的面评" hint="面试结束后记得回来填写评价" />}
              </ul>
            </Card>

            {/* 审批动态 */}
            <Card className="ws-rise overflow-hidden" style={rise(4)}>
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
                <span className="text-sm font-medium text-slate-900">审批动态</span>
                <span className="text-xs text-slate-400">近 14 天</span>
              </div>
              <ul className="divide-y divide-slate-100">
                {todos.offerUpdates.map((o) => (
                  <li key={o.offerId + o.side + o.updatedAt} onClick={() => go('offers')} className="flex cursor-pointer items-center gap-3 px-5 py-3 transition-colors hover:bg-slate-50">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">{o.candidateName}</span>
                    <span className="shrink-0 text-xs text-slate-500">
                      {o.side === 'feishu' ? '飞书审批' : 'BPM'} · {sideStateLabels[o.state]}
                    </span>
                    <span className="shrink-0 text-xs text-slate-300 tabular-nums">{fmtMD(o.updatedAt)}</span>
                  </li>
                ))}
                {!todos.offerUpdates.length && <EmptyState title="最近没有审批状态变化" hint="发起录取申请后，两侧的进度会同步到这里" />}
              </ul>
            </Card>
          </div>

          {/* 未来 7 天面试时间线 */}
          <section className="ws-rise" style={rise(5)}>
            <SectionHead title="未来 7 天面试" sub={days.length ? `共 ${days.reduce((n, d) => n + d.list.length, 0)} 场` : ''} />
            <Card>
              {days.length === 0 ? (
                <EmptyState
                  title="未来 7 天没有面试"
                  hint="到「约面」页为候选人安排第一场面试"
                  action={
                    <Btn variant="ghost" onClick={() => go('interviews')}>
                      去安排面试
                    </Btn>
                  }
                />
              ) : (
                <ol className="divide-y divide-slate-100">
                  {days.map((d) => (
                    <li key={d.key} className="flex gap-4 px-5 py-4">
                      <div className="w-20 shrink-0 pt-0.5 text-xs font-medium text-slate-500 tabular-nums">{d.label}</div>
                      <ul className="min-w-0 flex-1 space-y-2">
                        {d.list.map((iv) => (
                          <li key={iv.id} onClick={() => go('interviews')} className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-2 py-1.5 transition-colors hover:bg-slate-50">
                            <span className="text-sm font-medium text-slate-900 tabular-nums">
                              {fmtHM(iv.startAt)}–{fmtHM(iv.endAt)}
                            </span>
                            <span className="text-sm text-slate-700">{iv.candidateName}</span>
                            <span className="text-xs text-slate-400">
                              {iv.positionTitle} · {iv.round}
                            </span>
                            <span className="text-xs text-slate-400">{iv.mode === 'online' ? '线上' : iv.location || '线下'}</span>
                            <span className="ml-auto">
                              <InterviewStatusChip status={iv.status} />
                            </span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          </section>
        </>
      )}
    </div>
  )
}
