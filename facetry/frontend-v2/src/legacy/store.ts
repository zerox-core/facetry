import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api'
import { toast } from './components/Toast'
import type { Job, Session, SessionPatch } from './types'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const errMsg = (e: unknown) => (e instanceof Error ? e.message : '操作失败，请重试')
const timeLabel = () => {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** 本地乐观应用 PATCH，与后端字段语义保持一致 */
export function applyPatch(session: Session, patch: SessionPatch): Session {
  const s: Session = { ...session, sections: session.sections.map((sec) => ({ ...sec, questions: [...sec.questions] })) }
  if (typeof patch.note === 'string') {
    s.note = patch.note
    s.evaluation = null
  }
  if (patch.phase) s.phase = patch.phase
  if (patch.question) {
    const p = patch.question
    const q = s.sections.flatMap((sec) => sec.questions).find((x) => x.id === p.id)
    if (q) {
      if ('score' in p) q.score = p.score ?? null
      if (typeof p.note === 'string') q.note = p.note
      if (typeof p.excluded === 'boolean') q.excluded = p.excluded
      if (typeof p.q === 'string') q.q = p.q
      if (typeof p.point === 'string') q.point = p.point
      if (typeof p.followUp === 'string') q.followUp = p.followUp
      if (typeof p.type === 'string') q.type = p.type
      if (Array.isArray(p.expected)) q.expected = p.expected
      s.evaluation = null
    }
  }
  if (patch.addQuestion) {
    const { sectionId, sectionTitle, question } = patch.addQuestion
    const q = {
      id: `local-${crypto.randomUUID()}`,
      type: question.type || '经历深挖',
      q: question.q,
      point: question.point || '',
      followUp: question.followUp || '',
      expected: question.expected || [],
      excluded: false,
      score: null,
      note: '',
    }
    let sec = sectionId ? s.sections.find((x) => x.id === sectionId) : undefined
    if (!sec && sectionTitle) {
      sec = { id: `local-${crypto.randomUUID()}`, title: sectionTitle, kind: 'custom', anchor: null, questions: [] }
      s.sections.push(sec)
    }
    if (!sec) sec = s.sections[s.sections.length - 1]
    if (sec) sec.questions.push(q)
  }
  if (patch.removeQuestion) {
    for (const sec of s.sections) sec.questions = sec.questions.filter((q) => q.id !== patch.removeQuestion!.id)
  }
  if (patch.anchor) {
    const sec = s.sections.find((x) => x.id === patch.anchor!.id)
    if (sec) sec.anchor = { ...sec.anchor, page: patch.anchor.page, y: patch.anchor.y, matched: true, manual: true }
  }
  return s
}

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export function useReviewSession(sessionId: string) {
  const [session, setSession] = useState<Session | null>(null)
  const [loadError, setLoadError] = useState('')
  const [job, setJob] = useState<Job | null>(null)
  const [jobError, setJobError] = useState('')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [savedAt, setSavedAt] = useState('')
  const chain = useRef<Promise<unknown>>(Promise.resolve())
  const sessionRef = useRef<Session | null>(null)
  sessionRef.current = session
  const jobKey = `facetry-job-${sessionId}`

  const load = useCallback(async () => {
    setLoadError('')
    try {
      setSession(await api.getSession(sessionId))
    } catch (e) {
      setLoadError(errMsg(e))
    }
  }, [sessionId])

  const pollJob = useCallback(
    async (j: Job) => {
      setJob(j)
      setJobError('')
      try {
        for (;;) {
          const cur = await api.getJob(j.id)
          if (cur.state === 'done') {
            localStorage.removeItem(jobKey)
            setJob(null)
            setSession(await api.getSession(sessionId))
            toast(cur.type === 'analyze' ? '问题已标注在对应经历旁' : '综合评价已生成，请复核')
            return
          }
          if (cur.state === 'error') throw new Error(cur.error || '任务失败，请重试')
          await sleep(1500)
        }
      } catch (e) {
        // 404 说明任务已丢失（如服务重启），允许用户重试
        localStorage.removeItem(jobKey)
        setJob(null)
        setJobError(errMsg(e))
      }
    },
    [jobKey, sessionId],
  )

  useEffect(() => {
    void load()
    const stored = localStorage.getItem(jobKey)
    if (stored) {
      try {
        void pollJob(JSON.parse(stored) as Job)
      } catch {
        localStorage.removeItem(jobKey)
      }
    }
  }, [load, pollJob, jobKey])

  /** 乐观更新 + 串行保存队列；失败给出提示并回退到服务端状态 */
  const patch = useCallback(
    (p: SessionPatch) => {
      const current = sessionRef.current
      if (!current) return
      setSession(applyPatch(current, p))
      setSaveState('saving')
      const task = chain.current
        .then(() => api.patchSession(sessionId, p))
        .then((fresh) => {
          setSession(fresh)
          setSaveState('saved')
          setSavedAt(timeLabel())
        })
        .catch(async (e: unknown) => {
          setSaveState('error')
          toast('保存失败：' + errMsg(e))
          try {
            setSession(await api.getSession(sessionId))
          } catch {
            /* 保留本地状态 */
          }
        })
      chain.current = task.catch(() => {})
    },
    [sessionId],
  )

  /** 启动后台任务并轮询；任务 id 存入 localStorage 以便刷新后恢复 */
  const runJob = useCallback(
    async (start: Promise<Job>) => {
      setJobError('')
      let j: Job
      try {
        j = await start
      } catch (e) {
        setJobError(errMsg(e))
        return
      }
      localStorage.setItem(jobKey, JSON.stringify(j))
      await pollJob(j)
    },
    [jobKey, pollJob],
  )

  return { session, loadError, reload: load, patch, saveState, savedAt, job, jobError, setJobError, runJob }
}

/**
 * 通用后台任务轮询（初筛 / 重筛 / 同步 / AI 草稿等）：
 * run(POST 返回的 Job) 后轮询 /api/jobs/{id}，完成时回调 onDone；404 视为任务丢失，可重试。
 */
export function useJob(onDone: () => void | Promise<void>, doneMessage?: string) {
  const [job, setJob] = useState<Job | null>(null)
  const [jobError, setJobError] = useState('')
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  const run = useCallback(
    async (start: Promise<Job>) => {
      setJobError('')
      let j: Job
      try {
        j = await start
      } catch (e) {
        setJobError(errMsg(e))
        return
      }
      setJob(j)
      try {
        for (;;) {
          const cur = await api.getJob(j.id)
          if (cur.state === 'done') {
            setJob(null)
            await doneRef.current()
            if (doneMessage) toast(doneMessage)
            return
          }
          if (cur.state === 'error') throw new Error(cur.error || '任务失败，请重试')
          await sleep(1500)
        }
      } catch (e) {
        // 404 说明任务已丢失（如服务重启），允许用户重试
        setJob(null)
        setJobError(errMsg(e))
        toast(errMsg(e))
      }
    },
    [doneMessage],
  )

  return { job, jobError, run }
}
