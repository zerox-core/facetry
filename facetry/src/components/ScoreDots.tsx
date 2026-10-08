const LABELS = ['', '需提升', '较薄弱', '符合预期', '表现良好', '表现出色']

type Props = {
  value: number | null
  onChange?: (score: number | null) => void
  readonly?: boolean
  size?: 'sm' | 'md'
}

/** 1–5 分评分格：选中为墨色填充；再次点击已选格可清除评分 */
export function ScoreDots({ value, onChange, readonly, size = 'md' }: Props) {
  const cell = size === 'md' ? 'h-8 w-8 text-sm' : 'h-6 w-6 text-xs'
  return (
    <div className="flex items-center gap-1.5" role="radiogroup" aria-label="回答表现评分">
      {[1, 2, 3, 4, 5].map((n) => {
        const selected = value === n
        return (
          <button
            key={n}
            type="button"
            disabled={readonly}
            role="radio"
            aria-checked={selected}
            aria-label={`评分 ${n} 分`}
            title={readonly ? undefined : `${n} 分 · ${LABELS[n]}`}
            onClick={() => onChange?.(selected ? null : n)}
            className={`grid ${cell} cursor-pointer place-items-center rounded-lg border text-center font-medium tabular-nums transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-default ${
              selected
                ? 'border-[#1d2939] bg-[#1d2939] text-white'
                : 'border-slate-200 bg-white text-slate-500 hover:-translate-y-0.5 hover:border-slate-300 hover:text-slate-900'
            }`}
          >
            {n}
          </button>
        )
      })}
      {value !== null && <span className="ml-1 text-xs text-slate-400">{LABELS[value]}</span>}
    </div>
  )
}
