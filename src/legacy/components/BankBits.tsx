import type { Bank, BankQuestion } from '../types'
import { shortPartName } from '../views/shared'

export function filterBank(bank: Bank, part: string, search: string): BankQuestion[] {
  const kw = search.trim().toLowerCase()
  return bank.questions.filter(
    (b) =>
      (!part || b.part === part) &&
      (!kw || b.title.toLowerCase().includes(kw) || b.q.toLowerCase().includes(kw) || b.answer.toLowerCase().includes(kw)),
  )
}

export function partCount(bank: Bank, partKey: string): number {
  return bank.questions.filter((b) => b.part === partKey).length
}

/** 分类胶囊：全部 + 各分类，选中态为墨色胶囊 */
export function PartCapsules({ bank, value, onChange }: { bank: Bank; value: string; onChange: (part: string) => void }) {
  const items: [string, string, number][] = [
    ['', '全部', bank.questions.length],
    ...bank.parts.map((p): [string, string, number] => [p.key, shortPartName(p.name), partCount(bank, p.key)]),
  ]
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map(([key, label, count]) => (
        <button
          key={key || 'all'}
          type="button"
          onClick={() => onChange(key)}
          className={`h-8 cursor-pointer rounded-full px-3 text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
            value === key ? 'bg-[#1d2939] font-medium text-white' : 'bg-white text-slate-600 shadow-sm hover:bg-slate-100'
          }`}
        >
          {label}
          <span className={`ml-1.5 text-xs tabular-nums ${value === key ? 'text-white/60' : 'text-slate-400'}`}>{count}</span>
        </button>
      ))}
    </div>
  )
}

export const bankSearchCls =
  'h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:w-72'
