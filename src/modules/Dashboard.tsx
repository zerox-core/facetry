import { useState } from 'react'
import { Btn, Kpis, Pill, Sec, useToast } from './ui'

interface DashboardProps {
  navTo?: (mod: string, params?: Record<string, any>) => void
}

export default function Dashboard({ navTo }: DashboardProps) {
  const toast = useToast()
  const [calMonth, setCalMonth] = useState('2025-03')

  const go = (mod: string, params?: Record<string, any>) => {
    if (navTo) {
      navTo(mod, params)
    } else {
      toast(`跳转至 ${mod}`)
    }
  }

  // 待办统计
  const TODOS = [
    { id: 't1', title: '周以宁 · 产品设计负责人', sub: '初面已结束，等待你的专业面评', time: '超时 4 小时', type: 'review', mod: 'reviews', tone: 'red' as const, badge: '面评待提交' },
    { id: 't2', title: '陈默 · 后端架构师', sub: '今日 15:30 终面（会议室 402）', time: '今日 15:30', type: 'interview', mod: 'interviews', tone: 'amber' as const, badge: '即将开始' },
    { id: 't3', title: '顾言 · 测试开发工程师', sub: 'VP 审批已通过，待发放 Offer', time: '已停留 1 天', type: 'offer', mod: 'offers', tone: 'blue' as const, badge: 'Offer 待发' },
    { id: 't4', title: '苏晚晴 · HRBP', sub: '新投递简历，推荐度 92 分', time: '2 小时前', type: 'talent', mod: 'talent', tone: 'green' as const, badge: '待初筛' },
    { id: 't5', title: '许星河 · 数据科学家', sub: '两轮面评均已通过，等待发起薪资审批', time: '昨日 18:00', type: 'offer', mod: 'offers', tone: 'amber' as const, badge: '待定薪' },
  ]

  // 近期面试日历
  const SCHEDULE = [
    { time: '10:00 - 11:00', cand: '林知远', role: '高级前端工程师', round: '复面', who: '吴总监', room: '会议室 301', status: '进行中' },
    { time: '14:00 - 15:00', cand: '许星河', role: '数据科学家', round: '终面', who: '刘总', room: '线上腾讯会议', status: '待开始' },
    { time: '15:30 - 16:30', cand: '陈默', role: '后端架构师', round: '初面', who: '张工', room: '会议室 402', status: '待开始' },
    { time: '17:00 - 17:45', cand: '白露', role: '移动端工程师', round: 'HR 面', who: '王璐', room: '电话面试', status: '待开始' },
  ]

  // 招聘漏斗数据
  const FUNNEL = [
    { stage: '简历投递', count: 128, rate: '100%', color: '#3b4856' },
    { stage: '初筛通过', count: 48, rate: '37.5%', color: '#526070' },
    { stage: '面试安排', count: 26, rate: '54.2%', color: '#6e7b8a' },
    { stage: '面评通过', count: 11, rate: '42.3%', color: '#8a6410' },
    { stage: 'Offer 发放', count: 6, rate: '54.5%', color: '#d7a62a' },
    { stage: '成功入职', count: 4, rate: '66.7%', color: '#3f7a3a' },
  ]

  return (
    <div className="h-full flex flex-col min-h-0 overflow-y-auto">
      {/* 顶部 KPI 条 */}
      <Kpis items={[
        { k: '进行中招聘岗位', v: 14, d: '本月新增 3 个', s: [8, 9, 10, 11, 12, 13, 14] },
        { k: '待处理核心待办', v: 5, d: '1 项面评已超时', s: [2, 3, 4, 3, 5, 4, 5], warn: true },
        { k: '今日待进行面试', v: 4, d: '含 1 场远程线上面试', s: [1, 2, 3, 2, 4, 3, 4] },
        { k: '待审批 Offer', v: 3, d: '平均审批周期 1.8 天', s: [1, 1, 2, 2, 3, 2, 3] },
        { k: '简历平均处理时长', v: '18.5', u: '小时', d: '优于 SLA 24h', s: [24, 23, 21, 20, 19, 19, 18] },
        { k: '秋招/社招达成率', v: '78.5', u: '%', d: '离季度目标还差 6 人', s: [50, 55, 60, 68, 72, 75, 78] },
      ]} />

      <div className="flex-1 min-h-0 p-5 pt-3.5 grid grid-cols-12 gap-4">
        {/* 左侧区域：待办事项 + 招聘漏斗 (占 7 列) */}
        <div className="col-span-12 xl:col-span-7 flex flex-col gap-4">
          {/* 待办中心 */}
          <section className="panel rounded-[6px] flex flex-col">
            <div className="h-11 px-4 border-b border-line flex items-center bg-paper/60">
              <span className="w-[3.5px] h-3.5 bg-amber rounded-full mr-2.5" />
              <h2 className="text-[13px] font-semibold text-ink">我的待办事项</h2>
              <span className="ml-2 font-mono text-[11px] text-ink/40">5 项待跟进</span>
              <div className="ml-auto flex items-center gap-2">
                <button onClick={() => go('talent')} className="text-[11.5px] text-[#8a6410] font-medium hover:underline cursor-pointer">进入人才库 →</button>
              </div>
            </div>
            <div className="p-3 divide-y divide-line/60">
              {TODOS.map((t) => (
                <div key={t.id} className="py-2.5 px-2 flex items-center gap-3.5 hover:bg-[#faf7f0] rounded-[4px] transition-colors cursor-pointer group" onClick={() => go(t.mod, { id: t.id })}>
                  <Pill t={t.tone}>{t.badge}</Pill>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold text-ink group-hover:text-[#8a6410] transition-colors">{t.title}</span>
                      <span className="text-[11px] font-mono text-ink/40 ml-auto">{t.time}</span>
                    </div>
                    <div className="text-[11.5px] text-ink/60 mt-0.5 truncate">{t.sub}</div>
                  </div>
                  <Btn className="h-7 text-[11.5px] shrink-0 group-hover:border-amber transition-colors">处理</Btn>
                </div>
              ))}
            </div>
          </section>

          {/* 全景招聘漏斗 */}
          <section className="panel rounded-[6px] p-4 flex flex-col">
            <div className="flex items-center mb-3">
              <span className="w-[3.5px] h-3.5 bg-amber rounded-full mr-2.5" />
              <h3 className="text-[13px] font-semibold text-ink">招聘全链路转化漏斗</h3>
              <span className="ml-auto text-[11px] text-ink/45">本季度累计 128 位简历投递</span>
            </div>
            <div className="grid grid-cols-6 gap-2 mt-2">
              {FUNNEL.map((f, i) => (
                <div key={f.stage} className="bg-paper p-3 rounded-[4px] border border-line flex flex-col items-center relative group hover:border-amber transition-all">
                  <div className="text-[11px] text-ink/50 font-medium">{f.stage}</div>
                  <div className="text-[20px] font-bold font-serif text-ink mt-1 tnum">{f.count}</div>
                  <div className="text-[10.5px] font-mono text-[#8a6410] bg-amber-soft px-1.5 py-0.5 rounded-[2px] mt-1">{f.rate}</div>
                  {i < FUNNEL.length - 1 && (
                    <div className="hidden lg:block absolute -right-2 top-1/2 -translate-y-1/2 z-10 text-ink/30 font-mono text-[10px]">›</div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* 右侧区域：今日日程 + 快捷功能 (占 5 列) */}
        <div className="col-span-12 xl:col-span-5 flex flex-col gap-4">
          {/* 今日面试日程 */}
          <section className="panel rounded-[6px] flex flex-col">
            <div className="h-11 px-4 border-b border-line flex items-center bg-paper/60">
              <span className="w-[3.5px] h-3.5 bg-amber rounded-full mr-2.5" />
              <h2 className="text-[13px] font-semibold text-ink">今日面试日程</h2>
              <span className="ml-auto text-[11.5px] text-[#8a6410] font-medium hover:underline cursor-pointer" onClick={() => go('interviews')}>排期面板 →</span>
            </div>
            <div className="p-3 space-y-2.5">
              {SCHEDULE.map((s, idx) => (
                <div key={idx} className="p-3 bg-paper rounded-[4px] border border-line hover:border-amber/60 hover:shadow-2xs transition-all flex items-start gap-3">
                  <div className="font-mono text-[11.5px] font-semibold text-[#8a6410] bg-amber-soft px-2 py-1 rounded-[3px] shrink-0 mt-0.5">
                    {s.time.split(' - ')[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[13px] text-ink">{s.cand}</span>
                      <span className="text-[11.5px] text-ink/50">{s.round}</span>
                      <span className="ml-auto text-[10.5px] px-1.5 py-0.2 rounded-[2px] bg-[#e1edf5] text-[#2f6f9a] font-medium">{s.status}</span>
                    </div>
                    <div className="text-[11.5px] text-ink/65 mt-1">{s.role}</div>
                    <div className="text-[11px] text-ink/45 mt-0.5 flex items-center gap-3">
                      <span>面试官：{s.who}</span>
                      <span>地点：{s.room}</span>
                    </div>
                  </div>
                  <div className="shrink-0 flex flex-col gap-1.5">
                    <Btn primary className="h-7 text-[11px] px-2.5" onClick={() => go('assist', { cand: s.cand })}>进入副驾</Btn>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 快捷导航与操作中心 */}
          <section className="panel rounded-[6px] p-4 flex flex-col bg-paper">
            <div className="flex items-center mb-2.5">
              <span className="w-[3.5px] h-3.5 bg-amber rounded-full mr-2.5" />
              <h3 className="text-[13px] font-semibold text-ink">招聘工具箱</h3>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <button onClick={() => go('bank')} className="p-3 text-left border border-line rounded-[4px] bg-[#faf8f3] hover:bg-amber-soft/50 hover:border-amber/50 transition-all cursor-pointer group">
                <div className="font-semibold text-[12.5px] text-ink group-hover:text-[#8a6410]">✦ 智能题库管理</div>
                <div className="text-[11px] text-ink/50 mt-1">岗位考点与 AI 出题</div>
              </button>
              <button onClick={() => go('jobs')} className="p-3 text-left border border-line rounded-[4px] bg-[#faf8f3] hover:bg-amber-soft/50 hover:border-amber/50 transition-all cursor-pointer group">
                <div className="font-semibold text-[12.5px] text-ink group-hover:text-[#8a6410]">📄 岗位与 JD 库</div>
                <div className="text-[11px] text-ink/50 mt-1">JD 能力画像与权重</div>
              </button>
              <button onClick={() => go('assist')} className="p-3 text-left border border-line rounded-[4px] bg-[#faf8f3] hover:bg-amber-soft/50 hover:border-amber/50 transition-all cursor-pointer group">
                <div className="font-semibold text-[12.5px] text-ink group-hover:text-[#8a6410]">🎙️ AI 面试副驾</div>
                <div className="text-[11px] text-ink/50 mt-1">实时转录与智能追问</div>
              </button>
              <button onClick={() => go('admin')} className="p-3 text-left border border-line rounded-[4px] bg-[#faf8f3] hover:bg-amber-soft/50 hover:border-amber/50 transition-all cursor-pointer group">
                <div className="font-semibold text-[12.5px] text-ink group-hover:text-[#8a6410]">⚙️ 组织与系统设置</div>
                <div className="text-[11px] text-ink/50 mt-1">飞书配置与外部接入</div>
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
