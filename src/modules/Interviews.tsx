import { useState } from 'react'
import { Btn, Field, Kpis, Pill, Sec, Tabs, useToast, type Tone } from './ui'

type St = '待开始' | '进行中' | '已完成' | '待反馈' | '已取消'
type Iv = { id: string; cand: string; role: string; round: string; who: string[]; day: number; start: number; dur: number; mode: '现场' | '视频'; room: string; st: St; prev?: string }
const STT: Record<St, Tone> = { 待开始: 'blue', 进行中: 'amber', 已完成: 'green', 待反馈: 'red', 已取消: 'gray' }
const IVR = ['张工', '刘总', '陈经理', '吴总监', '郑工', '何经理']
const DAYS = ['周一 03/10', '周二 03/11', '周三 03/12', '周四 03/13', '周五 03/14']
const DATA: Iv[] = [
  ['林知远', '高级前端工程师', '复面', ['张工', '吴总监'], 2, 10, 1, '现场', 'A-302', '已完成', '初面 4.0 · 基础扎实'],
  ['周以宁', '产品设计负责人', '初面', ['陈经理'], 2, 10.5, 1, '视频', '腾讯会议', '待反馈'],
  ['许星河', '数据科学家', '终面', ['刘总'], 2, 14, 1, '现场', 'B-501', '进行中', '复面 4.5 · 算法强'],
  ['苏晚晴', 'HRBP', '初面', ['何经理'], 2, 14.5, 0.75, '视频', '飞书会议', '待开始'],
  ['顾言', '测试开发工程师', '初面', ['郑工'], 2, 15.5, 1, '现场', 'A-205', '待开始'],
  ['沈清和', '产品经理', '复面', ['陈经理', '刘总'], 2, 16, 1, '现场', 'B-501', '待开始', '初面 3.5 · 业务理解好'],
  ['叶书白', '后端架构师', '初面', ['张工'], 2, 16.5, 1, '视频', '腾讯会议', '待开始'],
  ['唐语', '高级前端工程师', '初面', ['张工'], 1, 11, 1, '现场', 'A-302', '已完成'],
  ['江澈', '移动端工程师', '复面', ['郑工', '吴总监'], 3, 10, 1.5, '现场', 'A-302', '待开始', '初面 4.0'],
  ['方既明', '数据科学家', '初面', ['刘总'], 3, 14, 1, '视频', '飞书会议', '待开始'],
  ['温若', '产品设计负责人', '终面', ['吴总监'], 4, 15, 1, '现场', 'B-501', '待开始', '复面 4.0'],
  ['陆川', '后端架构师', '初面', ['何经理'], 0, 9.5, 1, '视频', '腾讯会议', '已取消'],
].map((r, i) => ({ id: `IV-${3081 + i}`, cand: r[0], role: r[1], round: r[2], who: r[3], day: r[4], start: r[5], dur: r[6], mode: r[7], room: r[8], st: r[9], prev: r[10] }) as Iv)

const H0 = 9, H1 = 19, fmt = (h: number) => `${String(Math.floor(h)).padStart(2, '0')}:${h % 1 ? String(Math.round((h % 1) * 60)).padStart(2, '0') : '00'}`

interface InterviewsProps {
  navTo?: (mod: string, params?: Record<string, any>) => void
  initialCand?: string
}

export default function Interviews({ navTo, initialCand }: InterviewsProps) {
  const [list, setList] = useState(DATA)
  const [day, setDay] = useState(2)
  const foundIv = initialCand ? list.find(i => i.cand.includes(initialCand)) : null
  const [sel, setSel] = useState(foundIv ? foundIv.id : 'IV-3083')
  const [tab, setTab] = useState(0)
  const toast = useToast()
  const today = list.filter(i => i.day === day)
  const cur = list.find(i => i.id === sel) ?? today[0] ?? list[0]
  const now = 14.6
  const queue = list.filter(i => i.st === '待反馈' || (i.day === day && i.st !== '已完成' && i.st !== '已取消')).sort((a, b) => (a.st === '待反馈' ? -1 : 0) - (b.st === '待反馈' ? -1 : 0) || a.start - b.start)
  const conflict = (iv: Iv) => list.some(o => o.id !== iv.id && o.day === iv.day && o.st !== '已取消' && o.who.some(w => iv.who.includes(w)) && o.start < iv.start + iv.dur && iv.start < o.start + o.dur)
  const setSt = (st: St, m: string) => { setList(l => l.map(i => i.id === cur.id ? { ...i, st } : i)); toast(`${cur.cand} · ${m}`) }

  return (
    <div className="h-full flex flex-col min-h-0">
      <Kpis items={[
        { k: '今日面试', v: today.filter(i => i.st !== '已取消').length, d: `${today.filter(i => i.st === '已完成').length} 场已完成`, s: [4, 6, 5, 7, 6, 8, 6] },
        { k: '本周面试', v: list.filter(i => i.st !== '已取消').length, d: '较上周 +3', s: [6, 7, 8, 9, 8, 10, 11] },
        { k: '待提交面评', v: list.filter(i => i.st === '待反馈').length, d: '超 24h 1 条', s: [3, 2, 4, 2, 3, 1, 1], warn: true },
        { k: '面试官冲突', v: list.filter(conflict).length, d: '需调整排期', s: [0, 1, 0, 2, 1, 0, 2], warn: true },
        { k: '平均面试时长', v: '58', u: '分钟', d: '标准 60 分钟', s: [62, 60, 57, 59, 61, 58, 58] },
        { k: '到面率', v: '93', u: '%', d: '取消 1 场', s: [88, 90, 91, 89, 94, 92, 93] },
      ]} />
      <div className="flex-1 min-h-0 p-4 pt-3 flex gap-3">
        {/* queue */}
        <section className="panel rounded-[6px] w-[310px] shrink-0 flex flex-col">
          <div className="h-11 px-4 border-b border-line flex items-center bg-paper/60"><span className="w-[3px] h-3.5 rounded-full bg-amber mr-2" /><span className="text-[13px] font-semibold">我的工作队列</span><span className="ml-auto font-mono text-[10px] text-ink/40">{queue.length} 项</span></div>
          <ul className="flex-1 overflow-y-auto">{queue.map(i => (
            <li key={i.id}><button onClick={() => { setSel(i.id); setDay(i.day) }} className={`relative w-full text-left px-3 py-2 border-b border-[#efece4] ${i.id === cur.id ? 'bg-amber-soft/70' : 'hover:bg-[#f8f6f0]'}`}>
              {i.id === cur.id && <span className="absolute left-0 inset-y-0 w-[3px] bg-amber" />}
              <div className="flex items-center gap-1.5"><span className="font-mono text-[11px] text-ink/55 tnum w-10">{fmt(i.start)}</span><span className="font-semibold text-[12px]">{i.cand}</span><span className="text-[11px] text-ink/45">{i.round}</span><span className="ml-auto"><Pill t={STT[i.st]}>{i.st}</Pill></span></div>
              <div className="mt-0.5 pl-[46px] text-[11px] text-ink/45 flex gap-2"><span className="truncate">{i.role}</span><span>·</span><span>{i.who.join('、')}</span>{conflict(i) && <span className="text-[#a8483a]">冲突</span>}</div>
            </button></li>))}
          </ul>
        </section>

        {/* timeline */}
        <section className="panel rounded-[6px] flex-1 min-w-0 flex flex-col">
          <Tabs items={DAYS.map((d, i) => <>{d}<span className="ml-1 font-mono text-[10px] text-ink/35">{list.filter(x => x.day === i && x.st !== '已取消').length}</span></>)} v={day} set={setDay} right={<><Btn>同步日历</Btn><Btn primary onClick={() => toast('已打开排期面板')}>+ 安排面试</Btn></>} />
          <div className="flex-1 overflow-auto">
            <div className="min-w-[760px]">
              <div className="flex h-9 border-b border-line bg-[#f8f6f0] sticky top-0 z-10"><div className="w-[110px] shrink-0 px-3 text-[11px] text-ink/50 flex items-center">面试官</div>
                <div className="flex-1 relative">{Array.from({ length: H1 - H0 }).map((_, h) => <span key={h} className="absolute top-0 h-full flex items-center pl-1 font-mono text-[10px] text-ink/40 border-l border-line" style={{ left: `${(h / (H1 - H0)) * 100}%` }}>{H0 + h}:00</span>)}</div></div>
              {IVR.map(w => {
                const its = today.filter(i => i.who.includes(w)); const load = its.filter(i => i.st !== '已取消').reduce((a, b) => a + b.dur, 0)
                return (
                  <div key={w} className="flex h-[58px] border-b border-[#efece4]">
                    <div className="w-[110px] shrink-0 px-3 flex flex-col justify-center"><span className="text-[12px] font-medium">{w}</span><span className="text-[10.5px] text-ink/40 tnum">负载 {load}h / 6h</span><span className="mt-1 h-1 bg-[#ebe7dc] rounded-full"><span className="block h-full rounded-full" style={{ width: `${Math.min(100, (load / 6) * 100)}%`, background: load > 3 ? '#d7a62a' : '#8b98a6' }} /></span></div>
                    <div className="flex-1 relative">
                      {Array.from({ length: H1 - H0 }).map((_, h) => <span key={h} className="absolute inset-y-0 border-l border-[#f0ede5]" style={{ left: `${(h / (H1 - H0)) * 100}%` }} />)}
                      <span className="absolute inset-y-0 bg-[#f3f1eb]/80" style={{ left: `${((12 - H0) / (H1 - H0)) * 100}%`, width: `${(1.5 / (H1 - H0)) * 100}%` }} />
                      {its.map(i => { const on = i.id === cur.id, cf = conflict(i), t = STT[i.st]; return (
                        <button key={i.id} onClick={() => setSel(i.id)} className={`absolute top-2 bottom-2 rounded-[4px] shadow-xs px-1.5 text-left overflow-hidden transition-shadow ${on ? 'ring-2 ring-amber shadow-md z-10' : 'hover:shadow'} ${cf ? 'hatch' : ''} ${i.st === '已取消' ? 'opacity-50 line-through' : ''}`}
                          style={{ left: `${((i.start - H0) / (H1 - H0)) * 100}%`, width: `calc(${(i.dur / (H1 - H0)) * 100}% - 2px)`, background: cf ? undefined : `color-mix(in srgb, ${({ amber: '#f6ecd0', blue: '#e1edf5', green: '#e3f0df', red: '#f6e3df', gray: '#eceae3', violet: '#efe6f5' })[t]} 100%, transparent)`, borderLeft: `3px solid ${({ amber: '#d7a62a', blue: '#2f6f9a', green: '#3f7a3a', red: '#a8483a', gray: '#8b98a6', violet: '#7a4f9a' })[t]}` }}>
                          <div className="text-[11px] font-semibold truncate">{i.cand} · {i.round}</div><div className="text-[10px] text-ink/50 truncate">{fmt(i.start)} {i.mode} {i.room}</div>
                        </button>) })}
                      {day === 2 && <span className="absolute inset-y-0 w-[2px] bg-amber z-20" style={{ left: `${((now - H0) / (H1 - H0)) * 100}%` }} />}
                    </div>
                  </div>)
              })}
              {day === 2 && <div className="relative h-5"><span className="absolute -translate-x-1/2 px-1 bg-amber text-base font-mono text-[10px] font-semibold rounded-[2px]" style={{ left: `calc(110px + (100% - 110px) * ${(now - H0) / (H1 - H0)})` }}>{fmt(now)}</span></div>}
            </div>
          </div>
          <div className="h-9 shrink-0 border-t border-line px-4 flex items-center text-[11px] text-ink/45 gap-4 bg-[#fbfaf6]">
            {(['待开始', '进行中', '已完成', '待反馈'] as St[]).map(s => <Pill key={s} t={STT[s]}>{s}</Pill>)}<span className="flex items-center gap-1.5"><i className="w-4 h-2.5 hatch inline-block" />面试官冲突</span><span className="flex items-center gap-1.5"><i className="w-4 h-2.5 bg-[#f3f1eb] border border-line inline-block" />午休</span>
          </div>
        </section>

        {/* drawer */}
        <aside key={cur.id} className="panel-elevated rise rounded-[6px] w-[380px] shrink-0 flex flex-col">
          <div className="px-4 pt-3.5 pb-3 border-b border-line">
            <div className="flex items-center gap-2"><h2 className="font-serif text-[20px] font-bold">{cur.cand}</h2><Pill t={STT[cur.st]}>{cur.st}</Pill><span className="ml-auto font-mono text-[10.5px] text-ink/35">{cur.id}</span></div>
            <div className="text-[12px] text-ink/60 mt-0.5">{cur.role} · {cur.round}</div>
            <div className="mt-3 grid grid-cols-3 gap-3 p-2.5 bg-[#f8f6f0] rounded-[2px]"><Field k="时间" v={<span className="tnum">{DAYS[cur.day].slice(0, 2)} {fmt(cur.start)}</span>} /><Field k="时长" v={`${cur.dur * 60} 分钟`} /><Field k={cur.mode} v={cur.room} /></div>
            {conflict(cur) && <div className="mt-3 h-8 hatch rounded-[4px] flex items-center px-2 text-[11px] text-[#a8483a] font-medium">面试官时间冲突 · 建议改期或替换面试官</div>}
          </div>
          <Tabs items={['面试准备', '历史记录']} v={tab} set={setTab} />
          <div className="flex-1 overflow-y-auto">
            {tab === 0 ? <>
              <Sec t="面试官" extra={`${cur.who.length} 人`}>{cur.who.map((w, i) => <div key={w} className="flex items-center gap-2 py-1"><span className="w-6 h-6 rounded-full bg-[#3b4856] text-paper text-[10.5px] flex items-center justify-center">{w[0]}</span><span className="font-medium">{w}</span><span className="text-[11px] text-ink/45">{i === 0 ? '主面' : '副面'}</span><span className="ml-auto text-[11px] text-[#3f7a3a]">已确认</span></div>)}</Sec>
              <Sec t="上轮反馈">{cur.prev ? <p className="text-[12px] leading-relaxed"><span className="bg-[linear-gradient(transparent_60%,rgba(215,166,42,.3)_60%)]">{cur.prev}</span></p> : <p className="text-[11.5px] text-ink/40">首轮面试，无历史反馈</p>}</Sec>
              <Sec t="考察重点">{['系统设计：高并发场景下的取舍', '项目深挖：近一段核心项目的个人贡献', '稳定性：离职动机与职业规划'].map((t, i) => <label key={t} className="flex gap-2 py-1 text-[12px]"><input type="checkbox" defaultChecked={i === 0} className="accent-[#d7a62a] mt-0.5" />{t}</label>)}</Sec>
              <Sec t="附件">{['简历_' + cur.cand + '.pdf', '笔试结果.pdf'].map(f => <div key={f} className="flex items-center gap-2 py-1 text-[12px]"><span className="font-mono text-[9px] px-1 bg-[#f6e3df] text-[#a8483a] rounded-[2px]">PDF</span>{f}<button className="ml-auto text-[11px] text-[#8a6410]">预览</button></div>)}</Sec>
            </> : <div className="p-4 space-y-2 text-[11.5px]">{['03-08 14:20 王璐 创建面试', '03-08 14:22 系统 已发送邀约短信', '03-09 09:10 候选人 确认参加'].map(l => <div key={l} className="flex gap-2"><span className="w-1.5 h-1.5 mt-1.5 rounded-full bg-amber" /><span className="font-mono text-ink/45">{l.slice(0, 11)}</span><span>{l.slice(12)}</span></div>)}</div>}
          </div>
          <div className="shrink-0 border-t border-line p-3 flex gap-2 bg-[#fbfaf6]">
            {cur.st === '待开始' && <Btn primary className="flex-1 h-8" onClick={() => { setSt('进行中', '面试已开始'); if (navTo) navTo('assist', { cand: cur.cand }) }}>开始面试 (进入副驾)</Btn>}
            {cur.st === '进行中' && <Btn primary className="flex-1 h-8" onClick={() => { setSt('待反馈', '面试结束，待提交面评'); if (navTo) navTo('reviews', { candName: cur.cand }) }}>结束面试 (去评分)</Btn>}
            {cur.st === '待反馈' && <Btn primary className="flex-1 h-8" onClick={() => { setSt('已完成', '已催办面试官'); if (navTo) navTo('reviews', { candName: cur.cand }) }}>前往评审</Btn>}
            {(cur.st === '已完成' || cur.st === '已取消') && <Btn className="flex-1 h-8" onClick={() => { if (navTo) navTo('reviews', { candName: cur.cand }) }}>查看面评</Btn>}
            <Btn className="h-8" onClick={() => toast('已开启改期日历选点')}>改期</Btn>
            <Btn danger className="h-8" disabled={cur.st === '已取消' || cur.st === '已完成'} onClick={() => setSt('已取消', '面试已取消')}>取消</Btn>
          </div>
        </aside>
      </div>
    </div>
  )
}
