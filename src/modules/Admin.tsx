import { useState } from 'react'
import { Btn, Pill, Sec, useToast } from './ui'

interface AdminProps {
  navTo?: (mod: string, params?: Record<string, any>) => void
}

export default function Admin({ navTo }: AdminProps) {
  const toast = useToast()
  const [tab, setTab] = useState<'services' | 'team' | 'feishu'>('services')

  const SERVICES = [
    { name: 'LLM 智能大模型服务', provider: 'DeepSeek-V3 / Gemini-2.5-Pro', status: '正常运行', ping: '240ms', ok: true, desc: '驱动简历结构化提取、能力维度对齐、实时追问生成' },
    { name: '飞书组织与扫码登录', provider: 'Feishu Open Platform API', status: '正常运行', ping: '85ms', ok: true, desc: '支持企业内部员工一键扫码登录与组织人员同步' },
    { name: 'MinIO 对象存储服务', provider: 'S3-Compatible Object Store', status: '正常运行', ping: '12ms', ok: true, desc: '加密存储原始 PDF 简历、作品集附件与面试音视频' },
    { name: '通知与外部协同', provider: 'BPM 审批流 & 短信网关', status: '正常运行', ping: '110ms', ok: true, desc: '驱动面试邀约短信下发、Offer 审批加签提醒' },
  ]

  const MEMBERS = [
    { name: '王璐', role: 'HRBP / 招聘负责人', dept: '人力资源部', permissions: ['全量候选人', '面试安排', 'Offer 发起', '题库管理'] },
    { name: '吴总监', role: '技术中心负责人', dept: '技术中心', permissions: ['技术面评', 'Offer 终审', '题库出题'] },
    { name: '刘总', role: '业务 VP', dept: '总经办', permissions: ['VP 级审批', '全景看板', '战略规划'] },
    { name: '张工', role: '资深架构师 / 评委', dept: '技术中心', permissions: ['技术初面', '面评打分'] },
  ]

  return (
    <div className="h-full flex flex-col min-h-0 bg-canvas">
      {/* 顶部标题与 Tab 导航 */}
      <div className="h-12 px-5 border-b border-line bg-paper flex items-center gap-6 shrink-0 shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-[3px] bg-base text-paper font-bold flex items-center justify-center text-[12px]">设</span>
          <span className="font-semibold text-[13.5px] text-ink">系统与组织配置中心</span>
        </div>

        <div className="flex h-full">
          {[
            { id: 'services', label: '外部集成与服务健康度' },
            { id: 'team', label: '团队成员与面试官池 (4)' },
            { id: 'feishu', label: '飞书平台自建应用配置' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={`relative px-4 h-full text-[12.5px] font-medium transition-colors cursor-pointer ${tab === t.id ? 'text-ink font-semibold' : 'text-ink/50 hover:text-ink'}`}
            >
              {t.label}
              {tab === t.id && <span className="absolute inset-x-3 bottom-0 h-[2.5px] bg-amber rounded-t-sm" />}
            </button>
          ))}
        </div>

        <div className="ml-auto">
          <Btn primary className="h-8 text-[12px]" onClick={() => toast('已保存所有系统配置')}>保存当前配置</Btn>
        </div>
      </div>

      {/* 主体内容 */}
      <div className="flex-1 min-h-0 p-5 overflow-y-auto">
        {tab === 'services' && (
          <div className="space-y-4 max-w-4xl">
            <div className="panel rounded-[6px] p-5 space-y-4">
              <div className="flex items-center">
                <span className="w-[3.5px] h-3.5 bg-amber rounded-full mr-2.5" />
                <h3 className="text-[13px] font-semibold text-ink">第三方基础设施与微服务链路</h3>
                <Btn className="ml-auto h-7 text-[11.5px]" onClick={() => toast('所有微服务连通性诊断正常')}>重新检测网络连通性</Btn>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
                {SERVICES.map(s => (
                  <div key={s.name} className="p-4 rounded-[5px] border border-line bg-paper shadow-2xs hover:border-amber/50 transition-all flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="font-semibold text-[13px] text-ink">{s.name}</span>
                        <span className="ml-auto font-mono text-[11px] text-[#3f7a3a] bg-[#e3f0df] px-1.5 py-0.2 rounded-[2px]">{s.status}</span>
                      </div>
                      <div className="text-[11.5px] font-mono text-ink/45 mt-1">{s.provider}</div>
                      <div className="text-[12px] text-ink/70 mt-2 leading-relaxed">{s.desc}</div>
                    </div>
                    <div className="mt-3 pt-2 border-t border-line/60 flex items-center justify-between text-[11px] text-ink/40 font-mono">
                      <span>延迟响应：{s.ping}</span>
                      <span className="text-[#8a6410] cursor-pointer hover:underline" onClick={() => toast(`测试连接成功: ${s.name}`)}>测试请求 →</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'team' && (
          <div className="panel rounded-[6px] p-5 max-w-4xl space-y-4">
            <div className="flex items-center">
              <span className="w-[3.5px] h-3.5 bg-amber rounded-full mr-2.5" />
              <h3 className="text-[13px] font-semibold text-ink">招聘团队与评委名单</h3>
              <Btn primary className="ml-auto h-8 text-[12px]" onClick={() => toast('已打开添加成员抽屉')}>+ 添加招聘官/面试官</Btn>
            </div>
            <div className="divide-y divide-line border border-line rounded-[4px] bg-paper overflow-hidden">
              {MEMBERS.map(m => (
                <div key={m.name} className="p-3.5 flex items-center gap-4 hover:bg-[#faf8f4] transition-colors">
                  <span className="w-8 h-8 rounded-full bg-base text-paper font-semibold flex items-center justify-center text-[12px] shadow-xs">
                    {m.name[0]}
                  </span>
                  <div className="w-40">
                    <div className="font-semibold text-[13px] text-ink">{m.name}</div>
                    <div className="text-[11.5px] text-ink/50 mt-0.5">{m.dept}</div>
                  </div>
                  <div className="w-44 text-[12px] text-ink/75 font-medium">{m.role}</div>
                  <div className="flex-1 flex flex-wrap gap-1.5">
                    {m.permissions.map(p => (
                      <span key={p} className="text-[10.5px] px-2 py-0.5 rounded-[2px] bg-[#faf8f3] border border-line text-ink/70">
                        {p}
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2 text-[11.5px]">
                    <button className="text-[#8a6410] hover:underline cursor-pointer" onClick={() => toast(`正在编辑 ${m.name} 权限`)}>配置权限</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'feishu' && (
          <div className="panel rounded-[6px] p-5 max-w-2xl space-y-4 bg-paper">
            <div className="flex items-center">
              <span className="w-[3.5px] h-3.5 bg-amber rounded-full mr-2.5" />
              <h3 className="text-[13px] font-semibold text-ink">飞书开放平台企业应用凭据</h3>
            </div>
            <div className="space-y-3.5 text-[12px]">
              <div>
                <label className="block text-ink/60 font-medium mb-1">App ID (企业自建应用唯一标识)：</label>
                <input defaultValue="cli_a4d89e21f83c400d" className="w-full h-8 font-mono border border-line rounded-[3px] bg-[#faf8f3] px-2.5 outline-none" />
              </div>
              <div>
                <label className="block text-ink/60 font-medium mb-1">App Secret：</label>
                <input type="password" defaultValue="s8a7d9f6g2h1j3k4l5z6x7c8" className="w-full h-8 font-mono border border-line rounded-[3px] bg-[#faf8f3] px-2.5 outline-none" />
              </div>
              <div>
                <label className="block text-ink/60 font-medium mb-1">扫码登录重定向回调 URL (Redirect URI)：</label>
                <input defaultValue="http://127.0.0.1:8080/api/auth/feishu/callback" className="w-full h-8 font-mono border border-line rounded-[3px] bg-[#faf8f3] px-2.5 outline-none" />
              </div>
              <div className="p-3 bg-amber-soft/60 border border-[#ead9a6] rounded-[4px] text-[11.5px] text-[#8a6410] leading-relaxed">
                提示：本地开发与演示环境已自动启用 Mock 扫码机制，无需正式公网回调即可在弹窗内一键扫码体验完整审批流。
              </div>
            </div>
            <div className="pt-2">
              <Btn primary onClick={() => toast('飞书凭据验证通过并已安全保存')}>保存并验证凭据</Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
