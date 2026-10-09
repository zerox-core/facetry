const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { createApp, normalizeAnalysis } = require('../server');
const analysis = { name:'测试候选人',role:'工程师',summary:'测试',sections:[{title:'知识库项目',kind:'project',anchor:{lineId:'p2-l3',quote:'知识库项目',page:1,y:.1},questions:[{q:'混合检索带来了什么收益？',point:'证据',followUp:'怎样验证？',expected:['对照实验'],type:'技术取舍'},{q:'如何处理失败？',point:'可靠性',followUp:'举例',expected:['案例'],type:'经历深挖'}]}] };
const lines=[{id:'p2-l3',text:'知识库项目',page:2,y:.47,x:.12}];
async function fixture(t,llm,opts) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'facetry-test-'));
  const server=createApp({dataDir:dir,llm:llm||(()=>structuredClone(analysis)),...(opts||{})});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));const target=path.resolve(dir);if(target.startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(target).startsWith('facetry-test-'))fs.rmSync(target,{recursive:true,force:true});});
  const base='http://127.0.0.1:'+server.address().port;
  const login=async(name='测试员')=>{const r=await fetch(base+'/api/auth/demo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})});const data=await r.json();return {cookie:r.headers.get('set-cookie').split(';')[0],user:data.user,status:r.status};};
  const self=await login(),cookie=self.cookie;
  const req=async(p,method='GET',data)=>{const r=await fetch(base+p,{method,headers:{'Content-Type':'application/json',Cookie:cookie},...(data!==undefined?{body:JSON.stringify(data)}:{})});return {status:r.status,data:r.status===204?null:await r.json()};};
  const reqAs=(other)=>(p,method='GET',data)=>fetch(base+p,{method,headers:{'Content-Type':'application/json',Cookie:other.cookie},...(data!==undefined?{body:JSON.stringify(data)}:{})}).then(async r=>({status:r.status,data:r.status===204?null:await r.json()}));
  const upload=async(name='测试.txt',text='测试候选人\n知识库项目\n采用混合检索')=>{const r=await fetch(base+'/api/upload?name='+encodeURIComponent(name),{method:'POST',headers:{Cookie:cookie},body:text});return {status:r.status,data:await r.json()};};
  const poll=async jid=>{for(let n=0;n<100;n++){const {data}=await req('/api/jobs/'+jid);if(data.state!=='running')return data;await new Promise(r=>setTimeout(r,10));}throw new Error('job timeout');};
  const analyze=async s=>{const p='/api/sessions/'+s.id;const {data:job}=await req(p+'/analyze','POST',{lines,pageCount:2});assert.equal((await poll(job.id)).state,'done');return (await req(p)).data;};
  return {req,reqAs,upload,poll,analyze,login,base,dir,cookie,user:self.user};
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
  const buf=await zip.generateAsync({type:'nodebuffer'});const response=await fetch(f.base+'/api/upload?name=resume.docx',{method:'POST',headers:{Cookie:f.cookie},body:buf});assert.equal(response.status,201);assert.match((await response.json()).text,/知识库项目/);
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
test('question content is editable with truncation and invalidates evaluation',async t=>{
  const f=await fixture(t),{data:s}=await f.upload(),p='/api/sessions/'+s.id;const r=await f.analyze(s),q=r.sections[0].questions[0];
  const long='长'.repeat(3000);
  const {data:updated}=await f.req(p,'PATCH',{question:{id:q.id,q:'修改后的问题',point:long,followUp:'修改后的追问',type:'协作沟通',expected:['要点一','要点二']}});
  const edited=updated.sections[0].questions[0];assert.equal(edited.q,'修改后的问题');assert.equal(edited.point.length,200);assert.equal(edited.followUp,'修改后的追问');assert.equal(edited.type,'协作沟通');assert.deepEqual(edited.expected,['要点一','要点二']);assert.equal(edited.score,null);
  await f.req(p,'PATCH',{question:{id:q.id,expected:['a','b','c','d','e','f','g']}});
  assert.equal((await f.req(p)).data.sections[0].questions[0].expected.length,6);
});
test('addQuestion appends to an existing section or creates a custom section',async t=>{
  const f=await fixture(t),{data:s}=await f.upload(),p='/api/sessions/'+s.id;const r=await f.analyze(s);
  assert.equal((await f.req(p,'PATCH',{addQuestion:{question:{q:''}}})).status,400);
  const {data:added}=await f.req(p,'PATCH',{addQuestion:{sectionId:r.sections[0].id,question:{q:'追加到现有段落的问题',point:'考察点',expected:['参考'],type:'结果验证'}}});
  assert.equal(added.sections.length,1);assert.equal(added.sections[0].questions.length,3);
  const nq=added.sections[0].questions[2];assert.equal(nq.q,'追加到现有段落的问题');assert.equal(nq.score,null);assert.equal(nq.excluded,false);assert.ok(nq.id);
  const {data:created}=await f.req(p,'PATCH',{addQuestion:{sectionTitle:'我的补充',question:{q:'新段落的问题'}}});
  assert.equal(created.sections.length,2);const custom=created.sections[1];assert.equal(custom.title,'我的补充');assert.equal(custom.kind,'custom');assert.equal(custom.anchor,null);assert.equal(custom.questions[0].q,'新段落的问题');assert.equal(custom.questions[0].type,'补充提问');
  const {data:defaults}=await f.req(p,'PATCH',{addQuestion:{question:{q:'默认标题段落'}}});
  assert.equal(defaults.sections[2].title,'补充问题');
});
test('removeQuestion removes the question and cleans up the empty section',async t=>{
  const f=await fixture(t),{data:s}=await f.upload(),p='/api/sessions/'+s.id;const r=await f.analyze(s),sec=r.sections[0];
  assert.equal((await f.req(p,'PATCH',{removeQuestion:{id:'missing'}})).status,404);
  const {data:afterOne}=await f.req(p,'PATCH',{removeQuestion:{id:sec.questions[0].id}});
  assert.equal(afterOne.sections.length,1);assert.equal(afterOne.sections[0].questions.length,1);assert.equal(afterOne.sections[0].questions[0].id,sec.questions[1].id);
  const {data:afterAll}=await f.req(p,'PATCH',{removeQuestion:{id:sec.questions[1].id}});
  assert.equal(afterAll.sections.length,0);
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
test('existing evaluation requires force to regenerate',async t=>{
  const f=await fixture(t,messages=>{if(messages[0].content.includes('提取姓名'))return structuredClone(analysis);return {overall:'评价',strengths:['优势'],weaknesses:['不足'],suggestion:'建议',nextSteps:[],evidence:[]};});
  const {data:s}=await f.upload(),p='/api/sessions/'+s.id;const r=await f.analyze(s),qid=r.sections[0].questions[0].id;
  await f.req(p,'PATCH',{question:{id:qid,score:4}});
  let j=await f.req(p+'/evaluate','POST',{});assert.equal((await f.poll(j.data.id)).state,'done');assert.ok((await f.req(p)).data.evaluation);
  assert.equal((await f.req(p+'/evaluate','POST',{})).status,409);
  j=await f.req(p+'/evaluate','POST',{force:true});assert.equal(j.status,202);assert.equal((await f.poll(j.data.id)).state,'done');assert.ok((await f.req(p)).data.evaluation);
});
test('session list exposes questionCount and scoredCount excluding excluded questions',async t=>{
  const f=await fixture(t),{data:s}=await f.upload(),p='/api/sessions/'+s.id;const r=await f.analyze(s),[q1,q2]=r.sections[0].questions;
  await f.req(p,'PATCH',{question:{id:q1.id,score:5}});await f.req(p,'PATCH',{question:{id:q2.id,score:3,excluded:true}});
  const {data:list}=await f.req('/api/sessions');const item=list.find(x=>x.id===s.id);
  assert.equal(item.questionCount,1);assert.equal(item.scoredCount,1);assert.ok(!('sections' in item));assert.ok(!('lines' in item));
});
test('DELETE removes the session json and stored file',async t=>{
  const f=await fixture(t),{data:s}=await f.upload(),p='/api/sessions/'+s.id;
  assert.ok(fs.existsSync(path.join(f.dir,s.file)));assert.ok(fs.existsSync(path.join(f.dir,s.id+'.json')));
  const response=await fetch(f.base+p,{method:'DELETE',headers:{Cookie:f.cookie}});assert.equal(response.status,204);
  assert.ok(!fs.existsSync(path.join(f.dir,s.id+'.json')));assert.ok(!fs.existsSync(path.join(f.dir,s.file)));
  assert.equal((await f.req(p)).status,404);
  const again=await fetch(f.base+p,{method:'DELETE',headers:{Cookie:f.cookie}});assert.equal(again.status,404);
});
test('localhost origins are allowed, other cross origins are rejected',async t=>{
  const f=await fixture(t);
  const ok=await fetch(f.base+'/api/status',{headers:{Origin:'http://localhost:5173'}});assert.equal(ok.status,200);
  const ok2=await fetch(f.base+'/api/status',{headers:{Origin:'http://127.0.0.1:5173'}});assert.equal(ok2.status,200);
  const blocked=await fetch(f.base+'/api/status',{headers:{Origin:'https://evil.example.com'}});assert.equal(blocked.status,403);
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
test('bank is seeded with all questions and ordered parts on first access',async t=>{
  const f=await fixture(t);
  const {status,data}=await f.req('/api/bank');assert.equal(status,200);
  assert.equal(data.questions.length,41);
  assert.deepEqual(data.parts.map(x=>x.key),['A','B','E','F','C','D']);
  assert.equal(data.parts[0].name,'Part A · 基础题');assert.equal(data.parts[0].weight,10);
  const a1=data.questions.find(q=>q.id==='A1');assert.equal(a1.partName,'Part A · 基础题');assert.ok(a1.q.includes('Workflow'));assert.ok(!('images' in a1));assert.equal(a1.custom,false);assert.ok(a1.updatedAt);
  const d3=data.questions.find(q=>q.id==='D3');assert.ok(d3.material.includes('飞速发展'));
  assert.ok(fs.existsSync(path.join(f.dir,'_bank.json')));
});
test('bank POST creates a custom question, validates input and persists edits',async t=>{
  const f=await fixture(t);
  assert.equal((await f.req('/api/bank','POST',{title:'',q:'题干'})).status,400);
  assert.equal((await f.req('/api/bank','POST',{title:'标题',q:'  '})).status,400);
  const {status,data:created}=await f.req('/api/bank','POST',{title:'自定义题',q:'自定义题干内容',answer:'参考答案',material:'素材'});
  assert.equal(status,201);assert.match(created.id,/^U-[0-9a-f]{8}$/);assert.equal(created.part,'CUST');assert.equal(created.partName,'自定义');assert.equal(created.custom,true);assert.equal(created.material,'素材');
  const {data:bank}=await f.req('/api/bank');assert.equal(bank.questions.length,42);assert.equal(bank.parts.at(-1).key,'CUST');assert.equal(bank.parts.at(-1).weight,0);
  const {status:ps,data:patched}=await f.req('/api/bank/'+created.id,'PATCH',{title:'改后的标题',part:'C',answer:'改后的答案'});
  assert.equal(ps,200);assert.equal(patched.title,'改后的标题');assert.equal(patched.part,'C');assert.equal(patched.partName,'Part C · 思维题');assert.equal(patched.answer,'改后的答案');assert.ok(patched.updatedAt>=created.updatedAt);
  assert.equal((await f.req('/api/bank/'+created.id,'PATCH',{q:''})).status,400);
  const {data:bank2}=await f.req('/api/bank');const saved=bank2.questions.find(q=>q.id===created.id);assert.equal(saved.title,'改后的标题');assert.equal(saved.part,'C');
  const del=await fetch(f.base+'/api/bank/'+created.id,{method:'DELETE',headers:{Cookie:f.cookie}});assert.equal(del.status,204);
  const {data:bank3}=await f.req('/api/bank');assert.equal(bank3.questions.length,41);assert.ok(!bank3.parts.some(x=>x.key==='CUST'));
});
test('bank PATCH and DELETE return 404 for unknown ids',async t=>{
  const f=await fixture(t);
  assert.equal((await f.req('/api/bank/NOPE','PATCH',{title:'x'})).status,404);
  const del=await fetch(f.base+'/api/bank/NOPE',{method:'DELETE',headers:{Cookie:f.cookie}});assert.equal(del.status,404);
  const {data:bank}=await f.req('/api/bank');assert.equal(bank.questions.length,41);
});
test('bank storage file never leaks into session list or session routes',async t=>{
  const f=await fixture(t);
  await f.req('/api/bank');
  assert.ok(fs.existsSync(path.join(f.dir,'_bank.json')));
  const {data:list}=await f.req('/api/sessions');assert.ok(Array.isArray(list));assert.ok(!list.some(s=>s&&s.parts));
  assert.equal((await f.req('/api/sessions/_bank')).status,400);
  const del=await fetch(f.base+'/api/sessions/_bank',{method:'DELETE',headers:{Cookie:f.cookie}});assert.equal(del.status,400);
  assert.ok(fs.existsSync(path.join(f.dir,'_bank.json')));
});
test('unauthenticated requests to protected routes are rejected with 401',async t=>{
  const f=await fixture(t);
  assert.equal((await fetch(f.base+'/api/sessions')).status,401);
  assert.equal((await fetch(f.base+'/api/upload?name=x.txt',{method:'POST',body:'hello'})).status,401);
  assert.equal((await fetch(f.base+'/files/abc.txt')).status,401);
  assert.equal((await fetch(f.base+'/api/bank')).status,401);
  assert.equal((await fetch(f.base+'/api/auth/me')).status,401);
  assert.equal((await fetch(f.base+'/api/status')).status,200);
  assert.equal((await fetch(f.base+'/api/auth/demo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'  '})})).status,400);
});
test('demo login issues a cookie and sessions are isolated per user',async t=>{
  const f=await fixture(t);assert.equal(f.user.id,'demo:测试员');
  const me=await f.req('/api/auth/me');assert.equal(me.status,200);assert.equal(me.data.user.id,'demo:测试员');
  const {data:s}=await f.upload(),p='/api/sessions/'+s.id;
  assert.ok((await f.req('/api/sessions')).data.some(x=>x.id===s.id));
  assert.equal((await fetch(f.base+'/files/'+s.file,{headers:{Cookie:f.cookie}})).status,200);
  const other=await f.login('另一位面试官'),req2=f.reqAs(other);
  assert.equal((await req2('/api/sessions')).data.length,0);
  assert.equal((await req2(p)).status,404);
  assert.equal((await req2(p,'PATCH',{note:'越权'})).status,404);
  assert.equal((await req2(p+'/analyze','POST',{lines})).status,404);
  assert.equal((await req2(p+'/evaluate','POST',{})).status,404);
  assert.equal((await fetch(f.base+p,{method:'DELETE',headers:{Cookie:other.cookie}})).status,404);
  assert.equal((await fetch(f.base+'/files/'+s.file,{headers:{Cookie:other.cookie}})).status,404);
  assert.equal((await req2('/api/bank')).status,200);
  assert.equal((await f.req(p)).status,200);
});
test('feishu oauth redirect, state validation and mocked callback issue an fs: session',async t=>{
  const f=await fixture(t,undefined,{config:{feishuAppId:'cli_test',feishuAppSecret:'test_secret'},feishuClient:{exchange:async code=>{assert.equal(code,'testcode');return {userId:'fs:u123',name:'飞书用户',avatar:'https://a.example.com/av.png'};}}});
  const r=await fetch(f.base+'/api/auth/feishu',{redirect:'manual'});assert.equal(r.status,302);
  const loc=r.headers.get('location');assert.ok(loc.startsWith('https://open.feishu.cn/open-apis/authen/v1/authorize?'));assert.ok(loc.includes('app_id=cli_test'));const ru=new URL(loc).searchParams.get('redirect_uri');assert.ok(ru.startsWith('http://127.0.0.1:'));assert.ok(ru.endsWith('/api/auth/feishu/callback'));
  const state=new URL(loc).searchParams.get('state');assert.match(state,/^[0-9a-f]{16}$/);
  assert.equal((await fetch(f.base+'/api/auth/feishu/callback?code=x&state=wrong',{redirect:'manual'})).status,400);
  const cb=await fetch(f.base+'/api/auth/feishu/callback?code=testcode&state='+state,{redirect:'manual'});
  assert.equal(cb.status,302);assert.equal(cb.headers.get('location'),'/');
  const setCookie=cb.headers.get('set-cookie');assert.match(setCookie,/^zm_sess=[0-9a-f]{48}; HttpOnly; Path=\/; SameSite=Lax; Max-Age=2592000$/);
  const me=await fetch(f.base+'/api/auth/me',{headers:{Cookie:setCookie.split(';')[0]}});const meData=await me.json();
  assert.equal(me.status,200);assert.equal(meData.user.id,'fs:u123');assert.equal(meData.user.name,'飞书用户');assert.equal(meData.user.avatar,'https://a.example.com/av.png');
  assert.equal((await fetch(f.base+'/api/auth/feishu/callback?code=testcode&state='+state,{redirect:'manual'})).status,400);
});
test('feishu login adopts legacy sessions without userId and leaves owned sessions alone',async t=>{
  const f=await fixture(t,undefined,{config:{feishuAppId:'cli_test',feishuAppSecret:'test_secret'},feishuClient:{exchange:async()=>({userId:'fs:boss',name:'管理员',avatar:''})}});
  const {data:mine}=await f.upload();
  const legacyId=crypto.randomUUID();
  fs.writeFileSync(path.join(f.dir,legacyId+'.json'),JSON.stringify({id:legacyId,fileName:'旧简历.txt',file:legacyId+'.txt',name:'旧简历',role:'',summary:'',text:'',sections:[],lines:[],pageCount:1,phase:'prepare',note:'',evaluation:null,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}));
  const r=await fetch(f.base+'/api/auth/feishu',{redirect:'manual'}),state=new URL(r.headers.get('location')).searchParams.get('state');
  const cb=await fetch(f.base+'/api/auth/feishu/callback?code=c&state='+state,{redirect:'manual'});assert.equal(cb.status,302);
  const legacy=JSON.parse(fs.readFileSync(path.join(f.dir,legacyId+'.json'),'utf8'));assert.equal(legacy.userId,'fs:boss');
  const mineFile=JSON.parse(fs.readFileSync(path.join(f.dir,mine.id+'.json'),'utf8'));assert.equal(mineFile.userId,'demo:测试员');
  const bossMe=await fetch(f.base+'/api/auth/me',{headers:{Cookie:cb.headers.get('set-cookie').split(';')[0]}});assert.equal((await bossMe.json()).user.id,'fs:boss');
  const bossList=await fetch(f.base+'/api/sessions',{headers:{Cookie:cb.headers.get('set-cookie').split(';')[0]}});const bossData=await bossList.json();
  assert.ok(bossData.some(x=>x.id===legacyId));assert.ok(!bossData.some(x=>x.id===mine.id));
});
test('logout deletes the token and expires the cookie',async t=>{
  const f=await fixture(t);
  assert.equal((await f.req('/api/auth/me')).status,200);
  const out=await fetch(f.base+'/api/auth/logout',{method:'POST',headers:{Cookie:f.cookie}});
  assert.equal(out.status,204);assert.ok(out.headers.get('set-cookie').includes('Max-Age=0'));
  assert.equal((await fetch(f.base+'/api/auth/me',{headers:{Cookie:f.cookie}})).status,401);
});
