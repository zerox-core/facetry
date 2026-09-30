const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp, normalizeAnalysis } = require('../server');
const analysis = { name:'测试候选人',role:'工程师',summary:'测试',sections:[{title:'知识库项目',kind:'project',anchor:{lineId:'p2-l3',quote:'知识库项目',page:1,y:.1},questions:[{q:'混合检索带来了什么收益？',point:'证据',followUp:'怎样验证？',expected:['对照实验'],type:'技术取舍'},{q:'如何处理失败？',point:'可靠性',followUp:'举例',expected:['案例'],type:'经历深挖'}]}] };
const lines=[{id:'p2-l3',text:'知识库项目',page:2,y:.47,x:.12}];
async function fixture(t,llm) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'folio-test-'));
  const server=createApp({dataDir:dir,llm:llm||(()=>structuredClone(analysis))});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));const target=path.resolve(dir);if(target.startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(target).startsWith('folio-test-'))fs.rmSync(target,{recursive:true,force:true});});
  const base='http://127.0.0.1:'+server.address().port;
  const req=async(p,method='GET',data)=>{const r=await fetch(base+p,{method,headers:{'Content-Type':'application/json'},...(data!==undefined?{body:JSON.stringify(data)}:{})});return {status:r.status,data:await r.json()};};
  const upload=async(name='测试.txt',text='测试候选人\n知识库项目\n采用混合检索')=>{const r=await fetch(base+'/api/upload?name='+encodeURIComponent(name),{method:'POST',body:text});return {status:r.status,data:await r.json()};};
  const poll=async jid=>{for(let n=0;n<100;n++){const {data}=await req('/api/jobs/'+jid);if(data.state!=='running')return data;await new Promise(r=>setTimeout(r,10));}throw new Error('job timeout');};
  return {req,upload,poll,base,dir};
}
test('source line determines exact page and coordinates, and invalid model output fails',()=>{
  const r=normalizeAnalysis(analysis,lines,2);assert.equal(r.sections[0].anchor.page,2);assert.equal(r.sections[0].anchor.y,.47);assert.equal(r.sections[0].anchor.matched,true);
  assert.throws(()=>normalizeAnalysis({sections:[]},lines,2));assert.throws(()=>normalizeAnalysis({sections:[{questions:[]}]},lines,2));
  const fallback=structuredClone(analysis);fallback.sections[0].anchor={quote:'无匹配',page:99,y:20};const anchor=normalizeAnalysis(fallback,lines,2).sections[0].anchor;assert.equal(anchor.page,2);assert.equal(anchor.y,.94);assert.equal(anchor.matched,false);
});
test('upload validates file type, PDF signature and empty files; secrets are not served',async t=>{
  const f=await fixture(t);assert.equal((await f.upload('bad.exe','x')).status,400);assert.equal((await f.upload('bad.pdf','not PDF')).status,400);assert.equal((await f.upload('empty.txt','')).status,400);assert.equal((await f.upload('bad.png','x')).status,400);
  assert.equal((await fetch(f.base+'/config.json')).status,404);assert.equal((await fetch(f.base+'/data')).status,404);
  const result=await f.upload();assert.equal(result.status,201);const {data}=await f.req('/api/sessions/'+result.data.id);assert.equal(data.text,'测试候选人\n知识库项目\n采用混合检索');assert.ok(fs.existsSync(path.join(f.dir,result.data.id+'.json')));
});
test('DOCX content is extracted as text and malformed documents are rejected',async t=>{
  const f=await fixture(t),JSZip=require('jszip'),zip=new JSZip();
  zip.file('[Content_Types].xml','<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('word/document.xml','<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>测试候选人的知识库项目</w:t></w:r></w:p></w:body></w:document>');
  const buf=await zip.generateAsync({type:'nodebuffer'});const response=await fetch(f.base+'/api/upload?name=resume.docx',{method:'POST',body:buf});assert.equal(response.status,201);assert.match((await response.json()).text,/知识库项目/);
  assert.equal((await f.upload('bad.docx','broken')).status,400);
});
test('analysis, selection, scoring, notes and manual anchors survive readback',async t=>{
  const f=await fixture(t),{data:s}=await f.upload();const p='/api/sessions/'+s.id;
  const {data:job}=await f.req(p+'/analyze','POST',{lines,pageCount:2});assert.equal((await f.poll(job.id)).state,'done');
  const {data:result}=await f.req(p);const sec=result.sections[0],q=sec.questions[0];assert.equal(result.name,'测试候选人');assert.equal(sec.anchor.page,2);
  assert.equal((await f.req(p+'/analyze','POST',{lines})).status,409);
  assert.equal((await f.req(p,'PATCH',{question:{id:q.id,score:6}})).status,400);
  await f.req(p,'PATCH',{question:{id:q.id,score:4,note:'指出混合检索的评测方法',excluded:true},phase:'interview',note:'观察笔记'});
  const {data:saved}=await f.req(p);assert.equal(saved.sections[0].questions[0].score,4);assert.equal(saved.sections[0].questions[0].note,'指出混合检索的评测方法');assert.equal(saved.sections[0].questions[0].excluded,true);assert.equal(saved.phase,'interview');
  await f.req(p,'PATCH',{question:{id:q.id,excluded:false},anchor:{id:sec.id,page:1,y:.7}});const {data:fixed}=await f.req(p);assert.equal(fixed.sections[0].anchor.y,.7);assert.equal(fixed.sections[0].anchor.manual,true);assert.equal(fixed.sections[0].questions[0].score,4);
});
test('evaluation excludes removed questions, uses recorded evidence, and invalidates on edits',async t=>{
  let captured;
  const f=await fixture(t,messages=>{if(messages[0].content.includes('提取姓名'))return structuredClone(analysis);captured=JSON.parse(messages[1].content);return {overall:'依据记录的观察',strengths:['能提供实验依据'],weaknesses:['部分未验证'],suggestion:'进一步面试',nextSteps:['核实职责'],evidence:captured.records.map(r=>r.id)};});
  const {data:s}=await f.upload(),p='/api/sessions/'+s.id;let j=await f.req(p+'/analyze','POST',{lines,pageCount:2});await f.poll(j.data.id);
  assert.equal((await f.req(p+'/evaluate','POST',{})).status,400);
  const {data:r}=await f.req(p),[q1,q2]=r.sections[0].questions;
  await f.req(p,'PATCH',{question:{id:q1.id,score:4,note:'能解释评测集'}});await f.req(p,'PATCH',{question:{id:q2.id,score:1,note:'排除记录',excluded:true}});
  j=await f.req(p+'/evaluate','POST',{});assert.equal((await f.poll(j.data.id)).state,'done');assert.equal(captured.records.length,1);assert.equal(captured.records[0].id,'Q01');assert.equal(captured.scoredCount,1);assert.deepEqual((await f.req(p)).data.evaluation.evidence,[q1.id]);
  assert.equal((await f.req(p)).data.evaluation.overall,'依据记录的观察');await f.req(p,'PATCH',{question:{id:q1.id,note:'新证据'}});assert.equal((await f.req(p)).data.evaluation,null);
});
test('duplicate requests share one job; model failures leave original resume intact',async t=>{
  let finish;const pending=new Promise(resolve=>finish=resolve);const f=await fixture(t,async()=>{await pending;throw new Error('上游故障');});
  const {data:s}=await f.upload(),p='/api/sessions/'+s.id;const first=await f.req(p+'/analyze','POST',{lines,pageCount:2});const second=await f.req(p+'/analyze','POST',{lines,pageCount:2});assert.equal(first.data.id,second.data.id);finish();assert.equal((await f.poll(first.data.id)).state,'error');const {data:remaining}=await f.req(p);assert.equal(remaining.sections.length,0);assert.ok(remaining.text.includes('知识库项目'));
});
test('evaluation does not overwrite newer interview evidence',async t=>{
  let finish;const f=await fixture(t,async messages=>{if(messages[0].content.includes('提取姓名'))return structuredClone(analysis);return await new Promise(resolve=>finish=()=>resolve({overall:'旧评价',strengths:[],weaknesses:[],suggestion:'继续'}));});
  const {data:s}=await f.upload(),p='/api/sessions/'+s.id;let j=await f.req(p+'/analyze','POST',{lines,pageCount:2});await f.poll(j.data.id);const {data:r}=await f.req(p),qid=r.sections[0].questions[0].id;
  await f.req(p,'PATCH',{question:{id:qid,score:4}});j=await f.req(p+'/evaluate','POST',{});await f.req(p,'PATCH',{question:{id:qid,note:'生成期间的新记录'}});finish();assert.equal((await f.poll(j.data.id)).state,'error');assert.equal((await f.req(p)).data.evaluation,null);
});
