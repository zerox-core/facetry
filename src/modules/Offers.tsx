import { useState } from 'react'
import { Btn, Field, Kpis, Sec, Tabs, Th, useToast } from './ui'

const NODES = ['HR 发起', '部门负责人', 'HRD', '财务', 'VP', '发放', '候选人接受']
type Of = { id: string; cand: string; role: string; dept: string; level: string; base: number; band: [number, number]; months: number; stock: string; at: number; days: number; join: string; owner: string; issue?: string; rejected?: boolean }
const DATA: Of[] = [
  { id: 'OF-0318', cand: '许星河', role: '数据科学家', dept: '数据中台', level: 'P7', base: 58, band: [45, 60], months: 16, stock: '2,000 股', at: 3, days: 4, join: '04-01', owner: '王璐', issue: '财务审批超 48h' },
  { id: 'OF-0317', cand: '秦岚', role: '产品经理', dept: '产品部', level: 'P6', base: 42, band: [30, 40], months: 15, stock: '—', at: 2, days: 1, join: '04-07', owner: '李航', issue: '薪资超出职级带宽 5%' },
  { id: 'OF-0315', cand: '宋予安', role: '高级前端工程师', dept: '技术中心', level: 'P7', base: 50, band: [40, 55], months: 16, stock: '1,500 股', at: 5, days: 2, join: '03-24', owner: '王璐', issue: '候选人 48h 未回复' },
  { id: 'OF-0312', cand: '程楚', role: '测试开发工程师', dept: '质量部', level: 'P6', base: 30, band: [26, 36], months: 14, stock: '—', at: 6, days: 0, join: '03-17', owner: '赵敏' },
  { id: 'OF-0311', cand: '魏然', role: '后端架构师', dept: '技术中心', level: 'P8', base: 78, band: [65, 85], months: 16, stock: '4,000 股', at: 4, days: 1, join: '04-14', owner: '孙婧' },
  { id: 'OF-0309', cand: '白露', role: 'HRBP', dept: '人力资源部', level: 'P6', base: 34, band: [28, 38], months: 14, stock: '—', at: 1, days: 0, join: '04-01', owner: '李航' },
  { id: 'OF-0305', cand: '江澈', role: '移动端工程师', dept: '技术中心', level: 'P6', base: 36, band: [30, 42], months: 15, stock: '—', at: 5, days: 6, join: '—', owner: '赵敏', rejected: true, issue: '候选人拒绝 · 接受竞对 Offer' },
]

function Nodes({ at, rej, big }: { at: number; rej?: boolean; big?: boolean }) {
  return <div className="flex items-center">{NODES.map((n, i) => { const done = i < at || at === 6 && i === 6, now = i === at && at < 6, bad = rej && i === at; return (
    <div key={n} className={`flex items-center ${i < 6 ? 'flex-1' : ''}`} title={n}>
      <span className={`shrink-0 ${big ? 'w-3.5 h-3.5' : 'w-2.5 h-2.5'} ${bad ? 'bg-[#a8483a] rounded-sm' : 'rounded-full'} ${bad ? '' : now ? 'bg-amber pulse shadow-xs' : done ? 'bg-base' : 'border-2 border-[#cfc9ba] bg-paper'}`} />
      {i < 6 && <span className={`flex-1 h-[2px] mx-1 ${done ? 'bg-base' : 'bg-[#ded8cc]'}`} />}
    </div>) })}</div>
}

export default function Offers() {
  const [list, setList] = useState(DATA)
  const [sel, setSel] = useState(DATA[0].id)
  const [tab, setTab] = useState(0)
  const toast = useToast()
  const cur = list.find(o => o.id === sel)!
  const shown = tab === 1 ? list.filter(o => o.issue) : tab === 2 ? list.filter(o => o.at === 6) : list
  const approve = () => { setList(l => l.map(o => o.id === cur.id ? { ...o, at: Math.min(6, o.at + 1), days: 0, issue: undefined } : o)); toast(`${cur.cand} · ${NODES[cur.at]} 已通过`) }
  const pos = (v: number) => ((v - cur.band[0] * .8) / (cur.band[1] * 1.15 - cur.band[0] * .8)) * 100

  return (
    <div className="h-full flex flex-col min-h-0">
      <Kpis items={[
        { k: '审批中', v: list.filter(o => o.at < 5).length, d: '平均 1.8 天 / 节点', s: [3, 4, 4, 5, 4, 5, 5] },
        { k: '待候选人回复', v: list.filter(o => o.at === 5 && !o.rejected).length, d: '1 条超 48h', s: [1, 2, 1, 2, 3, 2, 1], warn: true },
        { k: '本月接受', v: list.filter(o => o.at === 6).length + 6, d: '目标 10', s: [1, 2, 3, 4, 5, 6, 7] },
        { k: 'Offer 接受率', v: '82', u: '%', d: '拒绝 1 · 竞对', s: [75, 78, 80, 79, 83, 81, 82] },
        { k: '异常待处理', v: list.filter(o => o.issue).length, d: '超期 / 超带宽 / 未回复', s: [1, 2, 3, 2, 3, 4, 4], warn: true },
      ]} />
      <div className="flex-1 min-h-0 p-5 pt-3.5 flex gap-4">
        <section className="panel rounded-[6px] flex-1 min-w-0 flex flex-col">
          <Tabs items={[`全部 Offer ${list.length}`, <span key="err" className="text-[#a8483a]">异常 {list.filter(o => o.issue).length}</span>, '已入职待办']} v={tab} set={setTab} right={<><Btn>导出台账</Btn><Btn primary>+ 发起 Offer</Btn></>} />
          <div className="flex-1 overflow-auto">
            <table className="w-full border-collapse text-[12px]">
              <thead><tr><Th w="140px">候选人</Th><Th>岗位 / 部门</Th><Th w="50px">职级</Th><Th w="120px" r>月薪 × 月数</Th><Th w="80px" r>年包</Th><Th w="240px">审批流程</Th><Th w="64px">停留</Th><Th w="60px">入职</Th><Th w="60px">负责人</Th></tr></thead>
              <tbody>{shown.map(o => { const on = o.id === sel, over = o.base > o.band[1]; return (
                <tr key={o.id} onClick={() => setSel(o.id)} className={`h-[50px] border-b border-[#ece8de] cursor-pointer transition-all duration-150 ${on ? 'bg-amber-soft/80 shadow-xs' : 'hover:bg-[#f9f7f1]'} ${o.rejected ? 'text-ink/45 opacity-80' : ''}`}>
                  <td className="relative px-3.5">{on && <span className="absolute left-0 inset-y-0 w-[3.5px] bg-amber shadow-[1px_0_4px_rgba(215,166,42,0.4)]" />}{o.issue && <span className="absolute right-0 top-0 w-0 h-0 border-t-[10px] border-l-[10px] border-t-[#c0604f] border-l-transparent" />}<div className="font-semibold text-[13px] text-ink">{o.cand}</div><div className="font-mono text-[10.5px] text-ink/40 mt-0.5">{o.id}</div></td>
                  <td className="px-3"><div><span className="text-[12.5px] font-medium text-ink/90">{o.role}</span></div><div className="text-[11px] text-ink/45 mt-0.5">{o.dept}</div></td>
                  <td className="px-3 font-mono font-medium text-[12px]">{o.level}</td>
                  <td className={`px-3 text-right tnum text-[12.5px] ${over ? 'text-[#a8483a] font-bold' : 'text-ink/80 font-medium'}`}>{o.base}K × {o.months}</td>
                  <td className="px-3 text-right tnum font-semibold text-[13px] text-ink">{(o.base * o.months / 10).toFixed(1)}万</td>
                  <td className="px-3"><Nodes at={o.at} rej={o.rejected} /><div className="text-[11px] mt-1 text-ink/55 font-medium">{o.rejected ? <span className="text-[#a8483a] font-semibold">候选人拒绝</span> : NODES[o.at]}</div></td>
                  <td className={`px-3 tnum text-[12px] ${o.days >= 2 ? 'text-[#a8483a] font-bold' : 'text-ink/55'}`}>{o.days} 天</td>
                  <td className="px-3 font-mono text-[12px] text-ink/70">{o.join}</td><td className="px-3 text-[12px] text-ink/70">{o.owner}</td>
                </tr>) })}</tbody>
            </table>
          </div>
          <div className="h-9 shrink-0 border-t border-line px-4 flex items-center text-[11.5px] text-ink/50 gap-5 bg-[#faf8f3]">
            <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-base inline-block" />已完成</span><span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-amber inline-block" />当前节点</span><span className="flex items-center gap-1.5"><i className="w-2 h-2 bg-[#a8483a] inline-block" />终止</span><span className="flex items-center gap-1.5"><i className="w-0 h-0 border-t-[8px] border-l-[8px] border-t-[#c0604f] border-l-transparent inline-block" />存在异常</span>
          </div>
        </section>

        <aside key={cur.id} className="panel-elevated rise rounded-[6px] w-[440px] shrink-0 flex flex-col">
          <div className="px-5 pt-4 pb-3.5 border-b border-line bg-paper">
            <div className="flex items-center gap-2.5"><h2 className="font-serif text-[24px] font-bold text-ink">{cur.cand}</h2><span className="font-mono text-[11.5px] px-2 py-0.5 border border-line bg-[#f8f6f0] rounded-[3px] font-semibold text-ink/80">{cur.level}</span><span className="ml-auto font-mono text-[11px] text-ink/40">{cur.id}</span></div>
            <div className="text-[13px] text-ink/75 font-medium mt-1">{cur.role} · {cur.dept}</div>
            <div className="mt-4"><Nodes at={cur.at} rej={cur.rejected} big /></div>
            <div className="mt-1.5 flex justify-between text-[10.5px] text-ink/50">{NODES.map((n, i) => <span key={n} className={i === cur.at ? 'text-[#8a6410] font-bold' : ''}>{n.replace('候选人', '')}</span>)}</div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {cur.issue && <div className="mx-5 mt-4 p-3.5 rounded-[5px] border border-[#e6c6bf] bg-[#fdf5f3] shadow-xs"><div className="text-[12.5px] font-semibold text-[#a8483a]">异常 · {cur.issue}</div><div className="mt-1.5 text-[12px] text-ink/70 leading-relaxed">{cur.issue.includes('带宽') ? '需补充特批说明并由 HRD 加签。' : cur.issue.includes('未回复') ? '建议负责人电话跟进，必要时延长有效期。' : cur.issue.includes('拒绝') ? '已归档，可回收至人才池并启动备选候选人。' : '已自动提醒审批人，可手动催办或转交。'}</div><div className="mt-3 flex gap-2"><Btn onClick={() => toast('已发送催办')}>催办</Btn><Btn>转交</Btn><Btn>补充说明</Btn></div></div>}
            <Sec t="薪资结构" extra={`职级带宽 ${cur.band[0]}–${cur.band[1]}K`}>
              <div className="mt-2 mb-3 p-3 bg-[#faf8f3] rounded-[5px] border border-line/70">
                <div className="relative h-12">
                  <span className="absolute top-5 h-3.5 bg-[#e8e4d8] rounded-full inset-x-0" />
                  <span className="absolute top-5 h-3.5 bg-[#d4cbb8] rounded-full" style={{ left: `${pos(cur.band[0])}%`, width: `${pos(cur.band[1]) - pos(cur.band[0])}%` }} />
                  <span className="absolute top-4.5 h-4.5 w-[2px] bg-ink/40 z-10" style={{ left: `${pos((cur.band[0] + cur.band[1]) / 2)}%` }} />
                  <span className="absolute -top-1 -translate-x-1/2 flex flex-col items-center z-20" style={{ left: `${pos(cur.base)}%` }}>
                    <span className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded-[3px] shadow-xs ${cur.base > cur.band[1] ? 'bg-[#c0604f] text-white' : 'bg-amber text-base font-semibold'}`}>{cur.base}K</span>
                    <span className={`w-0 h-0 border-x-4 border-x-transparent border-t-4 ${cur.base > cur.band[1] ? 'border-t-[#c0604f]' : 'border-t-amber'}`} />
                  </span>
                  <span className="absolute bottom-0 font-mono text-[10.5px] text-ink/50 font-medium -translate-x-1/2" style={{ left: `${pos(cur.band[0])}%` }}>{cur.band[0]}K</span>
                  <span className="absolute bottom-0 font-mono text-[10.5px] text-ink/50 font-medium -translate-x-1/2" style={{ left: `${pos(cur.band[1])}%` }}>{cur.band[1]}K</span>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3.5 p-3.5 bg-paper rounded-[4px] border border-line/60"><Field k="月薪" v={`${cur.base}K`} /><Field k="薪资月数" v={`${cur.months} 个月`} /><Field k="股票" v={cur.stock} /><Field k="年包" v={`${(cur.base * cur.months / 10).toFixed(1)} 万`} /><Field k="带宽分位" v={`P${Math.round(((cur.base - cur.band[0]) / (cur.band[1] - cur.band[0])) * 100)}`} /><Field k="预计入职" v={cur.join} /></div>
            </Sec>
            <Sec t="审批记录">{NODES.slice(0, cur.at + 1).map((n, i) => <div key={n} className="flex items-center gap-2.5 py-1.5 text-[12px]"><span className={`w-2 h-2 rounded-full ${i === cur.at ? 'bg-amber shadow-xs' : 'bg-base'}`} /><span className="w-24 font-medium text-ink">{n}</span><span className="text-ink/55">{i === cur.at ? (cur.rejected ? '已拒绝' : '处理中') : '已同意'}</span><span className="ml-auto font-mono text-ink/45 text-[11px]">03-{String(5 + i).padStart(2, '0')}</span></div>)}</Sec>
          </div>
          <div className="shrink-0 border-t border-line p-4 flex gap-2.5 bg-[#faf8f3]">
            <Btn primary className="flex-1 h-9 text-[13px] font-semibold" disabled={cur.at >= 6 || cur.rejected} onClick={approve}>{cur.at === 5 ? '标记已接受' : `通过 · ${NODES[cur.at]}`}</Btn>
            <Btn className="h-9">预览 Offer</Btn><Btn danger className="h-9" disabled={cur.at >= 6 || cur.rejected}>撤回</Btn>
          </div>
        </aside>
      </div>
    </div>
  )
}
