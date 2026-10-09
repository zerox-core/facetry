import type React from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import { Chip } from '../components/Chip'
import { toast } from '../components/Toast'
import { Btn, Card, Spinner } from '../components/ui'
import type { AdminOverview, AdminUser, OrgDept } from '../types'

const rise = (i: number) => ({ '--i': i } as React.CSSProperties)

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

export default function Admin() {
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

  const kw = search.trim().toLowerCase()
  const users = (overview?.users || []).filter((u) => !kw || u.name.toLowerCase().includes(kw) || u.groupName.toLowerCase().includes(kw))

  return (
    <div className="space-y-6">
      <div className="ws-rise flex items-end justify-between" style={rise(0)}>
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
                    {u.isAdmin && <Chip tone="blue">管理员</Chip>}
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
                  onClick={() => void toggleAdmin(u)}
                  title={u.isAdmin ? '撤销管理员' : '设为管理员'}
                  className={`h-8 cursor-pointer rounded-lg border px-3 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                    u.isAdmin ? 'border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {u.isAdmin ? '撤销管理员' : '设为管理员'}
                </button>
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
  )
}
