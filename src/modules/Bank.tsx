import { useState } from 'react'
import { Btn, Pill, Sec, useToast } from './ui'

interface BankProps {
  navTo?: (mod: string, params?: Record<string, any>) => void
  initialRole?: string
}

interface Question {
  id: string
  role: string
  part: string
  title: string
  q: string
  answer: string
  diff: '基础' | '进阶' | '专家'
  used: number
  passRate: string
}

const QUESTIONS: Question[] = [
  {
    id: 'Q-101', role: '前端工程', part: '框架原理', title: 'React 19 Server Components 与客户端状态解耦',
    q: '请阐述 RSC (React Server Components) 的通信协议与序列化边界，它与传统的 SSR 在数据流与打包产物上有何本质差异？',
    answer: 'RSC 运行且仅运行在服务端，组件代码完全不打包至客户端 bundle。服务端将渲染树流式序列化为特殊的 JSON-like 飞线协议，客户端利用该协议与 Client Components 树无缝拼装。相比传统 SSR，RSC 实现了零客户端 JS 依赖、完全避免客户端二次注水（Hydration）重复执行昂贵计算。',
    diff: '专家', used: 38, passRate: '42%'
  },
  {
    id: 'Q-102', role: '前端工程', part: '性能工程', title: '超大列表虚拟滚动中的动态行高估算与白屏优化',
    q: '在不定高卡片无限加载场景下，如何通过二分查找与滚动锚定 (Scroll Anchoring) 避免滚动条抖动与高速滑动下的白屏？',
    answer: '采用二分查找快速定位视口首屏元素索引；利用 ResizeObserver 实时测量真实渲染高度并动态修正前置元素偏移量缓存；引入 OverScan 预渲染缓冲区吸收高速惯性滚动；结合 transform: translate3d 开启 GPU 硬件加速。',
    diff: '进阶', used: 64, passRate: '56%'
  },
  {
    id: 'Q-103', role: '后端架构', part: '高并发', title: '分布式事务中的 TCC 与可靠消息最终一致性取舍',
    q: '在跨银行支付结算或优惠券核销链路中，为什么通常不选用 2PC/XA？TCC 的 Try-Confirm-Cancel 如何保证幂等和防悬挂？',
    answer: '2PC 在准备阶段长事务全局锁导致并发吞吐暴跌且有单点故障。TCC 是业务层两阶段：Try 阶段预留业务资源，Confirm 确认执行，Cancel 释放资源。防悬挂需要在 Cancel 时检测 Try 记录是否存在，并通过全局事务唯一 xid 状态机保证无论网络重发多少次都严格幂等。',
    diff: '专家', used: 52, passRate: '38%'
  },
  {
    id: 'Q-104', role: '数据科学', part: '特征工程', title: '深度推荐系统中的冷启动特征交叉与多任务学习',
    q: '在长尾商品/新用户冷启动场景下，如何利用 Multi-gate Mixture-of-Experts (MMoE) 结构平衡点击率 (CTR) 与转化率 (CVR) 的跷跷板效应？',
    answer: 'MMoE 针对每个任务分别设计专属的门控网络 (Gating Network)，门控根据输入特征动态决定对底层多个 Expert 共享子网络的权重分配，有效解决了强负相关任务下的负迁移 (Negative Transfer) 问题。',
    diff: '进阶', used: 29, passRate: '61%'
  },
  {
    id: 'Q-105', role: '通用能力', part: '系统设计', title: '高可用限流算法选型：漏桶、令牌桶与滑动窗口比较',
    q: '请对比三种主流限流算法在面对突发突刺流量、均匀整形流量时的优劣，并说明在分布式 Redis 集群中的原子计数实现。',
    answer: '令牌桶允许一定程度的突发流量（桶内积攒令牌一次性消耗）；漏桶强制以恒定速率输出，平滑整形；滑动窗口兼顾平滑度与突刺识别。在 Redis 中通常采用 Lua 脚本实现滑动窗口 zset 或令牌桶的原子读写。',
    diff: '基础', used: 88, passRate: '75%'
  },
]

export default function Bank({ navTo, initialRole }: BankProps) {
  const toast = useToast()
  const [roleFilter, setRoleFilter] = useState(initialRole || '全部')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showAiModal, setShowAiModal] = useState(false)
  const [aiGenerating, setAiGenerating] = useState(false)

  const roles = ['全部', '前端工程', '后端架构', '数据科学', '通用能力']

  const filtered = QUESTIONS.filter(q => {
    const matchRole = roleFilter === '全部' || q.role === roleFilter
    const matchText = (q.title + q.q + q.part).toLowerCase().includes(search.toLowerCase())
    return matchRole && matchText
  })

  const triggerAiGen = () => {
    setAiGenerating(true)
    setTimeout(() => {
      setAiGenerating(false)
      setShowAiModal(false)
      toast('✦ AI 针对选定岗位已自动生成 3 道定制面试题，已入库！')
    }, 1200)
  }

  return (
    <div className="h-full flex flex-col min-h-0 bg-canvas">
      {/* 顶部工具栏 */}
      <div className="h-12 px-5 border-b border-line bg-paper flex items-center gap-3 shrink-0 shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-[3px] bg-amber text-base font-bold flex items-center justify-center text-[12px]">题</span>
          <span className="font-semibold text-[13.5px] text-ink">知马 · 岗位智能题库</span>
          <span className="text-[11px] font-mono text-ink/45 ml-1">累计收录 184 题</span>
        </div>

        <div className="ml-auto flex items-center gap-2.5">
          <div className="relative">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜索考点、题干或关键字…"
              className="w-64 h-8 bg-[#faf8f3] border border-line rounded-[4px] pl-8 pr-3 text-[12px] outline-none focus:border-amber transition-all"
            />
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 absolute left-2.5 top-[9px] text-ink/40" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          </div>
          <Btn onClick={() => setShowAiModal(true)} className="h-8 border-amber/60 text-[#8a6410] bg-amber-soft font-medium">✦ AI 智能出题</Btn>
          <Btn primary className="h-8" onClick={() => toast('已打开手工录题表单')}>+ 添加题目</Btn>
        </div>
      </div>

      {/* 主体两栏 */}
      <div className="flex-1 min-h-0 p-5 flex gap-4">
        {/* 左侧岗位分类导航 (220px) */}
        <aside className="panel rounded-[6px] w-[220px] shrink-0 p-3 flex flex-col bg-paper">
          <div className="text-[11px] font-semibold text-ink/45 px-2 mb-2 tracking-wide uppercase">岗位与技术领域</div>
          <div className="space-y-1">
            {roles.map(r => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-[4px] text-[12.5px] font-medium transition-colors cursor-pointer ${roleFilter === r ? 'bg-amber text-base font-semibold shadow-xs' : 'text-ink/70 hover:bg-[#faf7f0]'}`}
              >
                <span>{r}</span>
                <span className={`text-[11px] font-mono ${roleFilter === r ? 'text-base/80 font-bold' : 'text-ink/40'}`}>
                  {r === '全部' ? QUESTIONS.length : QUESTIONS.filter(q => q.role === r).length}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-6 text-[11px] font-semibold text-ink/45 px-2 mb-2 tracking-wide uppercase">考核维度</div>
          <div className="space-y-1 text-[12px] text-ink/65 px-2">
            {['技术深度与实现', '大型系统设计', '业务与沟通', '架构与成本权衡'].map(d => (
              <div key={d} className="py-1 hover:text-ink cursor-pointer flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#cfc9ba]" />
                <span>{d}</span>
              </div>
            ))}
          </div>
        </aside>

        {/* 右侧题目清单 */}
        <section className="panel rounded-[6px] flex-1 min-w-0 flex flex-col">
          <div className="h-11 px-4 border-b border-line flex items-center bg-paper/60">
            <span className="w-[3px] h-3 bg-amber rounded-full mr-2" />
            <h2 className="text-[13px] font-semibold text-ink">{roleFilter} 题库</h2>
            <span className="ml-2 font-mono text-[11px] text-ink/40">匹配 {filtered.length} 道题目</span>
            <span className="ml-auto text-[11.5px] text-ink/45">点击题目可展开标准解答与参考答案</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {filtered.map(q => {
              const isOpen = expandedId === q.id
              return (
                <div key={q.id} className="border border-line rounded-[5px] bg-paper overflow-hidden hover:border-[#cfc9ba] transition-all shadow-2xs">
                  <div
                    onClick={() => setExpandedId(isOpen ? null : q.id)}
                    className="p-3.5 flex items-start gap-3 cursor-pointer bg-paper hover:bg-[#faf8f4] transition-colors"
                  >
                    <span className="font-mono text-[11px] text-ink/40 px-1.5 py-0.5 rounded bg-[#f4f2eb] mt-0.5">{q.id}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[13.5px] text-ink">{q.title}</span>
                        <span className="text-[10.5px] px-2 py-0.2 rounded-[2px] bg-[#eceae3] text-ink/70 font-medium">{q.part}</span>
                        <span className={`text-[10.5px] font-medium font-mono px-1.5 rounded-[2px] ${q.diff === '专家' ? 'bg-[#f6e3df] text-[#a8483a]' : q.diff === '进阶' ? 'bg-amber-soft text-[#8a6410]' : 'bg-[#e3f0df] text-[#3f7a3a]'}`}>
                          {q.diff}
                        </span>
                      </div>
                      <div className="text-[12px] text-ink/65 mt-1 line-clamp-1">{q.q}</div>
                    </div>
                    <div className="shrink-0 flex items-center gap-4 text-[11.5px] text-ink/45 font-mono">
                      <span>使用 {q.used} 次</span>
                      <span>通过率 {q.passRate}</span>
                      <span className="text-ink/30 transition-transform duration-200">{isOpen ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="p-4 pt-2 border-t border-dashed border-line bg-[#fdfcf9] space-y-3">
                      <div>
                        <div className="text-[11.5px] font-semibold text-ink/60 mb-1">完整题干描述：</div>
                        <div className="text-[12.5px] text-ink leading-relaxed p-2.5 rounded bg-paper border border-line">{q.q}</div>
                      </div>
                      <div>
                        <div className="text-[11.5px] font-semibold text-[#8a6410] mb-1">参考答案与评判要点：</div>
                        <div className="text-[12px] text-ink/80 leading-relaxed p-2.5 rounded bg-[#fcf9f0] border border-[#f0e4c6]">{q.answer}</div>
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <Btn className="h-7 text-[11.5px]" onClick={() => toast(`已将 ${q.id} 加入面试推荐题包`)}>+ 加入面试备选</Btn>
                        <Btn className="h-7 text-[11.5px]" onClick={() => {
                          toast(`已进入 ${q.id} 编辑状态`)
                        }}>编辑考点</Btn>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      </div>

      {/* AI 出题弹窗 */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-base/45 backdrop-blur-xs">
          <div className="panel-elevated rounded-[6px] w-[460px] bg-paper p-5 shadow-2xl border border-line animate-in fade-in duration-150">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2.5 h-2.5 rounded-full bg-amber" />
              <h3 className="font-semibold text-[14px] text-ink">✦ AI 智能生成岗位考题</h3>
              <button onClick={() => setShowAiModal(false)} className="ml-auto text-ink/40 hover:text-ink text-[14px] cursor-pointer">✕</button>
            </div>
            <div className="space-y-3 text-[12px]">
              <div>
                <label className="block text-ink/60 font-medium mb-1">目标岗位 / JD 角色：</label>
                <select className="w-full h-8 border border-line rounded-[3px] bg-[#faf8f3] px-2 outline-none">
                  <option>高级前端工程师 (React/微前端/跨端)</option>
                  <option>后端架构师 (分布式/高并发/K8s)</option>
                  <option>数据科学家 (LLM/推荐算法/强化学习)</option>
                  <option>产品设计负责人 (B端设计系统/增长)</option>
                </select>
              </div>
              <div>
                <label className="block text-ink/60 font-medium mb-1">侧重考察维度：</label>
                <div className="grid grid-cols-2 gap-2">
                  {['深度技术原理', '真实实战排错', '高可用系统设计', '成本与性能权衡'].map(d => (
                    <label key={d} className="flex items-center gap-1.5 p-2 rounded border border-line bg-[#faf8f3] cursor-pointer">
                      <input type="checkbox" defaultChecked className="accent-amber" />
                      <span>{d}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2 pt-3 border-t border-line">
              <Btn onClick={() => setShowAiModal(false)}>取消</Btn>
              <Btn primary disabled={aiGenerating} onClick={triggerAiGen}>
                {aiGenerating ? '正在调用大模型生成…' : '立即出题并入库'}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
