const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { ANALYZE, EVALUATE, BANKGEN } = require('./prompts');
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
  // —— 通用 JSON 数据文件：用户目录 / 授权 / 岗位 / 组织架构缓存 / 元信息 ——
  const dataFile = name => path.join(dir, name);
  function loadJSON(file, fallback) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } }
  function saveJSON(file, obj) { fs.writeFileSync(file + '.tmp', JSON.stringify(obj)); fs.renameSync(file + '.tmp', file); }
  const usersFile = dataFile('_users.json'), grantsFile = dataFile('_grants.json'), jdsFile = dataFile('_jds.json'), orgFile = dataFile('_org.json'), metaFile = dataFile('_meta.json');
  const loadUsers = () => loadJSON(usersFile, {});
  const loadGrants = () => loadJSON(grantsFile, {});
  const loadJds = () => loadJSON(jdsFile, { jds: [] });
  const loadOrg = () => loadJSON(orgFile, { depts: {}, fetchedAt: '' });
  const loadMeta = () => loadJSON(metaFile, { admins: [] });
  const bankFile = path.join(dir, '_bank.json'), PART_ORDER = ['A', 'B', 'E', 'F', 'C', 'D'];
  function saveBank(bank) { fs.writeFileSync(bankFile + '.tmp', JSON.stringify(bank)); fs.renameSync(bankFile + '.tmp', bankFile); }
  function loadBank() {
    let bank;
    if (!fs.existsSync(bankFile)) {
      // 初始为空：各组首次访问时由 ensureSeeds 生成自己的基础题副本
      bank = { parts: seed.parts, questions: [], seededGroups: [] };
    } else {
      try { bank = JSON.parse(fs.readFileSync(bankFile, 'utf8')); } catch { throw fail('题库数据损坏，请检查 data/_bank.json', 500); }
    }
    // 迁移：老题库题目没有 groupId，视为全局共享
    let dirty = false;
    for (const q of bank.questions) if (q.groupId === undefined) { q.groupId = 'GLOBAL'; dirty = true; }
    if (dirty || !fs.existsSync(bankFile)) saveBank(bank);
    return bank;
  }
  /** 每个最小用户组首次访问时生成组内共享的种子基础题副本；未识别组织的用户不发副本（识别后自动继承组内题库） */
  function ensureSeeds(bank, user) {
    if (!Array.isArray(bank.seededGroups)) bank.seededGroups = [];
    const group = primaryGroup(user.id);
    if (!group) return false;
    const scopeId = group.id;
    if (bank.seededGroups.includes(scopeId)) return false;
    const suffix = '-' + crypto.createHash('sha1').update(scopeId).digest('hex').slice(0, 6);
    for (const sq of seed.questions) {
      bank.questions.push({ ...sq, id: sq.id + suffix, custom: false, seed: true, groupId: scopeId, groupName: group.name, updatedAt: new Date().toISOString() });
    }
    bank.seededGroups.push(scopeId);
    return true;
  }
  function bankPart(bank, key) { return bank.parts[key] ? { part: key, partName: bank.parts[key].name } : { part: 'CUST', partName: '自定义' }; }
  /** 解析分类：已有 key / 已有名称 → 复用；否则按名称新建自定义分类（按组隔离） */
  function resolvePart(bank, input, scopeId = '') {
    if (input === 'CUST' || input === '自定义' || !input) return { part: 'CUST', partName: '自定义' };
    const visible = k => bank.parts[k] && (!bank.parts[k].groupId || bank.parts[k].groupId === scopeId);
    if (visible(input)) return { part: input, partName: bank.parts[input].name };
    const name = clip(String(input), 20).trim();
    if (!name) return { part: 'CUST', partName: '自定义' };
    const byName = Object.entries(bank.parts).find(([k, p]) => visible(k) && p.name === name);
    if (byName) return { part: byName[0], partName: byName[1].name };
    const key = 'X' + crypto.randomBytes(3).toString('hex');
    bank.parts[key] = { name, weight: 0, custom: true, ...(scopeId ? { groupId: scopeId } : {}) };
    return { part: key, partName: name };
  }
  // —— 组织架构与可见性：最小用户组内共享 JD 与题库；管理员可单独授权某用户查看某组织子树 ——
  function userGroups(userId) { return loadUsers()[userId]?.groups || []; }
  function primaryGroup(userId) { return userGroups(userId)[0] || null; }
  function isAdmin(userId) { return (Array.isArray(config().admins) && config().admins.includes(userId)) || loadMeta().admins.includes(userId); }
  function inGrantSubtree(grantId, groupId) {
    if (grantId === groupId) return true;
    const p = loadOrg().depts[groupId]?.path;
    return Array.isArray(p) && p.includes(grantId);
  }
  /** 组内容可见性：全局 / 本人创建 / 同最小组成员 / 被授权的组织子树 */
  function canViewScoped(user, item) {
    if (item.groupId === 'GLOBAL') return true;
    if (!item.groupId) return item.userId === user.id;
    if (item.userId === user.id) return true;
    if (userGroups(user.id).some(g => g.id === item.groupId)) return true;
    return (loadGrants()[user.id] || []).some(gid => inGrantSubtree(gid, item.groupId));
  }
  /** 组内容可编辑：管理员 / 创建者 / 同组成员；授权只读；全局种子题仅管理员可改 */
  function canEditScoped(user, item, { globalCustomOpen = false } = {}) {
    if (isAdmin(user.id)) return true;
    if (!item.groupId) return item.userId === user.id;
    if (item.groupId === 'GLOBAL') return globalCustomOpen ? !!item.custom : item.userId === user.id;
    return item.userId === user.id || userGroups(user.id).some(g => g.id === item.groupId);
  }
  function requireAdmin(req) { const u = requireUser(req); if (!isAdmin(u.id)) throw fail('需要管理员权限', 403); return u; }
  const authFile = path.join(dir, '_auth.json'), oauthStates = new Map();
  function saveAuth(auth) { fs.writeFileSync(authFile + '.tmp', JSON.stringify(auth)); fs.renameSync(authFile + '.tmp', authFile); }
  function loadAuth() {
    let auth = {};
    try { auth = JSON.parse(fs.readFileSync(authFile, 'utf8')); } catch {}
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000; let dirty = false;
    for (const [t, s] of Object.entries(auth)) { if (!s.createdAt || Date.parse(s.createdAt) < cutoff) { delete auth[t]; dirty = true; } }
    if (dirty) saveAuth(auth);
    return auth;
  }
  function cookieToken(req) { const m = /(?:^|;\s*)zm_sess=([\w-]+)/.exec(req.headers.cookie || ''); return m && m[1]; }
  function currentUser(req) { const t = cookieToken(req); if (!t) return null; const s = loadAuth()[t]; return s ? { id: s.userId, name: s.name, avatar: s.avatar, token: t } : null; }
  function requireUser(req) { const u = currentUser(req); if (!u) throw fail('请先登录', 401); return u; }
  function issueSession(res, userId, name, avatar) {
    const auth = loadAuth(), token = crypto.randomBytes(24).toString('hex');
    auth[token] = { userId, name, avatar, createdAt: new Date().toISOString() };
    saveAuth(auth);
    res.setHeader('Set-Cookie', `zm_sess=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000`);
    return { id: userId, name, avatar };
  }
  function adoptLegacy(userId) {
    for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.json') && !x.startsWith('_'))) {
      try { const s = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); if (!s.userId) { s.userId = userId; save(s); } } catch (e) { console.error('历史数据迁移失败:', f, e.message); }
    }
  }
  async function resolveDept(token, deptId, org, depth) {
    if (org.depts[deptId]) return org.depts[deptId];
    if (depth > 10) return null;
    const r = await fetch('https://open.feishu.cn/open-apis/contact/v3/departments/' + encodeURIComponent(deptId) + '?department_id_type=open_department_id', { headers: { Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(15000) });
    const j = await r.json().catch(() => ({}));
    const d = j?.data?.department;
    if (!d) return null;
    const parent = d.parent_department_id && d.parent_department_id !== '0' ? d.parent_department_id : '';
    const parentInfo = parent ? await resolveDept(token, parent, org, depth + 1) : null;
    const rec = { id: deptId, name: d.name || deptId, parentId: parent, path: [...(parentInfo ? parentInfo.path : []), deptId], pathName: [...(parentInfo ? parentInfo.pathName.split(' / ') : []), d.name || deptId].join(' / ') };
    org.depts[deptId] = rec;
    return rec;
  }
  const feishuClient = options.feishuClient || { async exchange(code) {
    const cfg = config();
    try {
      const atRes = await fetch('https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ app_id: cfg.feishuAppId, app_secret: cfg.feishuAppSecret }), signal: AbortSignal.timeout(15000) });
      const at = await atRes.json();
      if (!atRes.ok || at.code !== 0 || !at.app_access_token) throw new Error('app_access_token: ' + JSON.stringify(at));
      const utRes = await fetch('https://open.feishu.cn/open-apis/authen/v1/access_token', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + at.app_access_token }, body: JSON.stringify({ grant_type: 'authorization_code', code }), signal: AbortSignal.timeout(15000) });
      const ut = await utRes.json();
      if (!utRes.ok || ut.code !== 0 || !ut.data?.access_token) throw new Error('access_token: ' + JSON.stringify(ut));
      const uiRes = await fetch('https://open.feishu.cn/open-apis/authen/v1/user_info', { headers: { Authorization: 'Bearer ' + ut.data.access_token }, signal: AbortSignal.timeout(15000) });
      const ui = await uiRes.json();
      if (!uiRes.ok || ui.code !== 0 || !ui.data || (!ui.data.union_id && !ui.data.open_id)) throw new Error('user_info: ' + JSON.stringify(ui));
      const userId = 'fs:' + (ui.data.union_id || ui.data.open_id);
      // 拉取组织架构：用户所在部门及其路径，最深层即「最小用户组」
      let groups = [];
      try {
        const udRes = await fetch('https://open.feishu.cn/open-apis/contact/v3/users/' + encodeURIComponent(ui.data.union_id || ui.data.open_id) + '?user_id_type=union_id&department_id_type=open_department_id', { headers: { Authorization: 'Bearer ' + at.app_access_token }, signal: AbortSignal.timeout(15000) });
        const ud = await udRes.json().catch(() => ({}));
        const deptIds = ud?.data?.user?.department_ids || [];
        const org = loadOrg(); let dirty = false;
        const resolved = [];
        for (const did of deptIds.slice(0, 20)) { const rec = await resolveDept(at.app_access_token, did, org, 0); if (rec) resolved.push(rec); }
        dirty = resolved.length > 0;
        if (dirty) { org.fetchedAt = new Date().toISOString(); saveJSON(orgFile, org); }
        const maxDepth = Math.max(0, ...resolved.map(d => d.path.length));
        groups = resolved.filter(d => d.path.length === maxDepth).map(d => ({ id: d.id, name: d.name, pathName: d.pathName, path: d.path }));
      } catch (e) { console.error('组织架构获取失败（需 contact 相关权限）:', e.message); }
      return { userId, name: ui.data.name || ui.data.en_name || '飞书用户', avatar: ui.data.avatar_url || '', groups };
    } catch (e) { console.error('飞书登录失败:', e.message); throw fail('飞书登录失败，请重试', 502); }
  } };
  function get(sid) { if (!/^[\w-]+$/.test(sid) || sid.startsWith('_')) throw fail('无效编号'); const file = path.join(dir, sid + '.json'); if (!fs.existsSync(file)) throw fail('简历不存在', 404); return JSON.parse(fs.readFileSync(file, 'utf8')); }
  function save(s) { s.updatedAt = new Date().toISOString(); const dest = path.join(dir, s.id + '.json'); fs.writeFileSync(dest + '.tmp', JSON.stringify(s)); fs.renameSync(dest + '.tmp', dest); return s; }
  function config() { let cfg = {}; try { cfg = JSON.parse(fs.readFileSync(path.join(root, 'config.json'), 'utf8')); } catch {} return { ...cfg, ...(options.config || {}) }; }
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
      if (p === '/api/status') return send(res, 200, { configured: !!(config().apiKey && config().model && config().baseUrl), feishu: !!(config().feishuAppId && config().feishuAppSecret) });
      if (p === '/api/auth/feishu' && method === 'GET') {
        const cfg = config();
        if (!cfg.feishuAppId || !cfg.feishuAppSecret) throw fail('未配置飞书应用');
        for (const [st, exp] of oauthStates) if (exp < Date.now()) oauthStates.delete(st);
        const state = crypto.randomBytes(8).toString('hex');
        oauthStates.set(state, Date.now() + 10 * 60 * 1000);
        const redirectUri = cfg.feishuRedirectUri || `http://${req.headers.host || '127.0.0.1:3220'}/api/auth/feishu/callback`;
        const location = 'https://open.feishu.cn/open-apis/authen/v1/authorize?app_id=' + encodeURIComponent(cfg.feishuAppId) + '&redirect_uri=' + encodeURIComponent(redirectUri) + '&state=' + state;
        res.writeHead(302, { Location: location }); return res.end();
      }
      if (p === '/api/auth/feishu/callback' && method === 'GET') {
        const state = url.searchParams.get('state') || '', code = url.searchParams.get('code') || '';
        const expires = oauthStates.get(state); oauthStates.delete(state);
        if (!expires || expires < Date.now()) throw fail('登录状态已失效，请重新发起登录');
        const user = await feishuClient.exchange(code);
        if (!user || !user.userId) throw fail('飞书登录失败，请重试', 502);
        adoptLegacy(user.userId);
        // 用户目录（供分享与管理授权）+ 首个飞书用户自动成为管理员
        const users = loadUsers();
        users[user.userId] = { name: clip(user.name, 50) || '飞书用户', avatar: typeof user.avatar === 'string' ? user.avatar : '', groups: Array.isArray(user.groups) ? user.groups : [], updatedAt: new Date().toISOString() };
        saveJSON(usersFile, users);
        if (!user.userId.startsWith('demo:')) {
          const meta = loadMeta();
          const configured = Array.isArray(config().admins) ? config().admins : [];
          if (!meta.admins.length && !configured.length) { meta.admins.push(user.userId); saveJSON(metaFile, meta); }
        }
        issueSession(res, user.userId, clip(user.name, 50) || '飞书用户', typeof user.avatar === 'string' ? user.avatar : '');
        res.writeHead(302, { Location: '/' }); return res.end();
      }
      if (p === '/api/auth/demo' && method === 'POST') {
        const b = await json(req), name = clip(b.name, 50).trim();
        if (!name) throw fail('请提供用户名');
        const user = issueSession(res, 'demo:' + name, name, '');
        const users = loadUsers();
        if (!users[user.id]) { users[user.id] = { name: user.name, avatar: '', groups: [], updatedAt: new Date().toISOString() }; saveJSON(usersFile, users); }
        return send(res, 200, { user });
      }
      if (p === '/api/auth/me' && method === 'GET') {
        const u = requireUser(req);
        return send(res, 200, { user: { id: u.id, name: u.name, avatar: u.avatar, isAdmin: isAdmin(u.id) }, groups: userGroups(u.id) });
      }
      if (p === '/api/auth/logout' && method === 'POST') {
        const t = cookieToken(req);
        if (t) { const auth = loadAuth(); if (auth[t]) { delete auth[t]; saveAuth(auth); } }
        res.setHeader('Set-Cookie', 'zm_sess=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0');
        res.writeHead(204, { 'Cache-Control': 'no-store' }); return res.end();
      }
      if (p === '/api/bank' && method === 'GET') {
        const user = requireUser(req);
        const bank = loadBank();
        if (ensureSeeds(bank, user)) saveBank(bank);
        const group = primaryGroup(user.id);
        const scopeId = group ? group.id : '';
        const parts = PART_ORDER.filter(k => bank.parts[k]).map(k => ({ key: k, name: bank.parts[k].name, weight: bank.parts[k].weight }));
        for (const [k, p] of Object.entries(bank.parts)) {
          if (PART_ORDER.includes(k)) continue;
          if (p.groupId && p.groupId !== scopeId) continue; // 其他组的自定义分类不外露
          parts.push({ key: k, name: p.name, weight: p.weight || 0 });
        }
        if (bank.questions.some(q => q.custom)) parts.push({ key: 'CUST', name: '自定义', weight: 0 });
        const questions = bank.questions.filter(q => canViewScoped(user, q)).map(q => ({ ...q, readonly: !canEditScoped(user, q, { globalCustomOpen: true }) }));
        return send(res, 200, { parts, questions });
      }
      if (p === '/api/bank' && method === 'POST') {
        const user = requireUser(req);
        const bank = loadBank(), b = await json(req);
        const title = clip(b.title, 100), q = clip(b.q);
        if (!title.trim() || !q.trim()) throw fail('标题和题干不能为空');
        const group = primaryGroup(user.id);
        const question = { id: 'U-' + crypto.randomBytes(4).toString('hex'), ...resolvePart(bank, b.part, group ? group.id : ''), title, q, answer: clip(b.answer, 6000), custom: true, userId: user.id, userName: user.name, groupId: group ? group.id : '', groupName: group ? group.name : '', updatedAt: new Date().toISOString() };
        if (typeof b.material === 'string' && b.material.trim()) question.material = clip(b.material, 6000);
        if (typeof b.jdId === 'string' && b.jdId) {
          const jd = loadJds().jds.find(j => j.id === b.jdId);
          if (!jd || !canViewScoped(user, jd)) throw fail('岗位 JD 不存在', 404);
          question.jdId = jd.id; question.jdTitle = jd.title;
        }
        bank.questions.push(question); saveBank(bank);
        return send(res, 201, question);
      }
      if (p === '/api/bank/generate' && method === 'POST') {
        const user = requireUser(req);
        const b = await json(req);
        const count = Math.max(1, Math.min(10, Math.floor(Number(b.count) || 5)));
        let jdText = clip(b.jdText, 12000);
        let sourceJd = null;
        if (b.jdId) {
          sourceJd = loadJds().jds.find(j => j.id === b.jdId);
          if (!sourceJd || !canViewScoped(user, sourceJd)) throw fail('岗位 JD 不存在', 404);
          jdText = sourceJd.content;
        }
        if (!jdText.trim()) throw fail('请提供岗位 JD 内容');
        const requirements = clip(b.requirements, 2000);
        const bankNow = loadBank();
        const genGroup = primaryGroup(user.id);
        const genScopeId = genGroup ? genGroup.id : '';
        const existingNames = Object.values(bankNow.parts).filter(p => !p.groupId || p.groupId === genScopeId).map(p => p.name);
        const result = await llm([{ role: 'system', content: BANKGEN }, { role: 'user', content: `岗位 JD：\n${jdText}\n\n出题要求：${requirements || '按 JD 要求出题'}\n题目数量：${count}\n现有分类：${existingNames.join('、')}、自定义` }]);
        const questions = (Array.isArray(result.questions) ? result.questions : []).filter(x => x && typeof x.q === 'string' && x.q.trim()).slice(0, 10).map(x => {
          // 分类：优先匹配现有（key 或名称），不匹配则作为新分类建议（保存时自动创建）
          const raw = clip(String(x.part || ''), 20).trim();
          let part = '', partName = raw;
          if (bankNow.parts[raw] && (!bankNow.parts[raw].groupId || bankNow.parts[raw].groupId === genScopeId)) { part = raw; partName = bankNow.parts[raw].name; }
          else {
            const byName = Object.entries(bankNow.parts).find(([, p]) => (!p.groupId || p.groupId === genScopeId) && p.name === raw);
            if (byName) { part = byName[0]; partName = byName[1].name; }
          }
          return {
            title: clip(x.title, 100) || clip(x.q, 30), q: clip(x.q), answer: clip(x.answer, 6000), material: clip(x.material, 6000), part, partName,
            ...(sourceJd ? { jdId: sourceJd.id, jdTitle: sourceJd.title } : {}),
          };
        });
        if (!questions.length) throw fail('模型未生成有效题目，请重试', 422);
        return send(res, 200, { questions });
      }
      const bm = p.match(/^\/api\/bank\/([\w-]+)$/);
      if (bm && method === 'PATCH') {
        const user = requireUser(req);
        const bank = loadBank(), b = await json(req);
        const question = bank.questions.find(q => q.id === bm[1]);
        if (!question || !canViewScoped(user, question)) throw fail('题目不存在', 404);
        if (!canEditScoped(user, question, { globalCustomOpen: true })) throw fail('没有权限修改该题目', 403);
        if ('title' in b) { const title = clip(b.title, 100); if (!title.trim()) throw fail('标题和题干不能为空'); question.title = title; }
        if ('q' in b) { const q = clip(b.q); if (!q.trim()) throw fail('标题和题干不能为空'); question.q = q; }
        if ('part' in b) Object.assign(question, resolvePart(bank, b.part, question.groupId === 'GLOBAL' ? '' : question.groupId || ''));
        if (typeof b.answer === 'string') question.answer = clip(b.answer, 6000);
        if (typeof b.material === 'string') question.material = clip(b.material, 6000); else if (b.material === null) delete question.material;
        if ('jdId' in b) {
          if (!b.jdId) { delete question.jdId; delete question.jdTitle; }
          else {
            const jd = loadJds().jds.find(j => j.id === b.jdId);
            if (!jd || !canViewScoped(user, jd)) throw fail('岗位 JD 不存在', 404);
            question.jdId = jd.id; question.jdTitle = jd.title;
          }
        }
        question.updatedAt = new Date().toISOString(); saveBank(bank);
        return send(res, 200, question);
      }
      if (bm && method === 'DELETE') {
        const user = requireUser(req);
        const bank = loadBank(), index = bank.questions.findIndex(q => q.id === bm[1]);
        if (index === -1 || !canViewScoped(user, bank.questions[index])) throw fail('题目不存在', 404);
        if (!canEditScoped(user, bank.questions[index], { globalCustomOpen: false })) throw fail('没有权限删除该题目', 403);
        bank.questions.splice(index, 1); saveBank(bank);
        res.writeHead(204, { 'Cache-Control': 'no-store' }); return res.end();
      }
      // —— 岗位 JD：按创建者最小用户组共享 ——
      if (p === '/api/jds' && method === 'GET') {
        const user = requireUser(req);
        const jds = loadJds().jds.filter(j => canViewScoped(user, j)).map(j => ({ ...j, readonly: !canEditScoped(user, j) })).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        return send(res, 200, { jds });
      }
      if (p === '/api/jds' && method === 'POST') {
        const user = requireUser(req);
        const b = await json(req);
        const title = clip(b.title, 100), content = clip(b.content, 20000);
        if (!title.trim() || !content.trim()) throw fail('岗位名称和 JD 内容不能为空');
        const store = loadJds(), group = primaryGroup(user.id);
        const jd = { id: id(), title: title.trim(), company: clip(b.company, 100), content, requirements: clip(b.requirements, 4000), tags: (Array.isArray(b.tags) ? b.tags : []).filter(x => typeof x === 'string').slice(0, 8).map(x => clip(x, 30)), userId: user.id, userName: user.name, groupId: group ? group.id : '', groupName: group ? group.name : '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        store.jds.push(jd); saveJSON(jdsFile, store);
        return send(res, 201, jd);
      }
      const jm2 = p.match(/^\/api\/jds\/([\w-]+)$/);
      if (jm2 && method === 'PATCH') {
        const user = requireUser(req);
        const store = loadJds(), jd = store.jds.find(j => j.id === jm2[1]);
        if (!jd || !canViewScoped(user, jd)) throw fail('岗位不存在', 404);
        if (!canEditScoped(user, jd)) throw fail('没有权限修改该岗位', 403);
        const b = await json(req);
        if (typeof b.title === 'string') { const t = clip(b.title, 100); if (!t.trim()) throw fail('岗位名称不能为空'); jd.title = t; }
        if (typeof b.company === 'string') jd.company = clip(b.company, 100);
        if (typeof b.content === 'string') { const c = clip(b.content, 20000); if (!c.trim()) throw fail('JD 内容不能为空'); jd.content = c; }
        if (typeof b.requirements === 'string') jd.requirements = clip(b.requirements, 4000);
        if (Array.isArray(b.tags)) jd.tags = b.tags.filter(x => typeof x === 'string').slice(0, 8).map(x => clip(x, 30));
        jd.updatedAt = new Date().toISOString(); saveJSON(jdsFile, store);
        return send(res, 200, jd);
      }
      if (jm2 && method === 'DELETE') {
        const user = requireUser(req);
        const store = loadJds(), index = store.jds.findIndex(j => j.id === jm2[1]);
        if (index === -1 || !canViewScoped(user, store.jds[index])) throw fail('岗位不存在', 404);
        if (!canEditScoped(user, store.jds[index])) throw fail('没有权限删除该岗位', 403);
        store.jds.splice(index, 1); saveJSON(jdsFile, store);
        res.writeHead(204, { 'Cache-Control': 'no-store' }); return res.end();
      }
      // —— 用户目录：用于简历分享的对象选择 ——
      if (p === '/api/users' && method === 'GET') {
        requireUser(req);
        const users = Object.entries(loadUsers()).map(([uid, u]) => ({ id: uid, name: u.name || uid, avatar: u.avatar || '', groupName: (u.groups && u.groups[0]?.name) || '' })).sort((a, b) => a.name.localeCompare(b.name, 'zh'));
        return send(res, 200, { users });
      }
      // —— 管理：授权与组织架构 ——
      if (p === '/api/admin/overview' && method === 'GET') {
        requireAdmin(req);
        const grants = loadGrants(), org = loadOrg();
        const users = Object.entries(loadUsers()).map(([uid, u]) => ({ id: uid, name: u.name || uid, avatar: u.avatar || '', groupName: (u.groups && u.groups[0]?.pathName) || '', isAdmin: isAdmin(uid), grants: grants[uid] || [] })).sort((a, b) => a.name.localeCompare(b.name, 'zh'));
        return send(res, 200, { users, depts: org.depts, fetchedAt: org.fetchedAt || '' });
      }
      if (p === '/api/admin/grants' && method === 'PUT') {
        requireAdmin(req);
        const b = await json(req);
        if (typeof b.userId !== 'string' || !b.userId) throw fail('请指定用户');
        if (!Array.isArray(b.deptIds)) throw fail('授权格式不正确');
        const deptIds = [...new Set(b.deptIds.filter(x => typeof x === 'string').slice(0, 100))];
        const grants = loadGrants();
        if (deptIds.length) grants[b.userId] = deptIds; else delete grants[b.userId];
        saveJSON(grantsFile, grants);
        return send(res, 200, { userId: b.userId, deptIds });
      }
      if (p === '/api/admin/admins' && method === 'PUT') {
        const admin = requireAdmin(req);
        const b = await json(req);
        if (typeof b.userId !== 'string' || !b.userId) throw fail('请指定用户');
        if (b.userId === admin.id && !b.admin) throw fail('不能撤销自己的管理员权限');
        const meta = loadMeta(), set = new Set(meta.admins);
        if (b.admin) set.add(b.userId); else set.delete(b.userId);
        const configured = Array.isArray(config().admins) ? config().admins : [];
        if (!set.size && !configured.length) throw fail('至少保留一名管理员');
        meta.admins = [...set]; saveJSON(metaFile, meta);
        return send(res, 200, { userId: b.userId, admin: !!b.admin });
      }
      if (p === '/api/admin/org/refresh' && method === 'POST') {
        requireAdmin(req);
        const cfg = config();
        if (!cfg.feishuAppId || !cfg.feishuAppSecret) throw fail('未配置飞书应用');
        try {
          const atRes = await fetch('https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ app_id: cfg.feishuAppId, app_secret: cfg.feishuAppSecret }), signal: AbortSignal.timeout(15000) });
          const at = await atRes.json();
          if (!atRes.ok || at.code !== 0 || !at.app_access_token) throw new Error('app_access_token: ' + JSON.stringify(at));
          const org = { depts: {}, fetchedAt: new Date().toISOString() };
          let pageToken = '';
          for (let guard = 0; guard < 50; guard++) {
            const u = 'https://open.feishu.cn/open-apis/contact/v3/departments?department_id_type=open_department_id&parent_department_id=0&fetch_child=true&page_size=50' + (pageToken ? '&page_token=' + encodeURIComponent(pageToken) : '');
            const r = await fetch(u, { headers: { Authorization: 'Bearer ' + at.app_access_token }, signal: AbortSignal.timeout(15000) });
            const j = await r.json();
            if (!r.ok || j.code !== 0) throw new Error('departments: ' + JSON.stringify(j).slice(0, 300));
            for (const d of j.data?.items || []) {
              const did = d.open_department_id || d.department_id;
              if (!did) continue;
              org.depts[did] = { id: did, name: d.name || did, parentId: d.parent_department_id && d.parent_department_id !== '0' ? d.parent_department_id : '', path: [], pathName: '' };
            }
            if (!j.data?.has_more) break;
            pageToken = j.data.page_token || '';
          }
          // 依据 parentId 计算 path / pathName
          const resolve = (did, depth) => {
            const d = org.depts[did];
            if (!d || depth > 15) return null;
            if (d.path.length) return d;
            if (!d.parentId || !org.depts[d.parentId]) { d.path = [did]; d.pathName = d.name; return d; }
            const p = resolve(d.parentId, depth + 1);
            d.path = [...(p ? p.path : []), did];
            d.pathName = (p ? p.pathName + ' / ' : '') + d.name;
            return d;
          };
          for (const did of Object.keys(org.depts)) resolve(did, 0);
          saveJSON(orgFile, org);
          // 顺带补齐没有组织信息的用户（未识别组织），上限 50 人
          let syncedUsers = 0;
          const users = loadUsers(); let usersDirty = false;
          for (const [uid, u] of Object.entries(users)) {
            if (!uid.startsWith('fs:') || (u.groups && u.groups.length)) continue;
            if (syncedUsers >= 50) break;
            try {
              const udRes = await fetch('https://open.feishu.cn/open-apis/contact/v3/users/' + encodeURIComponent(uid.slice(3)) + '?user_id_type=union_id&department_id_type=open_department_id', { headers: { Authorization: 'Bearer ' + at.app_access_token }, signal: AbortSignal.timeout(15000) });
              const ud = await udRes.json().catch(() => ({}));
              const deptIds = ud?.data?.user?.department_ids || [];
              const resolved = [];
              for (const did of deptIds.slice(0, 20)) { const rec = await resolveDept(at.app_access_token, did, org, 0); if (rec) resolved.push(rec); }
              if (resolved.length) {
                const maxDepth = Math.max(...resolved.map(d => d.path.length));
                u.groups = resolved.filter(d => d.path.length === maxDepth).map(d => ({ id: d.id, name: d.name, pathName: d.pathName, path: d.path }));
                u.updatedAt = new Date().toISOString();
                usersDirty = true; syncedUsers++;
              }
            } catch (e) { console.error('同步用户组织失败:', uid, e.message); }
          }
          if (usersDirty) saveJSON(usersFile, users);
          return send(res, 200, { depts: org.depts, fetchedAt: org.fetchedAt, syncedUsers });
        } catch (e) { console.error('组织架构同步失败:', e.message); throw fail('组织架构同步失败：' + (e.message.includes('99991672') || e.message.includes('permission') ? '请为应用开通 contact:department.base:readonly 权限' : '请检查飞书配置与网络'), 502); }
      }
      if (p === '/api/sessions' && method === 'GET') {
        const user = requireUser(req);
        const users = loadUsers();
        return send(res, 200, fs.readdirSync(dir).filter(x => x.endsWith('.json') && !x.startsWith('_')).map(x => JSON.parse(fs.readFileSync(path.join(dir, x), 'utf8'))).filter(x => x.userId === user.id || (Array.isArray(x.shares) && x.shares.includes(user.id))).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(({ sections, lines, text, evaluation, shares, ...s }) => { const questions = (sections || []).flatMap(x => x.questions).filter(q => !q.excluded); const scored = questions.filter(q => q.score !== null); return { ...s, sharedBy: s.userId === user.id ? '' : (users[s.userId]?.name || '同事'), questionCount: questions.length, scoredCount: scored.length, avgScore: scored.length ? Math.round(scored.reduce((a, q) => a + q.score, 0) / scored.length * 10) / 10 : null, hasEvaluation: !!evaluation, suggestion: evaluation ? clip(evaluation.suggestion, 200) : '' }; }));
      }

      if (p === '/api/upload' && method === 'POST') {
        const user = requireUser(req);
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
        return send(res, 201, save({ id: sid, userId: user.id, fileName: name, file: sid + storedExt, name: name.replace(/\.[^.]+$/, ''), role: '', summary: '', text, sections: [], lines: [], pageCount: 1, phase: 'prepare', note: '', evaluation: null, createdAt: new Date().toISOString() }));
      }
      const jm = p.match(/^\/api\/jobs\/([\w-]+)$/);
      if (jm && method === 'GET') { const job = jobs.get(jm[1]); if (!job) throw fail('任务已结束或服务已重启，请重试', 404); return send(res, 200, job); }
      const sm = p.match(/^\/api\/sessions\/([\w-]+)(?:\/(analyze|evaluate))?$/);
      if (sm) {
        let s = get(sm[1]);
        const user = requireUser(req);
        const owner = s.userId === user.id, shared = !owner && Array.isArray(s.shares) && s.shares.includes(user.id);
        if (!owner && !shared) throw fail('简历不存在', 404);
        if (!sm[2] && method === 'GET') return send(res, 200, s);
        if (!sm[2] && method === 'DELETE') {
          if (!owner) throw fail('只有所有者可删除', 403);
          fs.unlinkSync(path.join(dir, s.id + '.json'));
          if (s.file) { const stored = path.join(dir, path.basename(s.file)); if (fs.existsSync(stored)) fs.unlinkSync(stored); }
          res.writeHead(204, { 'Cache-Control': 'no-store' }); return res.end();
        }
        if (!sm[2] && method === 'PATCH') {
          const b = await json(req);
          if (b.shares !== undefined) {
            if (!owner) throw fail('只有所有者可调整分享', 403);
            if (!Array.isArray(b.shares)) throw fail('分享格式不正确');
            s.shares = [...new Set(b.shares.filter(x => typeof x === 'string' && x !== user.id).slice(0, 50))];
          }
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
          if (!owner) throw fail('只有所有者可生成问题或评价', 403);
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
        const user = requireUser(req);
        const owner = get(name.replace(/\.[^.]+$/, ''));
        if (owner.userId !== user.id && !(Array.isArray(owner.shares) && owner.shares.includes(user.id))) throw fail('文件不存在', 404);
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
if (require.main === module) { const port = Number(process.env.PORT) || 3220, host = process.env.HOST || '0.0.0.0'; createApp().listen(port, host, () => { const nets = require('os').networkInterfaces(); const lan = Object.values(nets).flat().filter(Boolean).find(n => n.family === 'IPv4' && !n.internal); console.log(`知马已启动：http://localhost:${port}${lan ? `（局域网：http://${lan.address}:${port}）` : ''}`); }); }
module.exports = { createApp, normalizeAnalysis };
