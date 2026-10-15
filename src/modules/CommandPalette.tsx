import { useState, useEffect } from 'react'

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
  onNavigate: (modId: string, params?: Record<string, any>) => void
}

const ITEMS = [
  // 页面快速入口
  { category: '功能直达', title: '工作台 · 待办与全景漏斗看板', mod: 'dashboard' },
  { category: '功能直达', title: '人才库 · 候选人流水与能力评估', mod: 'talent' },
  { category: '功能直达', title: '面试排期 · 面试官时间轴甘特图', mod: 'interviews' },
  { category: '功能直达', title: '评审中心 · 五维打分与事实证据', mod: 'reviews' },
  { category: '功能直达', title: 'Offer 审批 · 职级带宽与审批流', mod: 'offers' },
  { category: '功能直达', title: '岗位与 JD · 能力基准与渠道转化', mod: 'jobs' },
  { category: '功能直达', title: '智能题库 · 岗位考题与 AI 出题', mod: 'bank' },
  { category: '功能直达', title: '面试副驾 · 实时转录与智能追问', mod: 'assist' },
  { category: '功能直达', title: '系统设置 · 飞书与基础服务配置', mod: 'admin' },

  // 重点候选人直达
  { category: '候选人', title: '林知远 · 高级前端工程师 (复面中 · 匹配度 92)', mod: 'talent', params: { q: '林知远' } },
  { category: '候选人', title: '周以宁 · 产品设计负责人 (初面超时待评 · 匹配度 89)', mod: 'reviews', params: { candName: '周以宁' } },
  { category: '候选人', title: '许星河 · 数据科学家 (终面已通过 · 待定薪审批)', mod: 'offers', params: { candName: '许星河' } },
  { category: '候选人', title: '陈默 · 后端架构师 (今日 15:30 终面)', mod: 'interviews', params: { candName: '陈默' } },
  { category: '候选人', title: '顾言 · 测试开发工程师 (Offer 待发放)', mod: 'offers', params: { candName: '顾言' } },

  // 重点岗位直达
  { category: '岗位', title: '高级前端工程师 · P6-P7 (HC 4 / 在招 38 天)', mod: 'jobs', params: { q: '前端' } },
  { category: '岗位', title: '后端架构师 · P8 (HC 1 / P0 紧急)', mod: 'jobs', params: { q: '架构师' } },
  { category: '岗位', title: '数据科学家 · P7 (HC 2 / 数据中台)', mod: 'jobs', params: { q: '数据' } },
]

export default function CommandPalette({ open, onClose, onNavigate }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
    }
  }, [open])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (open) onClose()
        else onClose() // handled in parent
      }
      if (e.key === 'Escape' && open) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  const filtered = ITEMS.filter(item => {
    return (item.title + item.category).toLowerCase().includes(query.toLowerCase())
  })

  const handleSelect = (item: typeof ITEMS[0]) => {
    onNavigate(item.mod, item.params)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 bg-base/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="panel-elevated w-[580px] max-w-full rounded-[8px] bg-paper shadow-2xl border border-line overflow-hidden">
        {/* 输入框 */}
        <div className="flex items-center px-4 h-12 border-b border-line bg-paper">
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-ink/40 mr-3" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            autoFocus
            value={query}
            onChange={e => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            onKeyDown={e => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setSelectedIndex(i => Math.min(filtered.length - 1, i + 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setSelectedIndex(i => Math.max(0, i - 1))
              } else if (e.key === 'Enter' && filtered[selectedIndex]) {
                handleSelect(filtered[selectedIndex])
              }
            }}
            placeholder="搜索候选人、岗位、待办、题库或任意操作…"
            className="flex-1 bg-transparent text-[13.5px] text-ink placeholder:text-ink/35 outline-none font-medium"
          />
          <kbd className="font-mono text-[11px] text-ink/40 bg-[#f0ede5] px-1.5 py-0.5 rounded-[3px]">ESC 关闭</kbd>
        </div>

        {/* 搜索建议列表 */}
        <div className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-ink/40 text-[12.5px]">未找到匹配的结果</div>
          ) : (
            filtered.map((item, index) => {
              const active = index === selectedIndex
              return (
                <div
                  key={index}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-[4px] cursor-pointer transition-colors ${active ? 'bg-amber text-base font-semibold shadow-2xs' : 'text-ink/80 hover:bg-[#faf7f0]'}`}
                >
                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${active ? 'bg-base text-paper' : 'bg-[#eceae3] text-ink/60'}`}>
                    {item.category}
                  </span>
                  <span className="text-[12.5px] truncate flex-1">{item.title}</span>
                  <span className={`text-[11px] font-mono ${active ? 'text-base/80' : 'text-ink/35'}`}>回车跳转 ↵</span>
                </div>
              )
            })
          )}
        </div>

        {/* 底部帮助 */}
        <div className="h-8 px-4 bg-[#faf8f3] border-t border-line flex items-center justify-between text-[11px] text-ink/40 font-mono">
          <span><kbd className="text-ink/60">↑</kbd> <kbd className="text-ink/60">↓</kbd> 移动选择</span>
          <span><kbd className="text-ink/60">Enter</kbd> 确认直达</span>
        </div>
      </div>
    </div>
  )
}
