import { useState, useEffect } from 'react'
import { Btn, Pill, Sec, useToast } from './ui'

interface AssistProps {
  navTo?: (mod: string, params?: Record<string, any>) => void
  initialCand?: string
}

const TRANSCRIPT = [
  { time: '14:02', role: 'interviewer', name: '吴总监', text: '知远你好，先请简要介绍一下你在上一家公司主导的前端微前端或首屏渲染架构。' },
  { time: '14:03', role: 'candidate', name: '林知远', text: '好的吴老师。我们上一套系统是跨 6 条业务线的综合 B 端平台，痛点在于首屏 TTI 达到 3.8s，并且不同团队代码库耦合严重。我当时主导了微前端改造，采用分块预渲染加 Module Federation 架构，抽离了全局底座和共享依赖，将首屏平均 TTI 优化到了 1.2 秒以内。' },
  { time: '14:05', role: 'interviewer', name: '吴总监', text: '在多子应用并存时，你们如何处理全局状态同步与 CSS 样式隔离？有没有遇到内存泄露问题？' },
  { time: '14:06', role: 'candidate', name: '林知远', text: '样式隔离主要依靠 PostCSS 插件给选择器增加隔离命名空间，加上特定容器的 Shadow DOM。全局状态我们基于 EventBus 封装了带类型约束的发布订阅模型。内存泄漏问题我们确实踩过坑，主要是子应用卸载时第三方图表实例（如 ECharts）未完全 dispose，后来我们在子应用生命周期钩子里强制实现了统一销毁协议。' },
]

export default function Assist({ navTo, initialCand }: AssistProps) {
  const toast = useToast()
  const [cand, setCand] = useState(initialCand || '林知远')
  const [speaking, setSpeaking] = useState(true)
  const [messages, setMessages] = useState(TRANSCRIPT)
  const [activeTab, setActiveTab] = useState<'copilot' | 'bank' | 'draft'>('copilot')

  // 模拟 AI 实时生成追问建议
  const SUGGESTIONS = [
    { id: 's1', tag: '技术深度', q: '追问：针对 Shadow DOM 穿透与弹窗全局定位（如 Portals）时的处理方案？', reason: '候选人提及了 Shadow DOM，可考察对前端边界与底层特性的理解。' },
    { id: 's2', tag: '稳定性与容灾', q: '追问：当某个子应用 CDN 加载失败或发生运行时 Uncaught Error 时，你们的熔断降级方案是什么？', reason: '检验高可用架构设计与异常兜底能力。' },
    { id: 's3', tag: '业务落地', q: '追问：推动 6 条业务线团队配合接入统一规范时，如何平衡各团队的交付排期与阻力？', reason: '考察跨团队技术领导力与沟通协作。' },
  ]

  // 题库推荐
  const BANK_RECOMMENDED = [
    { title: '手写带有超时与重试的 Promise 并发控制器', type: '代码实现', diff: '中等' },
    { title: '大型微前端架构下的共享依赖版本冲突与沙箱机制', type: '系统设计', diff: '高级' },
    { title: '前端性能监控 SDK 如何无侵入捕获长任务 (Long Task) 与 FP/LCP', type: '底层原理', diff: '高级' },
  ]

  const insertQuestion = (q: string) => {
    toast(`已记录该问题至面试提纲`)
  }

  return (
    <div className="h-full flex flex-col min-h-0 bg-canvas">
      {/* 顶部副驾控制条 */}
      <div className="h-12 px-5 border-b border-line bg-paper flex items-center gap-4 shrink-0 shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-semibold text-[13px] text-ink">AI 面试实时副驾</span>
          <span className="text-[11px] px-2 py-0.5 rounded-[3px] bg-[#e1edf5] text-[#2f6f9a] font-medium font-mono">LIVE RECORDING</span>
        </div>
        <div className="h-4 w-px bg-line" />
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-ink/50">当前候选人：</span>
          <select value={cand} onChange={e => setCand(e.target.value)} className="h-7 px-2 border border-line rounded-[3px] bg-[#faf8f3] text-[12px] font-semibold text-ink outline-none">
            <option value="林知远">林知远 · 高级前端工程师 (复面)</option>
            <option value="陈默">陈默 · 后端架构师 (初面)</option>
            <option value="许星河">许星河 · 数据科学家 (终面)</option>
            <option value="周以宁">周以宁 · 产品设计负责人 (初面)</option>
          </select>
        </div>
        <div className="ml-auto flex items-center gap-2.5">
          <span className="text-[11.5px] font-mono text-ink/50">已进行 24 分 32 秒</span>
          <Btn primary className="h-7 text-[11.5px]" onClick={() => {
            toast('面试已结束，正在整理面评草稿')
            if (navTo) navTo('reviews', { candName: cand })
          }}>结束面试并评定 →</Btn>
        </div>
      </div>

      {/* 主体三栏布局 */}
      <div className="flex-1 min-h-0 p-4 grid grid-cols-12 gap-4">
        {/* 左侧：候选人考察基准 (3列) */}
        <section className="col-span-12 lg:col-span-3 panel rounded-[6px] flex flex-col">
          <div className="h-10 px-4 border-b border-line flex items-center bg-paper/60">
            <span className="w-[3px] h-3 bg-amber rounded-full mr-2" />
            <h3 className="text-[12.5px] font-semibold text-ink">考察重点与 JD 映射</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div>
              <div className="text-[11px] text-ink/45 font-medium">基本信息</div>
              <div className="text-[13px] font-semibold text-ink mt-0.5">{cand} · 7 年经验</div>
              <div className="text-[11.5px] text-ink/65 mt-0.5">浙江大学 · 硕士 · 技术中心</div>
            </div>
            <div className="p-3 bg-[#faf8f3] border border-line rounded-[4px] space-y-2">
              <div className="text-[11.5px] font-semibold text-[#8a6410]">本轮考察要点 (复面)</div>
              <ul className="text-[11.5px] text-ink/75 space-y-1.5 list-disc list-inside">
                <li>复杂微前端系统架构设计与治理</li>
                <li>海量数据列表与可视化性能极限调优</li>
                <li>跨业务线技术推广与团队影响力</li>
              </ul>
            </div>
            <div>
              <div className="text-[11.5px] font-semibold text-ink/80 mb-2">知识点命中度</div>
              <div className="space-y-2">
                {[
                  { name: '微前端沙箱与隔离', score: 92, ok: true },
                  { name: '首屏性能指标 (TTI/LCP)', score: 88, ok: true },
                  { name: '跨端方案与长任务调度', score: 65, ok: false },
                  { name: '异常熔断与稳定性建设', score: 70, ok: false },
                ].map(k => (
                  <div key={k.name} className="text-[11.5px]">
                    <div className="flex justify-between text-ink/70 mb-1">
                      <span>{k.name}</span>
                      <span className="font-mono font-semibold">{k.score}%</span>
                    </div>
                    <div className="h-1.5 bg-[#ebe7dc] rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${k.score}%`, background: k.score >= 80 ? '#d7a62a' : '#8b98a6' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 中间：实时转录流 (5列) */}
        <section className="col-span-12 lg:col-span-5 panel rounded-[6px] flex flex-col">
          <div className="h-10 px-4 border-b border-line flex items-center bg-paper/60">
            <span className="w-[3px] h-3 bg-amber rounded-full mr-2" />
            <h3 className="text-[12.5px] font-semibold text-ink">实时语音转录</h3>
            <span className="ml-auto text-[11px] text-ink/40">支持实时纠错与智能分段</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
            {messages.map((m, idx) => (
              <div key={idx} className={`p-3 rounded-[5px] border ${m.role === 'interviewer' ? 'bg-[#f8f6f0] border-line/80' : 'bg-paper border-[#e4ded2]'}`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`text-[11px] font-semibold px-1.5 py-0.2 rounded-[2px] ${m.role === 'interviewer' ? 'bg-base text-paper' : 'bg-amber text-base'}`}>
                    {m.role === 'interviewer' ? '面试官' : '候选人'}
                  </span>
                  <span className="text-[12px] font-medium text-ink">{m.name}</span>
                  <span className="ml-auto font-mono text-[10.5px] text-ink/40">{m.time}</span>
                </div>
                <div className="text-[12px] text-ink/85 leading-relaxed">{m.text}</div>
              </div>
            ))}
            <div className="p-2.5 rounded-[4px] bg-[#fbf9f4] border border-dashed border-amber/50 flex items-center gap-2 text-[11.5px] text-ink/50">
              <span className="w-2 h-2 rounded-full bg-amber animate-ping" />
              <span>正在实时收音并转写中…</span>
            </div>
          </div>
        </section>

        {/* 右侧：AI 实时追问建议与题库支撑 (4列) */}
        <section className="col-span-12 lg:col-span-4 panel rounded-[6px] flex flex-col">
          <div className="h-10 border-b border-line flex bg-paper/60 px-2">
            {[
              { id: 'copilot', label: '✦ AI 追问建议' },
              { id: 'bank', label: '题库匹配' },
              { id: 'draft', label: '实时面评草稿' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`relative px-3 h-full text-[12px] font-medium transition-colors cursor-pointer ${activeTab === tab.id ? 'text-ink font-semibold' : 'text-ink/50 hover:text-ink'}`}
              >
                {tab.label}
                {activeTab === tab.id && <span className="absolute inset-x-2 bottom-0 h-[2px] bg-amber rounded-t-sm" />}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === 'copilot' && (
              <div className="space-y-3">
                <div className="text-[11px] text-ink/50">大模型基于当前对话内容动态推断出以下关键追问：</div>
                {SUGGESTIONS.map(s => (
                  <div key={s.id} className="p-3 bg-paper rounded-[4px] border border-line hover:border-amber transition-all space-y-1.5 shadow-2xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] px-1.5 py-0.2 rounded-[2px] bg-amber-soft text-[#8a6410] font-semibold">{s.tag}</span>
                      <button onClick={() => insertQuestion(s.q)} className="ml-auto text-[11px] text-[#8a6410] hover:underline cursor-pointer">+ 采纳提问</button>
                    </div>
                    <div className="text-[12px] font-medium text-ink leading-snug">{s.q}</div>
                    <div className="text-[11px] text-ink/50 leading-tight">{s.reason}</div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'bank' && (
              <div className="space-y-2.5">
                <div className="text-[11px] text-ink/50">针对「高级前端工程师」题库推荐：</div>
                {BANK_RECOMMENDED.map((b, i) => (
                  <div key={i} className="p-3 bg-paper rounded-[4px] border border-line hover:border-amber transition-all">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[10.5px] px-1.5 py-0.2 rounded-[2px] bg-[#eceae3] text-ink/70 font-medium">{b.type}</span>
                      <span className="text-[10.5px] text-[#a8483a] font-mono font-medium">{b.diff}</span>
                      <button onClick={() => toast(`已向当前候选人出题：${b.title}`)} className="ml-auto text-[11px] text-[#8a6410] hover:underline">一键采用</button>
                    </div>
                    <div className="text-[12px] font-medium text-ink">{b.title}</div>
                  </div>
                ))}
                <Btn className="w-full h-8 text-[11.5px] mt-2" onClick={() => navTo && navTo('bank')}>去题库查看更多题目 →</Btn>
              </div>
            )}

            {activeTab === 'draft' && (
              <div className="space-y-3">
                <div className="text-[11.5px] text-ink/60">AI 正在根据问答自动打分与撰写评语：</div>
                <div className="space-y-2">
                  {[
                    { dim: '技术深度', score: 4.5, desc: '对微前端和编译层优化机制理解扎实，实操经验丰富。' },
                    { dim: '系统设计', score: 4.2, desc: '具备大型架构治理意识，关注隔离和资源清理。' },
                    { dim: '沟通表达', score: 4.0, desc: '条理清晰，能迅速抓住面试官问题关键点。' },
                  ].map(d => (
                    <div key={d.dim} className="p-2.5 bg-[#faf8f3] border border-line rounded-[4px]">
                      <div className="flex justify-between items-center text-[12px] font-semibold text-ink">
                        <span>{d.dim}</span>
                        <span className="text-[#8a6410] font-mono">{d.score} / 5.0</span>
                      </div>
                      <div className="text-[11px] text-ink/65 mt-1">{d.desc}</div>
                    </div>
                  ))}
                </div>
                <Btn primary className="w-full h-8 text-[12px] mt-2" onClick={() => {
                  toast('已将实时评语同步至面评模块')
                  if (navTo) navTo('reviews', { candName: cand })
                }}>同步到评审中心 →</Btn>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
