import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import type { Go } from '../App'
import { BankPicker } from '../components/BankPicker'
import { Chip } from '../components/Chip'
import { ConfirmModal } from '../components/Modal'
import { kindLabels, PdfViewer } from '../components/PdfViewer'
import { formToPatch, QuestionCard, QuestionForm } from '../components/QuestionCard'
import { ScoreDots } from '../components/ScoreDots'
import { SectionSheet } from '../components/SectionSheet'
import { Select } from '../components/Select'
import { toast } from '../components/Toast'
import { Btn, Card, Label, Spinner } from '../components/ui'
import { captureImages, evictDocument, loadDocumentCached, type DocData } from '../pdf'
import { useReviewSession } from '../store'
import type { BankQuestion, Job, JobDescription, Phase, Session } from '../types'
import { shortPartName, useMediaQuery } from './shared'

const phases: [Phase, string][] = [
  ['prepare', '准备'],
  ['interview', '面试'],
  ['review', '评价'],
]

/** 任务进度：analyze 拆成两次模型调用，job.stage 为服务端真实阶段；前两步是客户端本地解析 */
function JobProgress({ job }: { job: Job }) {
  const steps =
    job.type === 'analyze'
      ? ['解析版面', '提取文本', '识别经历', '生成问题', '对齐原文']
      : ['整理评分记录', '归纳优势与不足', '形成建议']
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1500)
    return () => clearInterval(t)
  }, [])
  // 服务端已上报真实阶段时以它为准；未上报时前两步（本地）按时间走
  const stageIdx = job.stage ? (job.stage === 'outline' ? 2 : 3) : null
  const current = stageIdx ?? Math.min(Math.floor(tick / 3), stageIdx === null && job.type === 'analyze' ? 1 : steps.length - 1)
  const hint =
    job.type === 'analyze'
      ? job.stage === 'questions'
        ? '提纲已就绪，正在按板块生成问题…'
        : '正在通读简历、划分板块并锚定原文位置…'
      : '通常需要 1–3 分钟，你可以先阅读左侧简历'
  return (
    <div className="py-4">
      <div className="mb-5 flex items-center justify-center gap-2 text-sm font-medium text-slate-900">
        <Spinner />
        {job.type === 'analyze' ? '正在认真读这份简历…' : '正在整理这场对话…'}
      </div>
      <ol className="mx-auto max-w-xs space-y-2.5">
        {steps.map((s, i) => (
          <li key={s} className="flex items-center gap-2.5 text-sm">
            {i < current ? (
              <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-50 text-emerald-600">
                <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l4 4L19 6" /></svg>
              </span>
            ) : i === current ? (
              <Spinner className="h-5 w-5" />
            ) : (
              <span className="grid h-5 w-5 place-items-center rounded-full bg-slate-100 text-[11px] text-slate-400 tabular-nums">{i + 1}</span>
            )}
            <span className={i <= current ? 'text-slate-800' : 'text-slate-400'}>{s}</span>
          </li>
        ))}
      </ol>
      <p className="mt-5 text-center text-xs text-slate-400">{hint}</p>
    </div>
  )
}

function exportMarkdown(s: Session) {
  const all = s.sections.flatMap((sec) => sec.questions.map((q) => ({ ...q, section: sec.title })))
  const active = all.filter((q) => !q.excluded)
  const scored = active.filter((q) => q.score !== null)
  const avg = scored.length ? (scored.reduce((n, q) => n + (q.score || 0), 0) / scored.length).toFixed(1) : '—'
  const ev = s.evaluation
  const parts = [
    `# ${s.name} · 面试记录`,
    `岗位：${s.role || '未指定'}\n文件：${s.fileName}\n导出时间：${new Date().toLocaleString('zh-CN')}\n已评分：${scored.length}/${active.length}\n平均分：${avg}/5`,
    `## 整体观察\n${s.note || '暂无'}`,
    ev
      ? `## 综合评价\n${ev.overall}\n\n### 优势\n${ev.strengths.map((x) => '- ' + x).join('\n')}\n\n### 不足与待验证\n${ev.weaknesses.map((x) => '- ' + x).join('\n')}\n\n### 后续建议\n${ev.suggestion}\n${(ev.nextSteps || []).map((x) => '- ' + x).join('\n')}`
      : '## 综合评价\n尚未生成',
    ...s.sections.map(
      (sec) =>
        `## ${sec.title}${sec.anchor?.quote ? `\n原文：${sec.anchor.quote}` : ''}\n\n` +
        sec.questions
          .map(
            (q) =>
              `### ${q.excluded ? '[已隐藏] ' : ''}${q.q}\n评分：${q.score === null ? '未评分' : q.score + '/5'}\n备注：${q.note || '暂无'}\n考察点：${q.point}\n追问：${q.followUp}\n参考要点：\n${q.expected.map((x) => '- ' + x).join('\n')}`,
          )
          .join('\n\n'),
    ),
  ]
  const url = URL.createObjectURL(new Blob(['\uFEFF' + parts.join('\n\n')], { type: 'text/markdown;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${(s.name || '候选人').replace(/[<>:"/\\|?*]/g, '_')}_面试记录.md`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  toast('面试记录已导出为 Markdown')
}

/** 「+ 加题」的方式选择弹层：手动填写或从题库选择 */
function AddChooser({ onManual, onBank, onClose }: { onManual: () => void; onBank: () => void; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  const option =
    'flex w-full cursor-pointer items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-left transition-colors duration-150 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-[#1d2939]/50" onClick={onClose} />
      <div className="ws-paper login-fade relative w-full max-w-xs rounded-xl p-5" role="dialog" aria-modal="true">
        <h3 className="text-base font-semibold text-slate-900">加题方式</h3>
        <div className="mt-4 space-y-2">
          <button type="button" onClick={onManual} className={option}>
            <span>
              <span className="block text-sm font-medium text-slate-900">手动填写</span>
              <span className="mt-0.5 block text-xs text-slate-400">针对这份简历自定义一道题</span>
            </span>
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>
          </button>
          <button type="button" onClick={onBank} className={option}>
            <span>
              <span className="block text-sm font-medium text-slate-900">从题库选择</span>
              <span className="mt-0.5 block text-xs text-slate-400">复用通用题，可连续添加多道</span>
            </span>
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Review({ sessionId, go }: { sessionId: string; go: Go }) {
  const { session, loadError, reload, patch, saveState, savedAt, job, jobError, runJob } = useReviewSession(sessionId)
  const [doc, setDoc] = useState<DocData | null>(null)
  const [docError, setDocError] = useState('')
  const [docReload, setDocReload] = useState(0)
  const [role, setRole] = useState('')
  const [hoverSectionId, setHoverSectionId] = useState<string | null>(null)
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null)
  const [placingFor, setPlacingFor] = useState<string | null>(null)
  const [addingFor, setAddingFor] = useState<string | null>(null)
  const [chooserFor, setChooserFor] = useState<string | null>(null)
  const [pickerFor, setPickerFor] = useState<string | null>(null)
  const [newSectionTitle, setNewSectionTitle] = useState('')
  const [confirmRegen, setConfirmRegen] = useState(false)
  const [confirmReanalyze, setConfirmReanalyze] = useState(false)
  const [jds, setJds] = useState<JobDescription[] | null>(null)
  // 准备阶段才需要岗位库（关联 JD / 出题岗位）
  useEffect(() => {
    if (session?.phase === 'prepare' && jds === null) {
      void api
        .listJds()
        .then((r) => setJds(r.jds))
        .catch(() => setJds([]))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.phase])
  // 窄屏（手机 / iPad 竖屏）：上下堆叠 + 点标记弹底部抽屉
  const narrow = useMediaQuery('(max-width: 1023px)')

  const sid = session?.id
  const file = session?.file
  const docKey = sid ? `${sid}:${docReload}` : ''
  useEffect(() => {
    if (!sid || !file) return
    let alive = true
    setDoc(null)
    setDocError('')
    // 同一 docKey 共享缓存的解析 Promise，StrictMode 双调用不会重复解析也不会互相取消
    loadDocumentCached(docKey, `files/${file}`, session?.text || '')
      .then((d) => alive && setDoc(d))
      .catch((e) => alive && setDocError(e instanceof Error ? e.message : '简历暂时无法预览'))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sid, file, docKey])

  useEffect(() => {
    if (session && !role) setRole(session.role)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id])

  /** 全部题目按顺序的全局题号 */
  const qIndex = useMemo(() => {
    const m = new Map<string, number>()
    let i = 1
    for (const sec of session?.sections || []) for (const q of sec.questions) m.set(q.id, i++)
    return m
  }, [session?.sections])

  if (loadError) {
    return (
      <Card className="ws-rise mx-auto max-w-md p-8 text-center">
        <h2 className="text-lg font-semibold text-slate-900">简历加载失败</h2>
        <p className="mt-2 text-sm text-slate-500">{loadError}</p>
        <div className="mt-6 flex justify-center gap-2">
          <Btn variant="ghost" onClick={() => go('back')}>
            ← 返回{go.from}
          </Btn>
          <Btn onClick={() => void reload()}>重试</Btn>
        </div>
      </Card>
    )
  }
  if (!session) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-slate-400">
        <Spinner /> 正在打开简历…
      </div>
    )
  }

  const allQuestions = session.sections.flatMap((s) => s.questions)
  const activeQuestions = allQuestions.filter((q) => !q.excluded)
  const canEvaluate = activeQuestions.some((q) => q.score !== null || q.note.trim()) || session.note.trim().length > 0
  const running = !!job

  const analyze = (force = false) => {
    if (!doc) {
      toast('简历尚未加载完成，请稍候')
      return
    }
    const lines = doc.lines.length ? doc.lines : session.lines
    const images = captureImages(doc)
    if (!lines.length && !images.length) {
      toast('简历内容尚未加载，请稍后重试')
      return
    }
    void runJob(api.analyze(session.id, { role: role.trim() || undefined, lines, pageCount: doc.pageCount, images, force: force || undefined }))
  }

  const locateSection = (sectionId: string) => {
    document.getElementById(`sec-${sectionId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const scrollToQuestion = (qid: string) => {
    document.getElementById(`q-${qid}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  /** 题库题目 → 本场题目：类型取分类短名，考察点取标题，参考答案按行转为参考要点 */
  const pickFromBank = (sectionId: string, b: BankQuestion) => {
    patch({
      addQuestion: {
        sectionId,
        question: {
          type: shortPartName(b.partName),
          q: b.q,
          point: b.title,
          followUp: '',
          expected: b.answer
            .split(/\n+/)
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 6),
        },
      },
    })
    toast('已加入本场题目')
  }

  const saveLabel =
    saveState === 'saving' ? '保存中…' : saveState === 'error' ? '保存失败' : saveState === 'saved' ? `已自动保存 ${savedAt}` : ''

  const ev = session.evaluation
  const sheetSectionIndex = session.sections.findIndex((s) => s.id === activeSectionId)
  const sheetSection = sheetSectionIndex >= 0 ? session.sections[sheetSectionIndex] : null

  return (
    <div className="space-y-6">
      {/* 顶部条 */}
      <Card className="ws-rise flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-3" style={{ '--i': 0 } as React.CSSProperties}>
        <button
          type="button"
          onClick={() => go('back')}
          className="cursor-pointer text-sm font-medium text-slate-500 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          ← 返回{go.from}
        </button>
        <span className="hidden h-4 w-px bg-slate-200 sm:inline" />
        <h2 className="text-lg font-semibold text-slate-900">{session.name || '待解析'}</h2>
        {session.phase === 'prepare' ? (
          session.jdId ? (
            <span className="flex items-center gap-1.5 rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">
              岗位：{session.role}
              <button
                type="button"
                aria-label="取消岗位关联"
                title="取消岗位关联"
                onClick={() => patch({ jdId: '' })}
                className="cursor-pointer hover:text-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                ✕
              </button>
            </span>
          ) : (
            <Select
              size="sm"
              className="w-44"
              value=""
              placeholder="关联岗位库 JD…"
              onChange={(v) => v && patch({ jdId: v })}
              options={(jds || []).map((j) => ({ value: j.id, label: j.title }))}
            />
          )
        ) : (
          session.role && <span className="text-sm text-slate-500">{session.role}</span>
        )}
        <Chip>{session.fileName}</Chip>
        <div className="flex-1" />
        {session.phase === 'prepare' && session.sections.length > 0 && (
          <Btn variant="ghost" className="h-8 px-3 text-xs" disabled={running} onClick={() => setConfirmReanalyze(true)}>
            ↻ 重新识别生成
          </Btn>
        )}
        {saveLabel && (
          <span className={`text-xs ${saveState === 'error' ? 'text-red-500' : 'text-slate-400'}`}>{saveLabel}</span>
        )}
        <div className="flex rounded-lg bg-slate-100 p-1">
          {phases.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => session.phase !== key && patch({ phase: key })}
              className={`h-8 cursor-pointer rounded px-3 text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                session.phase === key ? 'bg-white font-medium text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </Card>

      <div className="grid items-start gap-6 lg:grid-cols-[52%_1fr]">
        {/* 左：原文 */}
        <div className="ws-rise lg:sticky lg:top-20 lg:max-h-[calc(100vh-6.5rem)] lg:overflow-y-auto lg:pr-1" style={{ '--i': 1 } as React.CSSProperties}>
          {docError ? (
            <Card className="p-8 text-center">
              <h3 className="text-base font-semibold text-slate-900">简历暂时无法预览</h3>
              <p className="mt-2 text-sm text-slate-500">{docError}</p>
              <Btn
                variant="ghost"
                className="mt-5"
                onClick={() => {
                  evictDocument(docKey)
                  setDocReload((n) => n + 1)
                }}
              >
                重新加载
              </Btn>
            </Card>
          ) : !doc ? (
            <Card className="flex items-center justify-center gap-2 py-32 text-sm text-slate-400">
              <Spinner /> 正在打开简历，保留原始排版…
            </Card>
          ) : (
            <PdfViewer
              doc={doc}
              sections={session.sections}
              lines={doc.lines.length ? doc.lines : session.lines}
              activeId={activeSectionId}
              onToggle={setActiveSectionId}
              hoverId={hoverSectionId}
              placingFor={placingFor}
              onPlace={(id, page, y) => {
                patch({ anchor: { id, page, y } })
                setPlacingFor(null)
                toast('锚点已更新')
              }}
              onLocate={locateSection}
              onOpenSection={narrow ? setActiveSectionId : undefined}
            />
          )}
        </div>

        {/* 右：工作面板 */}
        <div className="ws-rise space-y-4" style={{ '--i': 2 } as React.CSSProperties}>
          {session.sections.length === 0 ? (
            <Card className="p-8">
              {job?.type === 'analyze' ? (
                <JobProgress job={job} />
              ) : (
                <div className="mx-auto max-w-sm text-center">
                  <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-blue-50 text-blue-600">
                    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M21 11a8 8 0 0 1-8 8H7l-4 3V7a4 4 0 0 1 4-4h6a8 8 0 0 1 8 8z M7 8h9 M7 12h6" />
                    </svg>
                  </span>
                  <h3 className="mt-4 text-lg font-semibold text-slate-900">让问题，回到经历里</h3>
                  <p className="mt-1.5 text-sm text-slate-500">为项目经历生成有针对性的问题、追问和评分参考，直接标注在简历原文上。</p>
                  {jobError && <p className="login-fade mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">{jobError}</p>}
                  <div className="mt-5 text-left">
                    <Label>本次面试岗位</Label>
                    {(jds || []).length > 0 && (
                      <div className="mt-1">
                        <Select
                          value={session.jdId || ''}
                          placeholder="从岗位库选择…"
                          onChange={(v) => v && patch({ jdId: v })}
                          options={(jds || []).map((j) => ({ value: j.id, label: j.title, hint: j.company || undefined }))}
                        />
                      </div>
                    )}
                    {!session.jdId && (
                      <input
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        placeholder="或手动填写岗位方向（可留空，识别后自动匹配岗位库）"
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                      />
                    )}
                  </div>
                  <Btn variant="accent" className="mt-4 w-full" disabled={!doc || running} onClick={() => analyze()}>
                    {jobError ? '重试：AI 生成面试问题' : doc ? 'AI 生成面试问题' : '正在打开简历…'}
                  </Btn>
                  <p className="mt-3 text-xs text-slate-400">生成时，简历内容将发送至已配置的模型服务</p>
                </div>
              )}
            </Card>
          ) : session.phase === 'review' ? (
            <>
              {/* 评价阶段 */}
              <Card className="p-5">
                <Label>面试整体观察</Label>
                <textarea
                  key={session.id}
                  defaultValue={session.note}
                  rows={3}
                  maxLength={20000}
                  placeholder="补充逐题记录之外的观察，例如：沟通结构清楚；项目职责边界还需要下一轮确认…"
                  onBlur={(e) => {
                    if (e.target.value !== session.note) patch({ note: e.target.value })
                  }}
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                />
              </Card>

              {job?.type === 'evaluate' && (
                <Card className="p-6">
                  <JobProgress job={job} />
                </Card>
              )}

              {!ev && job?.type !== 'evaluate' && (
                <Card className="p-8 text-center">
                  <h3 className="text-lg font-semibold text-slate-900">把记录，汇成完整的看法</h3>
                  <p className="mt-1.5 text-sm text-slate-500">根据已记录的评分和笔记，整理优势、待验证项与后续建议。</p>
                  {jobError && <p className="login-fade mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">{jobError}</p>}
                  <Btn variant="accent" className="mt-5" disabled={!canEvaluate || running} onClick={() => void runJob(api.evaluate(session.id))}>
                    {jobError ? '重试：生成 AI 综合评价' : '生成 AI 综合评价'}
                  </Btn>
                  {!canEvaluate && <p className="mt-3 text-xs text-slate-400">先为至少一道题评分或写下备注，再生成评价</p>}
                </Card>
              )}

              {ev && (
                <Card className="p-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-slate-900">综合评价</h3>
                    <span className="text-xs text-slate-400">基于面试记录生成 · 请复核</span>
                  </div>
                  <p className="mt-3 text-[15px] leading-7 text-slate-800">{ev.overall}</p>
                  {ev.evidence.length > 0 && (
                    <div className="mt-4 flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-slate-400">评价依据</span>
                      {ev.evidence.map((id) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => scrollToQuestion(id)}
                          className="cursor-pointer rounded bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-600 hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 tabular-nums"
                        >
                          Q{String(qIndex.get(id) || 0).padStart(2, '0')}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="mt-5 grid gap-5 sm:grid-cols-2">
                    <div>
                      <h4 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        已观察到的优势
                      </h4>
                      <ul className="mt-2 space-y-1.5">
                        {ev.strengths.length ? (
                          ev.strengths.map((x, i) => (
                            <li key={i} className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                              {x}
                            </li>
                          ))
                        ) : (
                          <li className="text-sm text-slate-400">暂无充分证据</li>
                        )}
                      </ul>
                    </div>
                    <div>
                      <h4 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                        <span className="h-2 w-2 rounded-full bg-amber-500" />
                        不足与待验证项
                      </h4>
                      <ul className="mt-2 space-y-1.5">
                        {ev.weaknesses.length ? (
                          ev.weaknesses.map((x, i) => (
                            <li key={i} className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
                              {x}
                            </li>
                          ))
                        ) : (
                          <li className="text-sm text-slate-400">暂无记录</li>
                        )}
                      </ul>
                    </div>
                  </div>
                  {ev.nextSteps.length > 0 && (
                    <div className="mt-5">
                      <h4 className="text-sm font-semibold text-slate-900">下一步</h4>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                        {ev.nextSteps.map((x, i) => (
                          <li key={i}>{x}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="mt-5 rounded-lg bg-blue-50 px-4 py-3">
                    <div className="text-xs font-medium text-blue-600">后续建议</div>
                    <p className="mt-1 text-sm text-slate-800">{ev.suggestion}</p>
                  </div>
                  <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                    <span className="text-xs text-slate-400">生成于 {new Date(ev.generatedAt).toLocaleString('zh-CN')}</span>
                    <div className="flex gap-2">
                      <Btn variant="ghost" className="h-9" disabled={running} onClick={() => setConfirmRegen(true)}>
                        重新生成
                      </Btn>
                      <Btn variant="ghost" className="h-9" onClick={() => exportMarkdown(session)}>
                        导出 Markdown
                      </Btn>
                    </div>
                  </div>
                </Card>
              )}

              {/* 逐题记录（只读），供评价依据跳转 */}
              <Card className="p-5">
                <h3 className="mb-3 text-sm font-semibold text-slate-900">逐题记录</h3>
                <div className="space-y-2.5">
                  {activeQuestions.length ? (
                    session.sections.map((sec) =>
                      sec.questions
                        .filter((q) => !q.excluded)
                        .map((q) => (
                          <div key={q.id} id={`q-${q.id}`} className="flex scroll-mt-24 items-start gap-3 rounded-lg bg-slate-50 px-4 py-3">
                            <span className="mt-0.5 text-xs font-semibold text-slate-400 tabular-nums">Q{String(qIndex.get(q.id) || 0).padStart(2, '0')}</span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-slate-800">{q.q}</p>
                              {q.note.trim() && <p className="mt-1 text-xs text-slate-500">{q.note}</p>}
                            </div>
                            {q.score === null ? (
                              <span className="shrink-0 text-xs text-slate-400">未评分</span>
                            ) : (
                              <ScoreDots value={q.score} readonly size="sm" />
                            )}
                          </div>
                        )),
                    )
                  ) : (
                    <p className="text-sm text-slate-400">还没有保留的题目</p>
                  )}
                </div>
              </Card>
            </>
          ) : (
            <>
              {/* 准备 / 面试阶段 */}
              {session.summary && (
                <Card className="p-5">
                  <Label>AI 简历摘要</Label>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{session.summary}</p>
                </Card>
              )}
              {job?.type === 'analyze' && (
                <Card className="p-6">
                  <JobProgress job={job} />
                </Card>
              )}
              {jobError && job?.type !== 'analyze' && (
                <Card className="flex items-center justify-between px-5 py-3">
                  <p className="text-sm text-amber-700">{jobError}</p>
                </Card>
              )}
              {session.sections.map((sec, si) => (
                <section key={sec.id} id={`sec-${sec.id}`} className="scroll-mt-24 space-y-3">
                  <div className="flex flex-wrap items-center gap-2 px-1">
                    <span className="grid h-[22px] w-[22px] place-items-center rounded-full bg-[#1d2939] text-[11px] font-semibold text-white tabular-nums">
                      {si + 1}
                    </span>
                    <h3 className="text-base font-semibold text-slate-900">{sec.title}</h3>
                    <Chip tone="blue">{kindLabels[sec.kind] || '简历经历'}</Chip>
                    {placingFor === sec.id ? (
                      <span className="flex items-center gap-2 text-xs text-amber-700">
                        校准中：请点击左侧简历中的对应段落
                        <button
                          type="button"
                          onClick={() => setPlacingFor(null)}
                          className="cursor-pointer font-medium text-slate-500 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                        >
                          取消
                        </button>
                      </span>
                    ) : sec.anchor && sec.anchor.matched !== false ? (
                      <span className="text-xs text-slate-400 tabular-nums">已锚定 · 第 {sec.anchor.page} 页</span>
                    ) : session.phase === 'prepare' ? (
                      <button
                        type="button"
                        onClick={() => setPlacingFor(sec.id)}
                        className="cursor-pointer rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-700 hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                      >
                        位置待校准 · 点击放置
                      </button>
                    ) : null}
                  </div>
                  {sec.questions.map((q) => (
                    <QuestionCard
                      key={q.id}
                      q={q}
                      index={qIndex.get(q.id) || 0}
                      phase={session.phase}
                      onPatch={(p) => patch({ question: p })}
                      onRemove={() => patch({ removeQuestion: { id: q.id } })}
                      onHover={(inside) => setHoverSectionId(inside ? sec.id : null)}
                    />
                  ))}
                  {addingFor === sec.id ? (
                    <Card className="p-4">
                      <QuestionForm
                        submitLabel="添加问题"
                        onSubmit={(v) => {
                          patch({ addQuestion: { sectionId: sec.id, question: formToPatch(v) } })
                          setAddingFor(null)
                        }}
                        onCancel={() => setAddingFor(null)}
                      />
                    </Card>
                  ) : session.phase === 'prepare' ? (
                    <button
                      type="button"
                      onClick={() => setChooserFor(sec.id)}
                      className="w-full cursor-pointer rounded-xl border border-dashed border-slate-200 py-2.5 text-sm text-slate-400 transition-colors duration-150 hover:border-slate-300 hover:text-slate-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                    >
                      + 加题
                    </button>
                  ) : null}
                </section>
              ))}
              {addingFor === '__new__' ? (
                <Card className="space-y-3 p-4">
                  <div>
                    <Label>板块名称</Label>
                    <input
                      value={newSectionTitle}
                      onChange={(e) => setNewSectionTitle(e.target.value)}
                      placeholder="例如：开源贡献"
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                    />
                  </div>
                  <QuestionForm
                    submitLabel="创建板块并添加问题"
                    onSubmit={(v) => {
                      patch({ addQuestion: { sectionTitle: newSectionTitle.trim() || '自定义板块', question: formToPatch(v) } })
                      setAddingFor(null)
                      setNewSectionTitle('')
                    }}
                    onCancel={() => setAddingFor(null)}
                  />
                </Card>
              ) : session.phase === 'prepare' ? (
                <button
                  type="button"
                  onClick={() => setAddingFor('__new__')}
                  className="w-full cursor-pointer rounded-xl border border-dashed border-slate-200 py-3 text-sm font-medium text-slate-500 transition-colors duration-150 hover:border-slate-300 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
                  + 加板块
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>

      {chooserFor && (
        <AddChooser
          onClose={() => setChooserFor(null)}
          onManual={() => {
            setAddingFor(chooserFor)
            setChooserFor(null)
          }}
          onBank={() => {
            setPickerFor(chooserFor)
            setChooserFor(null)
          }}
        />
      )}

      <BankPicker open={!!pickerFor} onClose={() => setPickerFor(null)} onPick={(b) => pickerFor && pickFromBank(pickerFor, b)} />

      {narrow && sheetSection && (
        <SectionSheet
          section={sheetSection}
          index={sheetSectionIndex + 1}
          qIndex={qIndex}
          phase={session.phase}
          onPatch={(p) => patch({ question: p })}
          onRemove={(id) => patch({ removeQuestion: { id } })}
          onClose={() => setActiveSectionId(null)}
        />
      )}

      <ConfirmModal
        open={confirmReanalyze}
        title="重新 AI 识别生成题目？"
        body="将基于已缓存的简历提纲重新生成题目（原文标注位置保持不变），现有题目、评分与面试备注会清空。此操作不可撤销。"
        confirmLabel="重新生成"
        danger
        onConfirm={() => {
          setConfirmReanalyze(false)
          analyze(true)
        }}
        onCancel={() => setConfirmReanalyze(false)}
      />

      <ConfirmModal
        open={confirmRegen}
        title="重新生成综合评价？"
        body="将基于当前的评分与备注重新生成，覆盖现有评价内容。"
        confirmLabel="重新生成"
        onConfirm={() => {
          setConfirmRegen(false)
          void runJob(api.evaluate(session.id, true))
        }}
        onCancel={() => setConfirmRegen(false)}
      />
    </div>
  )
}
