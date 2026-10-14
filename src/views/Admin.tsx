import { useState } from 'react'
import {
  can,
  currentUser,
  retryFailedBatch,
  simulateSyncFailure,
  sourceDbSync,
  triggerSourceDbSync,
  useStore,
} from '../store'
import type { Go } from '../App'
import { Btn, Chip, Empty, Field, Modal, type Tone } from './ui'

/* ───────────── 管理后台 · 模块 3：组织与成员（演示数据）───────────── */
type User = { name: string; role: string; dept: string; email: string; perm: string }

const USERS: User[] = [
  { name: '林婉', role: 'HR 业务伙伴 (HRG)', dept: '技术部 · 招聘中心', email: 'linwan@company.com', perm: '超级管理员 · 录取审批发起权限' },
  { name: '赵静', role: '招聘专员 (Recruiter)', dept: '技术部 · 招聘中心', email: 'zhaojing@company.com', perm: '约面与人才库管理 · 来源库同步' },
  { name: '张工', role: '大前端技术主管 (TL)', dept: '技术部 · 大前端架构组', email: 'zhang@company.com', perm: '面试官 · 题库维护 · 面评权限' },
  { name: '李工', role: '后端架构组主管', dept: '技术部 · 后端架构组', email: 'ligong@company.com', perm: '面试官 · 题库维护 · 面评权限' },
  { name: '王总', role: '产品中心总监', dept: '产品中心 · 商业化产品部', email: 'wang@company.com', perm: '终面面试官 · 录用意向确认' },
]

/** 组织架构：负责人 + 授权可见范围（成员数由 USERS.dept 实时统计，不写死） */
const DEPTS = [
  { name: '技术部 · 招聘中心', lead: '林婉', scope: '全岗位候选人、约面与录取申请发起' },
  { name: '技术部 · 大前端架构组', lead: '张工', scope: '前端 / 全栈候选人简历、附件与面评' },
  { name: '技术部 · 后端架构组', lead: '李工', scope: '后端候选人简历、附件与面评' },
  { name: '产品中心 · 商业化产品部', lead: '王总', scope: '产品岗候选人终面与录用意向确认' },
]

const ROLES = ['超级管理员', '招聘专员', '面试官', '审批人（飞书 / BPM 侧）', '只读查看']
const SCOPES = ['全部门 · 全部候选人', '技术部 · 前端候选人', '技术部 · 后端候选人', '产品中心 · 产品岗候选人', '仅本人面试分配']

type Grant = { id: string; member: string; role: string; scope: string; source: string }

const INIT_GRANTS: Grant[] = [
  { id: 'g1', member: '林婉', role: '超级管理员', scope: '全部门 · 全部候选人', source: 'ADMIN_USERS / SUPER_ADMIN_USERS' },
  { id: 'g2', member: '赵静', role: '招聘专员', scope: '全部门 · 全部候选人', source: '按组织授权' },
  { id: 'g3', member: '张工', role: '面试官', scope: '技术部 · 前端候选人', source: '按岗位分配' },
  { id: 'g4', member: '李工', role: '面试官', scope: '技术部 · 后端候选人', source: '按岗位分配' },
  { id: 'g5', member: '王总', role: '审批人（飞书 / BPM 侧）', scope: '产品中心 · 产品岗候选人', source: 'BPM 流程节点同步' },
]

/* ───────────── 来源库同步状态：状态 → 语义色 / 文案（字面量映射，勿拼接类名）───────────── */
type SyncStatus = 'idle' | 'syncing' | 'success' | 'error'

const SYNC_LABEL: Record<SyncStatus, string> = {
  idle: '正常待触发',
  syncing: '同步进行中',
  success: '同步正常',
  error: '同步异常',
}
const SYNC_TONE: Record<SyncStatus, Tone> = { idle: 'success', syncing: 'info', success: 'success', error: 'error' }
const SYNC_DOT: Record<SyncStatus, string> = {
  idle: 'bg-success',
  syncing: 'bg-info',
  success: 'bg-success',
  error: 'bg-error',
}

/* ───────────── 外部对接配置：三态（已配置 / 未配置 / 异常）─────────────
   安全约束：这里只登记 .env 变量名，任何密钥 / 令牌取值一律不进入前端。 */
type ConfState = 'ok' | 'missing' | 'error'

const CONF_LABEL: Record<ConfState, string> = { ok: '已配置', missing: '未配置', error: '异常' }
const CONF_TONE: Record<ConfState, Tone> = { ok: 'success', missing: 'warning', error: 'error' }

type Integration = {
  key: string
  name: string
  ability: string
  env: string[]
  secretEnv: string[]
  state: ConfState
  note: string
}

const INTEGRATIONS: Integration[] = [
  {
    key: 'feishu',
    name: '飞书开放平台应用',
    ability: '日历排期、线上视频会议、飞书审批发起与状态查询',
    env: ['FEISHU_APP_ID', 'FEISHU_REDIRECT_URI', 'FEISHU_APPROVAL_CODE'],
    secretEnv: ['FEISHU_APP_SECRET'],
    state: 'ok',
    note: '复用公司现有自建应用，未新建应用替换。',
  },
  {
    key: 'bpm',
    name: 'BPM 内部 OA 录取流程',
    ability: '录取流程发起、字段映射、状态同步与回调',
    env: ['BPM_API_BASE', 'BPM_APP_KEY'],
    secretEnv: ['BPM_APP_SECRET'],
    state: 'error',
    note: '上次探测失败：BPM_API_BASE 未解析成功，录取流程无法发起（联调期 mock 适配层可用）。',
  },
  {
    key: 'sms',
    name: '第三方短信通道',
    ability: '约面通知、改期取消提醒（候选人侧）',
    env: ['SMS_PROVIDER', 'SMS_SIGN_NAME', 'SMS_TEMPLATE_INTERVIEW'],
    secretEnv: ['SMS_ACCESS_KEY', 'SMS_SECRET_KEY'],
    state: 'missing',
    note: '服务商尚未选定，模板 ID 待业务方提供；当前约面通知仅走邮件通道。',
  },
  {
    key: 'mail',
    name: '企业邮件 SMTP 服务',
    ability: '候选人邀约函、改期说明与入职指引长文本',
    env: ['MAIL_SMTP_HOST', 'MAIL_SMTP_PORT', 'MAIL_USERNAME'],
    secretEnv: ['MAIL_PASSWORD'],
    state: 'ok',
    note: 'SSL 加密通道，发送失败进入重试队列。',
  },
  {
    key: 'minio',
    name: 'MinIO 对象存储',
    ability: '简历原件与平台模板文件分开存放并区分缺失状态',
    env: ['MINIO_ENDPOINT', 'MINIO_BUCKET'],
    secretEnv: ['MINIO_ACCESS_KEY', 'MINIO_SECRET_KEY'],
    state: 'error',
    note: '上次探测失败：存储桶只读策略校验未通过，附件预览可能回落到平台模板文件。',
  },
  {
    key: 'llm',
    name: '大模型 AI 服务（OpenAI 兼容）',
    ability: '宽松初筛、JD 出题、面评草稿（均需人工确认）',
    env: ['LLM_BASE_URL', 'LLM_MODEL'],
    secretEnv: ['LLM_API_KEY'],
    state: 'ok',
    note: 'AI 结果仅作参考，不自动淘汰候选人、不自动触发审批。',
  },
]

type Toast = { tone: 'success' | 'error' | 'warning'; text: string }

export default function Admin({ go }: { go: Go }) {
  useStore()
  const [busy, setBusy] = useState<'sync' | 'retry' | 'fail' | ''>('')
  const [toast, setToast] = useState<Toast | null>(null)
  // 权限：can('admin:view') 只对 admin 角色为真；非管理员进来只能只读查看，需显式开启演示开关才可写
  const isAdmin = can('admin:view')
  const [demoAdmin, setDemoAdmin] = useState(false)
  const allowed = isAdmin || demoAdmin

  const [conf, setConf] = useState<Record<string, ConfState>>(() => {
    const init: Record<string, ConfState> = {}
    INTEGRATIONS.forEach((it) => {
      init[it.key] = it.state
    })
    return init
  })
  const [confNote, setConfNote] = useState<Record<string, string>>({})
  const [probing, setProbing] = useState('')

  const [grants, setGrants] = useState<Grant[]>(INIT_GRANTS)
  const [addOpen, setAddOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<Grant | null>(null)
  const [grantDraft, setGrantDraft] = useState({ member: USERS[0].name, role: ROLES[1], scope: SCOPES[0] })
  const [grantErr, setGrantErr] = useState('')

  const status = sourceDbSync.status as SyncStatus
  const failed = sourceDbSync.failedBatch
  const hasError = status === 'error' || !!sourceDbSync.lastError

  const say = (t: Toast) => {
    setToast(t)
    window.setTimeout(() => setToast(null), 5000)
  }

  const needPerm = !allowed ? '需要 admin:view 权限：请以超级管理员身份操作，或开启下方演示开关' : undefined

  /** 同步三种动作：手动拉取 / 重跑失败批次 / 演示异常。失败一律显式展示，不静默吞错。 */
  const runSync = (mode: 'sync' | 'retry' | 'fail') => {
    if (!allowed || busy) return
    setBusy(mode)
    window.setTimeout(() => {
      if (mode === 'fail') {
        const st = simulateSyncFailure()
        say({ tone: 'error', text: `已模拟来源库读取异常：${st.lastError}；本批 ${st.failedBatch?.count ?? 0} 条进入可重跑队列` })
      } else if (mode === 'retry') {
        const res = retryFailedBatch()
        say({ tone: 'success', text: `失败批次重跑完成：补入 ${res.newCount} 条，${res.ignoredCount} 条已存在跳过（同一幂等键，不重复建档）` })
      } else {
        const res = triggerSourceDbSync()
        say({
          tone: 'success',
          text: `同步完成：新抓取到 ${res.newCount} 条新入库候选人，${res.ignoredCount} 条已存在跳过（幂等保护）；来源更新不覆盖已确认的面评与审批结果`,
        })
      }
      setBusy('')
    }, 600)
  }

  /** 演示：重新探测某个对接项。真实实现由后端健康检查完成，前端只读状态。 */
  const probe = (it: Integration) => {
    if (!allowed || probing) return
    setProbing(it.key)
    window.setTimeout(() => {
      setConf((s) => ({ ...s, [it.key]: 'ok' }))
      setConfNote((s) => ({ ...s, [it.key]: '探测通过（演示）：配置已生效并写入启动日志，取值不回显到前端。' }))
      setProbing('')
      say({ tone: 'success', text: `${it.name}：配置检测通过（演示）` })
    }, 600)
  }

  const submitGrant = () => {
    if (!allowed) return
    if (!grantDraft.member || !grantDraft.role || !grantDraft.scope) {
      setGrantErr('成员、角色与生效范围均为必填')
      return
    }
    const dup = grants.some((g) => g.member === grantDraft.member && g.role === grantDraft.role && g.scope === grantDraft.scope)
    if (dup) {
      setGrantErr('该成员已拥有同一角色在同一范围的授权，无需重复添加')
      return
    }
    setGrantErr('')
    setGrants((s) => [...s, { id: `g${s.length + 1}-${grantDraft.member}`, ...grantDraft, source: '管理后台手动授权' }])
    setAddOpen(false)
    say({ tone: 'success', text: `已为 ${grantDraft.member} 授予「${grantDraft.role}」，生效范围：${grantDraft.scope}` })
  }

  const removeGrant = () => {
    if (!removeTarget || !allowed) return
    setGrants((s) => s.filter((g) => g.id !== removeTarget.id))
    say({ tone: 'warning', text: `已移除 ${removeTarget.member} 的「${removeTarget.role}」授权，该成员立即失去对应范围的访问与操作能力` })
    setRemoveTarget(null)
  }

  return (
    <div className="space-y-6">
      {/* 顶部标题栏 */}
      <div className="ws-rise flex flex-col justify-between gap-4 border-b border-base-300 pb-5 md:flex-row md:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-base-content">系统管理与集成后台</h1>
            <Chip tone={SYNC_TONE[status]}>
              <span className={`h-1.5 w-1.5 rounded-full ${SYNC_DOT[status]}`} aria-hidden="true" />
              {status === 'error' ? '同步异常，存在待重跑批次' : SYNC_LABEL[status]}
            </Chip>
          </div>
          <p className="mt-1.5 text-xs text-base-content/60">
            影刀来源库只读同步健康度 · 飞书与内部 BPM 配置状态 · 组织架构与角色授权
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Btn
            variant="solid"
            disabled={!allowed || busy !== ''}
            loading={busy === 'sync'}
            title={needPerm}
            onClick={() => runSync('sync')}
          >
            立即触发来源库同步
          </Btn>
          <Btn variant="ghost" onClick={() => go('candidates')}>
            候选人大池
          </Btn>
        </div>
      </div>

      {/* 身份与权限说明：权限不足时明确说明，不静默 */}
      {!isAdmin && (
        <div className="ws-rise alert alert-soft alert-warning items-start">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">
              当前身份不具备管理后台权限（can('admin:view') = false），本页为只读查看
            </div>
            <p className="mt-1 text-xs">
              当前登录：{currentUser.name} · {currentUser.role === 'hr' ? 'HR 业务伙伴' : currentUser.role} · {currentUser.dept}
              。同步触发、失败批次重跑、配置重试与角色授权均需超级管理员权限；只读身份仍可查看同步健康度与配置状态。
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Btn variant="outline" disabled={demoAdmin} onClick={() => setDemoAdmin(true)}>
                {demoAdmin ? '已开启管理员演示' : '[演示] 以超级管理员身份操作'}
              </Btn>
              <span className="text-[11px] text-base-content/60">
                演示开关仅影响本页按钮可用性，不改变 can() 判定与后端权限模型。
              </span>
            </div>
          </div>
        </div>
      )}
      {isAdmin && (
        <div className="ws-rise alert alert-soft alert-success">
          <span className="text-xs">
            已以超级管理员身份进入：{currentUser.name} · {currentUser.dept}，拥有来源库同步、配置重试与角色授权权限。
          </span>
        </div>
      )}

      {toast && (
        <div
          className={`ws-rise alert alert-soft ${
            toast.tone === 'error' ? 'alert-error' : toast.tone === 'warning' ? 'alert-warning' : 'alert-success'
          }`}
        >
          <span className="text-xs">{toast.text}</span>
        </div>
      )}

      {/* 模块 1：来源数据库同步状态与监控（影刀 RPA 落库 · 只读接入） */}
      <section className="ws-rise [--i:1] card card-border bg-base-100 shadow-[var(--shadow-paper)]">
        <div className="card-body gap-4 p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-base-300 pb-3">
            <div className="flex items-center gap-2.5">
              <span className={`h-2.5 w-2.5 rounded-full ${SYNC_DOT[status]}`} aria-hidden="true" />
              <h2 className="text-base font-semibold text-base-content">来源数据库同步状态（影刀落库 · 只读接入）</h2>
            </div>
            <span className="text-xs text-base-content/50">MySQL 只读账号 · 按来源唯一标识幂等去重</span>
          </div>

          {/* 异常态：上次成功时间 + 失败原因 + 影响条数 + 重跑入口 */}
          {hasError ? (
            <div className="alert alert-soft alert-error items-start">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                  来源库读取失败
                  <Chip tone="error">影响 {failed?.count ?? 0} 条待同步</Chip>
                </div>
                <p className="mt-1 text-xs">失败原因：{sourceDbSync.lastError}</p>
                <p className="mt-1 text-xs">
                  上次成功同步时间：{sourceDbSync.lastSyncTime}
                  {failed ? ` · 本批首次失败于 ${failed.at}` : ''}
                </p>
                <p className="mt-1 text-xs">
                  影响范围：本批记录尚未建档，工作台已存在的候选人与已确认的阶段 / 面评 / 审批结果不受影响。
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Btn
                    variant="outline"
                    disabled={!allowed || busy !== '' || !sourceDbSync.canRetry}
                    loading={busy === 'retry'}
                    title={needPerm}
                    onClick={() => runSync('retry')}
                  >
                    重跑失败批次
                  </Btn>
                  <Btn variant="ghost" onClick={() => go('candidates')}>
                    核对受影响候选人
                  </Btn>
                  {!sourceDbSync.canRetry && <span className="text-[11px]">当前没有可重跑的失败批次</span>}
                </div>
              </div>
            </div>
          ) : (
            <div className="alert alert-soft alert-success">
              <span className="text-xs">
                读取正常：上次成功同步 {sourceDbSync.lastSyncTime}，累计同步 {sourceDbSync.totalSynced} 位候选人
                {sourceDbSync.status === 'syncing' ? '，当前批次仍在拉取中' : ''}。
              </span>
            </div>
          )}

          <div className="stats stats-vertical w-full border border-base-300 bg-base-200/60 sm:stats-horizontal">
            <div className="stat">
              <div className="stat-title text-xs">连接状态</div>
              <div className="stat-value flex items-center gap-2 text-base">
                <span className={`h-2 w-2 rounded-full ${SYNC_DOT[status]}`} aria-hidden="true" />
                {status === 'error' ? '异常（可重跑）' : sourceDbSync.connected ? SYNC_LABEL[status] : '未连接'}
              </div>
              <div className="stat-desc text-[11px]">SOURCE_DB_HOST / SOURCE_DB_USER（只读）</div>
            </div>
            <div className="stat">
              <div className="stat-title text-xs">上次成功同步时间</div>
              <div className="stat-value font-mono text-base">{sourceDbSync.lastSyncTime}</div>
              <div className="stat-desc text-[11px]">同步失败时保留最后成功时间，便于判断数据新鲜度</div>
            </div>
            <div className="stat">
              <div className="stat-title text-xs">已累计同步候选人</div>
              <div className="stat-value text-base tabular-nums">{sourceDbSync.totalSynced} 位</div>
              <div className="stat-desc text-[11px]">重复读取不重复建档</div>
            </div>
            <div className="stat">
              <div className="stat-title text-xs">最近批次增量</div>
              <div className="stat-value text-base tabular-nums">{sourceDbSync.lastBatchCount} 条</div>
              <div className="stat-desc text-[11px]">来源更新不覆盖已确认业务数据</div>
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs font-semibold text-base-content/60">同步事件日志</div>
            <div className="space-y-1.5">
              {sourceDbSync.logs.length ? (
                sourceDbSync.logs.map((log, i) => {
                  const bad = /失败|异常|超时|缺失/.test(log.msg)
                  return (
                    <div
                      key={`${log.time}-${i}`}
                      className={`flex items-start justify-between gap-3 rounded-lg px-3 py-2 text-xs ${
                        bad ? 'bg-error/5 text-error' : 'bg-base-200 text-base-content/70'
                      }`}
                    >
                      <span className="flex min-w-0 items-start gap-2 font-mono">
                        {bad && <Chip tone="error">失败</Chip>}
                        <span className="min-w-0">{log.msg}</span>
                      </span>
                      <span className="shrink-0 tabular-nums text-base-content/50">{log.time}</span>
                    </div>
                  )
                })
              ) : (
                <Empty title="暂无同步日志" hint="触发一次来源库同步后，这里会记录每次拉取的结果与失败原因。" />
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-base-300 pt-3">
            <Btn
              variant="ghost"
              disabled={!allowed || busy !== ''}
              loading={busy === 'fail'}
              title={needPerm ?? '演示：模拟只读连接超时，用于查看异常态与重跑入口'}
              onClick={() => runSync('fail')}
            >
              [演示] 模拟来源库异常
            </Btn>
            <span className="text-[11px] text-base-content/50">
              失败不静默：异常会保留最后成功时间、失败原因与影响条数，失败批次可重跑且不重复建档。
            </span>
          </div>
        </div>
      </section>

      {/* 模块 2：通知与审批对接配置状态（只显示 .env 变量名，不含任何密钥取值） */}
      <section className="ws-rise [--i:2] card card-border bg-base-100 shadow-[var(--shadow-paper)]">
        <div className="card-body gap-4 p-6">
          <div className="border-b border-base-300 pb-3">
            <h2 className="text-base font-semibold text-base-content">通知与审批对接配置状态</h2>
            <p className="mt-1 text-xs text-base-content/60">
              每项对接的状态来自后端启动自检与最近一次探测；异常项可重试，未配置项待运维在 .env 补全后自动生效。
            </p>
            <p className="mt-1 text-[11px] text-base-content/50">
              安全说明：本页只展示 .env 变量名与连通状态，密钥类变量的取值不下发、不回显、不打印。
            </p>
          </div>

          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {INTEGRATIONS.map((it) => {
              const state = conf[it.key]
              const note = confNote[it.key] ?? it.note
              return (
                <div key={it.key} className="card card-border bg-base-100">
                  <div className="card-body gap-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-base-content">{it.name}</h3>
                      <Chip tone={CONF_TONE[state]}>{CONF_LABEL[state]}</Chip>
                    </div>
                    <p className="text-xs text-base-content/60">{it.ability}</p>
                    <div className="space-y-1 text-[11px] text-base-content/50">
                      <div className="flex flex-wrap items-center gap-1">
                        <span>配置来源：</span>
                        {it.env.map((v) => (
                          <code key={v} className="kbd kbd-xs">
                            {v}
                          </code>
                        ))}
                      </div>
                      <div className="flex flex-wrap items-center gap-1">
                        <span>密钥类变量（仅变量名）：</span>
                        {it.secretEnv.map((v) => (
                          <code key={v} className="kbd kbd-xs">
                            {v}
                          </code>
                        ))}
                      </div>
                    </div>
                    <p
                      className={`text-[11px] ${
                        state === 'error' ? 'text-error' : state === 'missing' ? 'text-warning' : 'text-base-content/60'
                      }`}
                    >
                      {note}
                    </p>
                    <div className="card-actions mt-1 items-center justify-between gap-2">
                      <span className="text-[11px] text-base-content/50">
                        {state === 'ok' ? '最近探测通过' : state === 'missing' ? '等待 .env 补全' : '最近探测失败'}
                      </span>
                      {state === 'ok' ? (
                        <Btn
                          variant="ghost"
                          disabled={!allowed || probing !== ''}
                          loading={probing === it.key}
                          title={needPerm ?? '演示：实际接入后由后端健康检查完成'}
                          onClick={() => probe(it)}
                        >
                          重新检测
                        </Btn>
                      ) : (
                        <Btn
                          variant="outline"
                          disabled={!allowed || probing !== ''}
                          loading={probing === it.key}
                          title={needPerm ?? '演示：实际接入后由后端健康检查完成'}
                          onClick={() => probe(it)}
                        >
                          {state === 'error' ? '重试探测' : '我已补全，重新检测'}
                        </Btn>
                      )}
                    </div>
                    {it.key === 'bpm' && state === 'error' && (
                      <button
                        type="button"
                        onClick={() => go('approvals')}
                        className="link link-hover self-start text-[11px] text-base-content/70"
                      >
                        查看受影响的录取申请 →
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="alert alert-soft alert-info">
            <span className="text-xs">
              对接关系说明：飞书审批与 BPM 为两条独立轨道，串并联与最终结论来源由 HR 与流程负责人确认后配置；任一必需审批未完成，
              工作台都不会把申请标为整体通过。
            </span>
          </div>
        </div>
      </section>

      {/* 模块 3：组织架构 · 成员与角色授权 */}
      <section className="ws-rise [--i:3] card card-border bg-base-100 shadow-[var(--shadow-paper)]">
        <div className="card-body gap-5 p-6">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-base-300 pb-3">
            <div>
              <h2 className="text-base font-semibold text-base-content">组织架构 · 成员与角色授权</h2>
              <p className="mt-1 text-xs text-base-content/60">
                按岗位、部门与面试分配限制简历及附件访问；个人信息与录取材料按公司权限展示。
              </p>
            </div>
            <Chip tone={allowed ? 'success' : 'warning'}>
              {allowed ? '当前身份可管理授权' : '只读：需要 admin:view 权限'}
            </Chip>
          </div>

          {/* 组织架构 */}
          <div>
            <div className="mb-2 text-xs font-semibold text-base-content/60">部门与授权范围</div>
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <caption className="sr-only">部门、负责人、成员数与授权可见范围</caption>
                <thead>
                  <tr className="text-base-content/50">
                    <th scope="col">部门 / 组织</th>
                    <th scope="col">负责人</th>
                    <th scope="col">成员数</th>
                    <th scope="col">授权可见范围</th>
                  </tr>
                </thead>
                <tbody>
                  {DEPTS.map((d) => (
                    <tr key={d.name} className="hover:bg-base-200/60">
                      <td className="font-semibold text-base-content">{d.name}</td>
                      <td className="text-base-content/70">{d.lead}</td>
                      <td className="tabular-nums text-base-content/70">
                        {USERS.filter((u) => u.dept === d.name).length} 人
                      </td>
                      <td className="text-base-content/70">{d.scope}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 成员表 */}
          <div>
            <div className="mb-2 text-xs font-semibold text-base-content/60">团队成员</div>
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <caption className="sr-only">团队成员的角色职能、所属部门、邮箱与业务权限边界</caption>
                <thead>
                  <tr className="text-base-content/50">
                    <th scope="col">姓名</th>
                    <th scope="col">角色职能</th>
                    <th scope="col">组织架构 / 部门</th>
                    <th scope="col">邮箱</th>
                    <th scope="col">业务权限边界</th>
                  </tr>
                </thead>
                <tbody>
                  {USERS.map((u) => (
                    <tr key={u.name} className="hover:bg-base-200/60">
                      <td className="font-semibold text-base-content">
                        {u.name}
                        {u.name === currentUser.name && (
                          <Chip tone="info" className="ml-2">
                            当前身份
                          </Chip>
                        )}
                      </td>
                      <td className="text-base-content/70">{u.role}</td>
                      <td className="text-base-content/70">{u.dept}</td>
                      <td className="font-mono text-base-content/60">{u.email}</td>
                      <td className="font-medium text-base-content">{u.perm}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 角色授权列表 */}
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-semibold text-base-content/60">角色授权（{grants.length} 条生效中）</div>
              <Btn variant="outline" disabled={!allowed} title={needPerm} onClick={() => setAddOpen(true)}>
                新增角色授权
              </Btn>
            </div>
            {grants.length ? (
              <div className="overflow-x-auto">
                <table className="table table-sm">
                  <caption className="sr-only">角色授权：成员、角色、生效范围、授权来源与移除入口</caption>
                  <thead>
                    <tr className="text-base-content/50">
                      <th scope="col">成员</th>
                      <th scope="col">角色</th>
                      <th scope="col">生效范围</th>
                      <th scope="col">授权来源</th>
                      <th scope="col">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grants.map((g) => (
                      <tr key={g.id} className="hover:bg-base-200/60">
                        <td className="font-semibold text-base-content">{g.member}</td>
                        <td className="text-base-content/70">{g.role}</td>
                        <td className="text-base-content/70">{g.scope}</td>
                        <td className="text-base-content/60">{g.source}</td>
                        <td>
                          <Btn
                            variant="ghost"
                            disabled={!allowed}
                            title={needPerm}
                            ariaLabel={`移除 ${g.member} 的${g.role}授权`}
                            onClick={() => setRemoveTarget(g)}
                          >
                            移除
                          </Btn>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty title="暂无角色授权" hint="请为成员授予角色并指定生效范围，未授权成员无法访问候选人与附件。" />
            )}
          </div>
        </div>
      </section>

      {/* 新增授权 */}
      <Modal
        open={addOpen}
        onClose={() => {
          setAddOpen(false)
          setGrantErr('')
        }}
        title="新增角色授权"
        sub="授权立即生效；可按同一入口移除，移除后该成员对应范围的访问与操作能力同时失效"
        footer={
          <>
            <Btn
              variant="ghost"
              onClick={() => {
                setAddOpen(false)
                setGrantErr('')
              }}
            >
              取消
            </Btn>
            <Btn variant="solid" disabled={!allowed} title={needPerm} onClick={submitGrant}>
              保存授权
            </Btn>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="成员" htmlFor="grant-member" required hint="授权对象来自团队成员列表">
            <select
              id="grant-member"
              className="select w-full"
              value={grantDraft.member}
              onChange={(e) => setGrantDraft({ ...grantDraft, member: e.target.value })}
            >
              {USERS.map((u) => (
                <option key={u.name} value={u.name}>
                  {u.name} · {u.dept}
                </option>
              ))}
            </select>
          </Field>
          <Field label="角色" htmlFor="grant-role" required>
            <select
              id="grant-role"
              className="select w-full"
              value={grantDraft.role}
              onChange={(e) => setGrantDraft({ ...grantDraft, role: e.target.value })}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </Field>
          <Field label="生效范围" htmlFor="grant-scope" required hint="按岗位与部门限制简历、附件与录取材料可见范围">
            <select
              id="grant-scope"
              className="select w-full"
              value={grantDraft.scope}
              onChange={(e) => setGrantDraft({ ...grantDraft, scope: e.target.value })}
            >
              {SCOPES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
          {grantErr && <p className="text-[11px] text-error">{grantErr}</p>}
        </div>
      </Modal>

      {/* 移除授权二次确认 */}
      <Modal
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        title="移除角色授权"
        sub="该操作会立即回收权限，请确认影响范围"
        footer={
          <>
            <Btn variant="ghost" onClick={() => setRemoveTarget(null)}>
              取消
            </Btn>
            <Btn variant="danger" disabled={!allowed} title={needPerm} onClick={removeGrant}>
              确认移除
            </Btn>
          </>
        }
      >
        {removeTarget && (
          <p className="text-sm text-base-content/80">
            将移除 <b className="font-semibold">{removeTarget.member}</b> 的「{removeTarget.role}」授权，生效范围{' '}
            {removeTarget.scope}。移除后该成员立即失去上述范围的简历、附件与录取材料访问能力，进行中的操作需要重新授权才能继续；
            已产生的业务记录不会被删除。
          </p>
        )}
      </Modal>
    </div>
  )
}
