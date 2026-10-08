const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { ANALYZE, EVALUATE } = require('./prompts');
const seed = require('./bank-seed');

const id = () => crypto.randomUUID();
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const clip = (value, max = 2000) => typeof value === 'string' ? value.slice(0, max) : '';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webp': 'image/webp', '.woff': 'font/woff', '.woff2': 'font/woff2', '.map': 'application/json', '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.txt': 'text/plain; charset=utf-8', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };

async function body(req, limit = 25 * 1024 * 1024) {
  let size = 0; const chunks = [];
  for await (const chunk of req) { size += chunk.length; if (size > limit) throw fail('文件过大，请使用 20 MB 以内的简历', 413); chunks.push(chunk); }
  return Buffer.concat(chunks);
}
async function json(req) { try { return JSON.parse((await body(req)).toString()); } catch (e) { if (e.status) throw e; throw fail('请求格式不正确'); } }
function parseResult(content) {
  if (typeof content === 'object' && content) return content;
  try { return JSON.parse(content); } catch {}
  try { return JSON.parse(String(content).match(/\{[\s\S]*\}/)?.[0]); } catch { throw fail('模型返回的格式不完整，请重试', 502); }
}
function normalizeAnalysis(result, lines, pages) {
  if (!Array.isArray(result.sections) || !result.sections.length) throw fail('没有识别到可出题的简历内容，请换用清晰的 PDF 或 Word 文件', 422);
  const normalized = s => String(s || '').replace(/\s+/g, '').toLowerCase();
  const sections = result.sections.slice(0, 12).map(s => {
    const a = s.anchor || {};
    const quote = normalized(a.quote);
    const line = lines.find(l => l.id === a.lineId) || (quote.length > 2 ? lines.find(l => normalized(l.text).includes(quote) || (normalized(l.text).length > 3 && quote.includes(normalized(l.text)))) : null);
    const page = Math.max(1, Math.min(pages, Number(a.page) || 1));
    const anchor = line ? { lineId: line.id, page: line.page, y: line.y, x: line.x || 0.1, quote: line.text, matched: true } : { page, y: Math.max(0.03, Math.min(0.94, Number(a.y) || 0.2)), x: 0.1, quote: clip(a.quote), matched: false };
    return { id: id(), title: clip(s.title, 100) || '简历经历', kind: ['project', 'experience', 'skills', 'education'].includes(s.kind) ? s.kind : 'experience', anchor,
      questions: (Array.isArray(s.questions) ? s.questions : []).filter(q => typeof q.q === 'string' && q.q.trim()).slice(0, 4).map(q => ({ id: id(), type: clip(q.type, 30) || '经历深挖', q: clip(q.q), point: clip(q.point), followUp: clip(q.followUp), expected: (Array.isArray(q.expected) ? q.expected : [q.expected]).filter(x => typeof x === 'string').map(x => clip(x)), excluded: false, score: null, note: '' })) };
  }).filter(s => s.questions.length);
  if (!sections.length) throw fail('模型未生成有效题目，请重试', 422);
  return { name: clip(result.name, 80), role: clip(result.role, 100), summary: clip(result.summary), sections };
}

function createApp(options = {}) {
  const root = __dirname, dir = options.dataDir || path.join(root, 'data');
  fs.mkdirSync(dir, { recursive: true });
  const distDir = path.resolve(root, '..', 'dist');
  const jobs = new Map();
  const bankFile = path.join(dir, '_bank.json'), PART_ORDER = ['A', 'B', 'E', 'F', 'C', 'D'];
  function saveBank(bank) { fs.writeFileSync(bankFile + '.tmp', JSON.stringify(bank)); fs.renameSync(bankFile + '.tmp', bankFile); }
  function loadBank() {
    if (!fs.existsSync(bankFile)) {
      const bank = { parts: seed.parts, questions: seed.questions.map(q => ({ ...q, custom: false, updatedAt: new Date().toISOString() })) };
      saveBank(bank); return bank;
    }
    try { return JSON.parse(fs.readFileSync(bankFile, 'utf8')); } catch { throw fail('题库数据损坏，请检查 data/_bank.json', 500); }
  }
  function bankPart(bank, key) { return bank.parts[key] ? { part: key, partName: bank.parts[key].name } : { part: 'CUST', partName: '自定义' }; }
  function get(sid) { if (!/^[\w-]+$/.test(sid) || sid.startsWith('_')) throw fail('无效编号'); const file = path.join(dir, sid + '.json'); if (!fs.existsSync(file)) throw fail('简历不存在', 404); return JSON.parse(fs.readFileSync(file, 'utf8')); }
  function save(s) { s.updatedAt = new Date().toISOString(); const dest = path.join(dir, s.id + '.json'); fs.writeFileSync(dest + '.tmp', JSON.stringify(s)); fs.renameSync(dest + '.tmp', dest); return s; }
  function config() { try { return JSON.parse(fs.readFileSync(path.join(root, 'config.json'), 'utf8')); } catch { return {}; } }
  async function llm(messages) {
    if (options.llm) return parseResult(await options.llm(messages));
    const cfg = config();
    if (!cfg.baseUrl || !cfg.model || !cfg.apiKey) throw fail('请先在 server/config.json 中配置大模型接口', 503);
    let response;
    try { response = await fetch(cfg.baseUrl.replace(/\/+$/, '') + '/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cfg.apiKey }, body: JSON.stringify({ model: cfg.model, messages, response_format: { type: 'json_object' }, max_tokens: 12000, temperature: 0.3 }), signal: AbortSignal.timeout(240000) }); }
    catch (e) { throw fail(e.name === 'TimeoutError' ? '模型响应超时，请稍后重试' : '无法连接模型服务，请检查配置和网络', 502); }
    if (!response.ok) throw fail('模型服务返回错误（' + response.status + '），请稍后重试', 502);
    const data = await response.json();
    return parseResult(data.choices?.[0]?.message?.content);
  }
  function send(res, code, data) { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); }
  const server = http.createServer(async (req, res) => {
    try {
      if (req.headers.origin) {
        let originHost = '';
        try { originHost = new URL(req.headers.origin).hostname; } catch {}
        if (req.headers.origin !== `http://${req.headers.host}` && !['localhost', '127.0.0.1'].includes(originHost)) throw fail('不允许跨来源请求', 403);
      }
      const url = new URL(req.url, 'http://localhost'), p = decodeURIComponent(url.pathname), method = req.method;
      if (p === '/api/status') return send(res, 200, { configured: !!(config().apiKey && config().model && config().baseUrl) });
      if (p === '/api/bank' && method === 'GET') {
        const bank = loadBank();
        const parts = PART_ORDER.filter(k => bank.parts[k]).map(k => ({ key: k, name: bank.parts[k].name, weight: bank.parts[k].weight }));
        if (bank.questions.some(q => q.custom)) parts.push({ key: 'CUST', name: '自定义', weight: 0 });
        return send(res, 200, { parts, questions: bank.questions });
      }
      if (p === '/api/bank' && method === 'POST') {
        const bank = loadBank(), b = await json(req);
        const title = clip(b.title, 100), q = clip(b.q);
        if (!title.trim() || !q.trim()) throw fail('标题和题干不能为空');
        const question = { id: 'U-' + crypto.randomBytes(4).toString('hex'), ...bankPart(bank, b.part), title, q, answer: clip(b.answer, 6000), custom: true, updatedAt: new Date().toISOString() };
        if (typeof b.material === 'string' && b.material.trim()) question.material = clip(b.material, 6000);
        bank.questions.push(question); saveBank(bank);
        return send(res, 201, question);
      }
      const bm = p.match(/^\/api\/bank\/([\w-]+)$/);
      if (bm && method === 'PATCH') {
        const bank = loadBank(), b = await json(req);
        const question = bank.questions.find(q => q.id === bm[1]);
        if (!question) throw fail('题目不存在', 404);
        if ('title' in b) { const title = clip(b.title, 100); if (!title.trim()) throw fail('标题和题干不能为空'); question.title = title; }
        if ('q' in b) { const q = clip(b.q); if (!q.trim()) throw fail('标题和题干不能为空'); question.q = q; }
        if ('part' in b) Object.assign(question, bankPart(bank, b.part));
        if (typeof b.answer === 'string') question.answer = clip(b.answer, 6000);
        if (typeof b.material === 'string') question.material = clip(b.material, 6000); else if (b.material === null) delete question.material;
        question.updatedAt = new Date().toISOString(); saveBank(bank);
        return send(res, 200, question);
      }
      if (bm && method === 'DELETE') {
        const bank = loadBank(), index = bank.questions.findIndex(q => q.id === bm[1]);
        if (index === -1) throw fail('题目不存在', 404);
        bank.questions.splice(index, 1); saveBank(bank);
        res.writeHead(204, { 'Cache-Control': 'no-store' }); return res.end();
      }
      if (p === '/api/sessions' && method === 'GET') return send(res, 200, fs.readdirSync(dir).filter(x => x.endsWith('.json') && !x.startsWith('_')).map(x => JSON.parse(fs.readFileSync(path.join(dir, x), 'utf8'))).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(({ sections, lines, text, evaluation, ...s }) => { const questions = (sections || []).flatMap(x => x.questions).filter(q => !q.excluded); const scored = questions.filter(q => q.score !== null); return { ...s, questionCount: questions.length, scoredCount: scored.length, avgScore: scored.length ? Math.round(scored.reduce((a, q) => a + q.score, 0) / scored.length * 10) / 10 : null, hasEvaluation: !!evaluation, suggestion: evaluation ? clip(evaluation.suggestion, 200) : '' }; }));
      if (p === '/api/upload' && method === 'POST') {
        const name = clip(url.searchParams.get('name'), 200), ext = path.extname(name).toLowerCase();
        if (!['.pdf', '.docx', '.txt', '.png', '.jpg', '.jpeg'].includes(ext)) throw fail('支持 PDF、DOCX、TXT、PNG 和 JPG 格式');
        const file = await body(req, 20 * 1024 * 1024);
        if (!file.length) throw fail('文件为空');
        if (ext === '.pdf' && file.subarray(0, 5).toString() !== '%PDF-') throw fail('不是有效的 PDF 文件');
        if (ext === '.png' && file.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw fail('不是有效的 PNG 文件');
        if (['.jpg', '.jpeg'].includes(ext) && file.subarray(0, 3).toString('hex') !== 'ffd8ff') throw fail('不是有效的 JPG 文件');
        let text = '';
        if (ext === '.txt') text = file.toString('utf8').slice(0, 60000);
        if (ext === '.docx') { try { text = (await require('mammoth').extractRawText({ buffer: file })).value.slice(0, 60000); } catch { throw fail('Word 文件无法解析，请导出为 PDF 后上传'); } }
        const sid = id(), storedExt = ext === '.jpeg' ? '.jpg' : ext;
        fs.writeFileSync(path.join(dir, sid + storedExt), file);
        return send(res, 201, save({ id: sid, fileName: name, file: sid + storedExt, name: name.replace(/\.[^.]+$/, ''), role: '', summary: '', text, sections: [], lines: [], pageCount: 1, phase: 'prepare', note: '', evaluation: null, createdAt: new Date().toISOString() }));
      }
      const jm = p.match(/^\/api\/jobs\/([\w-]+)$/);
      if (jm && method === 'GET') { const job = jobs.get(jm[1]); if (!job) throw fail('任务已结束或服务已重启，请重试', 404); return send(res, 200, job); }
      const sm = p.match(/^\/api\/sessions\/([\w-]+)(?:\/(analyze|evaluate))?$/);
      if (sm) {
        let s = get(sm[1]);
        if (!sm[2] && method === 'GET') return send(res, 200, s);
        if (!sm[2] && method === 'DELETE') {
          fs.unlinkSync(path.join(dir, s.id + '.json'));
          if (s.file) { const stored = path.join(dir, path.basename(s.file)); if (fs.existsSync(stored)) fs.unlinkSync(stored); }
          res.writeHead(204, { 'Cache-Control': 'no-store' }); return res.end();
        }
        if (!sm[2] && method === 'PATCH') {
          const b = await json(req);
          if (typeof b.note === 'string') s.note = b.note.slice(0, 20000);
          if (['prepare', 'interview', 'review'].includes(b.phase)) s.phase = b.phase;
          if (b.question) {
            const q = s.sections.flatMap(x => x.questions).find(q => q.id === b.question.id);
            if (!q) throw fail('题目不存在', 404);
            if ('score' in b.question) { const v = b.question.score; if (v !== null && (!Number.isInteger(v) || v < 1 || v > 5)) throw fail('评分应在 1–5 分之间'); q.score = v; }
            if (typeof b.question.note === 'string') q.note = b.question.note.slice(0, 10000);
            if (typeof b.question.excluded === 'boolean') q.excluded = b.question.excluded;
            if (typeof b.question.q === 'string') q.q = clip(b.question.q);
            if (typeof b.question.point === 'string') q.point = clip(b.question.point, 200);
            if (typeof b.question.followUp === 'string') q.followUp = clip(b.question.followUp, 500);
            if (typeof b.question.type === 'string') q.type = clip(b.question.type, 50);
            if (Array.isArray(b.question.expected)) q.expected = b.question.expected.filter(x => typeof x === 'string').slice(0, 6).map(x => clip(x, 300));
          }
          if (b.anchor) {
            const section = s.sections.find(x => x.id === b.anchor.id);
            if (!section || !Number.isInteger(b.anchor.page) || b.anchor.page < 1 || b.anchor.page > s.pageCount || !Number.isFinite(b.anchor.y) || b.anchor.y < 0 || b.anchor.y > 1) throw fail('定位无效');
            section.anchor = { ...section.anchor, page: b.anchor.page, y: b.anchor.y, matched: true, manual: true };
          }
          if (b.addQuestion) {
            const nq = b.addQuestion.question || {};
            if (typeof nq.q !== 'string' || !nq.q.trim()) throw fail('问题内容不能为空');
            const question = { id: id(), type: clip(nq.type, 50) || '补充提问', q: clip(nq.q), point: clip(nq.point, 200), followUp: clip(nq.followUp, 500), expected: (Array.isArray(nq.expected) ? nq.expected : []).filter(x => typeof x === 'string').slice(0, 6).map(x => clip(x, 300)), excluded: false, score: null, note: '' };
            let section = s.sections.find(x => x.id === b.addQuestion.sectionId);
            if (!section) { section = { id: id(), title: clip(b.addQuestion.sectionTitle, 100) || '补充问题', kind: 'custom', anchor: null, questions: [] }; s.sections.push(section); }
            section.questions.push(question);
          }
          if (b.removeQuestion) {
            const index = s.sections.findIndex(x => x.questions.some(q => q.id === b.removeQuestion.id));
            if (index === -1) throw fail('题目不存在', 404);
            s.sections[index].questions = s.sections[index].questions.filter(q => q.id !== b.removeQuestion.id);
            if (!s.sections[index].questions.length) s.sections.splice(index, 1);
          }
          if (b.question || 'note' in b || b.addQuestion || b.removeQuestion) s.evaluation = null;
          return send(res, 200, save(s));
        }
        if (sm[2] && method === 'POST') {
          const b = await json(req);
          if (sm[2] === 'evaluate' && s.evaluation && !b.force) throw fail('已生成综合评价，如需覆盖请确认重新生成', 409);
          const existing = [...jobs.values()].find(j => j.sessionId === s.id && j.state === 'running');
          if (existing) return send(res, 202, existing);
          if (sm[2] === 'analyze' && s.sections.length) throw fail('该简历已生成题目。请重新上传以建立新的面试记录', 409);
          const lines = (Array.isArray(b.lines) ? b.lines : []).slice(0, 2000).map(l => ({ id: clip(l.id, 40), text: clip(l.text, 1500), page: Math.max(1, Math.min(20, Number(l.page) || 1)), y: Math.max(0, Math.min(1, Number(l.y) || 0)), x: Math.max(0, Math.min(1, Number(l.x) || 0)) }));
          const pages = Math.max(1, Math.min(20, Math.floor(Number(b.pageCount) || 1)));
          const images = (Array.isArray(b.images) ? b.images : []).filter(x => typeof x === 'string' && /^data:image\/(jpeg|png);base64,/.test(x)).slice(0, 20);
          const records = s.sections.flatMap(sec => sec.questions.filter(q => !q.excluded).map(q => ({ ...q, section: sec.title })));
          if (sm[2] === 'analyze' && !lines.length && !images.length) throw fail('简历内容尚未加载，请稍后重试');
          if (sm[2] === 'evaluate' && !records.some(q => q.score !== null || q.note.trim()) && !s.note.trim()) throw fail('请先记录评分或面试观察，再生成综合评价');
          const job = { id: id(), sessionId: s.id, type: sm[2], state: 'running', startedAt: new Date().toISOString() }; jobs.set(job.id, job);
          send(res, 202, job);
          (async () => {
            try {
              if (job.type === 'analyze') {
                const content = [{ type: 'text', text: `目标岗位：${clip(b.role, 100) || '按简历求职方向'}\n页数：${pages}\n以下为带定位的原文行：\n` + lines.map(l => `[${l.id} 页${l.page} y=${l.y.toFixed(3)}] ${l.text}`).join('\n') }, ...images.map(image => ({ type: 'image_url', image_url: { url: image } }))];
                const result = normalizeAnalysis(await llm([{ role: 'system', content: ANALYZE }, { role: 'user', content }]), lines, pages);
                s = get(s.id); Object.assign(s, result, { name: result.name || s.name, role: clip(b.role, 100) || result.role, lines, pageCount: pages }); save(s);
              } else {
                const snapshot = JSON.stringify({ records, note: s.note });
                const questionLabels = new Map(s.sections.flatMap(sec => sec.questions).map((q, i) => [q.id, 'Q' + String(i + 1).padStart(2, '0')]));
                const evaluation = await llm([{ role: 'system', content: EVALUATE }, { role: 'user', content: JSON.stringify({ name: s.name, role: s.role, totalQuestions: records.length, scoredCount: records.filter(q => q.score !== null).length, records: records.filter(q => q.score !== null || q.note.trim()).map(q => ({ ...q, id: questionLabels.get(q.id) })), note: s.note }) }]);
                if (!evaluation || typeof evaluation.overall !== 'string' || !evaluation.overall.trim() || typeof evaluation.suggestion !== 'string' || !Array.isArray(evaluation.strengths) || !Array.isArray(evaluation.weaknesses)) throw fail('评价内容不完整，请重试', 502);
                s = get(s.id);
                const current = s.sections.flatMap(sec => sec.questions.filter(q => !q.excluded).map(q => ({ ...q, section: sec.title })));
                if (JSON.stringify({ records: current, note: s.note }) !== snapshot) throw fail('生成期间记录有更新，请根据最新记录重新生成', 409);
                s.evaluation = { overall: clip(evaluation.overall, 6000), suggestion: clip(evaluation.suggestion, 6000), strengths: evaluation.strengths.map(x => clip(x)).filter(Boolean), weaknesses: evaluation.weaknesses.map(x => clip(x)).filter(Boolean), nextSteps: (Array.isArray(evaluation.nextSteps) ? evaluation.nextSteps : []).map(x => clip(x)).filter(Boolean), evidence: [...new Set((Array.isArray(evaluation.evidence) ? evaluation.evidence : []).map(x => records.find(q => q.id === x || questionLabels.get(q.id) === x)?.id).filter(Boolean))], generatedAt: new Date().toISOString() }; save(s);
              }
              job.state = 'done';
            } catch (e) { job.state = 'error'; job.error = e.message; }
            setTimeout(() => jobs.delete(job.id), 30 * 60 * 1000).unref();
          })(); return;
        }
      }
      if (method !== 'GET') throw fail('接口不存在', 404);
      let file;
      if (p.startsWith('/files/')) {
        const name = p.slice(7); if (!/^[\w-]+\.(pdf|docx|txt|png|jpg)$/.test(name)) throw fail('文件不存在', 404);
        file = path.join(dir, name);
      } else {
        file = path.resolve(distDir, '.' + (p === '/' ? '/index.html' : p));
        if (!file.startsWith(distDir + path.sep)) throw fail('文件不存在', 404);
      }
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw fail('文件不存在', 404);
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-cache' }); fs.createReadStream(file).pipe(res);
    } catch (e) { if (!res.headersSent) send(res, e.status || 500, { error: e.status ? e.message : '服务处理失败，请重试' }); else res.end(); }
  });
  return server;
}
if (require.main === module) { const port = Number(process.env.PORT) || 3220; createApp().listen(port, '127.0.0.1', () => console.log(`FaceTry 已启动：http://localhost:${port}`)); }
module.exports = { createApp, normalizeAnalysis };
