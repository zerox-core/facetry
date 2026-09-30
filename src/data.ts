export const history: { cid?: string; id: string; name: string; role: string; date: string; score: number; dur: string; verdict: string }[] = [
  { id: 'R-0931', name: '周子航', role: '前端工程师', date: '2026-09-28', score: 4.1, dur: '28:14', verdict: '推荐' },
  { id: 'R-0927', name: '赵一鸣', role: '后端工程师', date: '2026-09-24', score: 3.8, dur: '14:02', verdict: '待定' },
  { id: 'R-0918', name: '孙可', role: '前端工程师', date: '2026-09-18', score: 3.4, dur: '31:40', verdict: '待定' },
  { id: 'R-0909', name: '吴桐', role: '产品经理', date: '2026-09-09', score: 2.9, dur: '22:51', verdict: '不推荐' },
  { id: 'R-0902', name: '郑乐', role: '前端工程师', date: '2026-09-02', score: 3.1, dur: '29:33', verdict: '不推荐' },
]

export const bank = [
  { cat: '前端', q: '浏览器事件循环中宏任务与微任务的执行顺序？', hot: "4.8k", tag: '基础' },
  { cat: '前端', q: '如何设计一个支持撤销/重做的编辑器状态模型？', hot: "2.1k", tag: '设计' },
  { cat: '后端', q: '如何保证分布式事务的最终一致性？', hot: "3.6k", tag: '架构' },
  { cat: '后端', q: 'Redis 缓存击穿、穿透、雪崩的区别和方案？', hot: "5.2k", tag: '基础' },
  { cat: '算法', q: 'RAG 系统中召回质量如何评测？', hot: "1.9k", tag: '前沿' },
  { cat: '产品', q: '如果 DAU 突然下降 20%，你会怎么分析？', hot: "3.3k", tag: '案例' },
  { cat: '综合', q: '你未来三年的职业规划是什么？', hot: "6.0k", tag: '行为' },
  { cat: '综合', q: '讲一个你失败的项目以及你学到了什么。', hot: "4.4k", tag: '行为' },
]

export const candidates = [
  {
    id: 'c1', name: '林晓', role: '前端工程师（高级）', exp: '5 年', edu: '浙江大学 · 计算机', match: 82, status: '待面试' as string, slot: '今天 14:30', round: '二面', source: '内推',
    summary: '5 年电商中后台经验，主导过 Webpack 到 Vite 迁移和首屏性能优化，React 与工程化经验扎实；缺少大型可视化与跨端经验。',
    skills: [{ k: 'React / TypeScript', v: 90 }, { k: '性能优化', v: 85 }, { k: '工程化', v: 80 }, { k: '可视化 / 图形', v: 45 }, { k: '团队管理', v: 60 }],
    highlights: ['LCP 由 4.2s 降至 1.8s，有可量化成果', '主导构建工具迁移，构建耗时降低 68%', '沉淀内部组件库，覆盖 12 个业务线'],
    risks: ['简历中"精通 Node.js"缺少对应项目佐证', '近一年无开源或技术分享记录', '2022 年有 4 个月空档期，简历未说明'],
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
    id: 'c2', name: '陈嘉豪', role: '后端工程师（中级）', exp: '3 年', edu: '华南理工 · 软件工程', match: 71, status: '待评价', slot: '今天 10:00', round: '一面', source: 'Boss 直聘',
    summary: '3 年 Go 后端经验，做过订单与库存服务，缓存与消息队列使用熟练；分布式事务与高并发压测经验偏浅。',
    skills: [{ k: 'Go', v: 82 }, { k: 'MySQL', v: 75 }, { k: 'Redis', v: 80 }, { k: '分布式', v: 55 }, { k: '系统设计', v: 58 }],
    highlights: ['订单服务 QPS 提升至 3k', '独立设计库存扣减方案', '有线上故障复盘文档'],
    risks: ['分布式事务描述停留在名词层面', '未提及压测与容量评估'],
    qs: [
      { id: 'q7', topic: '缓存', diff: '中等', basis: '技能：Redis', q: 'Redis 缓存击穿、穿透、雪崩有什么区别？在你的库存服务里是怎么防护的？', points: ['三者定义准确', '有对应方案', '结合自身项目'], answer: '击穿指单个热点 key 过期瞬间并发打库；穿透指查询不存在的数据；雪崩指大量 key 同时失效。方案分别为互斥锁或逻辑过期、布隆过滤器与空值缓存、过期时间加随机抖动与多级缓存。', follow: ['缓存与数据库双写一致性怎么保证？'], flag: '只背定义，无法结合项目' },
      { id: 'q8', topic: '分布式', diff: '较难', basis: '风险：分布式事务较浅', q: '下单扣库存与生成订单需要最终一致，你会怎么设计？', points: ['了解本地消息表 / TCC / Saga', '幂等与补偿', '权衡一致性与性能'], answer: '可用本地消息表加消息队列实现最终一致：订单与消息同事务落库，异步扣库存并通过幂等键防重，失败则重试或触发补偿取消订单。', follow: ['消息重复消费怎么处理？'], flag: '回答"用分布式事务框架"但说不出原理' },
    ],
  },
  {
    id: 'c3', name: '王雨桐', role: '产品经理（中级）', exp: '4 年', edu: '复旦大学 · 信息管理', match: 64, status: '待面试', slot: '明天 16:00', round: '一面', source: '官网投递',
    summary: '4 年 B 端产品经验，需求文档规范、协同能力强；数据分析与商业化经验相对薄弱。',
    skills: [{ k: '需求分析', v: 80 }, { k: '数据分析', v: 55 }, { k: '竞品研究', v: 70 }, { k: '商业化', v: 45 }, { k: '沟通协作', v: 85 }],
    highlights: ['主导 CRM 改版，续费率提升 6%', '推动跨部门评审机制'],
    risks: ['指标提升缺少归因说明', '未涉及 A/B 实验'],
    qs: [
      { id: 'q9', topic: '数据分析', diff: '中等', basis: '案例题', q: '如果产品 DAU 突然下降 20%，你会怎么分析？', points: ['先确认数据口径', '按维度拆解', '给出验证与行动'], answer: '先排除埋点与统计口径问题，再按渠道、版本、地区、新老用户拆分定位，结合近期发版与外部事件提出假设，最后用小流量验证并制定恢复方案。', follow: ['如何判断是季节性还是异常？'], flag: '直接给出结论，没有拆解过程' },
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
}

// 导入简历的 mock：模拟解析后产出的候选人
type Candidate = (typeof candidates)[number]
export const importPool: { c: Candidate; r: (typeof resumes)[string] }[] = [
  {
    c: {
      id: 'n1', name: '刘一帆', role: '算法工程师（高级）', exp: '4 年', edu: '上海交通大学 · 人工智能', match: 77, status: '待面试', slot: '待安排', round: '一面', source: '简历导入',
      summary: '4 年推荐与大模型应用经验，做过 RAG 检索与评测平台，工程落地能力较强；论文与模型训练深度需要进一步确认。',
      skills: [{ k: 'LLM 应用', v: 85 }, { k: '推荐系统', v: 78 }, { k: 'PyTorch', v: 70 }, { k: '评测体系', v: 82 }, { k: '模型训练', v: 52 }],
      highlights: ['RAG 召回准确率从 71% 提升到 89%', '搭建离线评测平台，覆盖 6 个业务场景'],
      risks: ['"主导大模型微调"缺少训练规模与资源描述', '2 年内换过 3 家公司'],
      qs: [
        { id: 'n1q1', topic: '检索增强', diff: '较难', basis: '简历：RAG 召回 71% → 89%', q: '你提到 RAG 召回准确率从 71% 提升到 89%，评测集是怎么构建的？提升主要来自哪几步？', points: ['评测集来源与标注方式', '区分召回与重排的贡献', '有线上验证'], answer: '期望候选人说明评测集构造（真实 query 采样 + 人工标注），再拆解切分策略、混合检索、重排模型各自贡献，并提到线上 A/B 或人工抽检验证。', follow: ['如何处理多轮对话中的指代问题？'], flag: '只报数字，说不清评测口径' },
        { id: 'n1q2', topic: '简历核实', diff: '中等', basis: '风险：微调描述不足', q: '简历写主导大模型微调，用的什么基座、多少数据、多少卡、训练了多久？', points: ['具体规模与资源', '个人职责边界'], answer: '应能给出基座模型、数据量级、GPU 数量与训练时长，并说明自己负责的环节。', follow: ['遇到过 loss 不收敛吗？怎么处理？'], flag: '数字模糊或前后矛盾' },
        { id: 'n1q3', topic: '协作与软技能', diff: '基础', basis: '风险：跳槽频繁', q: '过去两年换了三家公司，每次离开的主要原因是什么？', points: ['原因具体可信', '对下一份工作的期待'], answer: '关注原因是否合理、是否有反思，以及对本岗位的稳定性预期。', follow: ['什么情况下你会考虑离开我们？'], flag: '归咎前公司、缺乏反思' },
      ],
    },
    r: {
      file: '刘一帆_算法工程师.pdf', contact: '上海 · 177****5302 · yifan.liu@mail.com',
      sections: [
        { title: '工作经历', lines: [
          { text: '2024.03 – 至今　某金融科技公司 · 高级算法工程师' },
          { text: '负责智能客服 RAG 检索，召回准确率从 71% 提升到 89%', mark: 'hi', ref: 0, q: ['n1q1'] },
          { text: '主导大模型微调与对齐', mark: 'risk', ref: 0, q: ['n1q2'] },
          { text: '2023.02 – 2024.02　某内容平台 · 算法工程师', mark: 'risk', ref: 1, q: ['n1q3'] },
          { text: '搭建离线评测平台，覆盖 6 个业务场景', mark: 'hi', ref: 1 },
          { text: '2022.07 – 2023.01　某电商公司 · 推荐算法工程师' },
        ] },
        { title: '教育', lines: [{ text: '上海交通大学 · 人工智能 · 硕士 · 2022' }] },
      ],
    },
  },
  {
    c: {
      id: 'n2', name: '何思雨', role: '后端工程师（高级）', exp: '6 年', edu: '北京邮电大学 · 计算机', match: 84, status: '待面试', slot: '待安排', round: '一面', source: '简历导入',
      summary: '6 年 Java 后端经验，负责过支付清结算与对账系统，稳定性与容量治理经验扎实；团队管理经验仅限 3 人小组。',
      skills: [{ k: 'Java / Spring', v: 88 }, { k: '高可用', v: 84 }, { k: 'MySQL', v: 80 }, { k: '消息队列', v: 76 }, { k: '团队管理', v: 55 }],
      highlights: ['支付链路可用性从 99.9% 提升至 99.99%', '主导日均 800 万笔的对账系统重构'],
      risks: ['"带领团队"未说明团队规模与职责', '缺少云原生相关经历'],
      qs: [
        { id: 'n2q1', topic: '高可用', diff: '较难', basis: '简历：可用性 99.9% → 99.99%', q: '支付链路可用性从三个 9 提升到四个 9，你们具体做了哪些事？怎么度量的？', points: ['SLO 定义与度量口径', '降级、限流、熔断的取舍', '故障演练'], answer: '期望候选人先说明可用性口径，再讲依赖治理、多活或冗余、限流降级方案和混沌演练，并给出故障恢复时间的变化。', follow: ['下游银行通道超时怎么处理？'], flag: '只列组件名，没有度量和取舍' },
        { id: 'n2q2', topic: '系统设计', diff: '中等', basis: '简历：对账系统重构', q: '日均 800 万笔的对账系统，差错数据是怎么发现和处理的？', points: ['分片与批处理设计', '差错分类与自动修复', '幂等'], answer: '按时间窗口分片拉取双方流水，哈希比对后分类为长款、短款、金额不符，能自动处理的走补单或冲正，其余进入人工工单。', follow: ['跨天交易怎么对？'], flag: '说不出差错类型' },
        { id: 'n2q3', topic: '简历核实', diff: '基础', basis: '风险：团队规模不明', q: '简历写带领团队，团队几个人？你具体负责哪些管理工作？', points: ['规模与职责具体', '有带人案例'], answer: '关注是否真的承担过分工、评审、绩效沟通等职责，还是技术负责人角色。', follow: ['有没有处理过绩效不达标的成员？'], flag: '管理职责描述空泛' },
      ],
    },
    r: {
      file: '何思雨-Java高级.pdf', contact: '北京 · 135****7716 · siyu.he@mail.com',
      sections: [
        { title: '工作经历', lines: [
          { text: '2021.06 – 至今　某支付公司 · 高级后端工程师' },
          { text: '负责支付核心链路稳定性，可用性从 99.9% 提升至 99.99%', mark: 'hi', ref: 0, q: ['n2q1'] },
          { text: '主导对账系统重构，支撑日均 800 万笔交易', mark: 'hi', ref: 1, q: ['n2q2'] },
          { text: '带领团队完成清结算模块迭代', mark: 'risk', ref: 0, q: ['n2q3'] },
          { text: '2018.07 – 2021.05　某电商公司 · 后端工程师' },
          { text: '参与订单与营销系统开发，熟悉传统机房部署', mark: 'risk', ref: 1 },
        ] },
        { title: '教育', lines: [{ text: '北京邮电大学 · 计算机科学与技术 · 本科 · 2018' }] },
      ],
    },
  },
]
