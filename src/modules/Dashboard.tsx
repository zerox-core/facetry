import { useState, useMemo } from 'react'
import { Btn, Pill, useToast } from './ui'

interface DashboardProps {
  navTo?: (mod: string, params?: Record<string, any>) => void
}

// 极简纯净的平滑细线曲线 (无发光无渐变)
function SmoothArea({ data, color = '#d7a62a', height = 36 }: { data: number[]; color?: string; height?: number }) {
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const width = 120

  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((v - min) / range) * (height - 6) - 3
    return [x, y]
  })

  const pathD = pts.reduce((acc, [x, y], i) => {
    if (i === 0) return `M ${x} ${y}`
    const [prevX, prevY] = pts[i - 1]
    const cx = (prevX + x) / 2
    return `${acc} C ${cx} ${prevY}, ${cx} ${y}, ${x} ${y}`
  }, '')

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-28 h-9 overflow-visible shrink-0">
      <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <circle cx={pts.at(-1)![0]} cy={pts.at(-1)![1]} r="2.5" fill={color} />
    </svg>
  )
}

// 环形进度圈
function ProgressRing({ value, size = 44, stroke = 4 }: { value: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c * (1 - value / 100)
  return (
    <div className="relative shrink-0 flex items-center justify-center" style={{ width: size, height: size }}>
      <svg className="-rotate-90 w-full h-full">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#ebe7dc" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#d7a62a" strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <span className="absolute text-[11px] font-mono font-bold text-ink tnum">{Math.round(value)}%</span>
    </div>
  )
}

// 模拟近 45 天招聘热力矩阵
function Heatmap({ onHoverDay }: { onHoverDay: (info: string) => void }) {
  const cells = useMemo(() => {
    let s = 19
    return Array.from({ length: 42 }).map((_, i) => {
      s = (s * 9301 + 49297) % 233280
      const count = Math.floor((s / 233280) * 12)
      return { day: i + 1, count }
    })
  }, [])

  return (
    <div className="flex gap-1.5 flex-wrap">
      {cells.map(c => {
        const bg =
          c.count === 0 ? '#ebe7dc' :
          c.count < 3 ? '#e5decb' :
          c.count < 6 ? '#d6caa6' :
          c.count < 9 ? '#d7a62a' : '#8a6410'
        return (
          <div
            key={c.day}
            onMouseEnter={() => onHoverDay(`3 月 ${c.day} 日 · 累计处理 ${c.count} 份简历与面试`)}
            className="w-3.5 h-3.5 rounded-[2px] transition-transform hover:scale-125 cursor-pointer shadow-2xs"
            style={{ background: bg }}
            title={`3月${c.day}日: ${c.count}条记录`}
          />
        )
      })}
    </div>
  )
}

export default function Dashboard({ navTo }: DashboardProps) {
  const toast = useToast()
  const [hoverTip, setHoverTip] = useState('鼠标悬停查看历史某日流转活跃度')
  const [todoFilter, setTodoFilter] = useState<'all' | 'urgent' | 'review'>('all')

  const go = (mod: string, params?: Record<string, any>) => {
    if (navTo) navTo(mod, params)
    else toast(`跳转至 ${mod}`)
  }

  // 待办数据
  const TODOS = [
    { id: 't1', title: '周以宁 · 产品设计负责人', sub: '初面已结束，等待你的专业面评反馈', time: '超时 4h', urgent: true, mod: 'reviews', tone: 'red' as const, badge: '面评待交', cand: '周以宁' },
    { id: 't2', title: '陈默 · 后端架构师', sub: '今日 15:30 终面（会议室 402），请准时出席', time: '今日 15:30', urgent: true, mod: 'interviews', tone: 'amber' as const, badge: '即将开始', cand: '陈默' },
    { id: 't3', title: '顾言 · 测试开发工程师', sub: 'VP 审批已通过，HR 待发放正式电子 Offer', time: '停留 1 天', urgent: false, mod: 'offers', tone: 'blue' as const, badge: 'Offer 待发', cand: '顾言' },
    { id: 't4', title: '苏晚晴 · HRBP', sub: '候选人技术深度与组织发展能力画像高度匹配', time: '2h 前', urgent: false, mod: 'talent', tone: 'green' as const, badge: '待初筛', cand: '苏晚晴' },
    { id: 't5', title: '许星河 · 数据科学家', sub: '两轮面评 4.5 分均通过，薪资超出带宽需加签', time: '待审批', urgent: true, mod: 'offers', tone: 'amber' as const, badge: '待定薪', cand: '许星河' },
  ]

  const filteredTodos = TODOS.filter(t => {
    if (todoFilter === 'urgent') return t.urgent
    if (todoFilter === 'review') return t.mod === 'reviews'
    return true
  })

  // 聚光灯候选人
  const SPOTLIGHTS = [
    { name: '许星河', role: '数据科学家 · P7', score: 98, stage: '终面通过', salary: '58K×16', tags: ['强化学习', '推荐算法', '浙大硕'], avatar: '许' },
    { name: '林知远', role: '高级前端工程师 · P7', score: 92, stage: '复面进行中', salary: '50K×16', tags: ['微前端', 'React 19', '性能极限'], avatar: '林' },
    { name: '陈默', role: '后端架构师 · P8', score: 95, stage: '今日终面', salary: '78K×16', tags: ['分布式', '高并发', 'K8s调度'], avatar: '陈' },
  ]

  // 部门编制
  const DEPTS = [
    { name: '技术中心', hc: 18, filled: 12, rate: 67 },
    { name: '数据中台', hc: 8, filled: 6, rate: 75 },
    { name: '设计中心', hc: 4, filled: 2, rate: 50 },
    { name: '产品部', hc: 6, filled: 5, rate: 83 },
  ]

  return (
    <div className="h-full flex flex-col min-h-0 overflow-y-auto bg-canvas">
      {/* 顶部：纯净雅致的纸质决策看板 (彻底摒弃黑底与渐变毛玻璃) */}
      <div className="shrink-0 px-5 pt-4 pb-2">
        <section className="panel rounded-[6px] p-4.5 bg-paper flex flex-col gap-3.5 shadow-2xs border border-line">
          {/* 上半部分：标题与操作动作 */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line/70 pb-3.5">
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-[3px] bg-amber text-base font-serif font-black flex items-center justify-center text-[13px] shadow-2xs">
                知
              </span>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="font-serif text-[17px] font-bold text-ink tracking-tight">
                    知马 · 招聘总览与态势看板
                  </h1>
                  <span className="text-[11px] px-2 py-0.5 rounded-[3px] bg-[#faf8f3] text-ink/65 border border-line font-mono">
                    2025 招聘季 · 第 11 周
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[3px] text-[11px] font-medium bg-[#e1edf5] text-[#2f6f9a]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#2f6f9a]" />
                    AI 协同已在线
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <Btn onClick={() => toast('✦ 已导出今日招聘决策简报')}>
                ✦ 导出简报
              </Btn>
              <Btn primary onClick={() => go('talent')}>
                人才库作业 →
              </Btn>
            </div>
          </div>

          {/* 下半部分：三列工整的晨间纪要条目 (纸本分栏排版) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3 bg-[#faf8f3] border border-line/80 rounded-[4px] flex items-start gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber mt-1.5 shrink-0" />
              <div>
                <div className="text-[11px] font-semibold text-ink/50 uppercase tracking-wide">在招与编制</div>
                <div className="text-[12.5px] font-medium text-ink mt-0.5">
                  在招核心岗位 <strong>14</strong> 个，重点攻坚「后端架构师」与「高级前端」
                </div>
                <div className="text-[11px] text-ink/45 mt-0.5 font-mono">HC 达成度 78.5% · 离季度目标差 6 人</div>
              </div>
            </div>

            <div className="p-3 bg-[#faf8f3] border border-line/80 rounded-[4px] flex items-start gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#c0604f] mt-1.5 shrink-0" />
              <div>
                <div className="text-[11px] font-semibold text-[#c0604f] uppercase tracking-wide">待办与预警</div>
                <div className="text-[12.5px] font-medium text-ink mt-0.5">
                  候选人「周以宁」初面已超 4h SLA，等待专业面评
                </div>
                <div className="text-[11px] text-ink/45 mt-0.5 font-mono">已停留 4 小时 · 建议优先催办评委</div>
              </div>
            </div>

            <div className="p-3 bg-[#faf8f3] border border-line/80 rounded-[4px] flex items-start gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3f7a3a] mt-1.5 shrink-0" />
              <div>
                <div className="text-[11px] font-semibold text-[#3f7a3a] uppercase tracking-wide">高意向突破</div>
                <div className="text-[12.5px] font-medium text-ink mt-0.5">
                  数据科学家「许星河」(匹配度 98) 终面通过
                </div>
                <div className="text-[11px] text-ink/45 mt-0.5 font-mono">P7 职级带宽已确认 · 正在审批流</div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* 核心指标仪表舱 (6 个卡片，带平滑面积图与微渐变) */}
      <div className="shrink-0 px-5 py-2 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {[
          { label: '在招核心岗位', val: '14', unit: '个', tag: 'P0 级 2 个', data: [8, 9, 11, 10, 12, 13, 14], color: '#d7a62a' },
          { label: '待处理核心待办', val: '5', unit: '项', tag: '1 项面评超时', data: [2, 3, 5, 4, 6, 4, 5], color: '#c0604f', warn: true },
          { label: '今日面试排期', val: '4', unit: '场', tag: '1 场实时进行中', data: [2, 3, 4, 3, 5, 3, 4], color: '#3b5b8c' },
          { label: '在途 Offer 审批', val: '3', unit: '份', tag: '总金额 184.5 万', data: [1, 2, 2, 3, 2, 3, 3], color: '#2d5a4c' },
          { label: '简历平均处理流转', val: '18.5', unit: 'h', tag: 'SLA 达成 92%', data: [26, 24, 22, 21, 20, 19, 18], color: '#8a6410' },
          { label: 'Q1 HC 招聘达成率', val: '78.5', unit: '%', tag: '离目标还差 6 人', ring: 78.5, color: '#d7a62a' },
        ].map((item, idx) => (
          <div
            key={idx}
            className="panel-card rounded-[6px] p-3.5 bg-paper flex items-end justify-between hover:shadow-md hover:border-[#cfc9ba] transition-all group cursor-pointer"
            onClick={() => {
              if (idx === 0) go('jobs')
              else if (idx === 1) go('talent')
              else if (idx === 2) go('interviews')
              else if (idx === 3) go('offers')
              else if (idx === 4) go('reviews')
              else go('talent')
            }}
          >
            <div>
              <div className="text-[11.5px] text-ink/50 font-medium group-hover:text-ink transition-colors">
                {item.label}
              </div>
              <div className="font-serif text-[24px] font-bold leading-tight tnum mt-0.5 text-ink">
                {item.val}
                <span className="text-[12px] font-sans font-normal text-ink/45 ml-0.5">{item.unit}</span>
              </div>
              <div className={`text-[10.5px] mt-0.5 font-medium ${item.warn ? 'text-[#c0604f]' : 'text-ink/50'}`}>
                {item.tag}
              </div>
            </div>
            {item.ring ? (
              <ProgressRing value={item.ring} />
            ) : (
              <SmoothArea data={item.data} color={item.color} />
            )}
          </div>
        ))}
      </div>

      {/* 主体作业网格 (12 列全面布局，彻底消除右下角空白) */}
      <div className="flex-1 min-h-0 px-5 py-2 grid grid-cols-12 gap-4">
        {/* 左侧主力区 (占 8 列)：全景转化漏斗 + 待办战备中心 + 60天热力 */}
        <div className="col-span-12 xl:col-span-8 flex flex-col gap-4">
          {/* 1. 招聘全景阶梯转化漏斗 */}
          <section className="panel rounded-[6px] p-4.5 bg-paper flex flex-col shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center">
                <span className="w-[3.5px] h-3.5 bg-amber rounded-full mr-2.5" />
                <h2 className="text-[13.5px] font-semibold text-ink">招聘全链路转化效能漏斗</h2>
                <span className="ml-2 font-mono text-[11px] text-ink/40">累计处理 128 人次</span>
              </div>
              <span className="text-[11px] text-ink/45 font-mono">从投递到入职平均周期：23.4 天</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-6 gap-2 pt-1">
              {[
                { name: '简历投递', count: 128, sub: '初筛通过率', rate: '37.5%', span: '1.2 天' },
                { name: '初筛通过', count: 48, sub: '进面率', rate: '54.2%', span: '2.1 天' },
                { name: '面试排期', count: 26, sub: '面评通过率', rate: '42.3%', span: '3.4 天' },
                { name: '面评通过', count: 11, sub: 'Offer 发放率', rate: '54.5%', span: '1.8 天' },
                { name: 'Offer 发放', count: 6, sub: '候选人接受率', rate: '66.7%', span: '2.5 天' },
                { name: '成功入职', count: 4, sub: 'HC 完成度', rate: '78.5%', span: '已归档' },
              ].map((step, idx) => (
                <div
                  key={idx}
                  onClick={() => go('talent')}
                  className="p-3 rounded-[4px] border border-line bg-[#fdfcf9] hover:bg-amber-soft/40 hover:border-amber/60 transition-all cursor-pointer relative group flex flex-col items-center justify-between min-h-[92px]"
                >
                  <div className="text-[11px] text-ink/50 font-medium">{step.name}</div>
                  <div className="font-serif text-[22px] font-bold text-ink tnum group-hover:text-[#8a6410]">
                    {step.count}
                  </div>
                  <div className="w-full text-center">
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-[2px] bg-amber-soft text-[#8a6410] font-semibold">
                      {step.rate}
                    </span>
                  </div>
                  {idx < 5 && (
                    <span className="hidden md:block absolute -right-2 top-1/2 -translate-y-1/2 z-10 text-ink/30 font-mono text-[10px]">
                      ›
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* 2. 待办战备处理中心 */}
          <section className="panel rounded-[6px] flex flex-col bg-paper shadow-2xs">
            <div className="h-11 px-4.5 border-b border-line flex items-center justify-between bg-paper/60">
              <div className="flex items-center gap-2">
                <span className="w-[3.5px] h-3.5 bg-amber rounded-full" />
                <h3 className="text-[13px] font-semibold text-ink">我的紧急待办与推进</h3>
                <span className="text-[11px] font-mono text-ink/40">({filteredTodos.length})</span>
              </div>
              <div className="flex items-center gap-2">
                {(['all', 'urgent', 'review'] as const).map(tabKey => (
                  <button
                    key={tabKey}
                    onClick={() => setTodoFilter(tabKey)}
                    className={`px-2.5 py-1 text-[11.5px] rounded-[3px] font-medium transition-colors cursor-pointer ${todoFilter === tabKey ? 'bg-base text-paper font-semibold' : 'text-ink/60 hover:bg-[#faf7f0]'}`}
                  >
                    {tabKey === 'all' ? '全部' : tabKey === 'urgent' ? '⚠️ 超时催办' : '📝 待评审'}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3 divide-y divide-line/60">
              {filteredTodos.map(todo => (
                <div
                  key={todo.id}
                  onClick={() => go(todo.mod, { candName: todo.cand })}
                  className="py-2.5 px-3 flex items-center gap-3.5 hover:bg-[#faf7f0] rounded-[4px] transition-colors cursor-pointer group"
                >
                  <Pill t={todo.tone}>{todo.badge}</Pill>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold text-ink group-hover:text-[#8a6410] transition-colors">
                        {todo.title}
                      </span>
                      <span className={`text-[11px] font-mono ml-auto ${todo.urgent ? 'text-[#c0604f] font-semibold' : 'text-ink/40'}`}>
                        {todo.time}
                      </span>
                    </div>
                    <div className="text-[11.5px] text-ink/60 mt-0.5 truncate">{todo.sub}</div>
                  </div>
                  <Btn className="h-7 text-[11.5px] px-3 shrink-0 group-hover:border-amber transition-colors">
                    立即处理 →
                  </Btn>
                </div>
              ))}
            </div>
          </section>

          {/* 3. 60 天人才流转与面试密度热力图 (GitHub 风格矩阵) */}
          <section className="panel rounded-[6px] p-4.5 bg-paper shadow-2xs">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center">
                <span className="w-[3.5px] h-3.5 bg-amber rounded-full mr-2.5" />
                <h3 className="text-[13px] font-semibold text-ink">近 42 天人才吞吐与面试负荷热力点阵</h3>
              </div>
              <div className="text-[11px] text-ink/50 font-mono">{hoverTip}</div>
            </div>
            <div className="flex items-center justify-between pt-1">
              <Heatmap onHoverDay={msg => setHoverTip(msg)} />
              <div className="flex items-center gap-1.5 text-[10.5px] text-ink/45 font-mono ml-4 shrink-0">
                <span>少</span>
                <span className="w-2.5 h-2.5 rounded-[1px] bg-[#ebe7dc]" />
                <span className="w-2.5 h-2.5 rounded-[1px] bg-[#e5decb]" />
                <span className="w-2.5 h-2.5 rounded-[1px] bg-[#d6caa6]" />
                <span className="w-2.5 h-2.5 rounded-[1px] bg-[#d7a62a]" />
                <span className="w-2.5 h-2.5 rounded-[1px] bg-[#8a6410]" />
                <span>多</span>
              </div>
            </div>
          </section>
        </div>

        {/* 右侧态势区 (占 4 列)：今日实时战场雷达 + 聚光灯候选人 + 部门战况 */}
        <div className="col-span-12 xl:col-span-4 flex flex-col gap-4">
          {/* 1. 今日面试态势感知雷达 (带有实时 LIVE 脉冲) */}
          <section className="panel rounded-[6px] flex flex-col bg-paper shadow-2xs">
            <div className="h-11 px-4.5 border-b border-line flex items-center justify-between bg-paper/60">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <h3 className="text-[13px] font-semibold text-ink">今日面试态势感知雷达</h3>
              </div>
              <button
                onClick={() => go('interviews')}
                className="text-[11.5px] text-[#8a6410] font-medium hover:underline cursor-pointer"
              >
                排期总览 →
              </button>
            </div>

            <div className="p-3.5 space-y-3">
              {/* 实时进行中的高光卡片 (纯净纸质底色，无渐变) */}
              <div className="p-3 rounded-[5px] border border-amber/70 bg-[#fcf9f0] shadow-2xs relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber text-base font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-base animate-ping" />
                    LIVE 进行中
                  </span>
                  <span className="text-[11px] font-mono text-ink/50">已进行 24m / 60m</span>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="font-serif text-[18px] font-bold text-ink">林知远</span>
                  <span className="text-[12px] text-ink/70 font-medium">高级前端工程师 · 复面</span>
                </div>
                <div className="text-[11px] text-ink/50 mt-1 flex items-center gap-3">
                  <span>主考官：吴总监、张工</span>
                  <span>会议室：A-302</span>
                </div>
                <div className="mt-2.5 pt-2 border-t border-amber/30 flex items-center justify-between">
                  <span className="text-[11px] text-[#8a6410] font-medium">AI 实时音波捕获中</span>
                  <Btn primary className="h-7 text-[11px] px-3" onClick={() => go('assist', { cand: '林知远' })}>
                    进入 AI 副驾 🎙️
                  </Btn>
                </div>
              </div>

              {/* 后续排期 */}
              {[
                { time: '14:00', name: '许星河', role: '数据科学家 (终面)', who: '刘总', room: '线上腾讯会议' },
                { time: '15:30', name: '陈默', role: '后端架构师 (初面)', who: '张工', room: '会议室 402' },
              ].map((iv, idx) => (
                <div key={idx} className="p-2.5 rounded-[4px] border border-line bg-[#fdfcf9] flex items-center justify-between hover:border-amber/50 transition-colors">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-[#8a6410] font-bold bg-amber-soft px-1.5 rounded">
                        {iv.time}
                      </span>
                      <span className="font-semibold text-[12.5px] text-ink">{iv.name}</span>
                      <span className="text-[11px] text-ink/50 truncate max-w-[120px]">{iv.role}</span>
                    </div>
                    <div className="text-[10.5px] text-ink/40 mt-1 pl-1">
                      面试官：{iv.who} · {iv.room}
                    </div>
                  </div>
                  <Btn className="h-6 text-[10.5px] px-2 shrink-0" onClick={() => go('assist', { cand: iv.name })}>
                    准备
                  </Btn>
                </div>
              ))}
            </div>
          </section>

          {/* 2. 聚光灯：Top 明星候选人 */}
          <section className="panel rounded-[6px] p-4 bg-paper shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center">
                <span className="w-[3.5px] h-3.5 bg-amber rounded-full mr-2" />
                <h3 className="text-[13px] font-semibold text-ink">高匹配聚光灯候选人</h3>
              </div>
              <span className="text-[11px] text-[#8a6410] cursor-pointer hover:underline" onClick={() => go('talent')}>
                查看全部 →
              </span>
            </div>

            <div className="space-y-2.5">
              {SPOTLIGHTS.map(s => (
                <div
                  key={s.name}
                  onClick={() => go('talent', { q: s.name })}
                  className="p-2.5 rounded-[4px] border border-line bg-[#fdfcf9] hover:bg-[#faf7f0] transition-all cursor-pointer flex items-center gap-3"
                >
                  <span className="w-8 h-8 rounded-full bg-base text-amber font-serif font-bold text-[13px] flex items-center justify-center shrink-0">
                    {s.avatar}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[12.5px] text-ink">{s.name}</span>
                      <span className="font-mono text-[11.5px] font-bold text-[#8a6410] bg-amber-soft px-1.5 rounded-[2px]">
                        {s.score} 分
                      </span>
                    </div>
                    <div className="text-[11px] text-ink/55 truncate mt-0.5">{s.role}</div>
                    <div className="flex gap-1 mt-1">
                      {s.tags.map(t => (
                        <span key={t} className="text-[9.5px] px-1 bg-[#eceae3] text-ink/65 rounded-[2px]">{t}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 3. 各用人部门 HC 战况 */}
          <section className="panel rounded-[6px] p-4 bg-paper shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center">
                <span className="w-[3.5px] h-3.5 bg-amber rounded-full mr-2" />
                <h3 className="text-[13px] font-semibold text-ink">用人部门 HC 战况</h3>
              </div>
              <span className="text-[11px] font-mono text-ink/40">2025 Q1 目标</span>
            </div>

            <div className="space-y-2.5">
              {DEPTS.map(d => (
                <div key={d.name} className="text-[11.5px]">
                  <div className="flex justify-between items-center text-ink/75 mb-1">
                    <span className="font-medium">{d.name}</span>
                    <span className="font-mono font-semibold text-ink">
                      {d.filled} / {d.hc} 人 ({d.rate}%)
                    </span>
                  </div>
                  <div className="h-1.5 bg-[#ebe7dc] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${d.rate}%`, background: d.rate >= 70 ? '#d7a62a' : '#526070' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
