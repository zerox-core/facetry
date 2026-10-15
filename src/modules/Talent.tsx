import { Fragment, useEffect, useMemo, useState } from 'react'
import { useToast } from './ui'

type Stage = '待筛' | '初面' | '复面' | '终面' | 'Offer' | '淘汰'
type Job = { co: string; role: string; from: number; to: number }
type Iv = { round: string; who: string; date: string; score: number; verdict: '通过' | '待定' | '不通过'; note: string }
type C = {
  id: string; name: string; gender: string; age: number; role: string; dept: string; city: string; years: number; edu: string; school: string
  match: number; stage: Stage; source: string; owner: string; skills: number[]; jobs: Job[]; ivs: Iv[]
  tags: string[]; salary: string; expect: string; updated: string; days: number; phone: string; flag?: string
}

const DIMS = ['技术深度', '系统设计', '沟通协作', '业务理解', '学习能力', '稳定性']
const BENCH = [80, 75, 75, 70, 75, 70]
const FLOW: Stage[] = ['待筛', '初面', '复面', '终面', 'Offer']
const SC: Record<Stage, { fg: string; bg: string }> = {
  待筛: { fg: '#5f6b78', bg: '#eceae3' }, 初面: { fg: '#2f6f9a', bg: '#e1edf5' }, 复面: { fg: '#8a6410', bg: '#f6ecd0' },
  终面: { fg: '#7a4f9a', bg: '#efe6f5' }, Offer: { fg: '#3f7a3a', bg: '#e3f0df' }, 淘汰: { fg: '#a8483a', bg: '#f6e3df' },
}

// ---------- mock data ----------
const N = ['林知远', '周以宁', '陈默', '许星河', '苏晚晴', '高屿', '顾言', '沈清和', '韩touch', '叶书白', '唐语', '江澈', '方既明', '温若', '陆川', '秦岚', '魏然', '宋予安', '程楚', '白露']
const R: [string, string][] = [['高级前端工程师', '技术中心'], ['产品设计负责人', '设计中心'], ['后端架构师', '技术中心'], ['数据科学家', '数据中台'], ['HRBP', '人力资源部'], ['移动端工程师', '技术中心'], ['测试开发工程师', '质量部'], ['产品经理', '产品部']]
const CO = ['阿里巴巴', '腾讯', '字节跳动', '美团', '网易', '快手', '蚂蚁集团', '京东', '百度', '小红书', '拼多多', '滴滴']
const SRC = ['内推', 'Boss', '猎头', '官网', '拉勾', '校招']
const CITY = ['杭州', '上海', '北京', '深圳', '成都', '广州']
const OWN = ['王璐', '李航', '赵敏', '孙婧']
const SCH = ['浙江大学', '复旦大学', '北京邮电大学', '华中科技大学', '武汉大学', '南京大学', '电子科技大学']
const STG: Stage[] = ['复面', '初面', '待筛', 'Offer', '初面', '淘汰', '待筛', '终面', '待筛', '复面', '初面', '待筛', '终面', '待筛', '初面', 'Offer', '复面', '待筛', '淘汰', '初面']
const IVR = ['张工', '刘总', '陈经理', '吴总监']
const NOTES = ['基础扎实，项目深度足够，表达清晰。', '架构思路清楚，但对成本权衡讨论不足。', '业务理解较好，团队管理经验偏少。', '算法题完成度高，系统设计中等。', '沟通积极，稳定性需进一步确认。']
let seed = 7; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280
const ri = (a: number, b: number) => Math.floor(a + rnd() * (b - a + 1))
const DATA: C[] = N.map((name, i) => {
  const [role, dept] = R[i % R.length]; const years = ri(3, 12); const stage = STG[i]
  const nj = ri(1, 4); let t = 2025.3 - years; const span = years / nj
  const jobs: Job[] = Array.from({ length: nj }, (_, k) => { const f = t; t = k === nj - 1 ? 2025.3 : +(t + span * (0.6 + rnd() * 0.8)).toFixed(1); return { co: CO[ri(0, CO.length - 1)], role: k === nj - 1 ? role.replace('高级', '资深') : role.replace('高级', '').replace('负责人', ''), from: +f.toFixed(1), to: t } })
  const skills = DIMS.map(() => ri(48, 96))
  const rounds = stage === '待筛' ? 0 : stage === '初面' ? ri(0, 1) : stage === '复面' ? 2 : stage === '终面' ? 3 : stage === 'Offer' ? 3 : ri(1, 2)
  const ivs: Iv[] = Array.from({ length: rounds }, (_, k) => { const s = +(ri(5, 10) / 2).toFixed(1); return { round: ['初面', '复面', '终面'][k], who: IVR[ri(0, 3)], date: `03-${String(4 + k * 4 + ri(0, 2)).padStart(2, '0')}`, score: s, verdict: s >= 4 ? '通过' : s >= 3 ? '待定' : '不通过', note: NOTES[ri(0, 4)] } })
  const match = Math.round(skills.reduce((a, b) => a + b, 0) / 6 + ri(0, 8))
  const days = ri(0, 14)
  return {
    id: `ZM-${2417 - i * 3}`, name: name === '韩touch' ? '韩拓' : name, gender: i % 3 ? '男' : '女', age: 24 + years, role, dept, city: CITY[ri(0, 5)], years,
    edu: rnd() > .6 ? '硕士' : '本科', school: SCH[ri(0, SCH.length - 1)], match: Math.min(98, match), stage, source: SRC[ri(0, 5)], owner: OWN[ri(0, 3)],
    skills, jobs, ivs, tags: [['React', '性能优化', '可视化'], ['设计系统', 'B 端'], ['分布式', '高并发'], ['推荐算法', 'A/B'], ['组织发展', '绩效'], ['Flutter', 'iOS'], ['自动化', 'CI'], ['SaaS', '增长']][i % 8],
    salary: `${ri(25, 55)}K×${ri(13, 16)}`, expect: `${ri(35, 70)}K`, updated: days === 0 ? '今天' : `${days} 天前`, days,
    phone: `138****${String(ri(1000, 9999))}`, flag: stage === '待筛' && days > 5 ? '筛选超时' : nj >= 4 && years < 6 ? '跳槽频繁' : undefined,
  }
})

// ---------- atoms ----------
const Th = ({ children, w, r }: { children?: React.ReactNode; w?: string; r?: boolean }) => <th className={`sticky top-0 z-10 bg-[#f8f6f0] border-b border-line px-3 h-9 font-medium text-[11.5px] text-ink/55 whitespace-nowrap ${r ? 'text-right' : 'text-left'}`} style={{ width: w }}>{children}</th>
const Tag = ({ s }: { s: Stage }) => <span className="inline-flex items-center gap-1.5 px-2 h-5 rounded-[3px] text-[11.5px] font-medium" style={{ color: SC[s].fg, background: SC[s].bg }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: SC[s].fg }} />{s}</span>
const Sec = ({ t, extra, children }: { t: string; extra?: React.ReactNode; children: React.ReactNode }) => (
  <section className="border-b border-line/80 px-5 py-4">
    <div className="flex items-center mb-3"><span className="w-[3.5px] h-3.5 bg-amber rounded-full mr-2.5" /><h3 className="text-[13px] font-semibold text-ink">{t}</h3><div className="ml-auto text-[11.5px] text-ink/50">{extra}</div></div>
    {children}
  </section>
)
function Finger({ v }: { v: number[] }) {
  return <div className="flex items-end gap-[3px] h-[18px]">{v.map((x, i) => <span key={i} className="w-[3.5px] rounded-t-[1px]" style={{ height: `${Math.max(20, x)}%`, background: x >= 85 ? '#d7a62a' : x < 60 ? '#d9a69c' : '#c6c1b4' }} />)}</div>
}
function MatchBar({ v }: { v: number }) {
  return <div className="flex items-center gap-2 justify-end"><span className={`font-semibold tnum text-[12.5px] ${v >= 85 ? 'text-[#8a6410]' : 'text-ink/75'}`}>{v}</span><span className="w-12 h-1.5 bg-[#ebe7dc] rounded-full overflow-hidden"><span className="block h-full transition-all duration-500" style={{ width: `${v}%`, background: v >= 85 ? '#d7a62a' : '#9ca3af' }} /></span></div>
}
function Ring({ v }: { v: number }) {
  const r = 26, c = 2 * Math.PI * r
  return <div className="relative w-[68px] h-[68px] shrink-0"><svg viewBox="0 0 68 68" className="-rotate-90 w-full h-full"><circle cx="34" cy="34" r={r} fill="none" stroke="#ebe7dc" strokeWidth="5.5" /><circle cx="34" cy="34" r={r} fill="none" stroke="#d7a62a" strokeWidth="5.5" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} strokeLinecap="round" style={{ transition: 'stroke-dashoffset .6s' }} /></svg><div className="absolute inset-0 flex flex-col items-center justify-center"><span className="font-serif text-[20px] font-bold leading-none tnum text-ink">{v}</span><span className="text-[9px] text-ink/45 mt-0.5">匹配度</span></div></div>
}
function Spark({ d }: { d: number[] }) {
  const mx = Math.max(...d), mn = Math.min(...d)
  const p = d.map((v, i) => `${(i / (d.length - 1)) * 72},${21 - ((v - mn) / (mx - mn || 1)) * 18}`).join(' ')
  return <svg viewBox="0 0 72 24" className="w-[72px] h-6"><polyline points={p} fill="none" stroke="#d7a62a" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" /><circle cx="72" cy={p.split(' ').at(-1)!.split(',')[1]} r="2.5" fill="#d7a62a" /></svg>
}

function Career({ jobs }: { jobs: Job[] }) {
  const min = Math.floor(jobs[0].from), max = 2025.5, span = max - min
  return (
    <div>
      <div className="relative h-[26px] bg-[#f0ede5] rounded-[3px] overflow-hidden">
        {jobs.map((j, i) => <div key={i} title={`${j.co} ${j.role}`} className="absolute top-0 h-full border-r border-paper/80 flex items-center px-2 overflow-hidden shadow-2xs" style={{ left: `${((j.from - min) / span) * 100}%`, width: `${((j.to - j.from) / span) * 100}%`, background: i === jobs.length - 1 ? '#d7a62a' : ['#3b4856', '#526070', '#6e7b8a'][i % 3] }}><span className="text-[11px] text-white font-medium truncate">{j.co}</span></div>)}
      </div>
      <div className="relative h-4 mt-1">{Array.from({ length: Math.ceil(span) }).map((_, i) => <span key={i} className="absolute font-mono text-[10px] text-ink/40 -translate-x-1/2" style={{ left: `${(i / span) * 100}%` }}>{String(min + i).slice(2)}</span>)}</div>
      <table className="w-full mt-2.5 text-[12px]"><tbody>{[...jobs].reverse().map((j, i) => (
        <tr key={i} className="border-t border-dashed border-line/70"><td className="py-2 font-mono text-[11px] text-ink/45 w-[100px] tnum">{j.from.toFixed(1)}–{i === 0 ? '至今' : j.to.toFixed(1)}</td><td className="font-semibold text-ink">{j.co}</td><td className="text-ink/65">{j.role}</td><td className="text-right tnum text-ink/50 font-medium">{(j.to - j.from).toFixed(1)} 年</td></tr>
      ))}</tbody></table>
    </div>
  )
}

function Skills({ v }: { v: number[] }) {
  return <div className="grid grid-cols-2 gap-x-6 gap-y-3">{v.map((x, i) => (
    <div key={i}><div className="flex justify-between text-[11.5px] mb-1.5"><span className="text-ink/75 font-medium">{DIMS[i]}</span><span className={`tnum font-semibold ${x >= BENCH[i] ? 'text-ink' : 'text-[#a8483a]'}`}>{x}<span className="text-ink/40 font-normal"> / {BENCH[i]}</span></span></div>
      <div className="relative h-2 bg-[#ebe7dc] rounded-full overflow-hidden"><span className="absolute inset-y-0 left-0 rounded-full transition-all duration-500" style={{ width: `${x}%`, background: x >= BENCH[i] ? (x >= 85 ? '#d7a62a' : '#4b5768') : '#d08d80' }} /><span className="absolute -top-0.5 w-[2px] h-3 bg-ink z-10" style={{ left: `${BENCH[i]}%` }} /></div></div>
  ))}</div>
}

const VIEWS = [['全部候选人', 20], ['我负责的', 6], ['待我处理', 4], ['高匹配 ≥85', 5], ['人才池回收', 12]] as const

export default function Talent() {
  const [list, setList] = useState(DATA)
  const [sel, setSel] = useState(DATA[0].id)
  const [stage, setStage] = useState<Stage | '全部'>('全部')
  const [q, setQ] = useState('')
  const [view, setView] = useState(0)
  const [tab, setTab] = useState(0)
  const [checked, setChecked] = useState<string[]>([])
  const [sort, setSort] = useState<'match' | 'days'>('match')
  const toastFn = useToast()

  const shown = useMemo(() => list.filter(c => (stage === '全部' || c.stage === stage) && (c.name + c.role + c.tags.join() + c.id).includes(q)).sort((a, b) => sort === 'match' ? b.match - a.match : b.days - a.days), [list, stage, q, sort])
  const cur = list.find(c => c.id === sel) ?? list[0]
  const idx = FLOW.indexOf(cur.stage)
  const avg = cur.ivs.length ? cur.ivs.reduce((a, b) => a + b.score, 0) / cur.ivs.length : 0

  const flash = toastFn
  const move = (ids: string[], to: 'next' | '淘汰') => {
    setList(ls => ls.map(c => !ids.includes(c.id) ? c : to === '淘汰' ? { ...c, stage: '淘汰', updated: '刚刚', days: 0 } : { ...c, stage: FLOW[Math.min(4, FLOW.indexOf(c.stage) + 1)] ?? c.stage, updated: '刚刚', days: 0 }))
    flash(`${ids.length > 1 ? `${ids.length} 位候选人` : list.find(c => c.id === ids[0])?.name} ${to === '淘汰' ? '已淘汰' : '已推进至下一阶段'}`)
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return
      const i = shown.findIndex(c => c.id === sel)
      if (e.key === 'j' || e.key === 'ArrowDown') { e.preventDefault(); setSel(shown[Math.min(shown.length - 1, i + 1)]?.id ?? sel) }
      if (e.key === 'k' || e.key === 'ArrowUp') { e.preventDefault(); setSel(shown[Math.max(0, i - 1)]?.id ?? sel) }
    }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  })

  const cnt = (s: Stage) => list.filter(c => c.stage === s).length
  const KPI = [
    { k: '在库候选人', v: list.length, d: '+4 本周', s: [12, 13, 13, 15, 16, 18, 20] },
    { k: '待筛简历', v: cnt('待筛'), d: `${list.filter(c => c.flag === '筛选超时').length} 条超时`, s: [9, 8, 10, 7, 8, 6, cnt('待筛')], warn: true },
    { k: '面试进行中', v: cnt('初面') + cnt('复面') + cnt('终面'), d: '本周 9 场', s: [3, 5, 4, 6, 7, 8, 9] },
    { k: 'Offer 待审批', v: cnt('Offer'), d: '平均 1.8 天', s: [1, 2, 1, 3, 2, 2, cnt('Offer')] },
    { k: '平均招聘周期', v: '23.4', u: '天', d: '较上月 -2.1', s: [29, 28, 27, 26, 25, 24, 23] },
    { k: '面试通过率', v: '41', u: '%', d: '目标 45%', s: [35, 37, 36, 39, 40, 42, 41] },
  ]

  return (
    <div className="h-full flex flex-col min-h-0">

      {/* KPI strip */}
      <div className="shrink-0 px-5 pt-3.5 pb-1 grid grid-cols-6 gap-3.5">
        {KPI.map(k => (
          <div key={k.k} className="panel-card rounded-[5px] px-4 py-3 flex items-end justify-between hover:shadow-md transition-all duration-200 bg-paper">
            <div><div className="text-[11.5px] text-ink/50 font-medium">{k.k}</div><div className="font-serif text-[26px] font-bold leading-tight tnum mt-0.5 text-ink">{k.v}<span className="text-[12px] font-sans font-normal text-ink/45 ml-0.5">{k.u}</span></div><div className={`text-[11px] mt-0.5 ${k.warn ? 'text-[#a8483a] font-medium' : 'text-ink/50'}`}>{k.d}</div></div>
            <Spark d={k.s} />
          </div>
        ))}
      </div>

      <div className="flex-1 min-h-0 p-5 pt-3.5 flex gap-4">
        {/* ledger */}
        <section className="panel rounded-[6px] flex-1 min-w-0 flex flex-col">
          <div className="flex items-center h-11 px-4 border-b border-line gap-1.5 bg-paper/60">
            {VIEWS.map(([v, n], i) => <button key={v} onClick={() => setView(i)} className={`relative h-full px-3 text-[12.5px] cursor-pointer transition-colors ${view === i ? 'text-ink font-semibold' : 'text-ink/55 hover:text-ink'}`}>{v}<span className={`ml-1.5 font-mono text-[11px] ${view === i ? 'text-ink/75' : 'text-ink/40'}`}>{n}</span>{view === i && <span className="absolute inset-x-2.5 bottom-0 h-[2.5px] bg-amber rounded-t-sm" />}</button>)}
            <button className="ml-auto h-8 px-3.5 text-[12.5px] font-medium border border-line bg-paper text-ink/80 rounded-[4px] hover:bg-[#f5f3ec] hover:border-[#d6d0c2] shadow-2xs transition-all cursor-pointer">导入简历</button>
            <button className="h-8 px-3.5 text-[12.5px] bg-amber text-base font-semibold rounded-[4px] shadow-xs hover:shadow hover:brightness-105 transition-all cursor-pointer">+ 新建候选人</button>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 px-4 py-2.5 border-b border-line bg-[#faf8f3]">
            <div className="relative"><input value={q} onChange={e => setQ(e.target.value)} placeholder="姓名 / 编号 / 技能" className="w-56 h-8 border border-line rounded-[4px] bg-paper pl-8 pr-3 text-[12.5px] outline-none focus:border-amber focus:ring-1 focus:ring-amber/20 shadow-2xs transition-all" /><svg viewBox="0 0 24 24" className="w-4 h-4 absolute left-2.5 top-[8px] text-ink/40" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg></div>
            <div className="flex border border-line rounded-[4px] overflow-hidden bg-paper shadow-2xs shrink-0">
              {(['全部', ...FLOW, '淘汰'] as const).map(s => <button key={s} onClick={() => setStage(s)} className={`h-8 px-3 text-[12px] whitespace-nowrap flex items-center gap-1.5 font-medium border-r border-line last:border-r-0 transition-colors cursor-pointer ${stage === s ? 'bg-base text-paper font-semibold shadow-xs' : 'text-ink/65 hover:bg-[#f5f3ec]'}`}><span>{s}</span><span className={`font-mono text-[10.5px] px-1.5 py-0.5 rounded-[3px] ${stage === s ? 'bg-amber text-base font-bold' : 'text-ink/40 bg-[#f0ece2]'}`}>{s === '全部' ? list.length : cnt(s)}</span></button>)}
            </div>
            {['应聘岗位', '来源', '城市', '负责人'].map(f => <button key={f} className="h-8 px-3 text-[12px] font-medium text-ink/65 border border-dashed border-[#cfc9ba] rounded-[4px] bg-paper/80 hover:border-ink/50 hover:bg-paper transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 shadow-2xs cursor-pointer">{f} ▾</button>)}
            <span className="ml-auto whitespace-nowrap text-[12px] text-ink/50 font-medium tracking-wide">共 {shown.length} 条</span>
          </div>
          {checked.length > 0 && (
            <div className="rise flex items-center gap-3.5 px-4 h-10 bg-amber-soft border-b border-[#ead9a6] text-[12.5px] shadow-xs">
              <span className="font-semibold text-ink">已选 {checked.length} 项</span>
              <button onClick={() => { move(checked, 'next'); setChecked([]) }} className="text-[#8a6410] font-semibold hover:underline cursor-pointer">批量推进</button>
              <button className="text-[#8a6410] font-semibold hover:underline cursor-pointer">安排面试</button>
              <button className="text-[#8a6410] font-semibold hover:underline cursor-pointer">转交负责人</button>
              <button onClick={() => { move(checked, '淘汰'); setChecked([]) }} className="text-[#a8483a] font-semibold hover:underline cursor-pointer">批量淘汰</button>
              <button onClick={() => setChecked([])} className="ml-auto text-ink/50 hover:text-ink cursor-pointer">取消选择</button>
            </div>
          )}
          <div className="flex-1 overflow-auto">
            <table className="w-full border-collapse text-[12px]">
              <thead><tr>
                <Th w="36px"><input type="checkbox" className="accent-[#d7a62a] w-3.5 h-3.5 rounded" checked={checked.length === shown.length && shown.length > 0} onChange={e => setChecked(e.target.checked ? shown.map(c => c.id) : [])} /></Th>
                <Th w="150px">候选人</Th><Th>应聘岗位</Th><Th w="54px">工作年限</Th><Th w="72px">学历</Th><Th w="46px">城市</Th><Th w="46px">来源</Th>
                <Th w="68px">阶段</Th><Th w="52px">能力</Th>
                <Th w="80px" r><button onClick={() => setSort('match')} className={sort === 'match' ? 'text-ink' : ''}>匹配度 {sort === 'match' && '↓'}</button></Th>
                <Th w="52px" r>面评</Th><Th w="52px">负责人</Th>
                <Th w="70px" r><button onClick={() => setSort('days')} className={sort === 'days' ? 'text-ink' : ''}>更新 {sort === 'days' && '↓'}</button></Th>
              </tr></thead>
              <tbody>{shown.map(c => {
                const on = c.id === sel; const ck = checked.includes(c.id)
                const a = c.ivs.length ? c.ivs.reduce((x, y) => x + y.score, 0) / c.ivs.length : 0
                return (
                  <tr key={c.id} onClick={() => { setSel(c.id); setTab(0) }} className={`h-[50px] border-b border-[#ece8de] cursor-pointer transition-all duration-150 ${on ? 'bg-amber-soft/80 shadow-xs' : ck ? 'bg-[#faf5e6]' : 'hover:bg-[#f9f7f1]'} ${c.stage === '淘汰' ? 'text-ink/45 opacity-75' : ''}`}>
                    <td className="relative px-3">{on && <span className="absolute left-0 inset-y-0 w-[3.5px] bg-amber shadow-[1px_0_4px_rgba(215,166,42,0.4)]" />}<input type="checkbox" className="accent-[#d7a62a] w-3.5 h-3.5 rounded" checked={ck} onClick={e => e.stopPropagation()} onChange={() => setChecked(x => ck ? x.filter(i => i !== c.id) : [...x, c.id])} /></td>
                    <td className="px-3"><div className="flex items-center gap-1.5"><span className="font-semibold text-[13px] text-ink">{c.name}</span><span className="text-[11px] text-ink/45">{c.gender}·{c.age}</span>{c.flag && <span className="text-[10px] px-1.5 py-0.5 rounded-[2px] text-[#a8483a] bg-[#f6e3df] font-medium">{c.flag}</span>}</div><div className="font-mono text-[10.5px] text-ink/40 mt-0.5">{c.id}</div></td>
                    <td className="px-3"><div className="truncate text-[12.5px] font-medium text-ink/90">{c.role}</div><div className="text-[11px] text-ink/45 mt-0.5">{c.dept}</div></td>
                    <td className="px-3 tnum text-[12.5px] font-medium">{c.years} 年</td>
                    <td className="px-3"><div className="text-[12px] font-medium text-ink">{c.edu}</div><div className="text-[11px] text-ink/45 truncate max-w-[80px] mt-0.5">{c.school}</div></td>
                    <td className="px-3 text-[12px] text-ink/80">{c.city}</td><td className="px-3 text-[12px] text-ink/70">{c.source}</td>
                    <td className="px-3"><Tag s={c.stage} /></td>
                    <td className="px-3"><Finger v={c.skills} /></td>
                    <td className="px-3"><MatchBar v={c.match} /></td>
                    <td className="px-3 text-right tnum">{a ? <span className={`text-[12.5px] font-semibold ${a >= 4 ? 'text-[#3f7a3a]' : a < 3 ? 'text-[#a8483a]' : 'text-ink'}`}>{a.toFixed(1)}</span> : <span className="text-ink/30">—</span>}</td>
                    <td className="px-3 text-[12px] text-ink/70">{c.owner}</td>
                    <td className={`px-3 text-right tnum text-[11.5px] ${c.days > 5 ? 'text-[#a8483a] font-semibold' : 'text-ink/45'}`}>{c.updated}</td>
                  </tr>
                )
              })}</tbody>
            </table>
          </div>
          <div className="h-9 shrink-0 border-t border-line px-4 flex items-center text-[11.5px] text-ink/50 gap-5 bg-[#faf8f3]">
            <span><kbd className="font-mono text-ink/60">J</kbd> / <kbd className="font-mono text-ink/60">K</kbd> 上下切换</span>
            <span className="flex items-center gap-2">能力指纹：<i className="w-2 h-2 bg-amber inline-block" />≥85 <i className="w-2 h-2 bg-[#c6c1b4] inline-block" />常规 <i className="w-2 h-2 bg-[#d9a69c] inline-block" />&lt;60</span>
            <span className="ml-auto">第 1 / 1 页 · 每页 50 条</span>
          </div>
        </section>

        {/* detail */}
        <aside key={cur.id} className="panel-elevated rise rounded-[6px] w-[500px] shrink-0 flex flex-col">
          <div className="px-5 pt-4 pb-3.5 border-b border-line bg-paper">
            <div className="flex gap-4 items-start">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5"><h2 className="font-serif text-[24px] font-bold leading-tight text-ink">{cur.name}</h2><Tag s={cur.stage} /><span className="font-mono text-[11px] text-ink/40 ml-auto">{cur.id}</span></div>
                <div className="mt-1 text-[13px] font-medium text-ink/75">{cur.role} · {cur.dept} · {cur.city}</div>
                <div className="mt-2 flex flex-wrap gap-x-3.5 gap-y-1 text-[11.5px] text-ink/55"><span>{cur.gender} · {cur.age} 岁</span><span>{cur.edu} · {cur.school}</span><span>{cur.phone}</span><span>来源 {cur.source}</span></div>
                <div className="mt-2.5 flex flex-wrap gap-1.5">{cur.tags.map(t => <span key={t} className="text-[11px] px-2 py-0.5 border border-line rounded-[3px] bg-[#faf8f4] text-ink/70">{t}</span>)}</div>
              </div>
              <Ring v={cur.match} />
            </div>
            {/* pipeline */}
            <div className="mt-4 flex items-center px-1">
              {FLOW.map((s, i) => { const done = cur.stage !== '淘汰' && i < idx, now = i === idx; return (
                <div key={s} className="flex items-center flex-1 last:flex-none">
                  <div className="flex items-center gap-1.5"><span className={`w-3 h-3 rounded-full border-2 transition-all ${now ? 'bg-amber border-amber pulse' : done ? 'bg-base border-base' : 'bg-paper border-[#cfc9ba]'}`} /><span className={`text-[11.5px] ${now ? 'font-semibold text-[#8a6410]' : done ? 'text-ink/75' : 'text-ink/40'}`}>{s}</span></div>
                  {i < 4 && <span className={`flex-1 h-px mx-2 ${done ? 'bg-base' : 'bg-[#dcd7ca]'}`} />}
                </div>) })}
            </div>
            {cur.stage === '淘汰' && <div className="mt-3 h-6 hatch rounded-[3px] flex items-center px-3 text-[11.5px] text-[#a8483a] font-medium border border-[#e6c6bf]">已淘汰 · 可回收至人才池</div>}
          </div>
          <div className="flex border-b border-line px-3 bg-[#faf8f3]">{['概览', `面评 (${cur.ivs.length})`, '简历原文', '操作记录'].map((t, i) => <button key={t} onClick={() => setTab(i)} className={`relative px-3.5 h-10 text-[12.5px] font-medium transition-colors cursor-pointer ${tab === i ? 'font-semibold text-ink' : 'text-ink/55 hover:text-ink'}`}>{t}{tab === i && <span className="absolute inset-x-2.5 bottom-0 h-[2px] bg-amber rounded-t-sm" />}</button>)}</div>

          <div className="flex-1 overflow-y-auto">
            {tab === 0 && <>
              <div className="grid grid-cols-4 border-b border-line bg-paper">
                {[['当前薪资', cur.salary], ['期望薪资', cur.expect], ['平均任期', `${(cur.years / cur.jobs.length).toFixed(1)} 年`], ['面评均分', avg ? avg.toFixed(1) : '—']].map(([k, v]) => <div key={k} className="px-4 py-3 border-r border-line last:border-r-0"><div className="text-[11px] text-ink/45">{k}</div><div className="mt-1 text-[15px] font-semibold text-ink tnum">{v}</div></div>)}
              </div>
              <Sec t="职业轨迹" extra={`${cur.jobs.length} 段经历 · ${cur.years} 年`}><Career jobs={cur.jobs} /></Sec>
              <Sec t="能力评估" extra={<span className="flex items-center gap-1"><span className="w-px h-2.5 bg-ink" />岗位基准线</span>}><Skills v={cur.skills} /></Sec>
              <Sec t="风险与亮点">
                <ul className="space-y-2 text-[12px]">
                  {cur.skills.map((x, i) => ({ x, i })).filter(s => s.x >= 85).map(s => <li key={s.i} className="flex gap-2.5 p-2 rounded-[4px] bg-[#fcf9f0] border border-[#f0e4c6]"><span className="w-4 text-center text-[#8a6410] font-bold">▲</span><span className="text-ink/80">{DIMS[s.i]}显著高于岗位基准（+{s.x - BENCH[s.i]}）</span></li>)}
                  {cur.skills.map((x, i) => ({ x, i })).filter(s => s.x < BENCH[s.i]).map(s => <li key={s.i} className="flex gap-2.5 p-2 rounded-[4px] bg-[#fdf5f3] border border-[#f3d3cd]"><span className="w-4 text-center text-[#a8483a] font-bold">▼</span><span className="text-ink/80">{DIMS[s.i]}低于基准 {BENCH[s.i] - s.x} 分，建议复面重点考察</span></li>)}
                  {cur.flag && <li className="flex gap-2.5 p-2 rounded-[4px] bg-[#fdf5f3] border border-[#f3d3cd]"><span className="w-4 text-center text-[#a8483a] font-bold">!</span><span className="text-ink/80">{cur.flag}</span></li>}
                </ul>
              </Sec>
            </>}
            {tab === 1 && <div className="p-5">
              {cur.ivs.length ? <table className="w-full text-[12px]"><thead><tr className="text-ink/50 text-left"><th className="font-medium pb-2">轮次</th><th className="font-medium">面试官</th><th className="font-medium">日期</th><th className="font-medium text-right">评分</th><th className="font-medium text-right">结论</th></tr></thead>
                <tbody>{cur.ivs.map(v => <Fragment key={v.round}><tr className="border-t border-line/80"><td className="py-2.5 font-medium text-ink">{v.round}</td><td>{v.who}</td><td className="font-mono text-ink/60">{v.date}</td><td className="text-right tnum font-semibold text-ink">{v.score.toFixed(1)}</td><td className="text-right"><span className={`px-2 py-0.5 rounded-[3px] text-[11px] font-medium ${v.verdict === '通过' ? 'bg-[#e3f0df] text-[#3f7a3a]' : v.verdict === '待定' ? 'bg-amber-soft text-[#8a6410]' : 'bg-[#f6e3df] text-[#a8483a]'}`}>{v.verdict}</span></td></tr><tr><td colSpan={5} className="pb-3 text-ink/70 leading-relaxed">{v.note}</td></tr></Fragment>)}</tbody></table>
                : <div className="py-14 text-center text-ink/40">暂无面评记录<br /><button className="mt-3.5 h-8 px-4 border border-line rounded-[4px] text-ink/75 hover:bg-[#f5f3ec] transition-colors cursor-pointer text-[12.5px]">安排初面</button></div>}
            </div>}
            {tab > 1 && <div className="py-20 text-center text-ink/40 text-[12.5px]">{tab === 2 ? '简历原文预览（PDF 待加载）' : '暂无操作记录'}</div>}
          </div>

          <div className="shrink-0 border-t border-line p-4 flex gap-2.5 bg-[#faf8f3]">
            <button onClick={() => move([cur.id], 'next')} disabled={cur.stage === 'Offer' || cur.stage === '淘汰'} className="flex-1 h-9 bg-amber text-base font-semibold text-[13px] rounded-[4px] shadow-xs hover:shadow hover:brightness-105 active:scale-[0.99] transition-all disabled:opacity-35 cursor-pointer">推进至 {FLOW[idx + 1] ?? '—'}</button>
            <button className="h-9 px-3.5 border border-line bg-paper rounded-[4px] text-[12.5px] font-medium text-ink/80 hover:bg-[#f5f3ec] hover:border-[#d6d0c2] shadow-2xs active:scale-[0.99] transition-all cursor-pointer">安排面试</button>
            <button className="h-9 px-3.5 border border-line bg-paper rounded-[4px] text-[12.5px] font-medium text-ink/80 hover:bg-[#f5f3ec] hover:border-[#d6d0c2] shadow-2xs active:scale-[0.99] transition-all cursor-pointer">待定</button>
            <button onClick={() => move([cur.id], '淘汰')} disabled={cur.stage === '淘汰'} className="h-9 px-3.5 border border-[#e6c6bf] text-[#a8483a] bg-paper rounded-[4px] text-[12.5px] font-medium hover:bg-[#f6e3df] disabled:opacity-35 active:scale-[0.99] transition-all cursor-pointer">淘汰</button>
          </div>
        </aside>
      </div>

    </div>
  )
}
