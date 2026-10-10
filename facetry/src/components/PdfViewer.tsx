import { useEffect, useRef } from 'react'
import type { DocData } from '../pdf'
import type { ResumeLine, Section } from '../types'

export const kindLabels: Record<string, string> = {
  project: '项目经历',
  experience: '工作经历',
  skills: '专业技能',
  education: '教育经历',
  custom: '自定义板块',
}

type Props = {
  doc: DocData
  sections: Section[]
  lines: ResumeLine[]
  /** 当前展开浮层/底部抽屉的板块 */
  activeId: string | null
  onToggle: (id: string | null) => void
  /** 右侧面板悬停的板块（标记高亮联动） */
  hoverId: string | null
  /** 点击校准模式：正在放置锚点的板块 id */
  placingFor: string | null
  onPlace: (sectionId: string, page: number, y: number) => void
  onLocate: (sectionId: string) => void
  /** 窄屏模式：点标记改为打开底部抽屉，不再渲染行内浮层 */
  onOpenSection?: (sectionId: string) => void
}

function CanvasSlot({ canvas }: { canvas: HTMLCanvasElement }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    canvas.style.width = '100%'
    canvas.style.height = 'auto'
    canvas.style.display = 'block'
    el.appendChild(canvas)
    return () => {
      canvas.remove()
    }
  }, [canvas])
  return <div ref={ref} className="w-full" />
}

/** 板块锚点的展示 y：优先使用匹配到的原文行 */
function anchorY(sec: Section, lines: ResumeLine[]): number | null {
  const a = sec.anchor
  if (!a) return null
  if (a.lineId) {
    const line = lines.find((l) => l.id === a.lineId)
    if (line) return line.y
  }
  return a.y
}

export function PdfViewer({ doc, sections, lines, activeId, onToggle, hoverId, placingFor, onPlace, onLocate, onOpenSection }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)

  // 点击浮层与标记以外的地方关闭浮层（窄屏底部抽屉模式下由抽屉自己处理关闭）
  useEffect(() => {
    if (!activeId || onOpenSection) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (!t.closest('[data-marker]') && !t.closest('[data-popover]')) onToggle(null)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [activeId, onToggle, onOpenSection])

  return (
    <div ref={rootRef} className="space-y-6">
      {doc.pages.map((p) => {
        const pageSections = sections.filter((s) => s.anchor && s.anchor.page === p.page)
        return (
          <div key={p.page} className="ws-paper relative overflow-hidden rounded-sm">
            {p.canvas ? (
              <CanvasSlot canvas={p.canvas} />
            ) : (
              <div className="px-10 py-8">
                <div className="mb-4 text-xs text-slate-400">文本预览 · 已重新排版 · 第 {p.page} 页</div>
                {(p.textLines || []).map((l) => (
                  <p key={l.id} className="text-sm leading-7 text-slate-800">
                    {l.text}
                  </p>
                ))}
              </div>
            )}
            {/* 标记与命中带覆盖层：默认不拦截事件，仅标记/浮层可点 */}
            <div
              className={`absolute inset-0 ${placingFor ? 'cursor-crosshair' : 'pointer-events-none'}`}
              onClick={
                placingFor
                  ? (e) => {
                      const rect = e.currentTarget.getBoundingClientRect()
                      const y = Math.max(0.01, Math.min(0.99, (e.clientY - rect.top) / rect.height))
                      onPlace(placingFor, p.page, y)
                    }
                  : undefined
              }
            >
              {placingFor && (
                <div className="absolute inset-x-0 top-3 mx-auto w-fit rounded bg-[#1d2939] px-3 py-1.5 text-xs text-white">
                  点击简历中的对应段落，放置锚点
                </div>
              )}
              {pageSections.map((sec) => {
                const y = anchorY(sec, lines)
                if (y === null) return null
                const active = activeId === sec.id
                const hovered = hoverId === sec.id
                const idx = sections.findIndex((s) => s.id === sec.id) + 1
                const warm = sec.kind === 'skills' || sec.kind === 'education'
                const band = warm
                  ? 'bg-amber-400/15 shadow-[inset_0_0_0_1px_rgba(217,119,6,0.30)]'
                  : 'bg-emerald-400/15 shadow-[inset_0_0_0_1px_rgba(5,150,105,0.30)]'
                return (
                  <div key={sec.id}>
                    {/* 荧光命中带：标出锚点所在的一行 */}
                    <div
                      aria-hidden="true"
                      className={`absolute inset-x-0 h-5 -translate-y-1/2 transition-opacity duration-150 ${band} ${
                        active || hovered ? 'opacity-100' : 'opacity-60'
                      }`}
                      style={{ top: `${y * 100}%` }}
                    />
                    {/* 数字角标统一靠左对齐；点击即滚动右侧面板到对应板块 */}
                    <button
                      data-marker
                      type="button"
                      aria-label={`${sec.title}，点击定位到对应题目`}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (placingFor) return
                        if (onOpenSection) {
                          onOpenSection(sec.id)
                          return
                        }
                        onToggle(null)
                        onLocate(sec.id)
                      }}
                      className={`pointer-events-auto absolute z-10 grid h-[22px] w-[22px] -translate-y-1/2 cursor-pointer place-items-center rounded-full text-[11px] font-semibold tabular-nums transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                        hovered ? 'bg-amber-400 text-[#1d2939]' : 'bg-[#1d2939] text-white hover:bg-blue-600'
                      } ${sec.anchor?.matched === false ? 'ring-2 ring-amber-400' : ''}`}
                      style={{ left: 12, top: `${y * 100}%` }}
                    >
                      {idx}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
      <p className="text-center text-xs text-slate-400">数字标记对应这段经历的问题，点击自动定位到右侧题目</p>
    </div>
  )
}
