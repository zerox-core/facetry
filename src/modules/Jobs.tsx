import { useState } from 'react'
import { Btn, Field, Kpis, Pill, Sec, Tabs, Th, type Tone } from './ui'

const FUN = ['投递', '筛选通过', '面试', 'Offer', '入职']
type J = { id: string; title: string; dept: string; city: string; level: string; hc: number; filled: number; open: number; pri: 'P0' | 'P1' | 'P2'; owner: string; hm: string; f: number[]; st: '招聘中' | '暂停' | '已关闭' }
const DATA: J[] = [
  { id: 'JD-108', title: '高级前端工程师', dept: '技术中心', city: '杭州', level: 'P6-P7', hc: 4, filled: 1, open: 38, pri: 'P0', owner: '王璐', hm: '吴总监', f: [214, 62, 18, 3, 1], st: '招聘中' },
  { id: 'JD-107', title: '后端架构师', dept: '技术中心', city: '北京', level: 'P8', hc: 1, filled: 0, open: 52, pri: 'P0', owner: '孙婧', hm: '刘总', f: [86, 14, 5, 1, 0], st: '招聘中' },
  { id: 'JD-105', title: '数据科学家', dept: '数据中台', city: '深圳', level: 'P7', hc: 2, filled: 1, open: 24, pri: 'P1', owner: '王璐', hm: '刘总', f: [132, 40, 12, 2, 1], st: '招聘中' },
  { id: 'JD-104', title: '产品设计负责人', dept: '设计中心', city: '上海', level: 'P8', hc: 1, filled: 0, open: 61, pri: 'P1', owner: '李航', hm: '陈经理', f: [64, 9, 3, 0, 0], st: '招聘中' },
  { id: 'JD-102', title: '产品经理', dept: '产品部', city: '杭州', level: 'P6', hc: 3, filled: 2, open: 30, pri: 'P1', owner: '李航', hm: '陈经理', f: [301, 75, 22, 4, 2], st: '招聘中' },
  { id: 'JD-101', title: 'HRBP', dept: '人力资源部', city: '杭州', level: 'P6', hc: 1, filled: 0, open: 15, pri: 'P2', owner: '赵敏', hm: '何经理', f: [58, 16, 4, 1, 0], st: '招聘中' },
  { id: 'JD-099', title: '移动端工程师', dept: '技术中心', city: '成都', level: 'P6', hc: 2, filled: 0, open: 44, pri: 'P2', owner: '赵敏', hm: '郑工', f: [97, 21, 6, 1, 0], st: '暂停' },
  { id: 'JD-096', title: '测试开发工程师', dept: '质量部', city: '杭州', level: 'P5-P6', hc: 2, filled: 2, open: 40, pri: 'P2', owner: '孙婧', hm: '郑工', f: [120, 33, 10, 2, 2], st: '已关闭' },
]
const PRI: Record<string, Tone> = { P0: 'red', P1: 'amber', P2: 'gray' }
const STT: Record<string, Tone> = { 招聘中: 'green', 暂停: 'amber', 已关闭: 'gray' }

interface JobsProps {
  navTo?: (mod: string, params?: Record<string, any>) => void
}

export default function Jobs({ navTo }: JobsProps) {
  const [sel, setSel] = useState(DATA[0].id)
  const [tab, setTab] = useState(0)
  const [dt, setDt] = useState(0)
  const cur = DATA.find(j => j.id === sel)!
  const shown = tab === 0 ? DATA : DATA.filter(j => j.st === (['', '招聘中', '暂停', '已关闭'][tab]))
  const rate = (j: J, i: number) => j.f[i] ? Math.round((j.f[i + 1] / j.f[i]) * 100) : 0

  return (
    <div className="h-full flex flex-col min-h-0">
      <Kpis items={[
        { k: '在招岗位', v: DATA.filter(j => j.st === '招聘中').length, d: 'P0 岗位 2 个', s: [5, 5, 6, 6, 7, 6, 6] },
        { k: 'HC 完成度', v: `${DATA.reduce((a, b) => a + b.filled, 0)}/${DATA.reduce((a, b) => a + b.hc, 0)}`, d: 'Q1 目标 80%', s: [2, 3, 3, 4, 5, 6, 6] },
        { k: '平均在招天数', v: '38', u: '天', d: '超 45 天 3 个', s: [42, 41, 40, 39, 39, 38, 38], warn: true },
        { k: '简历转化率', v: '4.1', u: '%', d: '投递 → 面试', s: [3.2, 3.5, 3.6, 3.9, 4.0, 4.2, 4.1] },
        { k: '本周新增投递', v: 186, d: '内推占 22%', s: [120, 140, 150, 160, 170, 175, 186] },
      ]} />
      <div className="flex-1 min-h-0 p-4 pt-3 flex gap-3">
        <section className="panel rounded-[6px] flex-1 min-w-0 flex flex-col">
          <Tabs items={['全部岗位', '招聘中', '暂停', '已关闭']} v={tab} set={setTab} right={<><Btn>JD 模板库</Btn><Btn primary>+ 新建岗位</Btn></>} />
          <div className="flex-1 overflow-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead><tr><Th w="190px">岗位</Th><Th w="40px">优先级</Th><Th w="70px">职级</Th><Th w="90px">HC</Th><Th>招聘漏斗</Th><Th w="64px" r>在招天数</Th><Th w="80px">负责人</Th><Th w="64px">状态</Th></tr></thead>
              <tbody>{shown.map(j => { const on = j.id === sel; return (
                <tr key={j.id} onClick={() => setSel(j.id)} className={`h-[50px] border-b border-[#efece4] cursor-pointer ${on ? 'bg-amber-soft/70' : 'hover:bg-[#f8f6f0]'} ${j.st === '已关闭' ? 'text-ink/45' : ''}`}>
                  <td className="relative px-2">{on && <span className="absolute left-0 inset-y-0 w-[3px] bg-amber" />}<div className="font-semibold">{j.title}</div><div className="text-[10.5px] text-ink/40">{j.dept} · {j.city} · <span className="font-mono">{j.id}</span></div></td>
                  <td className="px-2"><Pill t={PRI[j.pri]} dot={false}>{j.pri}</Pill></td>
                  <td className="px-2 font-mono text-[11px]">{j.level}</td>
                  <td className="px-2"><div className="flex gap-[2px]">{Array.from({ length: j.hc }).map((_, i) => <span key={i} className={`w-3 h-3 rounded-[1px] ${i < j.filled ? 'bg-base' : 'border border-[#cfc9ba]'}`} />)}</div><div className="text-[10.5px] text-ink/45 mt-0.5 tnum">{j.filled}/{j.hc} 已入职</div></td>
                  <td className="px-2"><div className="flex items-center gap-[2px] h-5">{j.f.map((v, i) => <div key={i} className="h-full flex items-center justify-center text-[9.5px] font-mono rounded-[1px]" title={FUN[i]} style={{ width: `${Math.max(10, (v / j.f[0]) * 100) * 0.9}%`, minWidth: 22, background: i === 0 ? '#eceae3' : i < 3 ? '#d8d2c2' : '#d7a62a', color: i >= 3 ? '#18212b' : undefined }}>{v}</div>)}</div></td>
                  <td className={`px-2 text-right tnum ${j.open > 45 ? 'text-[#a8483a] font-semibold' : ''}`}>{j.open}</td>
                  <td className="px-2"><div>{j.owner}</div><div className="text-[10.5px] text-ink/40">用人 {j.hm}</div></td>
                  <td className="px-2"><Pill t={STT[j.st]}>{j.st}</Pill></td>
                </tr>) })}</tbody>
            </table>
          </div>
        </section>

        <aside key={cur.id} className="panel-elevated rise rounded-[6px] w-[460px] shrink-0 flex flex-col">
          <div className="px-4 pt-3.5 pb-3 border-b border-line">
            <div className="flex items-center gap-2"><h2 className="font-serif text-[20px] font-bold">{cur.title}</h2><Pill t={PRI[cur.pri]} dot={false}>{cur.pri}</Pill><Pill t={STT[cur.st]}>{cur.st}</Pill></div>
            <div className="mt-2.5 grid grid-cols-4 gap-3"><Field k="部门" v={cur.dept} /><Field k="地点" v={cur.city} /><Field k="职级" v={cur.level} /><Field k="薪资范围" v="35–55K" /></div>
          </div>
          <Tabs items={['转化分析', 'JD 详情', '渠道']} v={dt} set={setDt} />
          <div className="flex-1 overflow-y-auto">
            {dt === 0 && <>
              <Sec t="招聘漏斗" extra="近 30 天">
                {cur.f.map((v, i) => (
                  <div key={i}>
                    <div className="flex items-center gap-2 h-6"><span className="w-14 text-[11px] text-ink/55">{FUN[i]}</span><div className="flex-1 h-4 bg-[#f3f1eb] rounded-[1px]"><div className="h-full rounded-[1px] transition-all duration-500" style={{ width: `${Math.max(2, (v / cur.f[0]) * 100)}%`, background: i >= 3 ? '#d7a62a' : '#5b6876' }} /></div><span className="w-8 text-right font-mono text-[11px] font-semibold">{v}</span></div>
                    {i < 4 && <div className="pl-16 text-[10px] text-ink/40 tnum h-3.5">↓ {rate(cur, i)}%{rate(cur, i) < 20 && i > 0 && <span className="ml-1 text-[#a8483a]">低于基准</span>}</div>}
                  </div>))}
              </Sec>
              <Sec t="HC 进度"><div className="flex gap-1">{Array.from({ length: cur.hc }).map((_, i) => <div key={i} className={`flex-1 h-10 rounded-[2px] flex flex-col items-center justify-center text-[10.5px] ${i < cur.filled ? 'bg-base text-paper' : 'border border-dashed border-[#cfc9ba] text-ink/40'}`}><span className="font-mono">HC{i + 1}</span><span>{i < cur.filled ? '已入职' : '空缺'}</span></div>)}</div></Sec>
            </>}
            {dt === 1 && <>
              <Sec t="岗位职责"><ol className="list-decimal pl-4 space-y-1 text-[12px] leading-relaxed text-ink/80"><li>负责核心业务前端架构设计与性能优化；</li><li>推动组件库与工程化体系建设；</li><li>指导初中级工程师，参与技术评审。</li></ol></Sec>
              <Sec t="任职要求"><ol className="list-decimal pl-4 space-y-1 text-[12px] leading-relaxed text-ink/80"><li>5 年以上前端经验，精通 React 生态；</li><li>有大型应用性能优化落地经验；</li><li>良好的沟通与跨团队推动能力。</li></ol></Sec>
              <Sec t="能力基准">{[['技术深度', 80], ['系统设计', 75], ['沟通协作', 75], ['业务理解', 70]].map(([k, v]) => <div key={k} className="flex items-center gap-2 h-6"><span className="w-16 text-[11px] text-ink/55">{k}</span><div className="flex-1 h-1.5 bg-[#ebe7dc] rounded-full"><div className="h-full bg-[#5b6876] rounded-full" style={{ width: `${v}%` }} /></div><span className="font-mono text-[11px] w-6 text-right">{v}</span></div>)}</Sec>
            </>}
            {dt === 2 && <Sec t="渠道效果" extra="投递 / 进面">{[['内推', 38, 11], ['Boss', 92, 4], ['猎头', 21, 6], ['官网', 44, 2], ['拉勾', 19, 1]].map(([k, a, b]) => <div key={k as string} className="flex items-center gap-2 h-7 border-b border-dashed border-line"><span className="w-12 text-[13px]">{k}</span><div className="flex-1 flex h-3"><div className="bg-[#d8d2c2]" style={{ width: `${a}%` }} /></div><span className="font-mono text-[11px] w-16 text-right">{a} / {b}</span><span className={`font-mono text-[11px] w-10 text-right ${(b as number) / (a as number) > .2 ? 'text-[#8a6410] font-semibold' : 'text-ink/45'}`}>{Math.round(((b as number) / (a as number)) * 100)}%</span></div>)}</Sec>}
          </div>
          <div className="shrink-0 border-t border-line p-3 flex gap-2 bg-[#fbfaf6]">
            <Btn primary className="flex-1 h-8" onClick={() => navTo && navTo('talent', { q: cur.title })}>
              查看在聘候选人 ({cur.f[1]}) →
            </Btn>
            <Btn className="h-8" onClick={() => navTo && navTo('bank', { role: cur.title.includes('前端') ? '前端工程' : cur.title.includes('架构') ? '后端架构' : '数据科学' })}>
              ✦ 对应题库
            </Btn>
            <Btn className="h-8">{cur.st === '暂停' ? '恢复' : '暂停'}</Btn>
          </div>
        </aside>
      </div>
    </div>
  )
}
