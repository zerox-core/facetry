import { useEffect, useState, type CSSProperties } from 'react'
import { candidates, CHANNELS, history, type CandidateStage } from '../data'
import { rooms } from '../store'
import type { Go } from '../App'
import { Btn, Card, Chip, Empty, SectionHead } from './ui'

/* ── 图表进场进度 0 → 1：rAF 驱动 600ms（与 --dur-slow 同档），逐帧写入宽高，
      因此不依赖「挂载后是否发生了一次中间绘制」，收尾精确落在目标值；
      与 .motion-meter 的 600ms 过渡叠加时逐帧目标差很小，观感平滑不拖沓。
      reduced-motion 下直接返回 1（静态可读），数字与 aria-label 任何时候都在。 ── */
function useGrowIn(duration = 600) {
  const [p, setP] = useState(0)
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setP(1)
      return
    }
    let raf = 0
    const t0 = performance.now()
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / duration)
      setP(1 - Math.pow(1 - k, 3)) // ease-out，与 --ease-out 同向
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [duration])
  return p
}

const toSec = (d: string) => {
  const [m, s] = d.split(':').map(Number)
  return m * 60 + (s || 0)
}
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)
const V = ['推荐', '待定', '不推荐'] as const
const vCls: Record<string, string> = { 推荐: 'bg-success', 待定: 'bg-warning', 不推荐: 'bg-base-content/30' }

/** 转化漏斗阶段：全部取自 data.ts 的 STAGES，避免出现不在枚举内的非法阶段 */
const FUNNEL_STAGES = ['筛选中', '约面中', '面评中', '待录取', '已完成'] as const satisfies readonly CandidateStage[]

/** 总览：面试整体数据。全部由已有记录派生，不做预测。本页属模块 D（P2），主流程稳定后再接入来源库统计。 */
export default function Overview({ go }: { go: Go }) {
  const grown = useGrowIn()
  const n = history.length
  const avg = n ? history.reduce((a, h) => a + h.score, 0) / n : 0
  const avgDur = n ? history.reduce((a, h) => a + toSec(h.dur), 0) / n / 60 : 0
  const vc = Object.fromEntries(V.map((v) => [v, history.filter((h) => h.verdict === v).length]))
  // 漏斗口径：当前阶段或历史阶段覆盖过该阶段即计入（来源 Candidate.stageHistory，追加不覆盖）
  const funnel = FUNNEL_STAGES.map((stage) => ({
    stage,
    n: candidates.filter((c) => c.status === stage || c.stageHistory?.some((h) => h.stage === stage)).length,
  }))
  const fmax = Math.max(1, ...funnel.map((f) => f.n))

  // 按岗位
  const roles = Object.entries(history.reduce<Record<string, typeof history>>((m, h) => ((m[h.role] ??= []).push(h), m), {}))
    .map(([role, l]) => ({ role, n: l.length, avg: l.reduce((a, h) => a + h.score, 0) / l.length, pass: pct(l.filter((h) => h.verdict === '推荐').length, l.length) }))
    .sort((a, b) => b.n - a.n)
  const weakRole = roles.length > 1 ? roles.reduce((a, b) => (b.avg < a.avg ? b : a)).role : ''

  // 趋势：按日期升序
  const trend = [...history].sort((a, b) => a.date.localeCompare(b.date))

  // 荧光青柠落点（参考图「全落在当前那一根柱子上」）：
  // ① 漏斗「当前层」= 当前在途（status 命中该阶段）人数最多、并列取更深的一层；无人在途不点亮；
  // ② 「最新值」点一笔：走势图最新一根柱、结论分布里最新一场的结论段。其余柱一律黑白灰。
  const curN = (stage: CandidateStage) => candidates.filter((c) => c.status === stage).length
  const curMax = Math.max(0, ...FUNNEL_STAGES.map(curN))
  const curStage = curMax > 0 ? [...FUNNEL_STAGES].reverse().find((s) => curN(s) === curMax) : undefined
  const latestRec = trend.length ? trend[trend.length - 1] : undefined

  // 各考察方向的均分（来自面试间逐题评分）
  const topicMap: Record<string, number[]> = {}
  for (const [cid, r] of Object.entries(rooms)) {
    const c = candidates.find((x) => x.id === cid)
    c?.qs.forEach((q) => { const s = r.recs[q.id]?.score; if (s) (topicMap[q.topic] ??= []).push(s) })
  }
  const topics = Object.entries(topicMap).map(([t, l]) => ({ t, n: l.length, avg: l.reduce((a, b) => a + b, 0) / l.length })).sort((a, b) => a.avg - b.avg)
  const talks = Object.values(rooms).reduce((a, r) => a + (r.talk?.length ?? 0), 0)
  const sharedN = Object.values(rooms).filter((r) => r.shared).length

  return (
    <div className="space-y-9">
      <div className="ws-rise flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-base-content sm:text-3xl">数据总览</h1>
          <Chip tone="info" title="模块 D 数据看板在 PRD 中为 P2，主流程数据稳定后另行评审">
            P2 · 主流程稳定后建设
          </Chip>
        </div>
        <p className="max-w-md text-xs leading-relaxed text-base-content/60">
          口径来自工作台已有业务记录（面试场次、面评结论、约面场次、逐题评分），不含预测与估算值。
        </p>
      </div>

      <div
        className="ws-rise stats stats-vertical w-full overflow-hidden border border-base-300 bg-base-100 shadow-[var(--shadow-paper)] sm:stats-horizontal"
        style={{ '--i': 1 } as CSSProperties}
      >
        {[['累计面试', String(n), '场'], ['平均得分', avg.toFixed(1), '/ 5'], ['推荐率', String(pct(vc['推荐'], n)), '%'], ['平均用时', avgDur.toFixed(0), '分钟'], ['会话记录', String(talks), `条 · ${sharedN} 场分享`]].map(([k, v, u]) => (
          <div key={k} className="stat px-5 py-4">
            <div className="stat-title text-xs text-base-content/60">{k}</div>
            <div className="stat-value text-2xl tabular-nums text-base-content">
              {v}
              <span className="stat-desc ml-1 text-xs font-normal">{u}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-7 lg:grid-cols-[1.5fr_1fr]">
        <section className="ws-rise" style={{ '--i': 2 } as CSSProperties}>
          <SectionHead title="得分走势" sub="数值常显 · 点击柱形进入面试结果" />
          <Card className="px-5 pb-4 pt-6">
            {trend.length ? (
              <>
                <div className="flex h-44 items-end gap-4">
                  {trend.map((h) => (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => h.cid && go('result', h.cid)}
                      disabled={!h.cid}
                      aria-label={`${h.name} ${h.date} 得分 ${h.score.toFixed(1)}${h.cid ? '，查看面试结果' : ''}`}
                      title={`${h.name} · ${h.score}`}
                      className={`${h.cid ? 'motion-pop ' : ''}group flex h-full flex-1 cursor-pointer flex-col items-center justify-end gap-1.5 rounded-lg focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-default`}
                    >
                      {/* 分数常显：键盘与移动端不依赖 hover 也能读到 */}
                      <span className="text-xs tabular-nums text-base-content/60">{h.score.toFixed(1)}</span>
                      <span
                        aria-hidden="true"
                        className={`motion-meter w-full max-w-10 origin-bottom rounded-t-md ${h === latestRec ? 'bg-accent' : 'bg-secondary/80 group-hover:bg-secondary'}`}
                        style={{ height: `${((h.score / 5) * 100 * grown).toFixed(2)}%` }}
                      />
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex gap-4 border-t border-base-300 pt-2">
                  {trend.map((h) => (
                    <span key={h.id} className="flex-1 truncate text-center text-xs text-base-content/50">
                      <span className="block text-base-content/70">{h.name}</span>
                      {h.date.slice(5)}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <Empty title="暂无面试得分" hint="完成一场面试并提交评价后，这里会按时间展示得分走势。" action={<Btn variant="primary" onClick={() => go('candidates')}>去候选人列表</Btn>} />
            )}
          </Card>
        </section>

        <div className="space-y-7">
          <section className="ws-rise" style={{ '--i': 3 } as CSSProperties}>
            <SectionHead title="结论分布" sub="面评人工确认后的结论" />
            <Card className="px-5 py-4">
              {n ? (
                <>
                  <div className="flex h-2.5 overflow-hidden rounded-full bg-base-content/10" role="img" aria-label={`结论分布：推荐 ${vc['推荐']} 场，待定 ${vc['待定']} 场，不推荐 ${vc['不推荐']} 场`}>
                    {V.map((v) => (
                      <span key={v} className={`motion-meter ${v === latestRec?.verdict ? 'bg-accent' : vCls[v]}`} style={{ width: `${(pct(vc[v], n) * grown).toFixed(2)}%` }} />
                    ))}
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                    {V.map((v) => (
                      <div key={v}>
                        <span className={`mr-1.5 inline-block h-2 w-2 rounded-sm ${v === latestRec?.verdict ? 'bg-accent' : vCls[v]}`} aria-hidden="true" />
                        <span className="text-base-content/70">{v}</span>
                        {v === latestRec?.verdict && <span className="text-[11px] font-normal text-base-content/50">· 最新一场</span>}
                        <div className="mt-0.5 text-lg font-semibold tabular-nums text-base-content">
                          {vc[v]}
                          <span className="ml-1 text-xs font-normal text-base-content/50">{pct(vc[v], n)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <Empty title="暂无面试结论" hint="面评经人工确认后会进入结论分布统计。" />
              )}
            </Card>
          </section>
          <section className="ws-rise" style={{ '--i': 4 } as CSSProperties}>
            <SectionHead title="候选人进度" sub="当前阶段或历史阶段覆盖过即计入" />
            <Card className="px-5 py-4">
              {candidates.length ? (
                <div className="space-y-3">
                  {funnel.map(({ stage, n: v }) => (
                    <div key={stage} className="grid grid-cols-[52px_1fr_28px] items-center gap-4 text-sm">
                      <span className="text-base-content/70">{stage}</span>
                      <div className="h-2 rounded-full bg-base-content/10">
                        <div className={`motion-meter h-full rounded-full ${stage === curStage ? 'bg-accent' : 'bg-secondary'}`} style={{ width: `${(((v / fmax) * 100) * grown).toFixed(2)}%` }} />
                      </div>
                      <span className="text-right tabular-nums text-base-content">{v}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty title="暂无候选人数据" hint="来源库同步候选人后即可看到各阶段分布。" />
              )}
            </Card>
          </section>
        </div>
      </div>

      <div className="grid gap-7 lg:grid-cols-2">
        <section className="ws-rise" style={{ '--i': 5 } as CSSProperties}>
          <SectionHead title="岗位表现" sub="按面试场次聚合" />
          <Card>
            {roles.length ? (
              <table className="table table-sm">
                <thead>
                  <tr className="text-xs text-base-content/60">
                    <th className="px-5 py-2.5 font-medium">岗位</th>
                    <th className="font-medium">场次</th>
                    <th className="font-medium">均分</th>
                    <th className="px-5 text-right font-medium">推荐率</th>
                  </tr>
                </thead>
                <tbody>
                  {roles.map((r) => (
                    <tr key={r.role} className="border-base-300">
                      <td className="px-5 py-3 font-medium text-base-content">
                        {r.role === weakRole && <span className="mr-2 inline-block h-3 w-0.5 translate-y-0.5 rounded bg-base-content/60" aria-hidden="true" />}
                        {r.role}
                        {r.role === weakRole && <span className="ml-2 text-xs font-normal text-base-content/50">均分最低</span>}
                      </td>
                      <td className="tabular-nums text-base-content/70">{r.n}</td>
                      <td className="tabular-nums text-base-content">{r.avg.toFixed(1)}</td>
                      <td className="px-5 text-right tabular-nums text-base-content/70">{r.pass}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Empty title="暂无岗位维度数据" hint="面试评价提交后按岗位聚合均分与推荐率。" />
            )}
          </Card>
        </section>

        <section className="ws-rise" style={{ '--i': 6 } as CSSProperties}>
          <SectionHead title="考察方向均分" sub="来自面试间逐题评分" />
          <Card className="space-y-4 px-5 py-4">
            {topics.length ? topics.map((x) => (
              <div key={x.t} className="grid grid-cols-[96px_1fr_64px] items-center gap-4 text-sm">
                <span className="truncate text-base-content/70">{x.t}</span>
                <div className="h-2 rounded-full bg-base-content/10">
                  <div className="motion-meter h-full rounded-full bg-secondary" style={{ width: `${(((x.avg / 5) * 100) * grown).toFixed(2)}%` }} />
                </div>
                <span className="text-right tabular-nums text-base-content">
                  {x.avg.toFixed(1)}
                  <span className="ml-1 text-xs text-base-content/50">×{x.n}</span>
                </span>
              </div>
            )) : (
              <Empty title="暂无考察方向数据" hint="完成一场面试评分后，这里会显示各考察方向的表现。" />
            )}
          </Card>
        </section>
      </div>

      {/* 模块 D 尚未建设的两个统计口径：先占位说明数据来源与接入范围，不编造数字 */}
      <div className="grid gap-7 lg:grid-cols-2">
        <section className="ws-rise" style={{ '--i': 7 } as CSSProperties}>
          <SectionHead title="渠道效果" sub="FR-D2 · P2" />
          <Card className="space-y-4 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone="info">待接入</Chip>
              <span className="text-xs text-base-content/60">不展示估算数字</span>
            </div>
            <p className="text-xs leading-relaxed text-base-content/70">
              数据来源：来源数据库中的渠道标识（采集侧影刀落库的 source / source_id）+ 工作台后续结果（阶段流转、约面场次、面评结论、录取结果）。
            </p>
            <p className="text-xs leading-relaxed text-base-content/70">
              接入范围：按渠道统计简历量、进入约面 / 面评 / 录取的转化率与用时；口径与来源库字段确认前，这里只列出工作台已登记的渠道字典。
            </p>
            <div className="flex flex-wrap gap-1.5">
              {CHANNELS.map((c) => (
                <Chip key={c} tone="ghost">{c}</Chip>
              ))}
            </div>
          </Card>
        </section>

        <section className="ws-rise" style={{ '--i': 8 } as CSSProperties}>
          <SectionHead title="招聘成本" sub="FR-D3 · P2／另评审" />
          <Card className="space-y-4 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone="info">口径待确认</Chip>
              <span className="text-xs text-base-content/60">未接入不按零计</span>
            </div>
            <p className="text-xs leading-relaxed text-base-content/70">
              成本口径需业务与财务确认：渠道付费获取费用、账号与席位费用、内部人力与面试耗时等，均以合同 / 财务口径为准。
            </p>
            <div className="alert alert-soft alert-info text-xs" role="note">
              <span className="leading-relaxed">
                财务系统自动对接需另行授权与评审，当前未接入；因此本页不显示任何金额，也不把缺失成本当作 0 处理。
              </span>
            </div>
            <p className="text-xs leading-relaxed text-base-content/70">
              接入范围：成本项字典与分摊口径确认后，按岗位 / 渠道展示单位招聘成本与投入产出，并保留数据来源与更新时间。
            </p>
          </Card>
        </section>
      </div>
    </div>
  )
}
