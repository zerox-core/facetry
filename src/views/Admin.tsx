import { useState } from 'react'
import { sourceDbSync, triggerSourceDbSync } from '../store'
import type { Go } from '../App'
import { Btn, Card } from './ui'

const USERS = [
  { name: '林婉', role: 'HR 业务伙伴 (HRG)', email: 'linwan@company.com', perm: '超级管理员 · 录取审批发起权限' },
  { name: '赵静', role: '招聘专员 (Recruiter)', email: 'zhaojing@company.com', perm: '约面与人才库管理 · 来源库同步' },
  { name: '张工', role: '大前端技术主管 (TL)', email: 'zhang@company.com', perm: '面试官 · 题库维护 · 面评权限' },
  { name: '李工', role: '后端架构组主管', email: 'ligong@company.com', perm: '面试官 · 题库维护 · 面评权限' },
  { name: '王总', role: '产品中心总监', email: 'wang@company.com', perm: '终面面试官 · 录用意向确认' },
]

export default function Admin({ go }: { go: Go }) {
  const [syncing, setSyncing] = useState(false)
  const [syncLog, setSyncLog] = useState<string>('')

  const handleSyncNow = () => {
    setSyncing(true)
    setTimeout(() => {
      const res = triggerSourceDbSync()
      setSyncing(false)
      setSyncLog(`同步完成：新抓取到 ${res.newCount} 条新入库候选人，${res.ignoredCount} 条已存在跳过（幂等保护）`)
      setTimeout(() => setSyncLog(''), 4000)
    }, 700)
  }

  return (
    <div className="space-y-6">
      {/* 顶部标题栏 */}
      <div className="ws-rise flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-black/[0.08] pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-[#1d1d1f]">系统管理与集成后台</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              集成服务正常
            </span>
          </div>
          <p className="mt-1.5 text-xs text-[#6e6e73]">
            影刀来源库只读同步健康度 · 飞书与内部 BPM 配置 · 团队角色与组织权限
          </p>
        </div>

        <Btn variant="solid" onClick={handleSyncNow}>
          {syncing ? '正在拉取来源库…' : '🔄 立即触发来源库同步'}
        </Btn>
      </div>

      {syncLog && (
        <div className="login-fade rounded-2xl bg-emerald-50 px-4 py-3 text-xs text-emerald-800 border border-emerald-200/60">
          ✓ {syncLog}
        </div>
      )}

      {/* 模块 1：来源数据库同步状态与监控 (影刀 RPA 落库只读) */}
      <div className="ws-rise [--i:1] ws-paper rounded-2xl p-6 border border-black/[0.05] space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-black/[0.05]">
          <div className="flex items-center gap-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h2 className="text-base font-semibold text-[#1d1d1f]">来源数据库同步状态（影刀落库 · 只读接入）</h2>
          </div>
          <span className="text-xs text-[#86868b]">协议：MySQL 只读账号 · 自动幂等去重</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-4 text-xs">
          <div className="rounded-xl bg-[#f5f5f7] p-3.5">
            <div className="text-[#86868b]">连接状态</div>
            <div className="mt-1 text-base font-semibold text-emerald-700">正常已连接</div>
          </div>

          <div className="rounded-xl bg-[#f5f5f7] p-3.5">
            <div className="text-[#86868b]">上次同步时间</div>
            <div className="mt-1 text-base font-semibold text-[#1d1d1f] font-mono">{sourceDbSync.lastSyncTime}</div>
          </div>

          <div className="rounded-xl bg-[#f5f5f7] p-3.5">
            <div className="text-[#86868b]">已累计同步候选人</div>
            <div className="mt-1 text-base font-semibold text-[#1d1d1f]">{sourceDbSync.totalSynced} 位</div>
          </div>

          <div className="rounded-xl bg-[#f5f5f7] p-3.5">
            <div className="text-[#86868b]">最近批次增量</div>
            <div className="mt-1 text-base font-semibold text-[#1d1d1f]">{sourceDbSync.lastBatchCount} 条</div>
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold text-[#86868b] mb-2">同步事件日志历史</div>
          <div className="space-y-1.5 text-xs font-mono">
            {sourceDbSync.logs.map((log, i) => (
              <div key={i} className="rounded-lg bg-[#f5f5f7] px-3 py-2 flex items-center justify-between text-[#515154]">
                <span>{log.msg}</span>
                <span className="text-[#86868b]">{log.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 模块 2：外部服务与通道对接配置状态（不展示密钥） */}
      <div className="ws-rise [--i:2] ws-paper rounded-2xl p-6 border border-black/[0.05] space-y-4">
        <h2 className="text-base font-semibold text-[#1d1d1f]">外部系统与通道接入状态</h2>

        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 text-xs">
          {/* 飞书 */}
          <div className="rounded-xl border border-black/[0.06] p-4 bg-white space-y-1.5">
            <div className="flex items-center justify-between font-semibold">
              <span className="text-[#1d1d1f]">飞书开放平台应用</span>
              <span className="text-emerald-700">✓ 正常连通</span>
            </div>
            <div className="text-[#86868b]">权限：日历排期 API、线上视频会议、飞书审批</div>
            <div className="text-[11px] text-[#515154]">凭证复用自建应用，无硬编码</div>
          </div>

          {/* BPM */}
          <div className="rounded-xl border border-black/[0.06] p-4 bg-white space-y-1.5">
            <div className="flex items-center justify-between font-semibold">
              <span className="text-[#1d1d1f]">BPM 内部 OA 流程接口</span>
              <span className="text-emerald-700">✓ 正常连通</span>
            </div>
            <div className="text-[#86868b]">能力：录取流程双向触发、状态同步与回调</div>
            <div className="text-[11px] text-[#515154]">适配层隔离，防重复提交</div>
          </div>

          {/* 短信通知 */}
          <div className="rounded-xl border border-black/[0.06] p-4 bg-white space-y-1.5">
            <div className="flex items-center justify-between font-semibold">
              <span className="text-[#1d1d1f]">第三方短信通道服务</span>
              <span className="text-emerald-700">✓ 正常就绪</span>
            </div>
            <div className="text-[#86868b]">模板：约面通知模板、改期取消提醒</div>
            <div className="text-[11px] text-[#515154]">通道配置化，失败进入重试队列</div>
          </div>

          {/* 邮件通知 */}
          <div className="rounded-xl border border-black/[0.06] p-4 bg-white space-y-1.5">
            <div className="flex items-center justify-between font-semibold">
              <span className="text-[#1d1d1f]">企业邮件 SMTP 服务</span>
              <span className="text-emerald-700">✓ 正常就绪</span>
            </div>
            <div className="text-[#86868b]">能力：候选人长文本邀约函与入职指引</div>
            <div className="text-[11px] text-[#515154]">端口 465 SSL 加密通道</div>
          </div>

          {/* MinIO */}
          <div className="rounded-xl border border-black/[0.06] p-4 bg-white space-y-1.5">
            <div className="flex items-center justify-between font-semibold">
              <span className="text-[#1d1d1f]">MinIO 对象存储</span>
              <span className="text-emerald-700">✓ 桶已就绪</span>
            </div>
            <div className="text-[#86868b]">存储桶：facetry-resumes (只读原件)</div>
            <div className="text-[11px] text-[#515154]">支持原件与平台模板状态区分</div>
          </div>

          {/* LLM */}
          <div className="rounded-xl border border-black/[0.06] p-4 bg-white space-y-1.5">
            <div className="flex items-center justify-between font-semibold">
              <span className="text-[#1d1d1f]">大模型 AI 服务 (OpenAI 协议)</span>
              <span className="text-emerald-700">✓ 响应正常</span>
            </div>
            <div className="text-[#86868b]">模型：deepseek-chat / gpt-4o</div>
            <div className="text-[11px] text-[#515154]">驱动宽松初筛、JD出题与面评草稿</div>
          </div>
        </div>
      </div>

      {/* 模块 3：组织架构与用户权限 */}
      <div className="ws-rise [--i:3] ws-paper rounded-2xl p-6 border border-black/[0.05] space-y-4">
        <h2 className="text-base font-semibold text-[#1d1d1f]">团队组织成员与权限体系</h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-black/[0.06] text-[#86868b] font-semibold">
                <th className="py-2.5">姓名</th>
                <th>角色职能</th>
                <th>邮箱</th>
                <th>业务权限边界</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {USERS.map((u) => (
                <tr key={u.name} className="hover:bg-black/[0.01]">
                  <td className="py-3 font-semibold text-[#1d1d1f]">{u.name}</td>
                  <td className="text-[#515154]">{u.role}</td>
                  <td className="font-mono text-[#86868b]">{u.email}</td>
                  <td className="text-[#1d1d1f] font-medium">{u.perm}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
