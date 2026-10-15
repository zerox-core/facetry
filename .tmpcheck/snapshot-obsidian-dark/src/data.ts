// 演示数据的「今天」：所有相对展示（今天 / 明天 / 日历）都以它为基准
export const TODAY = '2026-10-01'

// 候选人生命周期标准阶段（严格对齐 PRD V1.1 与开发要求文档）
export const STAGES = [
  '新入库',
  '筛选中',
  '待联系',
  '约面中',
  '面评中',
  '待录取',
  '已完成',
  '搁置',
  '已淘汰',
] as const
export type CandidateStage = (typeof STAGES)[number]

// 兼容旧状态
export const STATUS = STAGES

// 招聘渠道字典：渠道由采集侧（影刀）扩展，工作台只做适配，主流程与渠道数量解耦
export const CHANNELS = [
  '前程无忧',
  '猎聘',
  'BOSS直聘',
  '内推',
  '官网投递',
  '猎头',
  '简历导入',
  '影刀采集',
] as const
export type Channel = (typeof CHANNELS)[number]

export const history: { cid?: string; id: string; name: string; role: string; date: string; score: number; dur: string; verdict: string }[] = [
  { id: 'R-0931', name: '周子航', role: '前端工程师', date: '2026-09-28', score: 4.1, dur: '28:14', verdict: '推荐' },
  { id: 'R-0927', name: '赵一鸣', role: '后端工程师', date: '2026-09-24', score: 3.8, dur: '14:02', verdict: '待定' },
  { id: 'R-0918', name: '孙可', role: '前端工程师', date: '2026-09-18', score: 3.4, dur: '31:40', verdict: '待定' },
  { id: 'R-0909', name: '吴桐', role: '产品经理', date: '2026-09-09', score: 2.9, dur: '22:51', verdict: '不推荐' },
  { id: 'R-0902', name: '郑乐', role: '前端工程师', date: '2026-09-02', score: 3.1, dur: '29:33', verdict: '不推荐' },
]

// 团队题库：完整结构（题目 + 考察要点 + 参考答案 + 追问 + 减分信号）；分类可由使用者自行添加
export const bank = [
  { id: 'b1', cat: '前端', q: '浏览器事件循环中宏任务与微任务的执行顺序？', hot: '4.8k', tag: '基础', diff: '基础', points: ['准确区分宏任务与微任务的来源', '说清每轮宏任务后清空微任务队列', '能结合 await / Promise 分析输出顺序'], answer: '每轮事件循环执行一个宏任务后，清空当前所有微任务，再渲染并进入下一个宏任务。宏任务：script、setTimeout、I/O；微任务：Promise.then、queueMicrotask、MutationObserver。await 之后的代码等价于微任务。', follow: ['Node.js 的事件循环与浏览器有什么区别？'], flag: '认为 setTimeout(fn, 0) 一定先于 Promise.then' },
  { id: 'b2', cat: '前端', q: '如何设计一个支持撤销/重做的编辑器状态模型？', hot: '2.1k', tag: '设计', diff: '较难', points: ['命令模式或快照 + 增量 diff', '内存占用与操作合并策略', '协同场景下的操作变换'], answer: '主流方案是命令模式（记录可逆操作）或不可变快照 + 增量 diff；需要处理连续输入的合并、栈容量上限与内存控制；协同编辑下需引入 OT / CRDT。', follow: ['协同编辑时如何保证撤销栈不失效？'], flag: '只说「存整个 state」，不考虑内存与合并' },
  { id: 'b3', cat: '后端', q: '如何保证分布式事务的最终一致性？', hot: '3.6k', tag: '架构', diff: '较难', points: ['本地消息表 / TCC / Saga 的适用场景', '幂等与补偿设计', '监控对账与人工兜底'], answer: '常见路径：本地消息表 + MQ 重试、TCC（Try-Confirm-Cancel）、Saga 长事务补偿。核心保障是幂等键、状态机、对账与告警；最终一致允许短暂不一致，但不能丢数据。', follow: ['本地消息表和 MQ 事务消息怎么选？'], flag: '只背 2PC / 3PC 名词，讲不出落地方式' },
  { id: 'b4', cat: '后端', q: 'Redis 缓存击穿、穿透、雪崩的区别和方案？', hot: '5.2k', tag: '基础', diff: '基础', points: ['三者定义准确', '每个问题有对应方案', '能结合自身项目'], answer: '击穿指单个热点 key 过期瞬间并发打库；穿透指查询不存在的数据；雪崩指大量 key 同时失效。方案分别为互斥锁或逻辑过期、布隆过滤器与空值缓存、过期时间加随机抖动与多级缓存。', follow: ['缓存与数据库双写一致性怎么保证？'], flag: '只背定义，无法结合项目' },
  { id: 'b5', cat: '算法', q: 'RAG 系统中召回质量如何评测？', hot: '1.9k', tag: '前沿', diff: '中等', points: ['评测集的构造方式', 'Recall@K / MRR / NDCG 等指标', '离线指标与线上效果结合'], answer: '构建带标准答案的 query 集，用 Recall@K、MRR、NDCG 度量召回与排序质量；区分检索器与重排器各自的贡献；离线指标要与线上点击率、人工抽检结合看。', follow: ['没有标注数据时怎么冷启动评测？'], flag: '只报一个准确率，说不清指标定义' },
  { id: 'b6', cat: '产品', q: '如果 DAU 突然下降 20%，你会怎么分析？', hot: '3.3k', tag: '案例', diff: '中等', points: ['先确认数据口径', '按维度拆解定位', '给出验证与行动'], answer: '先排除埋点与统计口径问题，再按渠道、版本、地区、新老用户拆分定位，结合近期发版与外部事件提出假设，最后用小流量验证并制定恢复方案。', follow: ['如何判断是季节性波动还是异常？'], flag: '直接给结论，没有拆解过程' },
  { id: 'b7', cat: '综合', q: '你未来三年的职业规划是什么？', hot: '6.0k', tag: '行为', diff: '基础', points: ['目标具体可衡量', '与应聘岗位匹配', '有清晰的自我认知'], answer: '优秀回答会把目标拆成能力成长与产出两条线，说明与本岗位的契合，并讲清过去的积累如何支撑规划；空洞的「想当管理」或「不断学习」为低分回答。', follow: ['如果一年后目标没达成，你会怎么调整？'], flag: '目标空泛，或与岗位明显不匹配' },
  { id: 'b8', cat: '综合', q: '讲一个你失败的项目以及你学到了什么。', hot: '4.4k', tag: '行为', diff: '基础', points: ['真实的失败而非变相夸自己', '归因客观、兼顾自身与外部', '有后续的机制性改进'], answer: '关注失败的真实性、归因是否兼顾自身与外部因素、以及后续是否形成机制性改进；STAR 结构完整为佳。', follow: ['这个教训后来在哪件事上验证过？'], flag: '把成功包装成失败，或全程甩锅他人' },
]

export const bankCats: string[] = ['前端', '后端', '算法', '产品', '综合']

export type JD = {
  id: string
  code: string // 标尺编号，如 "JD-FE-01"
  title: string // 职位标尺名称，如 "高级前端开发工程师"
  dept: string // 所属部门，如 "技术部 · 大前端架构组"
  exp: string // 经验门槛，如 "3-5 年"
  edu: string // 学历要求，如 "本科及以上"
  salary: string // 薪资范围，如 "25k-35k · 14薪"
  skills: string[] // 核心考核技能标签
  summary: string // 岗位定位
  responsibilities: string[] // 核心职责条目
  requirements: string[] // 硬性任职标准（AI定制出题与初筛对标依据）
  updatedAt: string
}

export type Position = {
  id: string
  code: string // 编制编号，如 "POS-2026-001"
  name: string // 在招编制名称，如 "大前端团队 · 高级前端工程师"
  jdId: string // 关联的标准 JD ID
  sourcePositionId?: string // 对应来源数据库 / BPM 中的岗位唯一识别码
  dept: string // 招聘业务部门
  recruiter: string // 负责 HR
  hiringManager: string // 用人主管 / 面试官
  hc: number // 招聘总编制 (HC)
  hired: number // 已录用人数
  status: '招募中' | '已暂停' | '已归档'
  createdAt: string
}

export const jds: JD[] = [
  {
    id: 'jd-fe',
    code: 'JD-FE-201',
    title: '高级前端开发工程师',
    dept: '技术部 · 商业化研发组',
    exp: '3-5 年',
    edu: '本科及以上',
    salary: '25k-38k · 14薪',
    skills: ['React / TypeScript', '前端工程化', '性能优化', '组件库设计', 'Node.js'],
    summary: '负责中后台高复杂度系统与协同工具的架构设计、性能调优和基础工程化建设。',
    responsibilities: [
      '主导核心业务系统前端架构治理与性能深度优化（LCP / 交互流畅度）。',
      '沉淀高质量跨业务通用前端组件库与脚手架工具链。',
      '推动团队由传统构建向现代工具链（Vite / Rollup / Rust tooling）演进。',
    ],
    requirements: [
      '3 年以上大型前端项目核心研发经验，精通 React 18+ 及其底层并发机制。',
      '有清晰量化的性能调优战果（具备 RUM 监控与真实指标治理实践）。',
      '深谙前端工程化体系，能够解决复杂的包依赖、CI/CD 与构建兼容性痛点。',
      '具备优秀的跨团队协同沟通能力与技术抽象思维。',
    ],
    updatedAt: '2026-09-28',
  },
  {
    id: 'jd-be',
    code: 'JD-BE-102',
    title: '资深后端开发工程师 / Go 架构师',
    dept: '技术部 · 交易履约组',
    exp: '5-8 年',
    edu: '本科及以上',
    salary: '30k-45k · 15薪',
    skills: ['Go', 'MySQL / Redis', '高并发微服务', '分布式事务', '高可用治理'],
    summary: '负责高并发订单、库存与交易清结算链路的架构设计与极端容量治理。',
    responsibilities: [
      '主导交易核心服务的高并发设计，保障线上集群 99.99% 的可用性。',
      '设计强一致性或最终一致性的分布式事务与资金/库存对账方案。',
      '参与线上复杂故障复盘、混沌工程压测与容量规划。',
    ],
    requirements: [
      '精通 Go / Java 语言及其高并发网络并发模型，深入理解底层内存与锁机制。',
      '熟悉 MySQL 事务与索引调优、Redis 缓存穿透/雪崩防护及 MQ 消息一致性。',
      '有主导千万级日流水交易系统或对账系统重构经验者优先。',
      '具备强烈的业务安全与资损防范意识。',
    ],
    updatedAt: '2026-09-25',
  },
  {
    id: 'jd-pm',
    code: 'JD-PM-301',
    title: '商业化高级产品经理',
    dept: '产品中心 · 商业化产品部',
    exp: '4-7 年',
    edu: '本科及以上',
    salary: '22k-35k · 14薪',
    skills: ['B 端产品设计', '商业化变现', '数据指标驱动', '需求拆解', '跨部门推动'],
    summary: '负责企业服务商业化计费、SaaS 会员体系与增值产品线的全生命周期规划。',
    responsibilities: [
      '深入行业客户业务流程，制定具有市场竞争力的商业化付费方案与定价策略。',
      '负责需求全流程把控，推进产研敏捷迭代并建立精细化数据监测看板。',
      '与销售、运营和客成功团队紧密配合，提升产品续约率与客单价。',
    ],
    requirements: [
      '4 年以上 B 端或 SaaS 商业化产品经验，有从 0 到 1 打造付费业务的成功案例。',
      '具备严密的数据分析意识与 A/B 实验方法论，能归因关键转化漏斗。',
      '极强的跨部门推动与沟通协调能力，能承受快节奏业务挑战。',
    ],
    updatedAt: '2026-09-20',
  },
]

export const positions: Position[] = [
  {
    id: 'pos-fe-1',
    code: 'POS-2026-001',
    name: '商业化大前端研发组 · 高级前端工程师',
    jdId: 'jd-fe',
    sourcePositionId: 'SRC-FE-901',
    dept: '技术部',
    recruiter: '林婉 (HRG)',
    hiringManager: '张工 (前端TL)',
    hc: 2,
    hired: 1,
    status: '招募中',
    createdAt: '2026-09-15',
  },
  {
    id: 'pos-be-1',
    code: 'POS-2026-002',
    name: '交易系统与履约中心 · 资深后端工程师',
    jdId: 'jd-be',
    sourcePositionId: 'SRC-BE-902',
    dept: '技术部',
    recruiter: '赵静 (HR)',
    hiringManager: '李工 (架构组)',
    hc: 3,
    hired: 1,
    status: '招募中',
    createdAt: '2026-09-12',
  },
  {
    id: 'pos-pm-1',
    code: 'POS-2026-003',
    name: '商业化产品部 · 核心商业化产品经理',
    jdId: 'jd-pm',
    sourcePositionId: 'SRC-PM-903',
    dept: '产品中心',
    recruiter: '林婉 (HRG)',
    hiringManager: '王总 (产品总监)',
    hc: 1,
    hired: 1,
    status: '招募中',
    createdAt: '2026-09-10',
  },
]

export const JD_TEMPLATES: Omit<JD, 'id' | 'code' | 'updatedAt'>[] = [
  {
    title: '全栈开发工程师（AI 原生业务）',
    dept: 'AI 创新实验室',
    exp: '3-5 年',
    edu: '本科及以上',
    salary: '28k-45k · 15薪',
    skills: ['TypeScript', 'Next.js', 'Python / FastAPI', 'LLM Agent', '向量数据库'],
    summary: '负责前沿 AI 协同工作台、多模态智能体应用的全栈研发与端到端交付。',
    responsibilities: [
      '端到端负责 AI Native 创新产品的 Web 界面、实时协同交互与后台推理链路。',
      '设计基于 RAG 与 Agent 的智能工作流管线，打通模型调用、记忆与工具库。',
      '追求极致的用户响应体验与流式首包输出性能。',
    ],
    requirements: [
      '扎实的全栈研发基本功，精通现代 TypeScript 生态并熟悉 Python 后端框架。',
      '有实际的 LangChain / LlamaIndex 或大模型应用落地经验。',
      '极强的自我驱动力与探索欲，善于利用前沿技术解决业务痛点。',
    ],
  },
  {
    title: 'AI 算法工程师（大模型与多模态）',
    dept: 'AI Lab',
    exp: '2-5 年',
    edu: '硕士及以上',
    salary: '35k-55k · 16薪',
    skills: ['PyTorch', '大模型微调', 'RAG 检索增强', '模型评测', '分布式训练'],
    summary: '负责垂直领域大模型的高效微调、Prompt 工程化与高质量问答评测体系建设。',
    responsibilities: [
      '负责企业级私有知识库的语义分块、混合检索与重排算法优化。',
      '构建自动化标注与端到端评测流水线，量化产出高质量的问答准确率。',
      '探索小参数模型（7B/14B）在垂直硬件环境下的轻量化推理与量化部署。',
    ],
    requirements: [
      '计算机或人工智能相关专业硕士及以上学历，在 NLP 或 CV 领域有扎实功底。',
      '熟练掌握 PyTorch 及主流大模型微调框架（LoRA / SFT / DPO）。',
      '严谨的科研工程习惯，对数据质量与评测准则有极高要求。',
    ],
  },
]

// 沟通记录
export type NoteItem = {
  id: string
  time: string
  author: string
  content: string
}

// 面试排期与通知状态
// PRD FR-B1/B2：一次面试 = 一场「场次」，必须带面试官、时长、方式，并保留改期/取消历史
export type ScheduleEvent = {
  at: string // 发生时间 YYYY-MM-DD HH:mm
  by: string // 操作人
  action: 'created' | 'rescheduled' | 'canceled' | 'notice_resent' | 'notice_failed'
  from?: string // 变更前（改期用）
  to?: string // 变更后（改期用）
  reason?: string
}

export type ScheduleDetail = {
  interviewId: string // 场次编号，如 IV-2026-0007
  idempotencyKey: string // 幂等键：同一候选人+岗位+轮次+时段只允许一场
  slot: string
  round: string
  type: 'online' | 'offline'
  interviewer: string // 面试官
  durationMin: number // 面试时长（分钟）
  status: 'scheduled' | 'canceled' // 场次状态；取消后保留记录不回退
  feishuCalendarStatus: 'synced' | 'pending' | 'failed'
  feishuMeetingUrl?: string
  noticeChannel: 'sms' | 'email'
  noticeStatus: 'sent' | 'pending' | 'failed' | 'confirmed'
  noticeAttempts: number // 已尝试发送次数，用于「重试」展示
  failureReason?: string
  history: ScheduleEvent[] // 改期/取消/重发全部追加在这里，不覆盖旧值
}

// 候选人模型全面升级
export type Candidate = {
  id: string
  name: string
  role: string
  exp: string
  edu: string
  match: number
  status: CandidateStage
  slot: string
  round: string
  source: Channel
  sourceId: string // 来源库唯一标识 (幂等键)
  attachmentType: 'original' | 'platform' | 'missing' // 候选人原件 / 平台模板 / 附件缺失
  positionId: string
  jdId: string
  assignee: string // 负责 HR
  summary: string
  skills: { k: string; v: number }[]
  highlights: string[]
  risks: string[]
  aiScreening: {
    recommended: boolean
    reasons: string[]
    risks: string[]
    looseMatch: string
  }
  notes: NoteItem[]
  scheduleDetail?: ScheduleDetail
  approvalId?: string // 关联的录取申请单号
  sourceUpdatedAt?: string // 来源库最后更新时间（PRD：工作台应如实展示数据更新时间）
  nextAction?: { text: string; owner: string; dueAt: string } // 下一步动作 + 责任人 + 期限（FR-A4）
  stageHistory?: { stage: CandidateStage; at: string; by: string; reason?: string }[] // 阶段流转历史，追加不覆盖
  qs: {
    id: string
    topic: string
    diff?: string
    basis?: string
    q: string
    points: string[]
    answer?: string
    follow?: string[]
    flag?: string
  }[]
}

// 录取申请单模型（PRD 模块 C：飞书审批 + BPM OA 双审批）
export type ApprovalApplication = {
  id: string // 申请单号，如 APP-2026-1001
  candidateId: string
  candidateName: string
  positionId: string
  positionName: string
  applicant: string // 发起 HR
  applyDate: string
  salary: string // 拟定薪资
  level: string // 拟定职级
  dept: string
  onboardDate: string
  materials: MaterialItem[] // 申请材料清单：逐项核对，缺失可补传（FR-C1）
  feishu: ApprovalTrack
  bpm: ApprovalTrack
  // 聚合结论：partial = 仅一侧通过（PRD 明确不得当作整体通过）
  finalStatus: 'processing' | 'approved' | 'rejected' | 'partial' | 'returned' | 'canceled'
  idempotencyKey: string // 幂等键：同一候选人 + 岗位只允许一张在途申请单
}

// 申请材料逐项核对
export type MaterialItem = {
  key: string
  name: string
  required: boolean
  status: 'done' | 'pending' | 'missing'
  fileRef?: string
}

// 单条审批轨（飞书审批 / BPM 各自独立实例）
export type ApprovalTrackStatus = 'pending' | 'approved' | 'rejected' | 'returned' | 'canceled'
export type ApprovalHistoryItem = {
  at: string
  status: ApprovalTrackStatus
  node: string
  by: string
  comment?: string
}
export type ApprovalTrack = {
  instanceId?: string // 飞书审批实例号
  processId?: string // BPM 流程号
  status: ApprovalTrackStatus
  currentNode: string
  updateTime: string
  approver: string
  history: ApprovalHistoryItem[] // 状态流转历史，追加不覆盖
  retryCount: number // 失败重试次数（沿用原实例，不重复发起）
  lastError?: string // 同步失败原因；有值即在 UI 上显示「可重试」
}

export const initialApprovals: ApprovalApplication[] = [
  // ① 正常态：飞书与 BPM 双通过，整体录用
  {
    id: 'APP-2026-1001',
    candidateId: 'c5',
    candidateName: '苏晴',
    positionId: 'pos-pm-1',
    positionName: '商业化产品部 · 核心商业化产品经理',
    applicant: '林婉 (HRG)',
    applyDate: '2026-09-28',
    salary: '32k · 14薪 + 期权',
    level: 'P7 专家',
    dept: '产品中心',
    onboardDate: '2026-10-15',
    idempotencyKey: 'APPR-2026-1001-C5-POSPM1',
    materials: [
      { key: 'final-review', name: '终面综合面评报告 (4.5 分 · 极力推荐)', required: true, status: 'done', fileRef: 'minio://facetry/materials/c5/final-review.pdf' },
      { key: 'diploma', name: '学历与学位认证材料 (南京大学 · 硕士)', required: true, status: 'done', fileRef: 'minio://facetry/materials/c5/diploma.pdf' },
      { key: 'salary-proof', name: '近 6 个月薪资银行流水证明', required: true, status: 'done', fileRef: 'minio://facetry/materials/c5/salary-proof.pdf' },
      { key: 'background-check', name: '背景调查授权书', required: false, status: 'pending' },
    ],
    feishu: {
      instanceId: 'FS-APP-8840291',
      status: 'approved',
      currentNode: '已归档',
      updateTime: '2026-09-30 11:20',
      approver: '张丽 (HRVP)',
      retryCount: 0,
      history: [
        { at: '2026-09-28 09:30', status: 'pending', node: '发起申请', by: '林婉 (HRG)', comment: '业务确认录用意向后显式提交。' },
        { at: '2026-09-29 14:10', status: 'pending', node: '用人部门总监审批', by: '王总 (产品总监)', comment: '业务侧同意，薪资方案符合编制预算。' },
        { at: '2026-09-30 11:20', status: 'approved', node: 'HRVP 审批', by: '张丽 (HRVP)', comment: '同意录用，按 P7 专家定级。' },
      ],
    },
    bpm: {
      processId: 'BPM-HIRE-202609-082',
      status: 'approved',
      currentNode: '已办结',
      updateTime: '2026-09-30 15:40',
      approver: '陈宏 (事业部总裁)',
      retryCount: 0,
      history: [
        { at: '2026-09-28 09:32', status: 'pending', node: '流程发起', by: '林婉 (HRG)' },
        { at: '2026-09-29 16:05', status: 'pending', node: '人力薪酬组定级复核', by: '薪酬绩效组', comment: '定级与薪酬均在区间内。' },
        { at: '2026-09-30 15:40', status: 'approved', node: '用人部门总裁签字', by: '陈宏 (事业部总裁)', comment: '同意录用，可发放 Offer。' },
      ],
    },
    finalStatus: 'approved',
  },
  // ② 处理中：两套系统都还在流转；BPM 出现一次状态同步失败但已重试（未重复发起流程）
  {
    id: 'APP-2026-1002',
    candidateId: 'c4',
    candidateName: '孟凡',
    positionId: 'pos-be-1',
    positionName: '交易系统与履约中心 · 资深后端工程师',
    applicant: '赵静 (HR)',
    applyDate: '2026-09-30',
    salary: '38k · 15薪',
    level: 'P7 资深研发',
    dept: '技术部',
    onboardDate: '2026-10-26',
    idempotencyKey: 'APPR-2026-1002-C4-POSBE1',
    materials: [
      { key: 'tech-review', name: '一面 / 二面技术评审表 (均分 3.8)', required: true, status: 'done', fileRef: 'minio://facetry/materials/c4/tech-review.pdf' },
      { key: 'diploma', name: '华中科技大学计算机学位验证', required: true, status: 'done', fileRef: 'minio://facetry/materials/c4/diploma.pdf' },
      { key: 'background-check', name: '背景调查授权书', required: true, status: 'pending' },
      { key: 'resign-proof', name: '原单位离职证明', required: true, status: 'missing' },
    ],
    feishu: {
      instanceId: 'FS-APP-8849910',
      status: 'pending',
      currentNode: '用人部门总监审批',
      updateTime: '2026-10-01 09:15',
      approver: '李工 (架构组主管)',
      retryCount: 0,
      history: [
        { at: '2026-09-30 16:40', status: 'pending', node: '发起申请', by: '赵静 (HR)', comment: '业务终面通过后提交。' },
        { at: '2026-10-01 09:15', status: 'pending', node: '用人部门总监审批', by: '李工 (架构组主管)', comment: '待确认薪酬特批额度。' },
      ],
    },
    bpm: {
      processId: 'BPM-HIRE-202610-003',
      status: 'pending',
      currentNode: '人力资源薪酬组定级复核',
      updateTime: '2026-10-01 10:00',
      approver: '薪酬绩效组',
      retryCount: 2,
      lastError: '状态查询接口超时（5s），沿用原流程号重试，未重复发起',
      history: [
        { at: '2026-09-30 16:45', status: 'pending', node: '流程发起', by: '赵静 (HR)' },
        { at: '2026-10-01 09:40', status: 'pending', node: '人力资源薪酬组定级复核', by: '薪酬绩效组', comment: '薪资高出预算 10%，需走特批。' },
        { at: '2026-10-01 10:00', status: 'pending', node: '状态同步重试', by: '系统同步任务', comment: '接口超时，按幂等键重试后恢复流转。' },
      ],
    },
    finalStatus: 'processing',
  },
  // ③ 单边通过：飞书已通过、BPM 仍在处理中；按 PRD 不得判为整体录用
  {
    id: 'APP-2026-1003',
    candidateId: 'c10',
    candidateName: '邓子睿',
    positionId: 'pos-be-1',
    positionName: '交易系统与履约中心 · 资深后端工程师',
    applicant: '赵静 (HR)',
    applyDate: '2026-09-29',
    salary: '36k · 15薪',
    level: 'P6+ 高级研发',
    dept: '技术部',
    onboardDate: '2026-10-27',
    idempotencyKey: 'APPR-2026-1003-C10-POSBE1',
    materials: [
      { key: 'final-review', name: '终面综合面评报告 (4.2 分 · 推荐)', required: true, status: 'done', fileRef: 'minio://facetry/materials/c10/final-review.pdf' },
      { key: 'diploma', name: '学历学位认证材料', required: true, status: 'done', fileRef: 'minio://facetry/materials/c10/diploma.pdf' },
      { key: 'salary-proof', name: '近 6 个月薪资流水', required: true, status: 'pending' },
      { key: 'hc-approval', name: '超编 HC 使用说明', required: false, status: 'missing' },
    ],
    feishu: {
      instanceId: 'FS-APP-8853120',
      status: 'approved',
      currentNode: '已归档',
      updateTime: '2026-09-30 17:05',
      approver: '张丽 (HRVP)',
      retryCount: 1,
      lastError: '首次发起时控件映射缺字段，已补全后沿用同一实例重提（未新建实例）',
      history: [
        { at: '2026-09-29 10:20', status: 'pending', node: '发起申请', by: '赵静 (HR)' },
        { at: '2026-09-30 10:50', status: 'pending', node: '用人部门总监审批', by: '李工 (架构组主管)', comment: '技术评价达标，同意录用。' },
        { at: '2026-09-30 17:05', status: 'approved', node: 'HRVP 审批', by: '张丽 (HRVP)', comment: '同意，等待 BPM 内部流程结论。' },
      ],
    },
    bpm: {
      processId: 'BPM-HIRE-202610-011',
      status: 'pending',
      currentNode: '财务预算复核',
      updateTime: '2026-10-01 08:50',
      approver: '预算管理组',
      retryCount: 0,
      history: [
        { at: '2026-09-29 10:25', status: 'pending', node: '流程发起', by: '赵静 (HR)' },
        { at: '2026-10-01 08:50', status: 'pending', node: '财务预算复核', by: '预算管理组', comment: '需确认第四季度人力预算余量。' },
      ],
    },
    finalStatus: 'partial',
  },
  // ④ 负向态：飞书审批退回并留意见，BPM 流程同步撤销；候选人转为搁置
  {
    id: 'APP-2026-1004',
    candidateId: 'c9',
    candidateName: '唐薇',
    positionId: 'pos-pm-1',
    positionName: '商业化产品部 · 核心商业化产品经理',
    applicant: '林婉 (HRG)',
    applyDate: '2026-09-24',
    salary: '38k · 14薪',
    level: 'P7 专家',
    dept: '产品中心',
    onboardDate: '2026-10-20',
    idempotencyKey: 'APPR-2026-1004-C9-POSPM1',
    materials: [
      { key: 'final-review', name: '终面综合面评报告 (4.3 分 · 推荐)', required: true, status: 'done', fileRef: 'minio://facetry/materials/c9/final-review.pdf' },
      { key: 'salary-proof', name: '近 6 个月薪资流水', required: true, status: 'done', fileRef: 'minio://facetry/materials/c9/salary-proof.pdf' },
      { key: 'salary-explain', name: '薪酬超预算说明与对标依据', required: true, status: 'missing' },
      { key: 'diploma', name: '学历学位认证材料', required: true, status: 'done', fileRef: 'minio://facetry/materials/c9/diploma.pdf' },
    ],
    feishu: {
      instanceId: 'FS-APP-8847665',
      status: 'returned',
      currentNode: '退回发起人（薪酬超预算）',
      updateTime: '2026-09-26 15:30',
      approver: '张丽 (HRVP)',
      retryCount: 0,
      history: [
        { at: '2026-09-24 11:00', status: 'pending', node: '发起申请', by: '林婉 (HRG)' },
        { at: '2026-09-25 09:40', status: 'pending', node: '用人部门总监审批', by: '王总 (产品总监)', comment: '业务认可人选，薪酬偏高。' },
        { at: '2026-09-26 15:30', status: 'returned', node: 'HRVP 审批', by: '张丽 (HRVP)', comment: '薪资超该职级预算 12%，且缺少薪酬对标说明，退回补充材料后重走。' },
      ],
    },
    bpm: {
      processId: 'BPM-HIRE-202609-071',
      status: 'returned',
      currentNode: '退回发起人（定级与预算不符）',
      updateTime: '2026-09-26 16:10',
      approver: '薪酬绩效组',
      retryCount: 0,
      history: [
        { at: '2026-09-24 11:05', status: 'pending', node: '流程发起', by: '林婉 (HRG)' },
        { at: '2026-09-25 14:20', status: 'pending', node: '人力薪酬组定级复核', by: '薪酬绩效组', comment: '建议下调至 P6+ 后再议。' },
        { at: '2026-09-26 16:10', status: 'returned', node: '退回发起人', by: '薪酬绩效组', comment: '飞书审批已退回，BPM 同步退回发起人不再继续流转；候选人转为搁置。' },
      ],
    },
    finalStatus: 'returned',
  },
]

export const candidates: Candidate[] = [
  {
    id: 'c1',
    name: '林晓',
    role: '前端工程师（高级）',
    exp: '5 年',
    edu: '浙江大学 · 计算机',
    match: 82,
    status: '约面中',
    slot: '2026-10-01 14:30',
    round: '二面',
    source: '内推',
    sourceId: 'SRC-INT-001',
    attachmentType: 'original',
    positionId: 'pos-fe-1',
    jdId: 'jd-fe',
    assignee: '林婉 (HRG)',
    summary: '5 年电商中后台经验，主导过 Webpack 到 Vite 迁移和首屏性能优化，React 与工程化经验扎实；缺少大型可视化与跨端经验。',
    skills: [{ k: 'React / TypeScript', v: 90 }, { k: '性能优化', v: 85 }, { k: '工程化', v: 80 }, { k: '可视化 / 图形', v: 45 }, { k: '团队管理', v: 60 }],
    highlights: ['LCP 由 4.2s 降至 1.8s，有可量化成果', '主导构建工具迁移，构建耗时降低 68%', '沉淀内部组件库，覆盖 12 个业务线'],
    risks: ['简历中"精通 Node.js"缺少对应项目佐证', '近一年无开源或技术分享记录', '2022 年有 4 个月空档期，简历未说明'],
    aiScreening: {
      recommended: true,
      reasons: ['名校对口专业，履历稳定性良好', '核心技能完全命中 JD 硬性要求（React 18、工程化调优）'],
      risks: ['Node.js 服务端项目证据稍显单薄'],
      looseMatch: '符合度 82% · 建议直接安排技术二面',
    },
    notes: [
      { id: 'n-1', time: '2026-09-28 10:30', author: '林婉 (HRG)', content: '一面综合表现良好，代码架构规范，沟通顺畅，约下周二面。' },
      { id: 'n-2', time: '2026-09-29 16:00', author: '张工 (前端TL)', content: '确认约二面，重点考察线上高并发故障排查与组件封装抽象能力。' },
    ],
    // 来源库最后更新时间（PRD：工作台如实展示数据更新时间）
    sourceUpdatedAt: '2026-09-25 09:20',
    // 下一步动作与责任人（FR-A4）
    nextAction: { text: '今天 17:00 前电话确认二面意向，并核对飞书会议链接', owner: '林婉 (HRG)', dueAt: '2026-10-01 17:00' },
    // 阶段流转历史，追加不覆盖
    stageHistory: [
      { stage: '新入库', at: '2026-09-25 09:20', by: '系统同步', reason: '内推记录从来源库落库' },
      { stage: '筛选中', at: '2026-09-26 10:05', by: '林婉 (HRG)', reason: 'AI 宽松匹配 82%，人工复核通过' },
      { stage: '约面中', at: '2026-09-28 17:10', by: '林婉 (HRG)', reason: '一面通过，发起二面邀约' },
    ],
    scheduleDetail: {
      interviewId: 'IV-2026-0007',
      idempotencyKey: 'SCH-C1-POSFE1-R2-202610011430',
      slot: '2026-10-01 14:30',
      round: '二面',
      type: 'online',
      interviewer: '张工 (前端TL)',
      durationMin: 60,
      status: 'scheduled',
      feishuCalendarStatus: 'synced',
      feishuMeetingUrl: 'https://vc.feishu.cn/j/883920193',
      noticeChannel: 'sms',
      noticeStatus: 'confirmed',
      noticeAttempts: 2,
      history: [
        { at: '2026-09-28 17:10', by: '林婉 (HRG)', action: 'created', to: '2026-09-30 14:30', reason: '一面通过后创建二面邀约' },
        { at: '2026-09-29 09:40', by: '林婉 (HRG)', action: 'rescheduled', from: '2026-09-30 14:30', to: '2026-10-01 14:30', reason: '面试官当天出差，改到次日同一时段' },
        { at: '2026-09-29 09:45', by: '系统通知', action: 'notice_resent', reason: '改期后重发短信并同步飞书日程' },
      ],
    },
    qs: [
      { id: 'q1', topic: '性能优化', diff: '中等', basis: '简历：首屏 LCP 4.2s → 1.8s', q: '你在简历中提到把 LCP 从 4.2 秒降到 1.8 秒，请拆解一下具体做了哪些事，哪一项收益最大？', points: ['是否有测量意识（RUM / Lighthouse）', '能否区分网络、渲染、脚本三类瓶颈', '是否考虑上线后的回退监控'], answer: '期望候选人先说明基线与测量方式，再按收益排序：路由级拆包与关键资源预加载通常收益最大，其次是图片格式与懒加载、关键 CSS 内联。最后应提到用性能预算和线上监控防止回退。', follow: ['如果 LCP 元素是接口驱动的图片，你怎么优化？', '如何证明这次优化对业务指标有帮助？'], flag: '只罗列手段、说不出具体数据或收益排序' },
      { id: 'q2', topic: 'React 原理', diff: '较难', basis: '技能：React 18', q: 'React 18 的并发渲染解决了什么问题？useTransition 与 useDeferredValue 分别适合什么场景？', points: ['理解时间切片与可中断渲染', '区分紧急更新与过渡更新', '有真实使用案例'], answer: '并发渲染让渲染可被打断，避免长任务阻塞输入。useTransition 用于包裹会引起大量渲染的状态更新（如筛选大列表）；useDeferredValue 用于延迟派生值，适合无法控制更新源的场景。', follow: ['并发模式下 effect 会被执行两次吗？为什么？', 'Suspense 与 transition 如何配合避免闪烁的 loading？'], flag: '把并发渲染等同于多线程' },
      { id: 'q3', topic: '工程化', diff: '中等', basis: '简历：Webpack → Vite 迁移', q: '迁移到 Vite 的过程中遇到过哪些兼容问题？生产构建与开发环境不一致时怎么排查？', points: ['了解 esbuild 与 Rollup 的分工', '处理 CommonJS 依赖与别名', '有渐进式迁移思路'], answer: '常见问题包括 CJS 依赖预构建、环境变量前缀、动态 require 与 SVG 处理。开发用 esbuild、生产用 Rollup，行为差异需要通过 preview 与 CI 构建对比排查。迁移应先在小应用试点再推广。', follow: ['如何度量迁移收益？', '微前端场景下 Vite 需要注意什么？'], flag: '只说"更快"，无具体问题与解决办法' },
      { id: 'q4', topic: '问题定位', diff: '中等', basis: '场景题', q: '一个大型表单页面输入时明显卡顿，你会怎么定位和优化？', points: ['先测量再优化', '能区分渲染次数与单次渲染成本', '给出分层方案'], answer: '先用 React Profiler 与 Performance 面板确认瓶颈；常见根因是状态提升过高导致整棵树重渲染。方案：拆分受控组件、状态下沉、字段级订阅（如 react-hook-form）、虚拟化长列表，必要时用 transition 降低输入优先级损耗。', follow: ['memo 什么时候反而会变慢？'], flag: '一上来就说 useMemo 全加上' },
      { id: 'q5', topic: '简历核实', diff: '中等', basis: '风险：Node.js 佐证不足', q: '简历写到熟悉 Node.js，请介绍一个你用 Node 做过的服务，以及你怎么处理它的错误与日志。', points: ['是否真实做过', '错误边界与进程管理', '可观测性意识'], answer: '期望候选人给出具体项目（BFF、脚本、SSR 均可），说明框架选型、错误统一处理、日志分级与链路追踪。若只是写过构建脚本，应如实说明，评估时按"了解"而非"熟练"。', follow: ['未捕获异常发生时进程应该怎么处理？'], flag: '回答泛泛，无法描述任何具体细节' },
      { id: 'q6', topic: '协作与软技能', diff: '基础', basis: '行为面试', q: '讲一次你与产品或后端意见不一致的经历，最后怎么达成一致的？', points: ['STAR 结构', '以数据或原型说服', '有复盘与流程改进'], answer: '优秀回答会明确情境与分歧点，说明自己如何收集数据或做小原型，最终达成折中，并推动了流程改进（如接口评审前置）。', follow: ['如果最后对方仍不同意呢？'], flag: '全程归咎他人' },
    ],
  },
  {
    id: 'c2',
    name: '陈嘉豪',
    role: '后端工程师（中级）',
    exp: '3 年',
    edu: '华南理工 · 软件工程',
    match: 71,
    status: '面评中',
    slot: '2026-10-01 10:00',
    round: '一面',
    source: 'BOSS直聘',
    sourceId: 'SRC-BOSS-8821',
    attachmentType: 'original',
    positionId: 'pos-be-1',
    jdId: 'jd-be',
    assignee: '赵静 (HR)',
    summary: '3 年 Go 后端经验，做过订单与库存服务，缓存与消息队列使用熟练；分布式事务与高并发压测经验偏浅。',
    skills: [{ k: 'Go', v: 82 }, { k: 'MySQL', v: 75 }, { k: 'Redis', v: 80 }, { k: '分布式', v: 55 }, { k: '系统设计', v: 58 }],
    highlights: ['订单服务 QPS 提升至 3k', '独立设计库存扣减方案', '有线上故障复盘文档'],
    risks: ['分布式事务描述停留在名词层面', '未提及压测与容量评估'],
    aiScreening: {
      recommended: true,
      reasons: ['技术栈与交易岗位极契合 (Go + MySQL/Redis)', '有真实微服务高并发重构实践'],
      risks: ['分布式事务底层落地深度需面试考核'],
      looseMatch: '符合度 71% · 建议重点深挖高并发库存',
    },
    notes: [{ id: 'n-3', time: '2026-09-30 18:20', author: '赵静 (HR)', content: '一面改为现场面试，已发邮件通知候选人，会议室已预约；候选人尚未回复确认邮件。' }],
    sourceUpdatedAt: '2026-09-26 14:05',
    nextAction: { text: '今天 17:00 前电话确认到场信息，面试结束后补全综合面评', owner: '赵静 (HR)', dueAt: '2026-10-01 17:00' },
    stageHistory: [
      { stage: '新入库', at: '2026-09-26 14:05', by: '系统同步', reason: 'BOSS 直聘主动投递落库' },
      { stage: '面评中', at: '2026-10-01 11:10', by: '赵静 (HR)', reason: '一面结束，等待面试官提交面评' },
    ],
    scheduleDetail: {
      interviewId: 'IV-2026-0004',
      idempotencyKey: 'SCH-C2-POSBE1-R1-202610011000',
      slot: '2026-10-01 10:00',
      round: '一面',
      type: 'offline',
      interviewer: '李工 (架构组主管)',
      durationMin: 45,
      status: 'scheduled',
      feishuCalendarStatus: 'synced',
      noticeChannel: 'email',
      noticeStatus: 'sent',
      noticeAttempts: 2,
      history: [
        { at: '2026-09-29 15:20', by: '赵静 (HR)', action: 'created', to: '2026-10-01 10:00', reason: '确认现场面试时间与会议室' },
        { at: '2026-09-30 18:25', by: '系统通知', action: 'notice_resent', reason: '候选人未回复首次邮件，重发一次邀约' },
      ],
    },
    qs: [
      { id: 'q7', topic: '缓存', diff: '中等', basis: '技能：Redis', q: 'Redis 缓存击穿、穿透、雪崩有什么区别？在你的库存服务里是怎么防护的？', points: ['三者定义准确', '有对应方案', '结合自身项目'], answer: '击穿指单个热点 key 过期瞬间并发打库；穿透指查询不存在的数据；雪崩指大量 key 同时失效。方案分别为互斥锁或逻辑过期、布隆过滤器与空值缓存、过期时间加随机抖动与多级缓存。', follow: ['缓存与数据库双写一致性怎么保证？'], flag: '只背定义，无法结合项目' },
      { id: 'q8', topic: '分布式', diff: '较难', basis: '风险：分布式事务较浅', q: '下单扣库存与生成订单需要最终一致，你会怎么设计？', points: ['了解本地消息表 / TCC / Saga', '幂等与补偿', '权衡一致性与性能'], answer: '可用本地消息表加消息队列实现最终一致：订单与消息同事务落库，异步扣库存并通过幂等键防重，失败则重试或触发补偿取消订单。', follow: ['消息重复消费怎么处理？'], flag: '回答"用分布式事务框架"但说不出原理' },
    ],
  },
  {
    id: 'c3',
    name: '王雨桐',
    role: '产品经理（中级）',
    exp: '4 年',
    edu: '复旦大学 · 信息管理',
    match: 64,
    status: '待联系',
    slot: '待安排',
    round: '一面待约',
    source: '前程无忧',
    sourceId: 'SRC-QC-55019',
    attachmentType: 'platform',
    positionId: 'pos-pm-1',
    jdId: 'jd-pm',
    assignee: '林婉 (HRG)',
    summary: '4 年 B 端产品经验，需求文档规范、协同能力强；数据分析与商业化经验相对薄弱。',
    skills: [{ k: '需求分析', v: 80 }, { k: '数据分析', v: 55 }, { k: '竞品研究', v: 70 }, { k: '商业化', v: 45 }, { k: '沟通协作', v: 85 }],
    highlights: ['主导 CRM 改版，续费率提升 6%', '推动跨部门评审机制'],
    risks: ['指标提升缺少归因说明', '未涉及 A/B 实验'],
    aiScreening: {
      recommended: false,
      reasons: ['教育背景优异，文档基本功扎实'],
      risks: ['商业化变现与核心计费模块经历较少'],
      looseMatch: '符合度 64% · 建议先由 HR 电话初沟通意向',
    },
    notes: [{ id: 'n-4', time: '2026-09-29 11:00', author: '林婉 (HRG)', content: '初步沟通意向薪资在 25k 左右，等待业务主管确认是否约面。' }],
    sourceUpdatedAt: '2026-09-27 09:15',
    nextAction: { text: '今天 16:00 前第二次电话跟进，确认是否接受商业化方向岗位', owner: '林婉 (HRG)', dueAt: '2026-10-01 16:00' },
    stageHistory: [
      { stage: '新入库', at: '2026-09-27 09:15', by: '系统同步', reason: '前程无忧简历落库（平台模板文件）' },
      { stage: '筛选中', at: '2026-09-28 14:20', by: '林婉 (HRG)', reason: 'AI 未推荐，人工查看后保留' },
      { stage: '待联系', at: '2026-09-29 11:00', by: '林婉 (HRG)', reason: '待业务主管确认是否推进，先保持联系阶段' },
    ],
    qs: [
      { id: 'q9', topic: '数据分析', diff: '中等', basis: '案例题', q: '如果产品 DAU 突然下降 20%，你会怎么分析？', points: ['先确认数据口径', '按维度拆解', '给出验证与行动'], answer: '先排除埋点与统计口径问题，再按渠道、版本、地区、新老用户拆分定位，结合近期发版与外部事件提出假设，最后用小流量验证并制定恢复方案。', follow: ['如何判断是季节性还是异常？'], flag: '直接给出结论，没有拆解过程' },
    ],
  },
  {
    id: 'c4',
    name: '孟凡',
    role: '后端工程师（高级）',
    exp: '6 年',
    edu: '华中科技大学 · 计算机',
    match: 76,
    status: '待录取',
    slot: '2026-09-29 14:00',
    round: '终面通过',
    source: '猎头',
    sourceId: 'SRC-LT-9092',
    attachmentType: 'original',
    positionId: 'pos-be-1',
    jdId: 'jd-be',
    assignee: '赵静 (HR)',
    summary: '6 年 Java / Go 混合栈，做过交易风控系统，一面评分 3.8，终面评价极佳，业务部门已确定录用，待发起飞书与 BPM 审批。',
    skills: [{ k: 'Java / Go', v: 84 }, { k: '系统设计', v: 80 }, { k: '风控领域', v: 78 }, { k: '跨团队推动', v: 58 }, { k: '稳定性', v: 74 }],
    highlights: ['一面系统设计题 4 分，证据充分', '风控规则引擎落地经验完整'],
    risks: ['期望薪资高出编制预算 10%，需审批特批'],
    aiScreening: {
      recommended: true,
      reasons: ['技术底子极其扎实，带过风控引擎架构'],
      risks: ['薪酬特批需走两套流程'],
      looseMatch: '符合度 76% · 推荐录用',
    },
    notes: [
      { id: 'n-5', time: '2026-09-30 17:00', author: '李工 (架构组主管)', content: '业务终面通过，同意录用，请 HR 尽快发起飞书与 BPM 审批申请。' },
    ],
    sourceUpdatedAt: '2026-09-24 08:40',
    nextAction: { text: '今天 15:00 前跟进飞书审批节点，并补齐离职证明后再提交材料', owner: '赵静 (HR)', dueAt: '2026-10-01 15:00' },
    stageHistory: [
      { stage: '新入库', at: '2026-09-24 08:40', by: '系统同步', reason: '猎头推荐记录落库' },
      { stage: '约面中', at: '2026-09-26 10:30', by: '赵静 (HR)', reason: '简历与技术栈匹配，安排一面' },
      { stage: '面评中', at: '2026-09-29 15:20', by: '李工 (架构组主管)', reason: '一面 4 分，进入业务终面' },
      { stage: '待录取', at: '2026-09-30 17:00', by: '李工 (架构组主管)', reason: '业务终面通过，确认录用意向，等待双审批结论' },
    ],
    approvalId: 'APP-2026-1002',
    qs: [
      { id: 'q10', topic: '系统设计', diff: '较难', basis: '简历：风控规则引擎', q: '风控规则引擎的规则热更新是怎么做的？规则出错时怎么回滚？', points: ['规则版本化与灰度', '热更新不中断决策链路', '有回滚与审计'], answer: '期望候选人讲清规则版本化、灰度生效、决策链路无中断切换，以及出错时的版本回退与审计日志。', follow: ['规则之间冲突怎么检测？'], flag: '只讲规则配置界面，不讲运行时机制' },
      { id: 'q11', topic: '协作与软技能', diff: '中等', basis: '一面遗留：跨团队推动', q: '讲一次你推动其他团队配合你落地的经历，对方不配合时你怎么做？', points: ['有具体推动路径', '能处理利益冲突', '结果可验证'], answer: '关注推动路径是否具体（数据、评审、上升机制），以及最终结果是否落地。', follow: ['如果对方排期一直让不出来呢？'], flag: '把推动等同于发邮件拉群' },
    ],
  },
  {
    id: 'c5',
    name: '苏晴',
    role: '产品经理（高级）',
    exp: '7 年',
    edu: '南京大学 · 信息管理',
    match: 88,
    status: '已完成',
    slot: '2026-09-26 10:00',
    round: '录取审批完成',
    source: '内推',
    sourceId: 'SRC-INT-008',
    attachmentType: 'original',
    positionId: 'pos-pm-1',
    jdId: 'jd-pm',
    assignee: '林婉 (HRG)',
    summary: '终面通过，飞书审批与 BPM 内部流程均已双通过，已于 9 月 30 日完成系统录用与发 Offer。',
    skills: [{ k: 'B 端产品', v: 90 }, { k: '商业化', v: 82 }, { k: '数据分析', v: 78 }, { k: '团队管理', v: 70 }],
    highlights: ['三轮面试评价一致为极力推荐', '商业化变现案例证据非常充分'],
    risks: [],
    aiScreening: {
      recommended: true,
      reasons: ['经验丰富，商业化标杆人才，背景完备'],
      risks: [],
      looseMatch: '符合度 88% · 标杆人选',
    },
    notes: [
      { id: 'n-6', time: '2026-09-30 16:00', author: '林婉 (HRG)', content: '飞书审批单与 BPM 流程均已归档通过，已发送正式录用通知书。' },
    ],
    sourceUpdatedAt: '2026-09-22 10:10',
    nextAction: { text: '10 月 15 日入职前完成背调回执与 Offer 签署确认', owner: '林婉 (HRG)', dueAt: '2026-10-14 18:00' },
    stageHistory: [
      { stage: '新入库', at: '2026-09-22 10:10', by: '系统同步', reason: '内推记录落库' },
      { stage: '待录取', at: '2026-09-28 09:30', by: '林婉 (HRG)', reason: '三轮面评一致推荐，业务确认录用' },
      { stage: '已完成', at: '2026-09-30 16:00', by: '林婉 (HRG)', reason: '飞书审批与 BPM 流程双通过并归档，已发放正式 Offer' },
    ],
    approvalId: 'APP-2026-1001',
    qs: [
      { id: 'q12', topic: '商业化', diff: '中等', basis: '终面题', q: '你负责的付费产品线，定价策略是怎么定的？', points: ['有定价方法论', '关注留存与续约', '有调整案例'], answer: '期望候选人讲清成本、价值与竞品三条线的定价权衡，以及上线后的价格实验与续约表现。', follow: ['降价换量的边界在哪里？'], flag: '定价完全凭感觉' },
    ],
  },
  {
    id: 'c6',
    name: '沈一诺',
    role: '前端工程师（中级）',
    exp: '3 年',
    edu: '武汉大学 · 软件工程',
    match: 69,
    status: '筛选中',
    slot: '待安排',
    round: '简历初筛',
    source: '猎聘',
    sourceId: 'SRC-LP-10928',
    attachmentType: 'missing',
    positionId: 'pos-fe-1',
    jdId: 'jd-fe',
    assignee: '林婉 (HRG)',
    summary: '影刀采集落库新数据，3 年小程序与 H5 经验，基础扎实，原件附件缺失（已标记为附件缺失状态）。',
    skills: [{ k: 'Vue / React', v: 72 }, { k: '小程序', v: 80 }, { k: '工程化', v: 55 }, { k: '性能优化', v: 58 }],
    highlights: ['小程序性能优化有量化结果', '有组件库维护经验'],
    risks: ['原始附件缺失，仅有平台文本', 'React 深度待验证'],
    aiScreening: {
      recommended: true,
      reasons: ['武大学历，小程序优化基础扎实'],
      risks: ['附件原件缺失，需联系候选人补交'],
      looseMatch: '符合度 69% · 建议通过初筛并索要原件简历',
    },
    notes: [
      { id: 'n-7', time: '2026-10-01 08:30', author: '系统同步', content: '影刀从猎聘同步落库，检测到简历附件缺失，已自动生成预筛报告（附件缺失不自动回网站补采）。' },
    ],
    sourceUpdatedAt: '2026-10-01 08:30',
    nextAction: { text: '今天 17:00 前联系候选人补交原件简历，再决定是否约面', owner: '林婉 (HRG)', dueAt: '2026-10-01 17:00' },
    stageHistory: [
      { stage: '新入库', at: '2026-10-01 08:30', by: '系统同步', reason: '影刀采集落库，检测到附件缺失' },
      { stage: '筛选中', at: '2026-10-01 08:35', by: '系统同步', reason: 'AI 宽松匹配 69%，待 HR 复核' },
    ],
    qs: [
      { id: 'q13', topic: '基础核实', diff: '基础', basis: '简历：小程序性能优化', q: '小程序首屏优化你具体做了哪些事？setData 的性能问题怎么处理？', points: ['了解 setData 通信成本', '有分包与预加载实践', '能量化收益'], answer: '期望候选人讲清分包加载、setData 数据量与频率控制、预请求与骨架屏，并给出优化前后的数据。', follow: ['小程序与 H5 的渲染差异是什么？'], flag: '只听说过优化手段，自己没做过' },
    ],
  },
  // c7：约面中 · 飞书日程仍在「待同步」，用于演示日程创建延迟（异常态可见）
  {
    id: 'c7',
    name: '郑亦然',
    role: '前端工程师（高级）',
    exp: '4 年',
    edu: '同济大学 · 软件工程',
    match: 74,
    status: '约面中',
    slot: '2026-10-02 10:30',
    round: '一面',
    source: '官网投递',
    sourceId: 'SRC-WEB-20031',
    attachmentType: 'original',
    positionId: 'pos-fe-1',
    jdId: 'jd-fe',
    assignee: '林婉 (HRG)',
    summary: '4 年 C 端与中后台前端经验，做过微前端拆分与低代码表单引擎；性能治理只有局部优化记录，缺少体系化数据。',
    skills: [{ k: 'React / TypeScript', v: 84 }, { k: '微前端', v: 78 }, { k: '低代码 / 表单引擎', v: 80 }, { k: '性能优化', v: 60 }, { k: 'Node.js', v: 52 }],
    highlights: ['主导 6 个子应用微前端拆分，独立发布周期缩短 40%', '低代码表单引擎覆盖 30+ 业务表单'],
    risks: ['性能优化缺少线上指标佐证', 'Node.js 仅用于构建脚本'],
    aiScreening: {
      recommended: true,
      reasons: ['官网投递简历完整，微前端与工程化经验与 JD 匹配'],
      risks: ['性能治理深度需面试确认'],
      looseMatch: '符合度 74% · 建议安排技术一面',
    },
    notes: [
      { id: 'n-8', time: '2026-09-30 17:40', author: '林婉 (HRG)', content: '官网投递简历落库，已与面试官确认 10 月 2 日上午时间，飞书日程创建请求已提交待回调。' },
    ],
    sourceUpdatedAt: '2026-09-30 17:30',
    nextAction: { text: '跟进飞书日程同步结果，同步成功后自动发送短信邀约', owner: '林婉 (HRG)', dueAt: '2026-10-01 18:00' },
    stageHistory: [
      { stage: '新入库', at: '2026-09-30 17:30', by: '系统同步', reason: '官网投递简历落库' },
      { stage: '待联系', at: '2026-09-30 17:40', by: '林婉 (HRG)', reason: '电话沟通意向通过，确认可面试时间' },
      { stage: '约面中', at: '2026-09-30 17:45', by: '林婉 (HRG)', reason: '发起飞书日程与面试会议' },
    ],
    scheduleDetail: {
      interviewId: 'IV-2026-0011',
      idempotencyKey: 'SCH-C7-POSFE1-R1-202610021030',
      slot: '2026-10-02 10:30',
      round: '一面',
      type: 'online',
      interviewer: '张工 (前端TL)',
      durationMin: 45,
      status: 'scheduled',
      feishuCalendarStatus: 'pending',
      noticeChannel: 'sms',
      noticeStatus: 'pending',
      noticeAttempts: 1,
      history: [
        { at: '2026-09-30 17:45', by: '林婉 (HRG)', action: 'created', to: '2026-10-02 10:30', reason: '飞书日程创建请求已提交，等待同步回调' },
      ],
    },
    qs: [
      { id: 'q14', topic: '工程化', diff: '较难', basis: '简历：微前端拆分 6 个子应用', q: '微前端拆分时你怎么处理子应用之间的样式隔离、公共依赖和状态共享？', points: ['隔离方案与取舍', '公共依赖版本治理', '主子应用通信方式'], answer: '期望候选人讲清沙箱与样式隔离方案（Shadow DOM / 前缀约定）、公共依赖外置与版本锁定、以及通过事件总线或全局 store 通信的边界。', follow: ['子应用发版不同步时怎么保证兼容？'], flag: '只提到用某框架，说不清隔离与依赖治理' },
      { id: 'q15', topic: '性能优化', diff: '中等', basis: '风险：缺少线上指标', q: '你做的性能优化有哪些线上指标可以佐证？如果现在接手一个慢的中后台系统，你的第一周会怎么排查？', points: ['有量化数据意识', '先测量后优化', '给出分层排查路径'], answer: '关注候选人是否先建立基线（LCP、INP、接口耗时），再按路由拆分、请求合并、渲染次数三条线排查，并保留回退与监控。', follow: ['如何防止优化成果回退？'], flag: '只讲优化手段，没有任何度量' },
    ],
  },
  // c8：待联系 · 面试已排但邀约通知连续失败，需要重新联系候选人（异常态可见）
  {
    id: 'c8',
    name: '高远',
    role: '后端工程师（高级）',
    exp: '5 年',
    edu: '西安电子科技大学 · 计算机',
    match: 73,
    status: '待联系',
    slot: '2026-10-02 15:00',
    round: '一面',
    source: '猎聘',
    sourceId: 'SRC-LP-33417',
    attachmentType: 'original',
    positionId: 'pos-be-1',
    jdId: 'jd-be',
    assignee: '赵静 (HR)',
    summary: '5 年 Go 后端经验，负责过网关与限流组件，工程基础扎实；高并发数据一致性与对账经验偏少。',
    skills: [{ k: 'Go', v: 85 }, { k: '网关 / 限流', v: 80 }, { k: 'MySQL', v: 72 }, { k: 'Redis', v: 70 }, { k: '对账一致性', v: 50 }],
    highlights: ['自研网关限流组件，拦截大促异常流量 3 倍峰值', '推动接口 SLA 与熔断规范落地'],
    risks: ['对账与资金一致性经验不足', '短信通知连续失败，候选人尚未确认面试'],
    aiScreening: {
      recommended: true,
      reasons: ['技术栈与交易岗位匹配，网关治理经验可复用'],
      risks: ['一致性经验需在面试中确认'],
      looseMatch: '符合度 73% · 建议约面并优先确认联系方式',
    },
    notes: [
      { id: 'n-9', time: '2026-10-01 09:10', author: '赵静 (HR)', content: '面试时段已与面试官确认，但短信邀约两次发送失败（签名审核未通过），已进入可重试队列，需改用邮件并电话联系候选人。' },
    ],
    sourceUpdatedAt: '2026-09-29 09:50',
    nextAction: { text: '今天 17:00 前改用邮件通道重发邀约，并电话确认候选人是否收到', owner: '赵静 (HR)', dueAt: '2026-10-01 17:00' },
    stageHistory: [
      { stage: '新入库', at: '2026-09-29 09:50', by: '系统同步', reason: '猎聘简历落库' },
      { stage: '筛选中', at: '2026-09-29 11:20', by: '赵静 (HR)', reason: 'AI 推荐，人工复核通过' },
      { stage: '约面中', at: '2026-09-30 16:30', by: '赵静 (HR)', reason: '与面试官确认时段，创建面试场次' },
      { stage: '待联系', at: '2026-10-01 09:10', by: '系统通知', reason: '候选人通知连续失败，退回人工联系' },
    ],
    scheduleDetail: {
      interviewId: 'IV-2026-0012',
      idempotencyKey: 'SCH-C8-POSBE1-R1-202610021500',
      slot: '2026-10-02 15:00',
      round: '一面',
      type: 'online',
      interviewer: '李工 (架构组主管)',
      durationMin: 45,
      status: 'scheduled',
      feishuCalendarStatus: 'synced',
      feishuMeetingUrl: 'https://vc.feishu.cn/j/771920455',
      noticeChannel: 'sms',
      noticeStatus: 'failed',
      noticeAttempts: 2,
      failureReason: '短信服务商返回签名审核未通过（SMS_SIGN_INVALID），已进入可重试队列，未重复创建面试场次',
      history: [
        { at: '2026-09-30 16:30', by: '赵静 (HR)', action: 'created', to: '2026-10-02 15:00', reason: '与面试官确认时段后创建场次' },
        { at: '2026-10-01 09:05', by: '系统通知', action: 'notice_failed', reason: '短信通道第 1 次发送失败：签名审核未通过' },
        { at: '2026-10-01 09:10', by: '系统通知', action: 'notice_failed', reason: '短信通道第 2 次发送失败，按幂等键保留原场次并转人工联系' },
      ],
    },
    qs: [
      { id: 'q16', topic: '高可用', diff: '较难', basis: '简历：网关限流组件', q: '你自研的网关限流组件是怎么做的？大促期间怎么避免误伤正常流量？', points: ['限流算法与选型', '热点与突发流量处理', '降级与放行策略'], answer: '期望候选人讲清算法（令牌桶 / 滑动窗口）选型、按接口与维度分级的配额、突发流量下的排队或快速失败策略，以及放行与告警机制。', follow: ['多实例部署时怎么保证全局限流准确？'], flag: '只讲单机算法，不考虑分布式与误伤' },
    ],
  },
  // c9：搁置 · 飞书审批退回（薪资超预算），业务侧暂缓，带搁置原因
  {
    id: 'c9',
    name: '唐薇',
    role: '产品经理（高级）',
    exp: '6 年',
    edu: '中山大学 · 信息管理',
    match: 79,
    status: '搁置',
    slot: '2026-09-25 10:00',
    round: '终面通过',
    source: '前程无忧',
    sourceId: 'SRC-QC-61204',
    attachmentType: 'platform',
    positionId: 'pos-pm-1',
    jdId: 'jd-pm',
    assignee: '林婉 (HRG)',
    summary: '6 年 SaaS 商业化产品经验，定价与续约案例完整，终面评价 4.3 分；薪资预期高出该职级预算 12%，飞书审批退回后转为搁置。',
    skills: [{ k: '商业化变现', v: 86 }, { k: '定价策略', v: 84 }, { k: '数据分析', v: 76 }, { k: '跨部门推动', v: 78 }, { k: '团队管理', v: 62 }],
    highlights: ['主导会员体系定价重构，客单价提升 18%', '终面评价一致认可业务判断力'],
    risks: ['薪资预期超预算 12%，缺少对标说明', '暂缓期间可能被其他机会吸引'],
    aiScreening: {
      recommended: true,
      reasons: ['商业化经验与岗位高度匹配，业务终面评价优秀'],
      risks: ['薪酬超预算，需要特批或暂缓'],
      looseMatch: '符合度 79% · 业务认可，卡在薪酬预算',
    },
    notes: [
      { id: 'n-10', time: '2026-09-26 15:35', author: '林婉 (HRG)', content: 'HRVP 退回申请：薪资超该职级预算 12% 且缺少薪酬对标说明；业务侧确认暂缓，候选人转为搁置，保留复用。' },
      { id: 'n-11', time: '2026-09-30 10:20', author: '王总 (产品总监)', content: '第四季度预算若释放可重启匹配，届时重新核定职级与薪资区间。' },
    ],
    sourceUpdatedAt: '2026-09-22 14:30',
    nextAction: { text: '10 月 15 日复核第四季度编制预算，再决定是否重启该候选人匹配', owner: '林婉 (HRG)', dueAt: '2026-10-15 18:00' },
    stageHistory: [
      { stage: '新入库', at: '2026-09-22 14:30', by: '系统同步', reason: '前程无忧简历落库（平台模板文件）' },
      { stage: '筛选中', at: '2026-09-23 10:00', by: '林婉 (HRG)', reason: 'AI 推荐，人工复核通过' },
      { stage: '待录取', at: '2026-09-24 11:00', by: '林婉 (HRG)', reason: '终面通过，业务确认录用，发起双审批' },
      { stage: '搁置', at: '2026-09-26 15:35', by: '林婉 (HRG)', reason: '搁置原因：飞书审批因薪资超预算退回、BPM 流程同步撤销，业务侧预算暂缓，暂不推进但不淘汰' },
    ],
    approvalId: 'APP-2026-1004',
    qs: [
      { id: 'q17', topic: '商业化', diff: '中等', basis: '简历：会员体系定价重构', q: '会员体系定价重构时，你是怎么平衡客单价提升与续约率下降风险的？', points: ['有定价方法论', '关注续约与流失', '有实验与调整过程'], answer: '期望候选人说明分层定价与价值锚点设计、灰度实验方式，以及对续约率、流失率的监控与回调机制。', follow: ['如果续约率下降超过预期，你的止损线在哪？'], flag: '只讲涨价，不评估续约风险' },
    ],
  },
  // c10：待录取 · 飞书已通过、BPM 仍在处理（单边通过，不得判为整体完成）
  {
    id: 'c10',
    name: '邓子睿',
    role: '后端工程师（高级）',
    exp: '5 年',
    edu: '电子科技大学 · 计算机',
    match: 81,
    status: '待录取',
    slot: '2026-09-30 16:00',
    round: '终面通过',
    source: '内推',
    sourceId: 'SRC-INT-014',
    attachmentType: 'original',
    positionId: 'pos-be-1',
    jdId: 'jd-be',
    assignee: '赵静 (HR)',
    summary: '5 年 Java 后端经验，主导过结算与对账系统重构，终面评价 4.2 分；飞书审批已通过，BPM 财务预算复核仍在处理中。',
    skills: [{ k: 'Java / Spring', v: 86 }, { k: '结算对账', v: 84 }, { k: 'MySQL', v: 78 }, { k: '分布式事务', v: 72 }, { k: '云原生', v: 58 }],
    highlights: ['对账系统重构后差异率下降至十万分之一', '带 4 人小组完成结算链路迁移'],
    risks: ['BPM 预算复核未完成，整体尚未通过', '薪资流水材料待补传'],
    aiScreening: {
      recommended: true,
      reasons: ['结算对账经验与交易岗位高度匹配', '终面评价稳定'],
      risks: ['审批尚未双通过，需按材料清单补齐'],
      looseMatch: '符合度 81% · 推荐录用（等待审批结论）',
    },
    notes: [
      { id: 'n-12', time: '2026-09-30 17:10', author: '李工 (架构组主管)', content: '终面通过，同意录用；已请 HR 发起飞书与 BPM，注意 BPM 侧预算复核。' },
      { id: 'n-13', time: '2026-10-01 09:20', author: '赵静 (HR)', content: '飞书审批已归档通过，BPM 仍在财务预算复核，整体不得标记为已录用；已提醒候选人补传近半年薪资流水。' },
    ],
    sourceUpdatedAt: '2026-09-23 16:20',
    nextAction: { text: '今天 16:00 前催办 BPM 财务预算复核，并收齐薪资流水与离职证明', owner: '赵静 (HR)', dueAt: '2026-10-01 16:00' },
    stageHistory: [
      { stage: '新入库', at: '2026-09-23 16:20', by: '系统同步', reason: '内推记录落库' },
      { stage: '约面中', at: '2026-09-26 09:40', by: '赵静 (HR)', reason: '技术栈匹配，安排一面' },
      { stage: '面评中', at: '2026-09-29 14:30', by: '李工 (架构组主管)', reason: '一面通过，安排终面' },
      { stage: '待录取', at: '2026-09-30 17:10', by: '李工 (架构组主管)', reason: '终面通过，发起飞书与 BPM 双审批' },
    ],
    approvalId: 'APP-2026-1003',
    qs: [
      { id: 'q18', topic: '系统设计', diff: '较难', basis: '简历：对账系统重构', q: '对账系统重构后差异率降到十万分之一，你是怎么做核对与差错处理的？', points: ['核对维度与频率设计', '差错定位与自动补偿', '监控与人工兜底'], answer: '期望候选人讲清按渠道与账期的核对策略、差错分类与自动冲正、以及监控告警与人工介入流程，并说明幂等与重跑机制。', follow: ['上游数据延迟到达时怎么处理？'], flag: '只说跑批脚本，没有差错处理设计' },
    ],
  },
]

export type ResumeLine = { text: string; mark?: 'hi' | 'risk'; ref?: number; q?: string[] }
export const resumes: Record<string, { file: string; contact: string; sections: { title: string; lines: ResumeLine[] }[] }> = {
  c1: {
    file: '林晓_高级前端_简历.pdf', contact: '杭州 · 138****2471 · linxiao@mail.com',
    sections: [
      { title: '工作经历', lines: [
        { text: '2021.03 – 至今　某电商平台 · 高级前端工程师' },
        { text: '负责商家后台首屏性能专项，LCP 由 4.2s 降至 1.8s，转化率提升 3.1%', mark: 'hi', ref: 0, q: ['q1', 'q4'] },
        { text: '主导 Webpack → Vite 构建迁移，CI 构建耗时降低 68%', mark: 'hi', ref: 1, q: ['q3'] },
        { text: '搭建内部组件库，覆盖 12 条业务线、140+ 组件', mark: 'hi', ref: 2, q: ['q6'] },
        { text: '2019.07 – 2022.01　某 SaaS 公司 · 前端工程师' },
        { text: '负责 CRM 表单引擎与权限模块开发' },
        { text: '2022.01 – 2022.05　（简历未填写）', mark: 'risk', ref: 2 },
      ] },
      { title: '专业技能', lines: [
        { text: '精通 React 18、TypeScript，熟悉并发渲染与状态管理方案', q: ['q2'] },
        { text: '精通 Node.js，能独立开发服务端应用', mark: 'risk', ref: 0, q: ['q5'] },
        { text: '熟悉 Vite / Webpack / Rollup 构建体系与前端监控' },
      ] },
      { title: '其他', lines: [{ text: '浙江大学 · 计算机科学与技术 · 本科 · 2019' }, { text: '技术博客（最近更新 2023.02）', mark: 'risk', ref: 1 }] },
    ],
  },
  c2: {
    file: '陈嘉豪-后端-3年.pdf', contact: '广州 · 159****8820 · jiahao.c@mail.com',
    sections: [
      { title: '工作经历', lines: [
        { text: '2022.07 – 至今　某零售科技公司 · Go 后端工程师' },
        { text: '重构订单服务，峰值 QPS 从 800 提升至 3k', mark: 'hi', ref: 0 },
        { text: '独立设计库存预扣 + 异步确认方案', mark: 'hi', ref: 1 },
        { text: '了解分布式事务（TCC、Saga、2PC）', mark: 'risk', ref: 0, q: ['q8'] },
        { text: '输出 3 篇线上故障复盘文档', mark: 'hi', ref: 2 },
      ] },
      { title: '专业技能', lines: [{ text: '熟悉 Go、Gin、gRPC，熟练使用 MySQL / Redis / Kafka', q: ['q7'] }, { text: '参与大促保障', mark: 'risk', ref: 1 }] },
      { title: '教育', lines: [{ text: '华南理工大学 · 软件工程 · 本科 · 2022' }] },
    ],
  },
  c3: {
    file: '王雨桐_产品经理.docx', contact: '上海 · 186****0913 · yutong.w@mail.com',
    sections: [
      { title: '工作经历', lines: [
        { text: '2021.04 – 至今　某企业服务公司 · 产品经理' },
        { text: '主导 CRM 改版，续费率提升 6%', mark: 'hi', ref: 0 },
        { text: '推动建立跨部门需求评审机制', mark: 'hi', ref: 1 },
        { text: '负责数据看板需求，关注核心指标增长', mark: 'risk', ref: 0, q: ['q9'] },
        { text: '迭代上线 20+ 功能，均通过灰度验证', mark: 'risk', ref: 1 },
      ] },
      { title: '教育', lines: [{ text: '复旦大学 · 信息管理与信息系统 · 本科 · 2020' }] },
    ],
  },
  c4: {
    file: '孟凡_高级后端_简历.pdf', contact: '深圳 · 137****6620 · fan.meng@mail.com',
    sections: [
      { title: '工作经历', lines: [
        { text: '2023.05 – 至今　某金融科技公司 · 高级后端工程师' },
        { text: '负责风控规则引擎，支持日均 2 亿次决策', mark: 'hi', ref: 0, q: ['q10'] },
        { text: '推动跨 3 个团队的数据口径统一', mark: 'risk', ref: 0, q: ['q11'] },
        { text: '2020.07 – 2023.04　某互联网公司 · 后端工程师' },
      ] },
      { title: '教育', lines: [{ text: '华中科技大学 · 计算机科学与技术 · 本科 · 2020' }] },
    ],
  },
  c5: {
    file: '苏晴-高级产品经理.pdf', contact: '北京 · 186****3355 · qing.su@mail.com',
    sections: [
      { title: '工作经历', lines: [
        { text: '2019.06 – 至今　某 SaaS 公司 · 高级产品经理' },
        { text: '负责付费产品线，ARR 三年增长 2.4 倍', mark: 'hi', ref: 0, q: ['q12'] },
        { text: '主导定价体系重构，续约率提升 9%', mark: 'hi', ref: 1 },
      ] },
      { title: '教育', lines: [{ text: '南京大学 · 信息管理与信息系统 · 本科 · 2019' }] },
    ],
  },
  c6: {
    file: '沈一诺_前端工程师(附件缺失-展示文本).txt', contact: '武汉 · 150****8812 · yinuo.shen@mail.com',
    sections: [
      { title: '工作经历', lines: [
        { text: '2023.07 – 至今　某生活服务平台 · 前端工程师' },
        { text: '负责小程序端性能优化，首屏耗时降低 41%', mark: 'hi', ref: 0, q: ['q13'] },
        { text: '维护业务组件库，支撑 6 个小程序' },
      ] },
      { title: '教育', lines: [{ text: '武汉大学 · 软件工程 · 本科 · 2023' }] },
    ],
  },
  c7: {
    file: '郑亦然_高级前端_简历.pdf', contact: '上海 · 133****9087 · yiran.zheng@mail.com',
    sections: [
      { title: '工作经历', lines: [
        { text: '2022.06 – 至今　某 SaaS 公司 · 前端工程师' },
        { text: '主导 6 个子应用微前端拆分，独立发布周期缩短 40%', mark: 'hi', ref: 0, q: ['q14'] },
        { text: '自研低代码表单引擎，覆盖 30+ 业务表单', mark: 'hi', ref: 1 },
        { text: '负责首屏加载优化（仅局部优化，缺少线上指标记录）', mark: 'risk', ref: 0, q: ['q15'] },
      ] },
      { title: '教育', lines: [{ text: '同济大学 · 软件工程 · 本科 · 2021' }] },
    ],
  },
  c8: {
    file: '高远-Go高级.pdf', contact: '西安 · 187****4412 · yuan.gao@mail.com',
    sections: [
      { title: '工作经历', lines: [
        { text: '2021.03 – 至今　某电商平台 · 高级后端工程师' },
        { text: '自研网关限流组件，大促拦截 3 倍峰值异常流量', mark: 'hi', ref: 0, q: ['q16'] },
        { text: '推动接口 SLA 与熔断规范落地' },
        { text: '了解资金对账与一致性方案', mark: 'risk', ref: 0 },
      ] },
      { title: '教育', lines: [{ text: '西安电子科技大学 · 计算机科学与技术 · 本科 · 2020' }] },
    ],
  },
  c9: {
    file: '唐薇_产品经理(平台模板).pdf', contact: '广州 · 139****2201 · wei.tang@mail.com',
    sections: [
      { title: '工作经历', lines: [
        { text: '2020.05 – 至今　某 SaaS 公司 · 高级产品经理' },
        { text: '主导会员体系定价重构，客单价提升 18%', mark: 'hi', ref: 0, q: ['q17'] },
        { text: '负责续约率与流失率监控看板' },
        { text: '期望薪资高于同职级区间（缺少对标说明）', mark: 'risk', ref: 0 },
      ] },
      { title: '教育', lines: [{ text: '中山大学 · 信息管理与信息系统 · 本科 · 2019' }] },
    ],
  },
  c10: {
    file: '邓子睿_高级后端_简历.pdf', contact: '成都 · 136****7788 · zirui.deng@mail.com',
    sections: [
      { title: '工作经历', lines: [
        { text: '2021.08 – 至今　某支付科技公司 · 高级后端工程师' },
        { text: '主导结算与对账系统重构，差异率降至十万分之一', mark: 'hi', ref: 0, q: ['q18'] },
        { text: '带 4 人小组完成结算链路迁移', mark: 'hi', ref: 1 },
      ] },
      { title: '教育', lines: [{ text: '电子科技大学 · 计算机科学与技术 · 本科 · 2020' }] },
    ],
  },
}

// 影刀落库增量同步池
export const importPool: { c: Candidate; r: (typeof resumes)[string] }[] = [
  {
    c: {
      id: 'n1',
      name: '刘一帆',
      role: '算法工程师（高级）',
      exp: '4 年',
      edu: '上海交通大学 · 人工智能',
      match: 77,
      status: '新入库',
      slot: '待安排',
      round: '未开始',
      source: '影刀采集',
      sourceId: 'SRC-YD-10884',
      attachmentType: 'original',
      positionId: 'pos-fe-1',
      jdId: 'jd-fe',
      assignee: '未分配',
      summary: '4 年推荐与大模型应用经验，做过 RAG 检索与评测平台，工程落地能力较强；论文与模型训练深度需要进一步确认。',
      skills: [{ k: 'LLM 应用', v: 85 }, { k: '推荐系统', v: 78 }, { k: 'PyTorch', v: 70 }, { k: '评测体系', v: 82 }, { k: '模型训练', v: 52 }],
      highlights: ['RAG 召回准确率从 71% 提升到 89%', '搭建离线评测平台，覆盖 6 个业务场景'],
      risks: ['"主导大模型微调"缺少训练规模与资源描述', '2 年内换过 3 家公司'],
      aiScreening: {
        recommended: true,
        reasons: ['上交科班，RAG 实操指标漂亮', '有评测平台完整搭建经历'],
        risks: ['频繁换工作，需背调核实原因'],
        looseMatch: '符合度 77% · 建议初筛通过并指定负责人',
      },
      notes: [
        { id: 'n-syn-1', time: '2026-10-01 11:30', author: '影刀自动化', content: '从前程无忧同步落库成功，附件原件已存入 MinIO。' },
      ],
      qs: [
        { id: 'n1q1', topic: '检索增强', diff: '较难', basis: '简历：RAG 召回 71% → 89%', q: '你提到 RAG 召回准确率从 71% 提升到 89%，评测集是怎么构建的？提升主要来自哪几步？', points: ['评测集来源与标注方式', '区分召回与重排的贡献', '有线上验证'], answer: '期望候选人说明评测集构造（真实 query 采样 + 人工标注），再拆解切分策略、混合检索、重排模型各自贡献，并提到线上 A/B 或人工抽检验证。', follow: ['如何处理多轮对话中的指代问题？'], flag: '只报数字，说不清评测口径' },
      ],
    },
    r: {
      file: '刘一帆_算法工程师.pdf', contact: '上海 · 177****5302 · yifan.liu@mail.com',
      sections: [
        { title: '工作经历', lines: [
          { text: '2024.03 – 至今　某金融科技公司 · 高级算法工程师' },
          { text: '负责智能客服 RAG 检索，召回准确率从 71% 提升到 89%', mark: 'hi', ref: 0, q: ['n1q1'] },
          { text: '主导大模型微调与对齐', mark: 'risk', ref: 0 },
        ] },
        { title: '教育', lines: [{ text: '上海交通大学 · 人工智能 · 硕士 · 2022' }] },
      ],
    },
  },
  {
    c: {
      id: 'n2',
      name: '何思雨',
      role: '后端工程师（高级）',
      exp: '6 年',
      edu: '北京邮电大学 · 计算机',
      match: 84,
      status: '筛选中',
      slot: '待安排',
      round: '未开始',
      source: 'BOSS直聘',
      sourceId: 'SRC-YD-20993',
      attachmentType: 'original',
      positionId: 'pos-be-1',
      jdId: 'jd-be',
      assignee: '赵静 (HR)',
      summary: '6 年 Java 后端经验，负责过支付清结算与对账系统，稳定性与容量治理经验扎实；团队管理经验仅限 3 人小组。',
      skills: [{ k: 'Java / Spring', v: 88 }, { k: '高可用', v: 84 }, { k: 'MySQL', v: 80 }, { k: '消息队列', v: 76 }, { k: '团队管理', v: 55 }],
      highlights: ['支付链路可用性从 99.9% 提升至 99.99%', '主导日均 800 万笔的对账系统重构'],
      risks: ['"带领团队"未说明团队规模与职责', '缺少云原生相关经历'],
      aiScreening: {
        recommended: true,
        reasons: ['对账与支付清算经验极其匹配交易岗位', '稳定性保障战果过硬'],
        risks: [],
        looseMatch: '符合度 84% · 极力推荐约面',
      },
      notes: [
        { id: 'n-syn-2', time: '2026-10-01 12:15', author: '影刀自动化', content: '从 BOSS 直聘同步落库，AI 宽松匹配初筛通过。' },
      ],
      qs: [
        { id: 'n2q1', topic: '高可用', diff: '较难', basis: '简历：可用性 99.9% → 99.99%', q: '支付链路可用性从三个 9 提升到四个 9，你们具体做了哪些事？怎么度量的？', points: ['SLO 定义与度量口径', '降级、限流、熔断的取舍', '故障演练'], answer: '期望候选人先说明可用性口径，再讲依赖治理、多活或冗余、限流降级方案和混沌演练，并给出故障恢复时间的变化。', follow: ['下游银行通道超时怎么处理？'], flag: '只列组件名，没有度量和取舍' },
      ],
    },
    r: {
      file: '何思雨-Java高级.pdf', contact: '北京 · 135****7716 · siyu.he@mail.com',
      sections: [
        { title: '工作经历', lines: [
          { text: '2021.06 – 至今　某支付公司 · 高级后端工程师' },
          { text: '负责支付核心链路稳定性，可用性从 99.9% 提升至 99.99%', mark: 'hi', ref: 0, q: ['n2q1'] },
          { text: '主导对账系统重构，支撑日均 800 万笔交易', mark: 'hi', ref: 1 },
        ] },
        { title: '教育', lines: [{ text: '北京邮电大学 · 计算机科学与技术 · 本科 · 2018' }] },
      ],
    },
  },
]
