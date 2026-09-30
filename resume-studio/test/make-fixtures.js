// Synthetic, non-personal fixtures for end-to-end browser checks.
const fs = require('node:fs');
const path = require('node:path');
const out = path.join(__dirname, 'fixtures');fs.mkdirSync(out,{recursive:true});
const pages=[[
  [50,760,24,'LIN ZHIYUAN'],[50,728,12,'AI APPLICATION ENGINEER | SYNTHETIC TEST RESUME'],
  [50,675,16,'EXPERIENCE'],[50,646,12,'YuanShan Technology | AI Engineer | 2023 - Present'],
  [50,620,11,'Built enterprise AI products with product and algorithm teams.'],
  [50,548,16,'Enterprise Knowledge Base'],[50,518,11,'Python / FastAPI / LangChain / Milvus'],
  [50,490,11,'Designed a RAG pipeline serving 500 internal users.'],
  [50,465,11,'Combined BM25 and vector retrieval, followed by reranking.'],
  [50,440,11,'Improved retrieval accuracy from 72% to 91% on a held-out set.'],
  [50,415,11,'Implemented citations, streaming and production monitoring.'],
  [50,320,16,'EDUCATION'],[50,288,11,'Computer Science, Bachelor degree | 2019 - 2023'],
  [50,45,9,'Fictional resume for application testing only. Page 1 of 2']
],[
  [50,760,22,'PROJECTS & SKILLS'],[50,650,16,'Data Analysis Agent'],
  [50,620,11,'TypeScript / Python / Tool Calling / PostgreSQL'],
  [50,590,11,'Built a natural-language interface for queries and reports.'],
  [50,565,11,'Designed SQL tools with read-only permissions and validation.'],
  [50,540,11,'Reduced report turnaround time by 60% compared with manual work.'],
  [50,515,11,'Implemented retry logic, tool execution tracing and failure alerts.'],
  [50,400,16,'SKILLS'],[50,370,11,'Python, TypeScript, Docker, PostgreSQL, RAG, Agent workflows'],
  [50,45,9,'Fictional resume for application testing only. Page 2 of 2']
]];
const objs=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [4 0 R 6 0 R] /Count 2 >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
for(let i=0;i<pages.length;i++){
  const stream=pages[i].map(([x,y,size,text])=>`BT /F1 ${size} Tf ${x} ${y} Td (${text.replace(/[\\()]/g,'\\$&')}) Tj ET`).join('\n');
  objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5+i*2} 0 R >>`);
  objs.push(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
}
let pdf='%PDF-1.4\n',offsets=[0];for(let i=0;i<objs.length;i++){offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${objs[i]}\nendobj\n`;}
const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size ${objs.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
fs.writeFileSync(path.join(out,'synthetic-resume.pdf'),pdf);
fs.writeFileSync(path.join(out,'synthetic-resume.txt'),'虚构测试简历\n林知远\n求职方向：AI 应用工程师\n项目经历：企业知识库问答系统\n使用 Python、FastAPI、Milvus 与 LangChain 构建 RAG，结合 BM25 混合检索与重排，将检索准确率由 72% 提升到 91%，服务 500 位内部用户。\n项目经历：数据分析 Agent\n使用 TypeScript、Python、PostgreSQL 实现自然语言查询和报告。设计只读 SQL 工具与异常重试机制，生成报告耗时缩短 60%。\n专业技能\nPython、TypeScript、Docker、RAG、Agent 工具调用。');
console.log('Synthetic fixtures created.');
