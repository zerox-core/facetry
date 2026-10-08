export type Phase = 'prepare' | 'interview' | 'review'

export type Anchor = {
  lineId?: string
  page: number
  y: number
  x?: number
  quote?: string
  matched?: boolean
  manual?: boolean
} | null

export type Question = {
  id: string
  type: string
  q: string
  point: string
  followUp: string
  expected: string[]
  excluded: boolean
  score: number | null
  note: string
}

export type SectionKind = 'project' | 'experience' | 'skills' | 'education' | 'custom'

export type Section = {
  id: string
  title: string
  kind: SectionKind
  anchor: Anchor
  questions: Question[]
}

export type Evaluation = {
  overall: string
  suggestion: string
  strengths: string[]
  weaknesses: string[]
  nextSteps: string[]
  evidence: string[]
  generatedAt: string
}

export type ResumeLine = { id: string; text: string; page: number; y: number; x?: number }

export type Session = {
  id: string
  fileName: string
  file: string
  name: string
  role: string
  summary: string
  text: string
  sections: Section[]
  lines: ResumeLine[]
  pageCount: number
  phase: Phase
  note: string
  evaluation: Evaluation | null
  createdAt: string
  updatedAt: string
}

export type SessionSummary = Pick<
  Session,
  'id' | 'fileName' | 'name' | 'role' | 'summary' | 'pageCount' | 'phase' | 'createdAt' | 'updatedAt'
> & {
  questionCount: number
  scoredCount: number
  /** 非隐藏已评分题的平均分（1 位小数），无评分时为 null */
  avgScore: number | null
  hasEvaluation: boolean
  /** evaluation.suggestion 截断 200 字，无评价时为 '' */
  suggestion: string
}

export type JobType = 'analyze' | 'evaluate'

export type Job = {
  id: string
  sessionId: string
  type: JobType
  state: 'running' | 'done' | 'error'
  error?: string
}

export type QuestionPatch = {
  id: string
  score?: number | null
  note?: string
  excluded?: boolean
  q?: string
  point?: string
  followUp?: string
  type?: string
  expected?: string[]
}

export type NewQuestion = {
  type?: string
  q: string
  point?: string
  followUp?: string
  expected?: string[]
}

export type SessionPatch = {
  note?: string
  phase?: Phase
  question?: QuestionPatch
  addQuestion?: { sectionId?: string; sectionTitle?: string; question: NewQuestion }
  removeQuestion?: { id: string }
  anchor?: { id: string; page: number; y: number }
}

export type AnalyzePayload = {
  role?: string
  lines: ResumeLine[]
  pageCount: number
  images: string[]
}

export type BankPartKey = 'A' | 'B' | 'E' | 'F' | 'C' | 'D' | 'CUST'

export type BankPart = { key: BankPartKey | string; name: string; weight: number }

export type BankQuestion = {
  id: string
  part: string
  partName: string
  title: string
  q: string
  answer: string
  material?: string
  custom: boolean
  updatedAt: string
}

export type Bank = { parts: BankPart[]; questions: BankQuestion[] }

export type BankQuestionInput = {
  part?: string
  title: string
  q: string
  answer?: string
  material?: string
}
