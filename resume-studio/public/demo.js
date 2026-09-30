export const demo = {
  id: 'demo', name: '林知远', role: 'AI 应用工程师', fileName: '林知远_个人简历.pdf', phase: 'prepare', note: '', evaluation: null,
  summary: '3 年工程经验，关注大模型应用与产品落地。', pageCount: 1,
  sections: [
    { id:'experience', title:'工作经历', kind:'experience', anchor:{page:1,y:.25,quote:'远山科技 · AI 应用工程师',matched:true}, questions:[
      { id:'q1',type:'经历深挖',q:'从后端开发转向 AI 应用工程，你在远山科技承担的职责发生了哪些具体变化？',point:'辨别实际职责与团队成果，观察主动学习和跨领域迁移能力。',followUp:'能举一个你独立推动、而非按既定方案执行的例子吗？',expected:['清楚说明转型前后的职责边界','举出具体学习路径与工程交付','能区分个人贡献和团队协作'],score:null,note:'',excluded:false },
      { id:'q2',type:'协作沟通',q:'与产品、算法团队合作搭建知识库时，哪次需求分歧最大？最后如何达成一致？',point:'观察跨职能沟通与基于证据作决策的能力。',followUp:'最终方案放弃了什么？谁承担了这个代价？',expected:['还原分歧场景和双方约束','说明自己的具体推动动作','给出结果与反思'],score:null,note:'',excluded:false }
    ]},
    { id:'project-rag', title:'企业知识库问答系统', kind:'project', anchor:{page:1,y:.41,quote:'企业知识库问答系统',matched:true}, questions:[
      { id:'q3',type:'技术取舍',q:'你提到将检索准确率从 72% 提升至 91%，具体做了哪些改进？为什么选择混合检索？',point:'验证 RAG 的真实实践深度，以及对检索质量的评估方法。',followUp:'这 19 个百分点中，哪项改动带来的提升最大？你是怎么验证的？',expected:['说明评测集构建与准确率口径','解释向量与关键词检索的互补性','有分块、重排或消融实验的具体证据'],score:null,note:'',excluded:false },
      { id:'q4',type:'结果验证',q:'系统服务 500+ 位内部用户后，最常见的“答非所问”是什么场景？你如何排查？',point:'观察线上问题定位、用户反馈闭环以及可靠性意识。',followUp:'你如何区分“没检索到”和“模型没理解”这两类问题？',expected:['用具体案例还原问题','分层检查检索与生成链路','说明上线监控与修复后的验证'],score:null,note:'',excluded:false },
      { id:'q5',type:'经历深挖',q:'你在这套 RAG 系统的开发中使用过哪些 AI 编程工具？有没有采纳后发现不合适的方案？',point:'考察 AI 工具使用能力、审查意识与独立判断。',followUp:'你是如何发现问题并修改的？',expected:['描述真实使用场景','能辨别生成代码或建议的边界','保留测试、验证和人工判断'],score:null,note:'',excluded:false }
    ]},
    { id:'project-agent', title:'数据分析 Agent', kind:'project', anchor:{page:1,y:.64,quote:'数据分析 Agent',matched:true}, questions:[
      { id:'q6',type:'技术取舍',q:'你如何设计 Agent 的工具调用边界，避免生成的 SQL 误改数据？',point:'检验工具设计和权限隔离的工程思考。',followUp:'如果用户在自然语言中要求删除数据，系统会如何处理？',expected:['只读权限和查询隔离','参数校验与受限工具','异常回退与审计'],score:null,note:'',excluded:false },
      { id:'q7',type:'结果验证',q:'分析报告生成耗时缩短 60% 的统计基线是什么？有没有更慢或失败的任务？',point:'辨别效果指标的可信度，观察对失败场景的认识。',followUp:'你会如何重新设计一次更客观的评估？',expected:['说明样本规模和计时口径','披露失败及边界案例','兼顾效率和结果正确性'],score:null,note:'',excluded:false }
    ]},
    { id:'skills', title:'专业技能', kind:'skills', anchor:{page:1,y:.82,quote:'Python / TypeScript / LangChain',matched:true}, questions:[
      { id:'q8',type:'技术取舍',q:'在 LangChain 与自行编排调用之间，你做过什么取舍？哪些场景不适合引入框架？',point:'观察对抽象成本、调试能力和可维护性的判断。',followUp:'结合你做过的项目，举一个具体的限制。',expected:['结合真实项目说明选型','理解框架封装与可控性的取舍','能讨论依赖和调试成本'],score:null,note:'',excluded:false }
    ]}
  ]
};
export const demoPaper = `
<div class="resume-head"><div><span class="resume-kicker">CURRICULUM VITAE</span><h2>林知远<span>LIN ZHIYUAN</span></h2><p class="resume-role">AI 应用工程师 <span> / </span> 3 年工作经验</p></div><div class="resume-monogram">林<span>知远</span></div></div>
<div class="resume-contact"><span>杭州，中国</span><span>lin.zhiyuan@example.com</span><span>138 0000 0000</span></div>
<p class="resume-intro">热衷于让技术解决真实问题。拥有后端开发与大模型应用经验，关注 RAG、Agent 及面向用户的 AI 产品落地。</p>
<section class="resume-section" data-section="experience"><h3><span>01</span> 工作经历</h3><div class="resume-item-head"><h4>远山科技 <span>· AI 应用工程师</span></h4><time>2023.07 — 至今</time></div><p>负责企业级 AI 应用的设计与研发，与产品、算法团队协作，将大模型能力融入实际业务流程。</p><ul><li>从后端开发转向 AI 应用，参与知识库、智能数据分析等产品的完整交付。</li><li>持续完善服务监控、评测与反馈机制，提升线上系统的可用性。</li></ul></section>
<section class="resume-section projects"><h3><span>02</span> 项目经历</h3><div class="resume-project" data-section="project-rag"><div class="resume-item-head"><h4>企业知识库问答系统</h4><time>2024.03 — 2024.10</time></div><div class="resume-stack">Python / FastAPI / LangChain / Milvus</div><p>面向公司内部的知识检索与智能问答平台，为 <mark>500+ 位内部用户</mark>提供制度、产品与技术文档的自然语言查询。</p><ul><li>主导 RAG 链路设计，采用向量检索与 BM25 混合召回，结合重排优化检索结果。</li><li>搭建离线评测集，将<mark>检索准确率从 72% 提升至 91%</mark>。</li><li>实现多轮对话、来源引用与流式输出，推动产品从原型走向实际使用。</li></ul></div><div class="resume-project" data-section="project-agent"><div class="resume-item-head"><h4>数据分析 Agent</h4><time>2024.11 — 2025.06</time></div><div class="resume-stack">TypeScript / Python / Tool Calling / PostgreSQL</div><p>让业务同学通过自然语言完成数据查询与报告生成，减少重复的取数与分析工作。</p><ul><li>设计 SQL 查询、图表生成等工具，完成任务拆解与多步调用编排。</li><li>增加查询校验、只读权限与异常重试，分析报告生成<mark>耗时缩短 60%</mark>。</li></ul></div></section>
<section class="resume-section" data-section="skills"><h3><span>03</span> 专业技能</h3><p><b>工程开发</b>　Python、TypeScript、FastAPI、PostgreSQL、Docker</p><p><b>大模型应用</b>　RAG、LangChain、Prompt Engineering、Agent 工具调用</p></section>
<section class="resume-section education"><h3><span>04</span> 教育经历</h3><div class="resume-item-head"><h4>浙江工业大学 <span>· 计算机科学与技术 · 本科</span></h4><time>2019 — 2023</time></div></section>
<footer class="resume-footer"><span>林知远 · 个人简历</span><span>01 / 01</span></footer>`;
