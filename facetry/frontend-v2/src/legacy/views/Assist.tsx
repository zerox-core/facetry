import { useState } from 'react'
import type { Go } from '../App'
import Bank from './Bank'
import Home from './Home'

/** 面试助手：简历解析出题与题库是面试环节的支撑工具，收在一个入口内用子标签切换 */
export default function Assist({ go, user }: { go: Go; user: string }) {
  const [tab, setTab] = useState<'review' | 'bank'>('review')
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1 border-b border-slate-200">
        {([
          ['review', '评审'],
          ['bank', '题库'],
        ] as const).map(([k, v]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`relative cursor-pointer px-4 py-2.5 text-sm transition-colors after:absolute after:inset-x-4 after:bottom-0 after:h-0.5 after:rounded-full after:bg-amber-400 after:transition-transform ${
              tab === k ? 'font-medium text-slate-900 after:scale-x-100' : 'text-slate-400 after:scale-x-0 hover:text-slate-700'
            }`}
          >
            {v}
          </button>
        ))}
      </div>
      {tab === 'review' ? <Home go={go} user={user} /> : <Bank />}
    </div>
  )
}
