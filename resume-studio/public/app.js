import { demo, demoPaper } from './demo.js';
import * as pdfjs from './vendor/pdf.min.mjs';
pdfjs.GlobalWorkerOptions.workerSrc = '/vendor/pdf.worker.min.mjs';

const paths = {
  page:'M6 3h8l4 4v14H6z M14 3v5h4 M9 12h6 M9 16h5',
  grid:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  plus:'M12 5v14 M5 12h14', upload:'M12 16V3 M7 8l5-5 5 5 M4 15v5h16v-5',
  arrow:'M5 12h14 M13 6l6 6-6 6',chevron:'M9 5l7 7-7 7',down:'M6 9l6 6 6-6',
  check:'M5 12l4 4L19 6',x:'M6 6l12 12 M18 6L6 18',clock:'M12 8v5l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  chat:'M21 11a8 8 0 0 1-8 8H7l-4 3V7a4 4 0 0 1 4-4h6a8 8 0 0 1 8 8z M7 8h9 M7 12h6',
  target:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0 M12 10v4 M10 12h4',
  briefcase:'M3 7h18v13H3z M8 7V4h8v3 M3 12c6 3 12 3 18 0 M12 11v4',
  book:'M3 4h7l2 2 2-2h7v16h-7l-2 1-2-1H3z M12 6v15',
  back:'M19 12H5 M11 6l-6 6 6 6',refresh:'M20 8a8 8 0 1 0 0 8 M20 3v5h-5',
  eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12 M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  minus:'M5 12h14',download:'M12 3v13 M7 11l5 5 5-5 M4 17v4h16v-4',
  pen:'M14 5l5 5 M4 20l5-1L21 7l-5-5L4 14z',info:'M12 11v6 M12 7v.1 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  leaf:'M5 19C2 9 8 3 21 3c0 13-6 18-16 16z M5 19L16 8',menu:'M4 6h16 M4 12h16 M4 18h16',
  closepanel:'M4 3h16v18H4z M13 3v18 M7 9l3 3-3 3', star:'m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z'
};
const icon = (name, cls='') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.page}"/></svg>`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const qs = (q, root=document) => root.querySelector(q);
const allQuestions = () => (state.session?.sections || []).flatMap(s => s.questions);
const selectedQuestions = () => allQuestions().filter(q => !q.excluded);
const scoredQuestions = () => selectedQuestions().filter(q => q.score !== null);
const average = () => scoredQuestions().length ? (scoredQuestions().reduce((n,q) => n + q.score,0)/scoredQuestions().length).toFixed(1) : '—';
const kinds = { project: '项目经历', experience:'工作经历', skills:'专业技能', education:'教育经历' };
const state = { session:null, sessions:[], section:'project-rag', phase:'prepare', panel:true, showExcluded:false, busy:false, loading:false, configured:false, zoom:100, lines:[], images:[], pageCount:1, loadingVersion:0, moveAnchor:null, error:'', pendingSaves:0, saveFailed:false };
let pdfDocument = null, clockTimer, toastTimer, saveChain = Promise.resolve();
const failedWrites = new Map();
const elapsed = new Map();
let tickStart = null;

async function api(url, options={}) {
  const response = await fetch(url, {...options, headers:{'Content-Type':'application/json', ...options.headers}});
  const data = await response.json(); if (!response.ok) throw new Error(data.error || '请求失败'); return data;
}
function toast(message) { const el=qs('#toast'); el.textContent=message; el.classList.add('visible'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('visible'),3500); }
function readLocal(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } }
function writeLocal(key,value) { try { localStorage.setItem(key,JSON.stringify(value)); } catch { toast('浏览器存储不可用，示例进度无法保留'); } }
function setSaved(label='已保存') { const el=qs('#save-status'); if(el) el.innerHTML=icon(state.saveFailed?'info':'check')+esc(label); }
function persist(patch) {
  const sid=state.session.id;
  if(sid==='demo') { writeLocal('folio-demo-v1',state.session); setSaved('示例已保存'); return Promise.resolve(); }
  state.pendingSaves++; setSaved('保存中…');
  const key=sid+':'+(patch.question?.id || (patch.anchor ? 'anchor:'+patch.anchor.id : 'session'));
  const task=saveChain.then(()=>api(`/api/sessions/${sid}`,{method:'PATCH',body:JSON.stringify(patch)}));
  saveChain=task.catch(()=>{});
  return task.then(()=>{failedWrites.delete(key);state.saveFailed=failedWrites.size>0;}).catch(e=>{failedWrites.set(key,patch);state.saveFailed=true; toast('保存失败：'+e.message+'。请保留此页面并重试。'); throw e;}).finally(()=>{state.pendingSaves--;setSaved(state.saveFailed?'保存失败 · 点击重试':state.pendingSaves?'保存中…':'已保存');});
}
function saveQuestion(q) { state.session.evaluation=null; persist({question:{id:q.id,score:q.score,note:q.note,excluded:q.excluded}}).catch(()=>{}); }
async function retrySave() {
  try { for(const patch of [...failedWrites.values()]) await persist(patch); for(const q of allQuestions()) await persist({question:{id:q.id,score:q.score,note:q.note,excluded:q.excluded}}); await persist({note:state.session.note,phase:state.phase}); toast('全部记录已保存'); } catch {}
}
function render() {
  const s=state.session;
  qs('#app').innerHTML=`<aside class="sidebar" id="sidebar"></aside><div class="main-shell"><header class="topbar"><div class="breadcrumbs"><button class="icon-button mobile-menu" data-action="menu" aria-label="打开导航">${icon('menu')}</button><span>面试工作台</span>${icon('chevron')}<strong>${esc(s.name)}</strong>${s.id==='demo'?'<span class="demo-tag">示例简历</span>':''}</div><div class="topbar-right"><button class="save-status" id="save-status" data-action="retry-save">${icon('check')}已保存</button><span class="avatar">我</span></div></header><main><section class="workspace-heading"><div><div class="eyebrow">READ BETWEEN THE LINES</div><h1>好问题，就在字里行间<span>。</span></h1><p>从一份简历开始，让每一次对话都有迹可循。</p></div><div class="heading-actions"><button class="button secondary" data-action="upload">${icon('upload')}上传简历</button><button class="button primary" id="primary-action" data-action="next"></button></div></section><div class="workflow" id="workflow"></div><div id="workspace"></div></main><footer class="app-footer"><span>页间 FOLIO <span class="footer-divider">/</span> 让对话回到经历本身</span><span>简历与记录保存在本机</span></footer></div>`;
  qs('#sidebar').insertAdjacentHTML('afterend','<button class="sidebar-scrim" data-action="menu" aria-label="关闭导航"></button>');
  renderSidebar(); renderWorkflow(); renderWorkspace(); updateTop();
}
function renderSidebar() {
  const s=state.session;
  qs('#sidebar').innerHTML=`<a class="brand" href="/" aria-label="页间首页"><span class="brand-icon">${icon('page')}</span><strong>页间</strong><span>FOLIO</span></a><div class="sidebar-workspace">个人工作空间<span class="workspace-dot"></span></div><button class="workspace-nav" data-action="workspace">${icon('grid')}面试工作台<span>${state.sessions.length || '01'}</span></button><div class="sidebar-label">简历档案<button class="icon-button" data-action="upload" aria-label="添加简历">${icon('plus')}</button></div><div class="candidate-list">${state.sessions.map(item=>`<button class="candidate ${s.id===item.id?'active':''}" data-session="${esc(item.id)}"><span class="candidate-avatar">${esc(item.name.slice(0,1))}</span><span><strong>${esc(item.name)}</strong><small>${esc(item.role || '待解析简历')}</small></span><span class="candidate-dot ${item.phase==='review'?'done':''}"></span></button>`).join('')}<button class="candidate ${s.id==='demo'?'active':''}" data-session="demo"><span class="candidate-avatar demo-avatar">林</span><span><strong>林知远 <i>示例</i></strong><small>AI 应用工程师</small></span></button></div><div class="sidebar-rule"></div><div class="sidebar-label">${state.phase==='review'?'本次面试':'简历目录'}<span>${String(s.sections.length).padStart(2,'0')}</span></div><nav class="section-nav">${s.sections.length?s.sections.map((sec,i)=>`<button data-section-nav="${sec.id}" class="${state.section===sec.id?'active':''}"><span class="section-number">${String(i+1).padStart(2,'0')}</span><span>${esc(sec.title)}</span><small>${sec.questions.filter(q=>!q.excluded).length}</small></button>`).join(''):'<p class="sidebar-empty">解析后，经历与项目会出现在这里。</p>'}</nav><div class="sidebar-bottom"><div class="margin-note">${icon('leaf')}<h4>好的面试，始于认真阅读。</h4><p>点击简历旁的数字标记，<br>在经历发生的地方展开提问。</p></div><div class="sidebar-bottom-line"><span class="connection-dot ${state.configured?'connected':''}"></span>${state.configured?'模型服务已配置':'模型服务待配置'}<button class="icon-button" data-action="help" aria-label="使用说明">${icon('info')}</button></div></div>`;
}
function renderWorkflow() {
  const stages=[['prepare','筛选问题','在简历上做好准备'],['interview','开始面试','让提问与记录同行'],['review','综合评价','用事实形成判断']];
  qs('#workflow').innerHTML=`<div class="workflow-steps">${stages.map(([key,label,desc],i)=>`<button class="workflow-step ${state.phase===key?'active':''}" data-phase="${key}"><span class="step-number">${String(i+1).padStart(2,'0')}</span><span><strong>${label}</strong><small>${desc}</small></span>${i<2?icon('chevron','step-arrow'):''}</button>`).join('')}</div><div class="workflow-summary" id="workflow-summary"></div>`;
  updateStats();
}
function updateTop() {
  const button=qs('#primary-action'); if(!button)return;
  button.innerHTML=state.phase==='prepare'?`开始面试 ${icon('arrow')}`:state.phase==='interview'?`结束并评价 ${icon('arrow')}`:`${icon('download')} 导出面试记录`;
  button.disabled=state.busy || state.loading || (state.phase==='prepare'&&!selectedQuestions().length);
  const timer=qs('#interview-timer'); if(timer) timer.textContent=timerText();
}
function updateStats() {
  const active=selectedQuestions().length, excluded=allQuestions().filter(q=>q.excluded).length;
  const el=qs('#workflow-summary'); if(el) el.innerHTML=state.phase==='prepare'?`<span class="stat-circle">${active}</span><span>道问题已保留${excluded?`<small> · ${excluded} 道已排除</small>`:''}</span>`:state.phase==='interview'?`${icon('clock')}<span id="interview-timer">${timerText()}</span><span class="vertical-rule"></span><strong>${scoredQuestions().length}<small> / ${active} 已评分</small></strong>`:`<strong>${scoredQuestions().length}<small> 道已评分</small></strong><span class="vertical-rule"></span><strong>${average()}<small> / 5 平均分</small></strong>`;
  updateTop();
}
function timerText() { const ms=(elapsed.get(state.session?.id)||0)+(tickStart?Date.now()-tickStart:0); const secs=Math.floor(ms/1000); return `${String(Math.floor(secs/60)).padStart(2,'0')}:${String(secs%60).padStart(2,'0')}`; }
function setTimer() { clearInterval(clockTimer); if(tickStart) {elapsed.set(state.session.id,(elapsed.get(state.session.id)||0)+Date.now()-tickStart);tickStart=null;} if(state.phase==='interview'){tickStart=Date.now();clockTimer=setInterval(()=>{const el=qs('#interview-timer');if(el)el.textContent=timerText();},1000);} }
function renderWorkspace() {
  if(state.phase==='review') { renderReview(); return; }
  qs('#workspace').innerHTML=`<div class="workspace-grid ${state.panel?'':'panel-hidden'}"><section class="document-area"><div class="document-toolbar"><div class="document-file">${icon('page')}<span>${esc(state.session.fileName)}</span></div><div class="document-controls"><span id="page-count">${state.session.pageCount || 1} 页</span><span class="vertical-rule"></span><button class="icon-button" data-action="zoom-out" aria-label="缩小简历">${icon('minus')}</button><button class="zoom-label" data-action="zoom-reset">${state.zoom}%</button><button class="icon-button" data-action="zoom-in" aria-label="放大简历">${icon('plus')}</button><button class="icon-button" data-action="toggle-panel" aria-label="展开或收起问题面板">${icon('closepanel')}</button></div></div><div class="document-hint">${icon('chat')}<span>${state.session.id==='demo'?'这是一份虚构示例。点击简历旁的数字，体验原位提问。':'数字标记对应这段经历的问题，点击即可展开。'}</span><span class="hint-label">${state.phase==='prepare'?'面试准备':'面试记录'}</span></div><div class="document-scroll" id="document-scroll"><div class="document-pages" id="document-pages"><div class="loading-paper"><span class="spinner"></span>正在打开简历…</div></div></div><div class="document-bottom"><span><i class="legend-dot"></i>当前查看 <i class="legend-dot muted"></i>其他问题</span><span>原文与问题，一眼对应</span></div></section><aside class="question-panel" id="question-panel"></aside></div>`;
  renderPanel(); renderPaper();
}
async function renderPaper() {
  const sid=state.session.id, version=++state.loadingVersion;
  const pages=qs('#document-pages'); if(!pages)return;
  try {
    if(sid==='demo') { pages.innerHTML=`<div class="paper demo-paper" data-page="1">${demoPaper}<div class="pin-layer"></div></div>`; }
    else {
      const ext=state.session.file.split('.').pop();
      if(ext==='pdf') {
        if(!pdfDocument || pdfDocument.sid!==sid) { const doc=await pdfjs.getDocument(`/files/${state.session.file}`).promise;pdfDocument={sid,doc}; }
        if(version!==state.loadingVersion || sid!==state.session.id)return;
        pages.innerHTML=''; state.lines=[];state.images=[];state.pageCount=pdfDocument.doc.numPages;
        if(state.pageCount>20) throw new Error('当前支持 20 页以内的简历，请精简文件后重新上传');
        for(let n=1;n<=pdfDocument.doc.numPages;n++) {
          const page=await pdfDocument.doc.getPage(n), base=page.getViewport({scale:1}), viewport=page.getViewport({scale:Math.min(1.8,1500/base.width)});
          if(version!==state.loadingVersion)return;
          const wrapper=document.createElement('div');wrapper.className='paper pdf-paper';wrapper.dataset.page=n;wrapper.style.aspectRatio=`${base.width}/${base.height}`;
          const canvas=document.createElement('canvas');canvas.width=viewport.width;canvas.height=viewport.height;canvas.setAttribute('aria-label',`简历第 ${n} 页`);wrapper.append(canvas);
          const textLayer=document.createElement('div');textLayer.className='accessible-text';wrapper.append(textLayer);
          const layer=document.createElement('div');layer.className='pin-layer';wrapper.append(layer);pages.append(wrapper);
          await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
          const text=await page.getTextContent();
          const rows=[];
          for(const item of text.items) {
            if(!item.str?.trim())continue;
            const transform=pdfjs.Util.transform(base.transform,item.transform), y=Math.max(0,Math.min(.99,(transform[5]-Math.hypot(transform[2],transform[3]))/base.height)), x=transform[4]/base.width;
            let row=rows.find(r=>Math.abs(r.y-y)<.006); if(!row){row={y,x,parts:[]};rows.push(row);} row.parts.push({x,text:item.str});
          }
          rows.sort((a,b)=>a.y-b.y).forEach((r,i)=>{const line={id:`p${n}-l${i+1}`,page:n,y:r.y,x:r.x,text:r.parts.sort((a,b)=>a.x-b.x).map(p=>p.text).join(' ')};state.lines.push(line); const span=document.createElement('p');span.textContent=line.text;textLayer.append(span);});
          state.images.push(canvas.toDataURL('image/jpeg',.72));
        }
      } else if(['jpg','png'].includes(ext)) {
        pages.innerHTML=`<div class="paper image-paper" data-page="1"><img id="resume-image" alt="上传的简历原图" src="/files/${state.session.file}"><div class="pin-layer"></div></div>`;
        const img=qs('#resume-image'); await img.decode();if(version!==state.loadingVersion)return;
        const canvas=document.createElement('canvas'),scale=Math.min(1,1600/img.naturalWidth);canvas.width=img.naturalWidth*scale;canvas.height=img.naturalHeight*scale;canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
        state.images=[canvas.toDataURL('image/jpeg',.8)];state.lines=[];state.pageCount=1;
      } else {
        const lines=state.session.text.split(/\r?\n/).filter(x=>x.trim());
        if(!lines.length)throw new Error('文件中没有可读取的文字，请换用 PDF 或清晰图片');
        const groups=[];let group=[],chars=0;
        for(const text of lines){if(chars+text.length>1800 && group.length){groups.push(group);group=[];chars=0;}group.push(text);chars+=text.length;}if(group.length)groups.push(group);
        if(groups.length>20)throw new Error('简历内容过长，请精简至 20 页以内');
        pages.innerHTML=groups.map((g,n)=>`<div class="paper text-paper" data-page="${n+1}"><div class="text-paper-label">${ext==='docx'?'WORD 文本预览 · 已重新排版':'简历文本预览'}</div>${g.map((t,i)=>`<p data-line="p${n+1}-l${i+1}" class="${t.length<24?'text-heading':''}">${esc(t)}</p>`).join('')}<div class="pin-layer"></div></div>`).join('');
        state.lines=[...pages.querySelectorAll('[data-line]')].map(el=>({id:el.dataset.line,text:el.textContent,page:Number(el.closest('.paper').dataset.page),x:.1,y:el.offsetTop/el.closest('.paper').offsetHeight}));state.images=[];state.pageCount=groups.length;
      }
    }
    if(version!==state.loadingVersion)return;
    const count=qs('#page-count');if(count)count.textContent=`${state.pageCount} 页`;
    setZoom();paintMarkers();
    if(state.session.sections.length && state.section) scrollToSection(state.section, false);
    if(state.session.id!=='demo' && !state.session.sections.length && !state.busy) renderPanel();
  } catch(e) { if(version===state.loadingVersion){pages.innerHTML=`<div class="loading-paper error-paper">${icon('info')}<h3>简历暂时无法预览</h3><p>${esc(e.message)}</p><button class="button secondary" data-action="retry-preview">重新加载</button></div>`;state.lines=[];state.images=[];toast(e.message);} }
}
function setZoom() { const el=qs('#document-pages');if(el)el.style.setProperty('--zoom',state.zoom/100);const label=qs('.zoom-label');if(label)label.textContent=state.zoom+'%';paintMarkers(); }
function paintMarkers() {
  if(!state.session || state.phase==='review')return;
  document.querySelectorAll('.pin-layer').forEach(el=>el.innerHTML='');
  document.querySelectorAll('.resume-section,.resume-project').forEach(el=>el.classList.toggle('section-selected',el.dataset.section===state.section && state.panel));
  for(const sec of state.session.sections) {
    const page=qs(`.paper[data-page="${sec.anchor.page}"]`);if(!page)continue;
    const active=sec.questions.filter(q=>!q.excluded), scored=active.filter(q=>q.score!==null).length;
    let y=sec.anchor.y*100;
    if(state.session.id==='demo') {const el=qs(`[data-section="${sec.id}"]`); if(el)y=(el.getBoundingClientRect().top-page.getBoundingClientRect().top+12)/page.getBoundingClientRect().height*100;}
    else if(page.classList.contains('text-paper') && !sec.anchor.manual) {const el=[...page.querySelectorAll('[data-line]')].find(el=>el.dataset.line===sec.anchor.lineId || el.textContent===sec.anchor.quote);if(el)y=(el.getBoundingClientRect().top-page.getBoundingClientRect().top)/page.getBoundingClientRect().height*100;}
    const pin=document.createElement('button');pin.className=`resume-pin ${state.section===sec.id&&state.panel?'selected':''} ${!active.length?'empty':''} ${scored===active.length&&scored?'scored':''}`;pin.style.top=`${y}%`;pin.dataset.pin=sec.id;pin.setAttribute('aria-label',`${sec.title}，${active.length} 道问题，点击展开或收起`);pin.setAttribute('aria-expanded',String(state.section===sec.id&&state.panel));pin.innerHTML=`${icon('chat')}<span>${active.length}</span><i class="pin-tooltip">${esc(sec.title)}</i>`;qs('.pin-layer',page).append(pin);
    if(state.session.id!=='demo' && state.section===sec.id&&state.panel) {const highlight=document.createElement('div');highlight.className='source-highlight';highlight.style.top=`${Math.max(0,y-.3)}%`;highlight.setAttribute('aria-hidden','true');qs('.pin-layer',page).append(highlight);}
  }
}
function focusSection(id,scroll=true) {
  state.section=id;state.panel=true;state.showExcluded=false;state.moveAnchor=null;
  qs('.workspace-grid')?.classList.remove('panel-hidden');renderSidebar();renderPanel();paintMarkers();
  if(scroll) scrollToSection(id);
  if(innerWidth<=620)qs('.document-area')?.scrollIntoView({behavior:'smooth',block:'start'});
}
function scrollToSection(id,smooth=true) {
  const pin=qs(`[data-pin="${id}"]`),scroller=qs('#document-scroll');
  if(pin&&scroller){const top=pin.getBoundingClientRect().top-scroller.getBoundingClientRect().top+scroller.scrollTop-130;scroller.scrollTo({top:Math.max(0,top),behavior:smooth?'smooth':'instant'});}
}
function renderPanel() {
  const panel=qs('#question-panel');if(!panel)return;
  const previousScroll=panel.dataset.section===state.section?(qs('.question-list',panel)?.scrollTop||0):0;
  const openReferences=[...panel.querySelectorAll('.question-card:has(details[open])')].map(el=>el.dataset.question);
  const s=state.session,sec=s.sections.find(x=>x.id===state.section)||s.sections[0];
  if(state.busy || state.loading) {panel.innerHTML=`<div class="panel-loading"><div class="loading-orbit">${icon('page')}<span class="spinner"></span></div><span class="eyebrow">${state.loading?'OPENING YOUR RESUME':'READING BETWEEN THE LINES'}</span><h3>${state.loading?'正在整理简历':'正在认真读这份简历'}</h3><p>${state.loading?'保留原始排版，提取经历的位置。':'结合项目细节设计问题，并将它们标注回原文。通常需要 1–3 分钟。'}</p><div class="loading-check">${icon('check')}简历已保存在本机</div><div class="loading-check"><span class="spinner small"></span>识别经历 · 设计问题 · 对齐原文</div><small>你可以先阅读左侧简历。</small></div>`;return;}
  if(!sec) {panel.innerHTML=`<div class="panel-empty">${icon('chat')}<span class="eyebrow">A GOOD CONVERSATION STARTS HERE</span><h3>让问题，回到经历里。</h3><p>为项目经历生成有针对性的问题、追问和评分参考，直接标在简历上。</p>${state.error?`<div class="inline-error">${esc(state.error)}</div>`:''}<label class="field-label" for="target-role">本次面试岗位 <small>可选</small></label><input id="target-role" placeholder="例如：AI 应用工程师" value="${esc(s.role)}"><button class="button primary full-width" data-action="analyze">生成面试问题 ${icon('arrow')}</button><p class="privacy-note">生成时，简历内容将发送至已配置的模型服务。</p></div>`;return;}
  state.section=sec.id;panel.dataset.section=sec.id;
  const excluded=sec.questions.filter(q=>q.excluded).length, questions=sec.questions.filter(q=>state.showExcluded?q.excluded:!q.excluded);
  panel.innerHTML=`<div class="panel-heading"><span class="eyebrow">${state.phase==='prepare'?'QUESTION NOTES':'INTERVIEW NOTES'}</span><button class="icon-button" data-action="toggle-panel" aria-label="收起问题面板">${icon('x')}</button></div><div class="panel-title"><span class="section-category">${kinds[sec.kind]||'简历经历'} · 第 ${sec.anchor.page} 页</span><h2>${esc(sec.title)}</h2><div class="source-quote">${icon('page')}<span>${esc(sec.anchor.quote || sec.title)}</span></div>${!sec.anchor.matched?'<div class="anchor-warning">按版面估算的位置，可点击「校准位置」调整。</div>':''}</div><div class="panel-tabs"><button class="${!state.showExcluded?'active':''}" data-action="show-kept">${state.phase==='prepare'?'待问问题':'面试记录'} <span>${sec.questions.length-excluded}</span></button><button class="${state.showExcluded?'active':''}" data-action="show-excluded">已排除 <span>${excluded}</span></button>${s.id!=='demo'?'<button class="relocate" data-action="move-anchor" title="点击简历中的准确位置">校准位置</button>':''}</div>${state.moveAnchor?'<div class="relocation-note">请点击左侧简历中的对应段落。<button data-action="cancel-move">取消</button></div>':''}<div class="question-list">${questions.length?questions.map((q,i)=>questionCard(q,i)).join(''):`<div class="empty-questions">${icon('check')}<h4>${state.showExcluded?'还没有排除的问题':'这段经历的问题已全部排除'}</h4><p>${state.showExcluded?'不需要的题目可以随时移到这里。':'你可以从“已排除”中恢复问题。'}</p></div>`}</div><div class="panel-footnote">${icon('info')}<span>${state.phase==='prepare'?'点击 × 排除题目，面试前随时可以恢复。':'评分与备注自动保存。未评分的问题不计入均分。'}</span></div>`;
  const list=qs('.question-list',panel);if(list)list.scrollTop=previousScroll;
  for(const id of openReferences){const detail=qs(`[data-question="${id}"] details`,panel);if(detail)detail.open=true;}
}
function questionCard(q,index) {
  const interview=state.phase==='interview', number=allQuestions().findIndex(x=>x.id===q.id)+1;
  return `<article class="question-card ${q.excluded?'excluded':''} ${q.score!==null?'has-score':''}" data-question="${q.id}"><div class="question-card-top"><span class="question-number">Q${String(number).padStart(2,'0')}</span><span class="question-type">${esc(q.type)}</span><button class="icon-button exclude-question" data-exclude="${q.id}" aria-label="${q.excluded?'恢复':'排除'}问题 Q${number}" title="${q.excluded?'恢复问题':'排除问题'}">${icon(q.excluded?'refresh':'x')}</button></div><h3>${esc(q.q)}</h3><p class="question-point">${esc(q.point)}</p><details class="reference"><summary>追问与参考要点 ${icon('down')}</summary><div class="reference-content"><label>可以继续问</label><p>${esc(q.followUp)}</p><label>留意这些证据</label><ul>${q.expected.map(e=>`<li>${esc(e)}</li>`).join('')}</ul></div></details>${interview&&!q.excluded?`<div class="score-block"><div class="score-label"><span>回答表现</span><strong>${q.score===null?'尚未评分':['','需提升','较薄弱','符合预期','表现良好','表现出色'][q.score]}</strong></div><div class="score-buttons">${[1,2,3,4,5].map(n=>`<button class="score-button ${q.score===n?'selected':''}" data-score="${n}" data-qid="${q.id}" aria-label="Q${number} 评分 ${n} 分" aria-pressed="${q.score===n}">${n}</button>`).join('')}</div><div class="score-scale"><span>需要提升</span><span>表现出色</span></div><label class="sr-only" for="note-${q.id}">Q${number} 面试备注</label><textarea id="note-${q.id}" data-note="${q.id}" placeholder="记下关键回答、观察或待验证的细节…" rows="3" maxlength="10000">${esc(q.note)}</textarea>${q.score!==null?`<button class="clear-score" data-clear-score="${q.id}">清除评分</button>`:''}</div>`:''}</article>`;
}
function renderReview() {
  const qsAll=selectedQuestions(), scored=scoredQuestions(), s=state.session, ev=s.evaluation;
  const coverage=qsAll.length?Math.round(scored.length/qsAll.length*100):0;
  qs('#workspace').innerHTML=`<section class="review-layout"><div class="review-main"><div class="review-heading"><div><span class="eyebrow">THE CONVERSATION, IN PERSPECTIVE</span><h2>让判断，有据可循。</h2><p>${esc(s.name)} <span> / </span> ${esc(s.role || '岗位待定')}${s.id==='demo'?' · 示例体验':''}</p></div><div class="review-seal">${icon('pen')}</div></div><div class="review-metrics"><div><span>已评分 / 保留问题</span><strong>${scored.length}<small> / ${qsAll.length}</small></strong></div><div><span>平均表现</span><strong>${average()}<small> / 5</small></strong></div><div><span>评分覆盖率</span><strong>${coverage}<small>%</small></strong></div></div><div class="review-note"><label for="overall-note">面试整体观察<span>补充逐题记录之外的观察</span></label><textarea id="overall-note" rows="3" maxlength="20000" placeholder="例如：沟通结构清楚；项目职责边界还需要在下一轮确认…">${esc(s.note)}</textarea></div><div class="evaluation-content" id="evaluation-content">${evaluationHTML(ev)}</div><div class="review-records"><div class="review-section-title"><h3>逐题记录</h3><button class="text-button" data-phase="interview">返回补充 ${icon('arrow')}</button></div>${qsAll.map((q,i)=>`<div class="review-record"><span class="record-index">${String(i+1).padStart(2,'0')}</span><div><h4>${esc(q.q)}</h4><p>${esc(q.note || '暂无备注')}</p></div><span class="record-score ${q.score===null?'unscored':''}">${q.score===null?'未评分':`${q.score}<small> / 5</small>`}</span></div>`).join('')||'<p class="muted-text">还没有保留的题目。</p>'}</div></div><aside class="review-aside"><div class="review-summary-card"><span class="eyebrow">INTERVIEW OVERVIEW</span><h3>本次面试概览</h3>${s.sections.map(sec=>{const scored=sec.questions.filter(q=>!q.excluded&&q.score!==null), avg=scored.length?scored.reduce((a,q)=>a+q.score,0)/scored.length:0;return `<div class="dimension"><div><span>${esc(sec.title)}</span><strong>${avg?avg.toFixed(1):'—'}</strong></div><div class="dimension-track"><span style="width:${avg/5*100}%"></span></div></div>`;}).join('')}<p>${qsAll.length-scored.length} 道题目尚未评分。<br>未评分题目不计入平均分。</p></div><div class="review-paper-note">${icon('leaf')}<h4>记录事实，留出判断的空间。</h4><p>综合评价基于评分与笔记。简历上的经历仍需面试验证，最终判断由面试官作出。</p></div><button class="button secondary full-width" data-action="export">${icon('download')}导出完整记录</button></aside></section>`;
}
function evaluationHTML(ev) {
  if(state.busy)return `<div class="evaluation-empty"><span class="spinner"></span><h3>正在整理这场对话</h3><p>将逐题评分与备注转化为有证据的综合评价…</p></div>`;
  if(!ev)return `<div class="evaluation-empty">${icon('book')}<h3>把记录，汇成完整的看法。</h3><p>${state.session.id==='demo'?'示例模式将生成一份基于当前记录的体验报告。':'根据已记录的评分和笔记，整理优势、待验证项与后续建议。'}${state.error?`<span class="inline-error">${esc(state.error)}</span>`:''}</p><button class="button primary" data-action="evaluate">生成综合评价 ${icon('arrow')}</button></div>`;
  return `<div class="evaluation-title"><h3>综合评价</h3><span>${state.session.id==='demo'?'示例记录摘要':'基于面试记录生成 · 请复核'}</span><button class="icon-button" data-action="evaluate" aria-label="重新生成评价">${icon('refresh')}</button></div><p class="evaluation-overall">${esc(ev.overall)}</p>${ev.evidence?.length?`<div class="evidence-links"><span>查看评价依据</span>${ev.evidence.map(id=>`<button data-evidence="${esc(id)}">Q${String(allQuestions().findIndex(q=>q.id===id)+1).padStart(2,'0')} ${icon('arrow')}</button>`).join('')}</div>`:''}<div class="evaluation-columns"><div><h4><span class="positive-dot"></span>已观察到的优势</h4><ul>${ev.strengths.map(x=>`<li>${esc(x)}</li>`).join('')||'<li>暂无充分证据。</li>'}</ul></div><div><h4><span class="attention-dot"></span>不足与待验证项</h4><ul>${ev.weaknesses.map(x=>`<li>${esc(x)}</li>`).join('')||'<li>暂无记录。</li>'}</ul></div></div><div class="evaluation-suggestion"><label>后续建议</label><p>${esc(ev.suggestion)}</p>${ev.nextSteps?.length?`<ul>${ev.nextSteps.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}</div>`;
}
async function changePhase(phase) {
  if(state.busy){toast('当前任务完成后即可切换阶段');return;}
  if(phase==='interview'&&!selectedQuestions().length){toast('请先生成并保留至少一道面试问题');return;}
  if(state.phase===phase)return;
  state.phase=phase;state.session.phase=phase;state.error='';state.moveAnchor=null;state.showExcluded=false;setTimer();persist({phase}).catch(()=>{});
  renderWorkflow();renderWorkspace();renderSidebar();updateTop();
}
async function openSession(id) {
  if(state.loading){toast('正在打开简历，请稍候');return;}
  if(state.busy){toast('正在处理当前简历，完成后即可切换');return;}
  if(state.saveFailed){toast('请先点击右上角重试保存，以免丢失记录');return;}
  await saveChain;
  if(tickStart){elapsed.set(state.session.id,(elapsed.get(state.session.id)||0)+Date.now()-tickStart);tickStart=null;}clearInterval(clockTimer);
  state.session=id==='demo'?(readLocal('folio-demo-v1')||structuredClone(demo)):await api('/api/sessions/'+id);
  state.phase=state.session.phase||'prepare';state.section=id==='demo'?'project-rag':state.session.sections[0]?.id;
  state.panel=state.session.sections.length?innerWidth>620:true;state.showExcluded=false;state.error='';state.lines=[];state.images=[];state.zoom=100;state.pageCount=state.session.pageCount||1;state.moveAnchor=null;pdfDocument=null;
  writeLocal('folio-current',id);setTimer();render();
  const job=readLocal('folio-job-'+id);if(job){state.busy=true;renderPanel();updateTop();pollJob(job,id).catch(handleTaskError);}
}
function uploadModal() {
  if(state.busy||state.loading){toast('请等待当前简历处理完成');return;}
  qs('#modal-root').innerHTML=`<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="upload-title"><button class="icon-button modal-close" data-action="close-modal" aria-label="关闭上传窗口">${icon('x')}</button><span class="eyebrow">A NEW CONVERSATION</span><h2 id="upload-title">下一场好面试，<br>从这里开始。</h2><p>上传简历，让问题直接出现在经历旁边。</p><button class="upload-drop" id="upload-drop" data-action="choose-file">${icon('upload')}<strong>点击选择，或将简历拖到这里</strong><span>PDF、Word、TXT 或图片 · 最大 20 MB</span></button><div class="upload-note">${icon('info')}<span>PDF 保留原始排版；Word 提取文本重新排版。上传后可预览简历，再生成问题。</span></div></section></div>`;
  qs('[data-action="choose-file"]').focus();
}
function closeModal(){qs('#modal-root').innerHTML='';qs('[data-action="upload"]')?.focus();}
async function uploadFile(file) {
  if(!file)return;
  if(file.size>20*1024*1024){toast('请选择 20 MB 以内的文件');return;}
  if(!/\.(pdf|docx|txt|png|jpe?g)$/i.test(file.name)){toast('请选择 PDF、Word、TXT 或图片文件');return;}
  if(state.saveFailed){toast('请先保存当前面试记录');return;}
  try {await saveChain;closeModal();state.loading=true;renderPanel();updateTop();const response=await fetch('/api/upload?name='+encodeURIComponent(file.name),{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:file});const session=await response.json();if(!response.ok)throw new Error(session.error);state.sessions=await api('/api/sessions');state.loading=false;await openSession(session.id);toast('简历已上传，预览后即可生成问题');} catch(e){state.loading=false;renderPanel();updateTop();toast(e.message);}
}
async function analyze() {
  if(state.busy)return;
  if(!state.lines.length&&!state.images.length){toast('请等待简历加载完成，或重新上传可读取的文件');return;}
  const role=qs('#target-role')?.value||state.session.role;
  state.busy=true;state.error='';renderPanel();updateTop();
  try {const job=await api(`/api/sessions/${state.session.id}/analyze`,{method:'POST',body:JSON.stringify({role,lines:state.lines,images:state.images,pageCount:state.pageCount})});writeLocal('folio-job-'+state.session.id,job.id);await pollJob(job.id,state.session.id);}catch(e){handleTaskError(e);}
}
async function pollJob(jobId,sid) {
  for(;;) {
    const job=await api('/api/jobs/'+jobId);
    if(job.state==='error'){localStorage.removeItem('folio-job-'+sid);throw new Error(job.error);}
    if(job.state==='done') {
      localStorage.removeItem('folio-job-'+sid);await saveChain;state.session=await api('/api/sessions/'+sid);state.sessions=await api('/api/sessions');state.busy=false;state.section=state.session.sections[0]?.id;
      if(state.phase==='review')renderReview();else{renderPanel();paintMarkers();}
      const name=qs('.breadcrumbs strong');if(name)name.textContent=state.session.name;
      renderSidebar();updateStats();toast(job.type==='analyze'?'问题已标注在对应经历旁':'综合评价已生成，请复核');return;
    }
    await new Promise(resolve=>setTimeout(resolve,1800));
  }
}
function handleTaskError(e) {state.busy=false;state.error=e.message;if(e.message.includes('服务已重启'))localStorage.removeItem('folio-job-'+state.session.id);if(state.phase==='review')renderReview();else renderPanel();updateTop();toast(e.message);}
async function evaluate() {
  if(state.busy)return;
  if(!selectedQuestions().some(q=>q.score!==null||q.note.trim())&&!state.session.note.trim()){toast('先为回答打分，或写下至少一条面试观察');return;}
  await saveChain;if(state.saveFailed){toast('请先重试保存面试记录');return;}
  state.error='';
  if(state.session.id==='demo') {
    const scored=scoredQuestions(),notes=selectedQuestions().filter(q=>q.note.trim());
    state.session.evaluation={overall:`这是一份示例模式的记录摘要，不是模型评价。本次保留 ${selectedQuestions().length} 道问题，已评分 ${scored.length} 道，${scored.length?'平均 '+average()+' / 5 分。':'尚无可计算的均分。'}有 ${notes.length} 道问题附有面试备注。`,strengths:scored.filter(q=>q.score>=4).map(q=>`「${q.q}」获评 ${q.score}/5 分${q.note?'；记录：'+q.note:'，具体表现尚需补充备注。'}`),weaknesses:[...scored.filter(q=>q.score<=2).map(q=>`「${q.q}」获评 ${q.score}/5 分，建议进一步核实。`),`还有 ${selectedQuestions().length-scored.length} 道问题未评分，相关能力尚未验证。`],suggestion:'请结合具体回答复核评分，并在下一轮补充尚未验证的经历。上传真实简历后可使用已配置的模型生成综合评价。',nextSteps:[],evidence:[],generatedAt:new Date().toISOString()};persist({}).catch(()=>{});renderReview();return;
  }
  state.busy=true;renderReview();updateTop();
  try{const job=await api(`/api/sessions/${state.session.id}/evaluate`,{method:'POST',body:'{}'});writeLocal('folio-job-'+state.session.id,job.id);await pollJob(job.id,state.session.id);}catch(e){handleTaskError(e);}
}
function exportRecord() {
  const s=state.session,ev=s.evaluation;
  const output=[`# ${s.name} · 面试记录`, `岗位：${s.role||'未指定'}\n导出时间：${new Date().toLocaleString('zh-CN')}\n${s.id==='demo'?'虚构示例数据\n':''}已评分：${scoredQuestions().length}/${selectedQuestions().length}\n平均分：${average()}/5`, `## 整体观察\n${s.note||'暂无'}`,ev?`## 综合评价\n${ev.overall}\n\n### 优势\n${ev.strengths.map(x=>'- '+x).join('\n')}\n\n### 不足与待验证\n${ev.weaknesses.map(x=>'- '+x).join('\n')}\n\n### 后续建议\n${ev.suggestion}\n${(ev.nextSteps||[]).map(x=>'- '+x).join('\n')}`:'## 综合评价\n尚未生成',...s.sections.map(sec=>`## ${sec.title}\n原文：${sec.anchor.quote}\n\n`+sec.questions.map(q=>`### ${q.excluded?'[已排除] ':''}${q.q}\n评分：${q.score===null?'未评分':q.score+'/5'}\n备注：${q.note||'暂无'}\n考察点：${q.point}\n追问：${q.followUp}\n参考要点：\n${q.expected.map(x=>'- '+x).join('\n')}`).join('\n\n'))].join('\n\n');
  const url=URL.createObjectURL(new Blob(['\uFEFF'+output],{type:'text/markdown;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`${s.name.replace(/[<>:"/\\|?*]/g,'_')}_面试记录.md`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('完整面试记录已导出');
}
function helpModal(){qs('#modal-root').innerHTML=`<div class="modal-backdrop"><section class="modal help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title"><button class="icon-button modal-close" data-action="close-modal" aria-label="关闭说明">${icon('x')}</button><span class="eyebrow">A LITTLE GUIDE</span><h2 id="help-title">在经历旁，把问题问深。</h2><ol><li><strong>上传与解析</strong><p>选择简历并预览，再生成问题。PDF 保留原版；Word 和 TXT 以文字预览。</p></li><li><strong>在原文上筛题</strong><p>点击数字标记展开问题，× 排除不需要的题，可随时恢复。</p></li><li><strong>一边问，一边记</strong><p>进入面试模式，逐题给出 1–5 分并记录事实，数据自动保存。</p></li><li><strong>形成综合评价</strong><p>根据记录生成评价、查看覆盖率，并导出完整 Markdown 记录。</p></li></ol><p class="privacy-note">个人本机工作台。生成问题时，简历内容会发送给 config.json 中配置的模型服务。未匹配的定位可手动校准。</p></section></div>`;qs('.modal-close').focus();}

document.addEventListener('click',async e=>{
  const button=e.target.closest('button');
  if(state.moveAnchor && e.target.closest('.paper')&&!button) {
    const page=e.target.closest('.paper'),rect=page.getBoundingClientRect(),sec=state.session.sections.find(s=>s.id===state.moveAnchor);sec.anchor={...sec.anchor,page:Number(page.dataset.page),y:Math.max(0,Math.min(1,(e.clientY-rect.top)/rect.height)),matched:true,manual:true};state.moveAnchor=null;persist({anchor:{id:sec.id,page:sec.anchor.page,y:sec.anchor.y}}).catch(()=>{});renderPanel();paintMarkers();return;
  }
  if(!button)return;
  if(button.dataset.session){openSession(button.dataset.session).catch(e=>toast(e.message));qs('#sidebar')?.classList.remove('mobile-open');return;}
  if(button.dataset.phase){changePhase(button.dataset.phase);return;}
  if(button.dataset.evidence){const section=state.session.sections.find(s=>s.questions.some(q=>q.id===button.dataset.evidence));if(section){await changePhase('interview');focusSection(section.id);const card=qs(`[data-question="${button.dataset.evidence}"]`);if(card)qs('.question-list').scrollTop=card.offsetTop-qs('.question-list').offsetTop;}return;}
  if(button.dataset.sectionNav){if(state.phase==='review')await changePhase('interview');focusSection(button.dataset.sectionNav);qs('#sidebar')?.classList.remove('mobile-open');return;}
  if(button.dataset.pin){if(state.section===button.dataset.pin&&state.panel){state.panel=false;qs('.workspace-grid').classList.add('panel-hidden');paintMarkers();}else focusSection(button.dataset.pin,false);return;}
  if(button.dataset.exclude){const q=allQuestions().find(q=>q.id===button.dataset.exclude);q.excluded=!q.excluded;saveQuestion(q);renderPanel();paintMarkers();renderSidebar();updateStats();toast(q.excluded?'已排除，可在“已排除”中恢复':'问题已恢复');return;}
  if(button.dataset.score){const q=allQuestions().find(q=>q.id===button.dataset.qid);q.score=Number(button.dataset.score);saveQuestion(q);renderPanel();paintMarkers();updateStats();return;}
  if(button.dataset.clearScore){const q=allQuestions().find(q=>q.id===button.dataset.clearScore);q.score=null;saveQuestion(q);renderPanel();paintMarkers();updateStats();return;}
  switch(button.dataset.action){
    case 'upload':uploadModal();break;case 'close-modal':closeModal();break;case 'choose-file':qs('#file-input').click();break;
    case 'next':if(state.phase==='prepare')changePhase('interview');else if(state.phase==='interview')changePhase('review');else exportRecord();break;
    case 'toggle-panel':state.panel=!state.panel;qs('.workspace-grid')?.classList.toggle('panel-hidden',!state.panel);paintMarkers();break;
    case 'show-kept':state.showExcluded=false;renderPanel();break;case 'show-excluded':state.showExcluded=true;renderPanel();break;
    case 'zoom-in':state.zoom=Math.min(150,state.zoom+10);setZoom();break;case 'zoom-out':state.zoom=Math.max(60,state.zoom-10);setZoom();break;case 'zoom-reset':state.zoom=100;setZoom();break;
    case 'analyze':analyze();break;case 'evaluate':evaluate();break;case 'export':exportRecord();break;
    case 'move-anchor':state.moveAnchor=state.section;renderPanel();toast('请点击简历中的对应段落');break;case 'cancel-move':state.moveAnchor=null;renderPanel();break;
    case 'retry-preview':renderPaper();break;case 'retry-save':if(state.saveFailed)retrySave();else toast('记录已自动保存在本机');break;
    case 'help':helpModal();break;case 'menu':qs('#sidebar').classList.toggle('mobile-open');break;case 'workspace':changePhase('prepare');break;
  }
});
document.addEventListener('input',e=>{
  if(e.target.dataset.note){const q=allQuestions().find(q=>q.id===e.target.dataset.note);q.note=e.target.value;saveQuestion(q);}
  if(e.target.id==='overall-note'){state.session.note=e.target.value;state.session.evaluation=null;persist({note:e.target.value}).catch(()=>{});qs('#evaluation-content').innerHTML=evaluationHTML(null);}
});
qs('#file-input').addEventListener('change',e=>{uploadFile(e.target.files[0]);e.target.value='';});
document.addEventListener('dragover',e=>{if(e.target.closest('#upload-drop')){e.preventDefault();qs('#upload-drop').classList.add('dragover');}});
document.addEventListener('dragleave',e=>{if(e.target.closest('#upload-drop'))qs('#upload-drop').classList.remove('dragover');});
document.addEventListener('drop',e=>{if(e.target.closest('#upload-drop')){e.preventDefault();uploadFile(e.dataTransfer.files[0]);}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(qs('.modal'))closeModal();else{state.moveAnchor=null;state.panel=false;qs('.workspace-grid')?.classList.add('panel-hidden');paintMarkers();}}if(e.key==='Tab'&&qs('.modal')){const nodes=[...qs('.modal').querySelectorAll('button,input,textarea,a[href]')],first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
window.addEventListener('beforeunload',e=>{if(state.pendingSaves||state.saveFailed){e.preventDefault();e.returnValue='';}});
new ResizeObserver(()=>paintMarkers()).observe(document.body);

async function init(){try{const [sessions,status]=await Promise.all([api('/api/sessions'),api('/api/status')]);state.sessions=sessions;state.configured=status.configured;const current=readLocal('folio-current');await openSession(current==='demo'||sessions.some(s=>s.id===current)?current:sessions[0]?.id||'demo');}catch(e){state.session=structuredClone(demo);render();toast('服务暂时无法连接：'+e.message);}}
init();
