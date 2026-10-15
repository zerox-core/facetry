import type React from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import type { Go } from '../App'
import { Chip } from '../components/Chip'
import { toast } from '../components/Toast'
import { Btn, Card, ScoreStamp, SectionHead, Spinner } from '../components/ui'
import { useJob } from '../store'
import type { AdminOverview, AdminUser, AuthUser, Bank, DashboardData, Integrations, JobDescription, OrgDept, SessionSummary } from '../types'
import { fmtTime, PhaseChip, ProgressBar, shortPartName } from './shared'

const rise = (i: number) => ({ '--i': i } as React.CSSProperties)

/** 系统接入状态：LLM / 飞书 / MinIO / 邮件 / 短信+BPM / 来源数据库，附来源库同步 */
function IntegrationsPanel() {
  const [data, setData] = useState<Integrations | null>(null)
  const [error, setError] = useState('')
  const reload = useCallback(async () => {
    try {
      setData(await api.adminIntegrations())
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : '集成状态加载失败')
    }
  }, [])
  useEffect(() => {
    void reload()
  }, [reload])
  const { job, run } = useJob(async () => {
    await reload()
    toast('来源库同步完成')
  })

  const dot = (ok: boolean) => <span className={`h-2 w-2 shrink-0 rounded-full ${ok ? 'bg-emerald-500' : 'bg-slate-300'}`} />
  const block = (title: string, ok: boolean, lines: (string | null | undefined | false)[], extra?: React.ReactNode) => (
    <Card className="px-4 py-3.5">
      <div className="flex items-center gap-2">
        {dot(ok)}
        <span className="text-sm font-medium text-slate-900">{title}</span>
        <span className={`ml-auto text-xs ${ok ? 'text-emerald-600' : 'text-slate-400'}`}>{ok ? '已配置' : '未配置'}</span>
      </div>
      <div className="mt-2 space-y-0.5 text-xs leading-5 text-slate-400">
        {lines.filter((l): l is string => !!l).map((l, i) => (
          <p key={i} className="truncate">{l}</p>
        ))}
      </div>
      {extra}
    </Card>
  )

  return (
    <section className="space-y-4">
      <SectionHead title="系统接入状态" sub="外部服务配置与来源库同步" />
      {error && (
        <Card className="px-5 py-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-amber-700">{error}</p>
            <Btn variant="ghost" className="h-8 px-3 text-xs" onClick={() => void reload()}>
              重试
            </Btn>
          </div>
        </Card>
      )}
      {!data && !error && (
        <Card className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
          <Spinner /> 正在加载…
        </Card>
      )}
      {data && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {block('LLM', data.llm.configured, [data.llm.configured ? `模型 ${data.llm.model || '默认'}` : 'AI 初筛 / 草稿将降级为本地规则'])}
          {block('飞书', data.feishu.configured, [
            data.feishu.calendar ? '日程已启用' : '日程未启用',
            data.feishu.approval ? '审批已启用' : '审批未启用（走 mock）',
          ])}
          {block('MinIO', data.minio.configured, [data.minio.configured ? '对象存储模式' : `本地存储模式（${data.minio.mode || 'local'}）`])}
          {block('邮件', data.smtp.configured, [data.smtp.configured ? 'SMTP 已配置' : '候选人邮件通知不可用'])}
          {block('短信 + BPM', data.sms.configured && data.bpm.mode !== 'mock', [
            data.sms.configured ? `短信：${data.sms.provider || '已配置'}` : '短信未配置',
            `BPM：${data.bpm.mode === 'mock' ? 'mock 适配层' : data.bpm.mode}`,
          ])}
          {block(
            '来源数据库',
            data.sourceDb.configured,
            [
              data.sourceDb.configured ? `类型 ${data.sourceDb.type || '—'}` : '未配置时同步生成演示数据（channel=demo）',
              data.sourceDb.lastSyncAt ? `上次同步 ${fmtTime(data.sourceDb.lastSyncAt)} · 新增 ${data.sourceDb.lastCount}` : '尚未同步过',
              `累计候选人 ${data.sourceDb.totalCandidates}`,
            ],
            <div className="mt-2 flex items-center gap-2">
              <Btn variant="ghost" className="h-8 px-3 text-xs" disabled={!!job} onClick={() => void run(api.adminSync())}>
                {job ? '同步中…' : '立即同步'}
              </Btn>
              {data.sourceDb.lastError && <span className="truncate text-xs text-red-500" title={data.sourceDb.lastError}>上次错误：{data.sourceDb.lastError}</span>}
            </div>,
          )}
        </div>
      )}
    </section>
  )
}

/** 组内容抽屉：超管从看板钻取查看某组的题库或岗位（只读） */
function GroupDrawer({ group, kind, onClose }: { group: { groupId: string; groupName: string }; kind: 'bank' | 'jds'; onClose: () => void }) {
  const [bank, setBank] = useState<Bank | null>(null)
  const [jds, setJds] = useState<JobDescription[] | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const run = kind === 'bank' ? api.bankGroup(group.groupId).then(setBank) : api.jdsGroup(group.groupId).then((r) => setJds(r.jds))
    void run.catch((e) => setError(e instanceof Error ? e.message : '加载失败，请重试'))
  }, [group.groupId, kind])

  const loading = kind === 'bank' ? !bank : !jds
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-[#1d2939]/50" onClick={onClose} />
      <div className="login-fade relative flex h-full w-full max-w-xl flex-col bg-white shadow-2xl" role="dialog" aria-modal="true">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              {group.groupName} · {kind === 'bank' ? '题库' : '岗位'}
            </h3>
            <p className="mt-0.5 text-xs text-slate-400">只读视图 · 共 {kind === 'bank' ? (bank?.questions.length ?? '…') : (jds?.length ?? '…')} 条</p>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭" className="cursor-pointer text-slate-400 hover:text-slate-700">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12 M18 6L6 18" /></svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-6 py-4">
          {error && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">{error}</p>}
          {loading && !error && (
            <p className="flex items-center justify-center gap-2 py-12 text-sm text-slate-400">
              <Spinner /> 正在加载…
            </p>
          )}
          {bank?.questions.map((q) => {
            const open = openId === q.id
            return (
              <div key={q.id} className="rounded-lg bg-slate-50 px-4 py-3">
                <button type="button" onClick={() => setOpenId(open ? null : q.id)} className="w-full cursor-pointer text-left">
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip tone="blue">{shortPartName(q.partName)}</Chip>
                    {q.userName && <span className="text-xs text-slate-400">{q.userName}</span>}
                    <span className="text-sm font-medium text-slate-900">{q.title || q.q}</span>
                  </div>
                  {q.title && <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-slate-500">{q.q}</p>}
                </button>
                {open && q.answer && <p className="mt-2 whitespace-pre-wrap border-t border-slate-200 pt-2 text-xs leading-5 text-slate-600">{q.answer}</p>}
              </div>
            )
          })}
          {bank && !bank.questions.length && <p className="py-12 text-center text-sm text-slate-400">该组暂无题目</p>}
          {jds?.map((j) => (
            <div key={j.id} className="rounded-lg bg-slate-50 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-slate-900">{j.title}</span>
                {j.company && <Chip>{j.company}</Chip>}
                <span className="text-xs text-slate-400">{j.userName}</span>
              </div>
              <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs leading-5 text-slate-500">{j.content}</p>
            </div>
          ))}
          {jds && !jds.length && <p className="py-12 text-center text-sm text-slate-400">该组暂无岗位</p>}
        </div>
      </div>
    </div>
  )
}

/** 成员简历抽屉：列出该成员全部简历，点击进入评审详情 */
function MemberDrawer({ member, sessions, onClose, go }: { member: { userId: string; name: string }; sessions: SessionSummary[]; onClose: () => void; go: Go }) {
  const list = sessions.filter((s) => s.userId === member.userId)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-[#1d2939]/50" onClick={onClose} />
      <div className="login-fade relative flex h-full w-full max-w-xl flex-col bg-white shadow-2xl" role="dialog" aria-modal="true">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">{member.name} 的简历</h3>
            <p className="mt-0.5 text-xs text-slate-400">共 {list.length} 份 · 点击查看详细面试情况（只读）</p>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭" className="cursor-pointer text-slate-400 hover:text-slate-700">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12 M18 6L6 18" /></svg>
          </button>
        </div>
        <ul className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto">
          {list.map((s) => (
            <li key={s.id} onClick={() => go('review', s.id)} className="flex cursor-pointer items-center gap-3 px-6 py-3.5 transition-colors hover:bg-slate-50">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-900">{s.name || '待解析'}</span>
                  <span className="truncate text-xs text-slate-400">{s.role || '—'}</span>
                </div>
                <p className="mt-0.5 truncate text-xs text-slate-400">{s.fileName}</p>
              </div>
              <ProgressBar scored={s.scoredCount} total={s.questionCount} />
              <PhaseChip phase={s.phase} questionCount={s.questionCount} jobState={s.jobState} />
              {s.avgScore !== null && <ScoreStamp score={s.avgScore} />}
              <span className="w-14 shrink-0 text-right text-xs text-slate-400">{fmtTime(s.updatedAt)}</span>
            </li>
          ))}
          {!list.length && <li className="px-6 py-12 text-center text-sm text-slate-400">该成员还没有简历</li>}
        </ul>
      </div>
    </div>
  )
}

/** 超管数据看板：全组织的简历、面试、题库、岗位汇总 */
function Dashboard({ go }: { go: Go }) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [member, setMember] = useState<{ userId: string; name: string } | null>(null)
  const [groupView, setGroupView] = useState<{ kind: 'bank' | 'jds'; groupId: string; groupName: string } | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    void api
      .adminDashboard()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : '看板加载失败'))
    void api
      .listSessions()
      .then(setSessions)
      .catch(() => {})
  }, [])
  if (error)
    return (
      <Card className="px-5 py-4">
        <p className="text-sm text-amber-700">{error}</p>
      </Card>
    )
  if (!data)
    return (
      <Card className="flex items-center justify-center gap-2 py-12 text-sm text-slate-400">
        <Spinner /> 正在加载看板…
      </Card>
    )
  const stats: [string, string | number, string][] = [
    ['用户', data.userCount, '已登录过的成员'],
    ['简历总数', data.sessions.total, `已完成评价 ${data.sessions.evaluated}`],
    ['题目总数', data.questions.total, `已评分 ${data.questions.scored}`],
    ['平均得分', data.questions.avgScore === null ? '—' : data.questions.avgScore.toFixed(1), '全部已评分题'],
    ['题库题目', data.bank.total, `${data.bank.byGroup.length} 个组`],
    ['岗位 JD', data.jds.total, `${data.jds.byGroup.length} 个组`],
  ]
  return (
    <section className="space-y-4">
      <SectionHead title="数据看板" sub="全部组织 · 仅超管可见" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {stats.map(([label, value, sub]) => (
          <Card key={label} className="px-4 py-3.5">
            <div className="text-xs font-medium text-slate-500">{label}</div>
            <div className="mt-1.5 text-2xl font-semibold text-slate-900 tabular-nums">{value}</div>
            <div className="mt-0.5 text-xs text-slate-400">{sub}</div>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-3 text-sm font-medium text-slate-900">成员面试情况</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400">
                <th className="px-5 py-2 font-medium">成员</th>
                <th className="py-2 font-medium">简历</th>
                <th className="py-2 font-medium">题目</th>
                <th className="py-2 font-medium">已评分</th>
                <th className="px-5 py-2 text-right font-medium">已评价</th>
              </tr>
            </thead>
            <tbody>
              {data.byUser.map((u) => (
                <tr key={u.userId} onClick={() => setMember(u)} className="cursor-pointer border-t border-slate-100 transition-colors hover:bg-slate-50">
                  <td className="px-5 py-2.5 font-medium text-slate-900">{u.name}</td>
                  <td className="py-2.5 tabular-nums text-slate-600">{u.sessions}</td>
                  <td className="py-2.5 tabular-nums text-slate-600">{u.questions}</td>
                  <td className="py-2.5 tabular-nums text-slate-600">{u.scored}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums text-slate-600">{u.evaluated}</td>
                </tr>
              ))}
              {!data.byUser.length && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-sm text-slate-400">
                    还没有简历数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-3 text-sm font-medium text-slate-900">最近活动</div>
          <ul className="divide-y divide-slate-100">
            {data.recent.map((s) => (
              <li key={s.id} onClick={() => go('review', s.id)} className="flex cursor-pointer items-center gap-3 px-5 py-2.5 transition-colors hover:bg-slate-50">
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium text-slate-900">{s.name || '待解析'}</span>
                  <span className="ml-2 text-xs text-slate-400">{s.role || '—'}</span>
                  <span className="ml-2 text-xs text-slate-300">by {s.ownerName}</span>
                </div>
                <PhaseChip phase={s.phase} questionCount={s.questionCount} />
                {s.avgScore !== null && <ScoreStamp score={s.avgScore} />}
                <span className="w-16 text-right text-xs text-slate-400">{fmtTime(s.updatedAt)}</span>
              </li>
            ))}
            {!data.recent.length && <li className="px-5 py-8 text-center text-sm text-slate-400">暂无活动</li>}
          </ul>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="px-5 py-4">
          <div className="text-sm font-medium text-slate-900">题库分布</div>
          <ul className="mt-3 space-y-2">
            {data.bank.byGroup.map((g) => (
              <li key={g.groupId || 'personal'} onClick={() => setGroupView({ kind: 'bank', groupId: g.groupId, groupName: g.groupName })} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1 text-sm transition-colors hover:bg-slate-50">
                <span className="min-w-0 flex-1 truncate text-slate-700">{g.groupName}</span>
                <span className="text-xs text-slate-400">共 {g.total} 题 · 自建 {g.custom}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="px-5 py-4">
          <div className="text-sm font-medium text-slate-900">岗位分布</div>
          <ul className="mt-3 space-y-2">
            {data.jds.byGroup.map((g) => (
              <li key={g.groupId || 'personal'} onClick={() => setGroupView({ kind: 'jds', groupId: g.groupId, groupName: g.groupName })} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1 text-sm transition-colors hover:bg-slate-50">
                <span className="min-w-0 flex-1 truncate text-slate-700">{g.groupName}</span>
                <span className="text-xs text-slate-400">{g.count} 个岗位</span>
              </li>
            ))}
            {!data.jds.byGroup.length && <li className="text-sm text-slate-400">暂无岗位</li>}
          </ul>
        </Card>
      </div>

      {member && <MemberDrawer member={member} sessions={sessions} go={go} onClose={() => setMember(null)} />}
      {groupView && <GroupDrawer group={groupView} kind={groupView.kind} onClose={() => setGroupView(null)} />}
    </section>
  )
}


type TreeNode = { dept: OrgDept; children: TreeNode[] }

/** 扁平部门表 → 树（根为 parentId 为空或找不到父级的部门） */
function buildTree(depts: Record<string, OrgDept>): TreeNode[] {
  const nodes = new Map<string, TreeNode>()
  for (const d of Object.values(depts)) nodes.set(d.id, { dept: d, children: [] })
  const roots: TreeNode[] = []
  for (const n of nodes.values()) {
    const parent = n.dept.parentId ? nodes.get(n.dept.parentId) : undefined
    if (parent && parent !== n) parent.children.push(n)
    else roots.push(n)
  }
  const sortRec = (list: TreeNode[]) => {
    list.sort((a, b) => a.dept.name.localeCompare(b.dept.name, 'zh'))
    list.forEach((n) => sortRec(n.children))
  }
  sortRec(roots)
  return roots
}

/** 单个部门勾选行（递归渲染子部门；默认收起，箭头展开） */
function DeptRow({
  node,
  checked,
  expanded,
  onToggle,
  onToggleOpen,
  depth,
}: {
  node: TreeNode
  checked: Set<string>
  expanded: Set<string>
  onToggle: (id: string) => void
  onToggleOpen: (id: string) => void
  depth: number
}) {
  const id = node.dept.id
  const expandable = node.children.length > 0
  const isOpen = expanded.has(id)
  return (
    <>
      <div className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50" style={{ marginLeft: depth * 20 }}>
        <button
          type="button"
          aria-label={isOpen ? '收起' : '展开'}
          onClick={() => expandable && onToggleOpen(id)}
          className={`grid h-5 w-5 shrink-0 place-items-center text-slate-400 ${expandable ? 'cursor-pointer hover:text-slate-700' : 'cursor-default opacity-0'}`}
        >
          <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 transition-transform duration-150 ${isOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>
        </button>
        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5">
          <input type="checkbox" checked={checked.has(id)} onChange={() => onToggle(id)} className="shrink-0 accent-blue-600" />
          <span className="truncate">{node.dept.name}</span>
        </label>
        {expandable && <span className="shrink-0 text-xs text-slate-400">{node.children.length} 个子部门</span>}
      </div>
      {isOpen &&
        node.children.map((c) => (
          <DeptRow key={c.dept.id} node={c} checked={checked} expanded={expanded} onToggle={onToggle} onToggleOpen={onToggleOpen} depth={depth + 1} />
        ))}
    </>
  )
}

/** 授权抽屉：参考飞书管理后台——当前已授权 + 组织树勾选（父部门自动含子部门） */
function GrantDrawer({ user, overview, onClose, onSaved }: { user: AdminUser; overview: AdminOverview; onClose: () => void; onSaved: () => void }) {
  const [checked, setChecked] = useState<Set<string>>(new Set(user.grants))
  const [expanded, setExpanded] = useState<Set<string>>(new Set()) // 组织树默认全部收起
  const [saving, setSaving] = useState(false)
  const tree = useMemo(() => buildTree(overview.depts), [overview.depts])
  const deptName = (id: string) => overview.depts[id]?.name || id

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const toggle = (id: string) =>
    setChecked((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const toggleOpen = (id: string) =>
    setExpanded((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const save = async () => {
    setSaving(true)
    try {
      await api.adminSetGrants(user.id, [...checked])
      toast('授权已更新')
      onSaved()
      onClose()
    } catch (e) {
      toast(e instanceof Error ? e.message : '保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-[#1d2939]/50" onClick={onClose} />
      <div className="login-fade relative flex h-full w-full max-w-lg flex-col bg-white shadow-2xl" role="dialog" aria-modal="true">
        <div className="border-b border-slate-100 px-6 py-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900">管理授权</h3>
              <p className="mt-0.5 text-xs text-slate-400">为该用户添加或撤销其他组织的内容查看权限（JD 与题库）</p>
            </div>
            <button type="button" onClick={onClose} aria-label="关闭" className="cursor-pointer text-slate-400 hover:text-slate-700">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12 M18 6L6 18" /></svg>
            </button>
          </div>
          <div className="mt-4 flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
            {user.avatar ? (
              <img src={user.avatar} alt={user.name} referrerPolicy="no-referrer" className="h-9 w-9 rounded-full object-cover" />
            ) : (
              <span className="grid h-9 w-9 place-items-center rounded-full bg-blue-50 text-sm text-blue-600">{user.name[0]}</span>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                {user.name}
                {user.isAdmin && <Chip tone="blue">管理员</Chip>}
              </div>
              <div className="truncate text-xs text-slate-400">{user.groupName || '未识别组织'}</div>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-4">
          <div>
            <div className="text-xs font-medium text-slate-500">当前已授权（{user.grants.length}）</div>
            <div className="mt-2 flex min-h-10 flex-wrap items-center gap-2 rounded-xl border border-dashed border-slate-200 px-3 py-2">
              {user.grants.length ? (
                user.grants.map((g) => (
                  <Chip key={g} tone="blue">
                    {deptName(g)}
                  </Chip>
                ))
              ) : (
                <span className="text-sm text-slate-400">暂未授权任何部门</span>
              )}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">添加授权 · 勾选父部门将自动包含全部子部门</div>
            {tree.length ? (
              <div className="mt-2 max-h-96 space-y-0.5 overflow-y-auto rounded-xl border border-slate-100 p-2">
                {tree.map((n) => (
                  <DeptRow key={n.dept.id} node={n} checked={checked} expanded={expanded} onToggle={toggle} onToggleOpen={toggleOpen} depth={0} />
                ))}
              </div>
            ) : (
              <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-700">
                暂无组织架构数据。管理员可点击右上角「同步组织架构」从飞书拉取（需要 contact:department.base:readonly 权限）。
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-3">
          <span className="text-xs text-slate-400">已选 {checked.size} 个部门</span>
          <div className="flex gap-2">
            <Btn variant="ghost" onClick={onClose}>
              取消
            </Btn>
            <Btn onClick={() => void save()} disabled={saving}>
              {saving ? '保存中…' : '确认授权'}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Admin({ me, go }: { me: AuthUser; go: Go }) {
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [granting, setGranting] = useState<AdminUser | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const reload = useCallback(async () => {
    try {
      setOverview(await api.adminOverview())
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败，请重试')
    }
  }, [])
  useEffect(() => {
    void reload()
  }, [reload])

  const refreshOrg = async () => {
    setRefreshing(true)
    try {
      const r = await api.adminRefreshOrg()
      setOverview((o) => (o ? { ...o, depts: r.depts, fetchedAt: r.fetchedAt } : o))
      toast(`已同步 ${Object.keys(r.depts).length} 个部门${r.syncedUsers ? `，补齐 ${r.syncedUsers} 人的组织信息` : ''}`)
      await reload()
    } catch (e) {
      toast(e instanceof Error ? e.message : '同步失败，请重试')
    } finally {
      setRefreshing(false)
    }
  }

  const toggleAdmin = async (u: AdminUser) => {
    try {
      await api.adminSetAdmin(u.id, !u.isAdmin)
      toast(u.isAdmin ? `已撤销 ${u.name} 的管理员权限` : `已将 ${u.name} 设为管理员`)
      await reload()
    } catch (e) {
      toast(e instanceof Error ? e.message : '操作失败，请重试')
    }
  }

  const toggleSuper = async (u: AdminUser) => {
    try {
      await api.adminSetSuper(u.id, !u.isSuper)
      toast(u.isSuper ? `已撤销 ${u.name} 的超管权限` : `已将 ${u.name} 设为超管`)
      await reload()
    } catch (e) {
      toast(e instanceof Error ? e.message : '操作失败，请重试')
    }
  }

  const toggleRole = async (u: AdminUser) => {
    const next = u.role === 'interviewer' ? 'hr' : 'interviewer'
    try {
      await api.adminSetRole(u.id, next)
      toast(next === 'interviewer' ? `已将 ${u.name} 设为面试官` : `已将 ${u.name} 设为 HR`)
      await reload()
    } catch (e) {
      toast(e instanceof Error ? e.message : '操作失败，请重试')
    }
  }

  const kw = search.trim().toLowerCase()
  const users = (overview?.users || []).filter((u) => !kw || u.name.toLowerCase().includes(kw) || u.groupName.toLowerCase().includes(kw))

  return (
    <div className="space-y-8">
      {me.isSuper && (
        <div className="ws-rise" style={rise(0)}>
          <Dashboard go={go} />
        </div>
      )}
      <div className="space-y-6">
        <div className="ws-rise flex items-end justify-between" style={rise(1)}>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">系统管理</h1>
          <p className="mt-1 text-sm text-slate-500">
            授权管理与组织架构同步{overview?.fetchedAt ? ` · 组织数据更新于 ${new Date(overview.fetchedAt).toLocaleString('zh-CN')}` : ''}
          </p>
        </div>
        <Btn variant="ghost" onClick={() => void refreshOrg()} disabled={refreshing}>
          {refreshing ? '同步中…' : '同步组织架构'}
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

      {!overview && !error && (
        <Card className="ws-rise flex items-center justify-center gap-2 py-20 text-sm text-slate-400" style={rise(1)}>
          <Spinner /> 正在加载…
        </Card>
      )}

      {overview && (
        <Card className="ws-rise overflow-hidden" style={rise(2)}>
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
            <span className="text-sm font-medium text-slate-900">用户授权名单</span>
            <span className="text-xs text-slate-400">
              {overview.users.length} 人 · {Object.values(overview.depts).length} 个部门
            </span>
          </div>
          <div className="border-b border-slate-100 px-5 py-2.5">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索姓名或部门，支持任意层级…" className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:w-80" />
          </div>
          <ul className="divide-y divide-slate-100">
            {users.map((u) => (
              <li key={u.id} className="flex items-center gap-3 px-5 py-3">
                {u.avatar ? (
                  <img src={u.avatar} alt={u.name} referrerPolicy="no-referrer" className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-xs text-slate-500">{u.name[0]}</span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-900">
                    {u.name}
                    {u.isSuper && <Chip tone="emerald">超管</Chip>}
                    {u.isAdmin && !u.isSuper && <Chip tone="blue">管理员</Chip>}
                    {u.role === 'interviewer' && <Chip tone="amber">面试官</Chip>}
                  </div>
                  <div className="truncate text-xs text-slate-400">{u.groupName || '未识别组织'}</div>
                </div>
                <div className="hidden flex-wrap items-center gap-1.5 md:flex">
                  {u.grants.length ? (
                    u.grants.slice(0, 3).map((g) => (
                      <Chip key={g} tone="amber">
                        {overview.depts[g]?.name || g}
                      </Chip>
                    ))
                  ) : (
                    <span className="text-xs text-slate-300">未授权其他组织</span>
                  )}
                  {u.grants.length > 3 && <span className="text-xs text-slate-400">+{u.grants.length - 3}</span>}
                </div>
                <Btn variant="ghost" className="h-8 px-3 text-xs" onClick={() => setGranting(u)}>
                  授权
                </Btn>
                <button
                  type="button"
                  onClick={() => void toggleRole(u)}
                  title={u.role === 'interviewer' ? '改回 HR（可看候选人库）' : '设为面试官（只见分配的面试）'}
                  className={`h-8 cursor-pointer rounded-lg border px-3 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 ${
                    u.role === 'interviewer' ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {u.role === 'interviewer' ? '改回 HR' : '设为面试官'}
                </button>
                <button
                  type="button"
                  onClick={() => void toggleAdmin(u)}
                  title={u.isAdmin ? '撤销管理员' : '设为管理员'}
                  className={`h-8 cursor-pointer rounded-lg border px-3 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                    u.isAdmin ? 'border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {u.isAdmin ? '撤销管理员' : '设为管理员'}
                </button>
                {me.isSuper && (
                  <button
                    type="button"
                    onClick={() => void toggleSuper(u)}
                    title={u.isSuper ? '撤销超管' : '设为超管'}
                    className={`h-8 cursor-pointer rounded-lg border px-3 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 ${
                      u.isSuper ? 'border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {u.isSuper ? '撤销超管' : '设为超管'}
                  </button>
                )}
              </li>
            ))}
            {!users.length && <li className="px-5 py-10 text-center text-sm text-slate-400">没有匹配的用户</li>}
          </ul>
        </Card>
      )}

      {granting && overview && (
        <GrantDrawer
          user={overview.users.find((u) => u.id === granting.id) || granting}
          overview={overview}
          onClose={() => setGranting(null)}
          onSaved={() => void reload()}
        />
      )}
      </div>
      <div className="ws-rise" style={rise(3)}>
        <IntegrationsPanel />
      </div>
    </div>
  )
}
