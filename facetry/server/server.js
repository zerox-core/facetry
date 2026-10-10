const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { OUTLINE, GENERATE, EVALUATE, BANKGEN } = require('./prompts');
const seed = require('./bank-seed');

// 环境变量（LLM_BASE_URL / LLM_API_KEY / LLM_MODEL）优先于 config.json；支持 server/.env
try { process.loadEnvFile(path.join(__dirname, '.env')); } catch {}

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
const normText = s => String(s || '').replace(/\s+/g, '').toLowerCase();
function resolveAnchor(a, lines, pages) {
  const quote = normText(a.quote);
  const line = lines.find(l => l.id === a.lineId) || (quote.length > 2 ? lines.find(l => normText(l.text).includes(quote) || (normText(l.text).length > 3 && quote.includes(normText(l.text)))) : null);
  const page = Math.max(1, Math.min(pages, Number(a.page) || 1));
  return line ? { lineId: line.id, page: line.page, y: line.y, x: line.x || 0.1, quote: line.text, matched: true } : { page, y: Math.max(0.03, Math.min(0.94, Number(a.y) || 0.2)), x: 0.1, quote: clip(a.quote), matched: false };
}
const sortByPosition = sections => sections.sort((a, b) => (a.anchor?.page ?? 1) - (b.anchor?.page ?? 1) || (a.anchor?.y ?? 0) - (b.anchor?.y ?? 0));
function normalizeQuestion(q) {
  return { id: id(), type: clip(q.type, 30) || '经历深挖', q: clip(q.q), point: clip(q.point), followUp: clip(q.followUp), expected: (Array.isArray(q.expected) ? q.expected : [q.expected]).filter(x => typeof x === 'string').map(x => clip(x)), excluded: false, score: null, note: '' };
}
/** 第一阶段：结构提纲（板块 + 锚点），不带题目；按版面从上到下排序 */
function normalizeOutline(result, lines, pages) {
  if (!Array.isArray(result.sections) || !result.sections.length) throw fail('没有识别到简历内容，请换用清晰的 PDF 或 Word 文件', 422);
  const sections = result.sections.slice(0, 20).map(s => ({ id: id(), title: clip(s.title, 100) || '简历经历', kind: ['project', 'experience', 'skills', 'education'].includes(s.kind) ? s.kind : 'experience', anchor: resolveAnchor(s.anchor || {}, lines, pages) }));
  return { name: clip(result.name, 80), role: clip(result.role, 100), summary: clip(result.summary), sections: sortByPosition(sections) };
}
/** 第二阶段：题目挂到提纲板块上（按标题逐字/包含匹配），匹配不到的进自定义板块 */
function normalizeQuestions(result, outline) {
  const norm = t => String(t || '').replace(/\s+/g, '');
  const byTitle = new Map(outline.map(s => [norm(s.title), s]));
  const remaining = new Set(outline.map(s => s.id));
  const out = [];
  for (const sec of (Array.isArray(result.sections) ? result.sections : []).slice(0, 20)) {
    const qs = (Array.isArray(sec.questions) ? sec.questions : []).filter(q => typeof q.q === 'string' && q.q.trim()).slice(0, 4).map(normalizeQuestion);
    if (!qs.length) continue;
    const target = byTitle.get(norm(sec.title)) || outline.find(s => { const a = norm(s.title), b = norm(sec.title); return a && b && (a.includes(b) || b.includes(a)); });
    if (target && remaining.has(target.id)) { out.push({ ...target, questions: qs }); remaining.delete(target.id); }
    else if (target) { out.find(o => o.id === target.id).questions.push(...qs); }
    else out.push({ id: id(), title: clip(sec.title, 100) || '补充问题', kind: 'custom', anchor: null, questions: qs });
  }
  if (!out.length) throw fail('模型未生成有效题目，请重试', 422);
  const order = new Map(outline.map((s, i) => [s.id, i]));
  out.sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999));
  return out;
}

function createApp(options = {}) {
  const root = __dirname;
  // 运行数据库统一读取平台注入的 SQLITE_PATH（平台固定值 /data/app.db）；
  // 生产环境下路径规范化后必须落在 /data 内，防止环境变量误配写到其他位置；
  // 本地开发不注入时在 server/.env 中设置 SQLITE_PATH 指向本地文件（参考 .env.example），测试经 options.dataDir 注入临时目录
  if (process.env.SQLITE_PATH && process.env.NODE_ENV === 'production') {
    const resolved = path.resolve(process.env.SQLITE_PATH);
    if (!resolved.startsWith(path.resolve('/data') + path.sep)) throw new Error('SQLITE_PATH 必须位于 /data 目录内（平台固定注入 /data/app.db）');
  }
  // 上传的简历附件与数据库同目录持久化（平台为 /data）
  const dir = options.dataDir || path.dirname(process.env.SQLITE_PATH || '/data/app.db');
  fs.mkdirSync(dir, { recursive: true });
  const distDir = path.resolve(root, '..', 'dist');
  const jobs = new Map();

  // —— SQLite 数据层（node:sqlite，简历原文文件仍在磁盘上） ——
  // 连接调用直接读取 process.env.SQLITE_PATH（平台契约：/data/app.db）；文件不存在时由 node:sqlite 创建，已存在则原样打开，绝不清空
  const db = new DatabaseSync(process.env.SQLITE_PATH || (options.dataDir ? path.join(options.dataDir, 'app.db') : '/data/app.db'));
  // 数据库存有简历、会话令牌等敏感数据，限制为仅属主可读写
  if (process.platform !== 'win32') { try { fs.chmodSync(process.env.SQLITE_PATH || (options.dataDir ? path.join(options.dataDir, 'app.db') : '/data/app.db'), 0o600); } catch {} }
  db.exec(`PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY, userId TEXT, name TEXT, role TEXT, phase TEXT, createdAt TEXT, updatedAt TEXT, data TEXT);
    CREATE TABLE IF NOT EXISTS bank_questions(id TEXT PRIMARY KEY, part TEXT, groupId TEXT, custom INTEGER, userId TEXT, data TEXT);
    CREATE TABLE IF NOT EXISTS bank_parts(key TEXT PRIMARY KEY, name TEXT, weight INTEGER, custom INTEGER, groupId TEXT);
    CREATE TABLE IF NOT EXISTS bank_meta(id INTEGER PRIMARY KEY CHECK(id=1), seededGroups TEXT);
    CREATE TABLE IF NOT EXISTS jds(id TEXT PRIMARY KEY, groupId TEXT, userId TEXT, data TEXT);
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, data TEXT);
    CREATE TABLE IF NOT EXISTS auth(token TEXT PRIMARY KEY, userId TEXT, createdAt TEXT, data TEXT);
    CREATE TABLE IF NOT EXISTS grants(userId TEXT PRIMARY KEY, deptIds TEXT);
    CREATE TABLE IF NOT EXISTS org(id INTEGER PRIMARY KEY CHECK(id=1), data TEXT);
    CREATE TABLE IF NOT EXISTS meta(k TEXT PRIMARY KEY, v TEXT);
    CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY, sessionId TEXT, state TEXT, data TEXT);`);
  const J = JSON.stringify, P = JSON.parse;
  const replaceAll = (table, rows, insert) => { db.exec('BEGIN'); try { db.exec('DELETE FROM ' + table); for (const r of rows) insert(r); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; } };

  // —— 老 JSON 文件数据一次性导入并改名备份 ——
  (function importLegacy() {
    if (db.prepare("SELECT v FROM meta WHERE k='migrated'").get()) return;
    const files = fs.readdirSync(dir).filter(x => x.endsWith('.json'));
    if (files.length) {
      const read = f => { try { return P(fs.readFileSync(path.join(dir, f), 'utf8')); } catch { return null; } };
      const bank = read('_bank.json');
      if (bank) {
        for (const q of bank.questions || []) if (q.groupId === undefined) q.groupId = 'GLOBAL';
        saveBank({ parts: bank.parts || {}, questions: bank.questions || [], seededGroups: bank.seededGroups || [] });
      }
      const users = read('_users.json');
      if (users) replaceAll('users', Object.entries(users), ([k, v]) => db.prepare('INSERT INTO users(id, data) VALUES (?, ?)').run(k, J(v)));
      const grants = read('_grants.json');
      if (grants) replaceAll('grants', Object.entries(grants), ([k, v]) => db.prepare('INSERT INTO grants(userId, deptIds) VALUES (?, ?)').run(k, J(v)));
      const jds = read('_jds.json');
      if (jds) replaceAll('jds', jds.jds || [], j => db.prepare('INSERT INTO jds(id, groupId, userId, data) VALUES (?, ?, ?, ?)').run(j.id, j.groupId || '', j.userId || '', J(j)));
      const org = read('_org.json');
      if (org) db.prepare('INSERT INTO org(id, data) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(J(org));
      const meta = read('_meta.json');
      if (meta) db.prepare("INSERT OR REPLACE INTO meta(k, v) VALUES('meta', ?)").run(J(meta));
      const auth = read('_auth.json');
      if (auth) replaceAll('auth', Object.entries(auth), ([k, v]) => db.prepare('INSERT INTO auth(token, userId, createdAt, data) VALUES (?, ?, ?, ?)').run(k, v.userId || '', v.createdAt || '', J(v)));
      const jobArr = read('_jobs.json');
      if (Array.isArray(jobArr)) replaceAll('jobs', jobArr, j => db.prepare('INSERT INTO jobs(id, sessionId, state, data) VALUES (?, ?, ?, ?)').run(j.id, j.sessionId || '', j.state || '', J(j)));
      for (const f of files.filter(x => !x.startsWith('_'))) {
        const s = read(f);
        if (s && s.id) save(s);
      }
      for (const f of files) { try { fs.renameSync(path.join(dir, f), path.join(dir, f + '.legacy')); } catch {} }
      console.log('已将旧 JSON 数据导入 SQLite（原文件改名为 *.json.legacy 备份）');
    }
    db.prepare("INSERT OR REPLACE INTO meta(k, v) VALUES('migrated', '1')").run();
  })();

  // —— 数据访问（保持原有函数签名，路由层不变） ——
  const loadUsers = () => { const out = {}; for (const r of db.prepare('SELECT id, data FROM users').all()) out[r.id] = P(r.data); return out; };
  const saveUsers = users => replaceAll('users', Object.entries(users), ([k, v]) => db.prepare('INSERT INTO users(id, data) VALUES (?, ?)').run(k, J(v)));
  const loadGrants = () => { const out = {}; for (const r of db.prepare('SELECT userId, deptIds FROM grants').all()) out[r.userId] = P(r.deptIds); return out; };
  const saveGrants = grants => replaceAll('grants', Object.entries(grants), ([k, v]) => db.prepare('INSERT INTO grants(userId, deptIds) VALUES (?, ?)').run(k, J(v)));
  const loadJds = () => ({ jds: db.prepare('SELECT data FROM jds').all().map(r => P(r.data)) });
  const saveJds = store => replaceAll('jds', store.jds, j => db.prepare('INSERT INTO jds(id, groupId, userId, data) VALUES (?, ?, ?, ?)').run(j.id, j.groupId || '', j.userId || '', J(j)));
  const loadOrg = () => { const r = db.prepare('SELECT data FROM org WHERE id=1').get(); return r ? P(r.data) : { depts: {}, fetchedAt: '' }; };
  const saveOrg = org => db.prepare('INSERT INTO org(id, data) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(J(org));
  const loadMeta = () => { const r = db.prepare("SELECT v FROM meta WHERE k='meta'").get(); return r ? P(r.v) : { admins: [] }; };
  const saveMeta = meta => db.prepare("INSERT OR REPLACE INTO meta(k, v) VALUES('meta', ?)").run(J(meta));
  const PART_ORDER = ['A', 'B', 'E', 'F', 'C', 'D'];
  function saveBank(bank) {
    db.exec('BEGIN');
    try {
      db.exec('DELETE FROM bank_questions'); db.exec('DELETE FROM bank_parts');
      const pq = db.prepare('INSERT INTO bank_questions(id, part, groupId, custom, userId, data) VALUES (?, ?, ?, ?, ?, ?)');
      for (const q of bank.questions) pq.run(q.id, q.part || '', q.groupId || '', q.custom ? 1 : 0, q.userId || '', J(q));
      const pp = db.prepare('INSERT INTO bank_parts(key, name, weight, custom, groupId) VALUES (?, ?, ?, ?, ?)');
      for (const [k, p] of Object.entries(bank.parts)) pp.run(k, p.name, p.weight || 0, p.custom ? 1 : 0, p.groupId || '');
      db.prepare('INSERT INTO bank_meta(id, seededGroups) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET seededGroups=excluded.seededGroups').run(J(bank.seededGroups || []));
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
  }
  function loadBank() {
    const parts = {};
    for (const r of db.prepare('SELECT * FROM bank_parts').all()) parts[r.key] = { name: r.name, weight: r.weight, ...(r.custom ? { custom: true } : {}), ...(r.groupId ? { groupId: r.groupId } : {}) };
    // 初始为空：内置种子分类；各组首次访问时由 ensureSeeds 生成自己的基础题副本
    if (!Object.keys(parts).length) Object.assign(parts, P(J(seed.parts)));
    const questions = db.prepare('SELECT data FROM bank_questions').all().map(r => P(r.data));
    const meta = db.prepare('SELECT seededGroups FROM bank_meta WHERE id=1').get();
    return { parts, questions, seededGroups: meta ? P(meta.seededGroups) : [] };
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
  /** 计算用户负责的部门：其所在部门路径上 leader_user_id 等于自己的部门 */
  function computeLeaderOf(unionId, groups, org) {
    const out = new Set();
    for (const g of groups || []) {
      for (const did of g.path || []) {
        if (org.depts[did]?.leaderId === unionId) out.add(did);
      }
      if (org.depts[g.id]?.leaderId === unionId) out.add(g.id);
    }
    return [...out];
  }
  /** 负责人视角：能查看其负责部门（含子部门）成员的简历 */
  function canLeadView(user, ownerId) {
    const scopes = loadUsers()[user.id]?.leaderOf || [];
    if (!scopes.length) return false;
    const pg = primaryGroup(ownerId);
    if (!pg) return false;
    return scopes.some(did => pg.id === did || (Array.isArray(pg.path) && pg.path.includes(did)));
  }
  function isAdmin(userId) { return (Array.isArray(config().admins) && config().admins.includes(userId)) || loadMeta().admins.includes(userId); }
  function isSuper(userId) { return (Array.isArray(config().superAdmins) && config().superAdmins.includes(userId)) || (Array.isArray(loadMeta().superAdmins) && loadMeta().superAdmins.includes(userId)); }
  function inGrantSubtree(grantId, groupId) {
    if (grantId === groupId) return true;
    const p = loadOrg().depts[groupId]?.path;
    return Array.isArray(p) && p.includes(grantId);
  }
  /** 组内容可见性：全局 / 本人创建 / 同最小组成员 / 被授权的组织子树（超管走管理台 group 参数查看，不影响普通视图） */
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
  function requireSuper(req) { const u = requireUser(req); if (!isSuper(u.id)) throw fail('需要超级管理员权限', 403); return u; }
  const oauthStates = new Map();
  const AUTH_CUTOFF = () => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  function cookieToken(req) { const m = /(?:^|;\s*)zm_sess=([\w-]+)/.exec(req.headers.cookie || ''); return m && m[1]; }
  function currentUser(req) {
    const t = cookieToken(req);
    if (!t) return null;
    const r = db.prepare('SELECT data FROM auth WHERE token = ? AND createdAt > ?').get(t, AUTH_CUTOFF());
    if (!r) return null;
    const s = P(r.data);
    return { id: s.userId, name: s.name, avatar: s.avatar, token: t };
  }
  function requireUser(req) { const u = currentUser(req); if (!u) throw fail('请先登录', 401); return u; }
  function issueSession(res, userId, name, avatar) {
    const token = crypto.randomBytes(24).toString('hex'), createdAt = new Date().toISOString();
    db.prepare('INSERT INTO auth(token, userId, createdAt, data) VALUES (?, ?, ?, ?)').run(token, userId, createdAt, J({ userId, name, avatar, createdAt }));
    db.prepare('DELETE FROM auth WHERE createdAt <= ?').run(AUTH_CUTOFF());
    res.setHeader('Set-Cookie', `zm_sess=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000`);
    return { id: userId, name, avatar };
  }
  function adoptLegacy(userId) {
    for (const r of db.prepare("SELECT id, data FROM sessions WHERE userId IS NULL OR userId = ''").all()) {
      try { const s = P(r.data); s.userId = userId; save(s); } catch (e) { console.error('历史数据迁移失败:', r.id, e.message); }
    }
  }
  async function resolveDept(token, deptId, org, depth) {
    if (org.depts[deptId]) return org.depts[deptId];
    if (depth > 10) return null;
    const r = await fetch('https://open.feishu.cn/open-apis/contact/v3/departments/' + encodeURIComponent(deptId) + '?department_id_type=open_department_id&user_id_type=union_id', { headers: { Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(15000) });
    const j = await r.json().catch(() => ({}));
    const d = j?.data?.department;
    if (!d) return null;
    const parent = d.parent_department_id && d.parent_department_id !== '0' ? d.parent_department_id : '';
    const parentInfo = parent ? await resolveDept(token, parent, org, depth + 1) : null;
    const rec = { id: deptId, name: d.name || deptId, parentId: parent, leaderId: d.leader_user_id || '', path: [...(parentInfo ? parentInfo.path : []), deptId], pathName: [...(parentInfo ? parentInfo.pathName.split(' / ') : []), d.name || deptId].join(' / ') };
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
      let groups = [], leaderOf = [];
      try {
        const udRes = await fetch('https://open.feishu.cn/open-apis/contact/v3/users/' + encodeURIComponent(ui.data.union_id || ui.data.open_id) + '?user_id_type=union_id&department_id_type=open_department_id', { headers: { Authorization: 'Bearer ' + at.app_access_token }, signal: AbortSignal.timeout(15000) });
        const ud = await udRes.json().catch(() => ({}));
        const deptIds = ud?.data?.user?.department_ids || [];
        const org = loadOrg(); let dirty = false;
        const resolved = [];
        for (const did of deptIds.slice(0, 20)) { const rec = await resolveDept(at.app_access_token, did, org, 0); if (rec) resolved.push(rec); }
        dirty = resolved.length > 0;
        if (dirty) { org.fetchedAt = new Date().toISOString(); saveOrg(org); }
        const maxDepth = Math.max(0, ...resolved.map(d => d.path.length));
        groups = resolved.filter(d => d.path.length === maxDepth).map(d => ({ id: d.id, name: d.name, pathName: d.pathName, path: d.path }));
        leaderOf = computeLeaderOf(ui.data.union_id || ui.data.open_id, groups, org);
      } catch (e) { console.error('组织架构获取失败（需 contact 相关权限）:', e.message); }
      return { userId, name: ui.data.name || ui.data.en_name || '飞书用户', avatar: ui.data.avatar_url || '', groups, leaderOf };
    } catch (e) { console.error('飞书登录失败:', e.message); throw fail('飞书登录失败，请重试', 502); }
  } };
  function get(sid) { if (!/^[\w-]+$/.test(sid) || sid.startsWith('_')) throw fail('无效编号'); const r = db.prepare('SELECT data FROM sessions WHERE id = ?').get(sid); if (!r) throw fail('简历不存在', 404); return P(r.data); }
  function save(s) {
    s.updatedAt = new Date().toISOString();
    db.prepare('INSERT INTO sessions(id, userId, name, role, phase, createdAt, updatedAt, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET userId=excluded.userId, name=excluded.name, role=excluded.role, phase=excluded.phase, updatedAt=excluded.updatedAt, data=excluded.data')
      .run(s.id, s.userId || '', s.name || '', s.role || '', s.phase || 'prepare', s.createdAt || s.updatedAt, s.updatedAt, J(s));
    return s;
  }
  const listSessions = () => db.prepare('SELECT data FROM sessions').all().map(r => P(r.data));
  function config() {
    let cfg = {};
    try { cfg = JSON.parse(fs.readFileSync(path.join(root, 'config.json'), 'utf8')); } catch {}
    // 环境变量优先于 config.json（LLM 与飞书凭据都应放在环境变量中）
    const env = {};
    if (process.env.LLM_BASE_URL) env.baseUrl = process.env.LLM_BASE_URL;
    if (process.env.LLM_API_KEY) env.apiKey = process.env.LLM_API_KEY;
    if (process.env.LLM_MODEL) env.model = process.env.LLM_MODEL;
    if (process.env.FEISHU_APP_ID) env.feishuAppId = process.env.FEISHU_APP_ID;
    if (process.env.FEISHU_APP_SECRET) env.feishuAppSecret = process.env.FEISHU_APP_SECRET;
    if (process.env.FEISHU_REDIRECT_URI) env.feishuRedirectUri = process.env.FEISHU_REDIRECT_URI;
    return { ...cfg, ...env, ...(options.config || {}) };
  }
  async function llm(messages) {
    if (options.llm) return parseResult(await options.llm(messages));
    const cfg = config();
    if (!cfg.baseUrl || !cfg.model || !cfg.apiKey) throw fail('请先在 server/config.json 中配置大模型接口', 503);
    // 网络层故障与格式不完整各自动重试一次；不限制 max_tokens，让模型完整输出
    let lastErr = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      let response;
      try { response = await fetch(cfg.baseUrl.replace(/\/+$/, '') + '/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cfg.apiKey }, body: JSON.stringify({ model: cfg.model, messages, response_format: { type: 'json_object' }, temperature: 0.3 }), signal: AbortSignal.timeout(600000) }); }
      catch (e) { lastErr = fail(e.name === 'TimeoutError' ? '模型响应超时，请稍后重试' : '无法连接模型服务，请检查配置和网络', 502); continue; }
      if (!response.ok) { const e = fail('模型服务返回错误（' + response.status + '），请稍后重试', 502); if (response.status >= 500) { lastErr = e; continue; } throw e; }
      const data = await response.json();
      try { return parseResult(data.choices?.[0]?.message?.content); }
      catch (e) { lastErr = e; }
    }
    throw lastErr || fail('模型返回的格式不完整，请重试', 502);
  }
  function send(res, code, data) { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); }
  // —— 生成任务持久化：服务重启后自动继续未完成的 analyze/evaluate ——
  function persistJobs() { replaceAll('jobs', [...jobs.values()], j => db.prepare('INSERT INTO jobs(id, sessionId, state, data) VALUES (?, ?, ?, ?)').run(j.id, j.sessionId || '', j.state || '', J(j))); }
  /** 岗位匹配：识别出的岗位方向与现有 JD 互相包含即视为同一岗位，自动关联 */
  function matchJd(role, jds) {
    const norm = s => String(s || '').toLowerCase().replace(/[\s（）()，,、·\-—_【】\[\]：:]/g, '');
    const r = norm(role);
    if (!r) return null;
    for (const j of jds) {
      const t = norm(j.title);
      if (t && (t.includes(r) || r.includes(t))) return j;
    }
    return null;
  }
  async function executeJob(job) {
    const b = job.payload || {};
    try {
      if (job.type === 'analyze') {
        const s0 = get(job.sessionId);
        // 重新生成时用已缓存的原文行（客户端无需重新解析简历）
        const lines = (b.lines || []).length ? b.lines : (s0.lines || []);
        const pages = (b.pageCount || s0.pageCount) || 1, images = b.images || [];
        const owner = { id: s0.userId };
        // 题库参考：组内公共题 + 岗位 JD 专属题（岗位题优先），供模型结合简历改写复用
        const bankQs = loadBank().questions.filter(q => canViewScoped(owner, q));
        const refQs = [...(s0.jdId ? bankQs.filter(q => q.jdId === s0.jdId) : []), ...bankQs.filter(q => !q.jdId)].slice(0, 40);
        const bankRef = refQs.length ? '\n\n题库参考（约六成题目从中选取高相关度的并结合简历改写，保持考察方向，不要照抄）：\n' + refQs.map(q => `[${q.partName}] ${q.title ? q.title + '：' : ''}${clip(q.q, 200)}`).join('\n') : '';
        const linesText = lines.map(l => `[${l.id} 页${l.page} y=${l.y.toFixed(3)}] ${l.text}`).join('\n');
        // 阶段一：结构提纲（带锚点）。重新生成时复用已缓存提纲，只重新出题，标注位置不变
        const reuseOutline = b.force === true && Array.isArray(s0.outline) && s0.outline.length;
        let outline, meta = null;
        if (reuseOutline) {
          outline = s0.outline;
        } else {
          job.stage = 'outline'; persistJobs();
          const content = [{ type: 'text', text: `目标岗位：${clip(b.role, 100) || '按简历求职方向'}\n页数：${pages}\n以下为带定位的原文行：\n` + linesText }, ...images.map(image => ({ type: 'image_url', image_url: { url: image } }))];
          meta = normalizeOutline(await llm([{ role: 'system', content: OUTLINE }, { role: 'user', content }]), lines, pages);
          outline = meta.sections;
        }
        // 阶段二：按提纲生成题目
        job.stage = 'questions'; persistJobs();
        const genContent = [{ type: 'text', text: `目标岗位：${clip(b.role, 100) || s0.role || '按简历求职方向'}\n板块提纲（返回的 section title 必须与下列标题逐字一致）：\n` + outline.map(o => `- ${o.title}`).join('\n') + `\n以下为带定位的原文行：\n` + linesText + bankRef }, ...images.map(image => ({ type: 'image_url', image_url: { url: image } }))];
        const genResult = await llm([{ role: 'system', content: GENERATE }, { role: 'user', content: genContent }]);
        const sections = normalizeQuestions(genResult, outline);
        const s = get(job.sessionId);
        if (meta) {
          // 岗位以现有 JD 为准：显式关联 > 匹配现有 JD（自动关联）> 用户手填 > 留空待补（模型猜测的方向不直接展示）
          const visible = loadJds().jds.filter(j => canViewScoped({ id: s.userId }, j));
          let jd = s.jdId ? visible.find(j => j.id === s.jdId) : null;
          if (!jd) jd = matchJd(clip(b.role, 100) || meta.role, visible);
          const role = jd ? jd.title : clip(b.role, 100);
          Object.assign(s, { name: meta.name || s.name, role, summary: meta.summary, outline, lines, pageCount: pages });
          if (jd) s.jdId = jd.id;
        }
        s.sections = sections; s.evaluation = null; save(s);
      } else {
        let s = get(job.sessionId);
        const records = s.sections.flatMap(sec => sec.questions.filter(q => !q.excluded).map(q => ({ ...q, section: sec.title })));
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
    delete job.payload;
    persistJobs();
    setTimeout(() => { jobs.delete(job.id); persistJobs(); }, 30 * 60 * 1000).unref();
  }
  // 恢复上次运行中未完成的任务
  for (const j of db.prepare('SELECT data FROM jobs').all().map(r => P(r.data))) {
    if (!j || !j.id || !j.sessionId || Date.parse(j.startedAt || 0) < Date.now() - 30 * 60 * 1000) continue;
    jobs.set(j.id, j);
    if (j.state === 'running') { console.log('恢复未完成的生成任务:', j.type, j.sessionId); void executeJob(j); }
  }
  const publicJob = j => { const { payload, ...pub } = j; return pub; };
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
        const basePath = (process.env.BASE_PATH || '').replace(/\/+$/, '');
        const redirectUri = cfg.feishuRedirectUri || `http://${req.headers.host || '127.0.0.1:8080'}${basePath}/api/auth/feishu/callback`;
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
        users[user.userId] = { name: clip(user.name, 50) || '飞书用户', avatar: typeof user.avatar === 'string' ? user.avatar : '', groups: Array.isArray(user.groups) ? user.groups : [], leaderOf: Array.isArray(user.leaderOf) ? user.leaderOf : [], updatedAt: new Date().toISOString() };
        saveUsers(users);
        if (!user.userId.startsWith('demo:')) {
          const meta = loadMeta();
          const configured = Array.isArray(config().admins) ? config().admins : [];
          if (!meta.admins.length && !configured.length) { meta.admins.push(user.userId); saveMeta(meta); }
        }
        issueSession(res, user.userId, clip(user.name, 50) || '飞书用户', typeof user.avatar === 'string' ? user.avatar : '');
        res.writeHead(302, { Location: '/' }); return res.end();
      }
      if (p === '/api/auth/demo' && method === 'POST') {
        // 演示登录仅用于本地开发与测试；生产部署不得设置 ENABLE_DEMO_LOGIN
        if (process.env.ENABLE_DEMO_LOGIN !== 'true' && !options.allowDemoLogin) throw fail('演示登录未启用', 403);
        const b = await json(req), name = clip(b.name, 50).trim();
        if (!name) throw fail('请提供用户名');
        const user = issueSession(res, 'demo:' + name, name, '');
        const users = loadUsers();
        if (!users[user.id]) { users[user.id] = { name: user.name, avatar: '', groups: [], updatedAt: new Date().toISOString() }; saveUsers(users); }
        return send(res, 200, { user });
      }
      if (p === '/api/auth/me' && method === 'GET') {
        const u = requireUser(req);
        return send(res, 200, { user: { id: u.id, name: u.name, avatar: u.avatar, isAdmin: isAdmin(u.id), isSuper: isSuper(u.id) }, groups: userGroups(u.id) });
      }
      if (p === '/api/auth/logout' && method === 'POST') {
        const t = cookieToken(req);
        if (t) db.prepare('DELETE FROM auth WHERE token = ?').run(t);
        res.setHeader('Set-Cookie', 'zm_sess=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0');
        res.writeHead(204, { 'Cache-Control': 'no-store' }); return res.end();
      }
      if (p === '/api/bank' && method === 'GET') {
        const user = requireUser(req);
        const bank = loadBank();
        // 超管可通过管理台按组查看（只读），不影响普通视图
        const groupView = url.searchParams.get('group');
        if (groupView !== null && isSuper(user.id)) {
          const parts = PART_ORDER.filter(k => bank.parts[k]).map(k => ({ key: k, name: bank.parts[k].name, weight: bank.parts[k].weight }));
          for (const [k, p2] of Object.entries(bank.parts)) {
            if (PART_ORDER.includes(k)) continue;
            if ((p2.groupId || '') !== groupView) continue;
            parts.push({ key: k, name: p2.name, weight: p2.weight || 0 });
          }
          if (bank.questions.some(q => q.custom)) parts.push({ key: 'CUST', name: '自定义', weight: 0 });
          const questions = bank.questions.filter(q => (q.groupId || '') === groupView).map(q => ({ ...q, readonly: true }));
          return send(res, 200, { parts, questions });
        }
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
      const pm = p.match(/^\/api\/bank\/parts\/([\w-]+)$/);
      if (pm && method === 'PATCH') {
        const user = requireUser(req);
        const bank = loadBank(), b = await json(req);
        const part = bank.parts[pm[1]];
        if (!part) throw fail('分类不存在', 404);
        const group = primaryGroup(user.id);
        if (part.groupId && part.groupId !== (group ? group.id : '') && !isAdmin(user.id)) throw fail('没有权限修改该分类', 403);
        const name = clip(b.name, 20).trim();
        if (!name) throw fail('分类名称不能为空');
        part.name = name;
        for (const q of bank.questions) if (q.part === pm[1]) q.partName = name;
        saveBank(bank);
        return send(res, 200, { key: pm[1], name });
      }
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
        const groupView = url.searchParams.get('group');
        if (groupView !== null && isSuper(user.id)) {
          const jds = loadJds().jds.filter(j => (j.groupId || '') === groupView).map(j => ({ ...j, readonly: true })).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
          return send(res, 200, { jds });
        }
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
        store.jds.push(jd); saveJds(store);
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
        jd.updatedAt = new Date().toISOString(); saveJds(store);
        return send(res, 200, jd);
      }
      if (jm2 && method === 'DELETE') {
        const user = requireUser(req);
        const store = loadJds(), index = store.jds.findIndex(j => j.id === jm2[1]);
        if (index === -1 || !canViewScoped(user, store.jds[index])) throw fail('岗位不存在', 404);
        if (!canEditScoped(user, store.jds[index])) throw fail('没有权限删除该岗位', 403);
        store.jds.splice(index, 1); saveJds(store);
        res.writeHead(204, { 'Cache-Control': 'no-store' }); return res.end();
      }
      // —— 用户目录：用于简历分享的对象选择 ——
      if (p === '/api/users' && method === 'GET') {
        requireUser(req);
        const users = Object.entries(loadUsers()).map(([uid, u]) => ({ id: uid, name: u.name || uid, avatar: u.avatar || '', groupName: (u.groups && u.groups[0]?.name) || '' })).sort((a, b) => a.name.localeCompare(b.name, 'zh'));
        return send(res, 200, { users });
      }
      // —— 管理：授权与组织架构 ——
      // —— 超管数据看板：全组织简历、面试、题库、岗位汇总 ——
      if (p === '/api/admin/dashboard' && method === 'GET') {
        requireSuper(req);
        const users = loadUsers();
        const sessions = listSessions();
        const byUser = new Map();
        let evaluated = 0, scoredQuestions = 0, totalQuestions = 0, scoreSum = 0;
        for (const s of sessions) {
          const active = (s.sections || []).flatMap(x => x.questions).filter(q => !q.excluded);
          const scored = active.filter(q => q.score !== null);
          totalQuestions += active.length; scoredQuestions += scored.length; scoreSum += scored.reduce((a, q) => a + q.score, 0);
          if (s.evaluation) evaluated++;
          const u = byUser.get(s.userId) || { userId: s.userId, name: users[s.userId]?.name || s.userId, sessions: 0, questions: 0, scored: 0, evaluated: 0 };
          u.sessions++; u.questions += active.length; u.scored += scored.length; if (s.evaluation) u.evaluated++;
          byUser.set(s.userId, u);
        }
        const bank = loadBank();
        const bankByGroup = new Map();
        for (const q of bank.questions) {
          const k = q.groupId || '';
          const g = bankByGroup.get(k) || { groupId: k, groupName: q.groupName || '个人题目', total: 0, custom: 0 };
          g.total++; if (q.custom) g.custom++;
          bankByGroup.set(k, g);
        }
        const jds = loadJds().jds;
        const jdByGroup = new Map();
        for (const j of jds) {
          const k = j.groupId || '';
          const g = jdByGroup.get(k) || { groupId: k, groupName: j.groupName || '个人岗位', count: 0 };
          g.count++;
          jdByGroup.set(k, g);
        }
        const recent = [...sessions].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')).slice(0, 10).map(s => {
          const active = (s.sections || []).flatMap(x => x.questions).filter(q => !q.excluded);
          const scored = active.filter(q => q.score !== null);
          return { id: s.id, name: s.name, role: s.role, ownerName: users[s.userId]?.name || s.userId, phase: s.phase, updatedAt: s.updatedAt, questionCount: active.length, scoredCount: scored.length, avgScore: scored.length ? Math.round(scored.reduce((a, q) => a + q.score, 0) / scored.length * 10) / 10 : null, hasEvaluation: !!s.evaluation };
        });
        return send(res, 200, {
          userCount: Object.keys(users).length,
          sessions: { total: sessions.length, evaluated, byPhase: { prepare: sessions.filter(s => s.phase === 'prepare').length, interview: sessions.filter(s => s.phase === 'interview').length, review: sessions.filter(s => s.phase === 'review').length } },
          questions: { total: totalQuestions, scored: scoredQuestions, avgScore: scoredQuestions ? Math.round(scoreSum / scoredQuestions * 10) / 10 : null },
          byUser: [...byUser.values()].sort((a, b) => b.sessions - a.sessions),
          bank: { total: bank.questions.length, byGroup: [...bankByGroup.values()].sort((a, b) => b.total - a.total) },
          jds: { total: jds.length, byGroup: [...jdByGroup.values()].sort((a, b) => b.count - a.count) },
          recent,
        });
      }
      if (p === '/api/admin/overview' && method === 'GET') {
        requireAdmin(req);
        const grants = loadGrants(), org = loadOrg();
        const users = Object.entries(loadUsers()).map(([uid, u]) => ({ id: uid, name: u.name || uid, avatar: u.avatar || '', groupName: (u.groups && u.groups[0]?.pathName) || '', isAdmin: isAdmin(uid), isSuper: isSuper(uid), grants: grants[uid] || [] })).sort((a, b) => a.name.localeCompare(b.name, 'zh'));
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
        saveGrants(grants);
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
        meta.admins = [...set]; saveMeta(meta);
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
            const u = 'https://open.feishu.cn/open-apis/contact/v3/departments?department_id_type=open_department_id&user_id_type=union_id&parent_department_id=0&fetch_child=true&page_size=50' + (pageToken ? '&page_token=' + encodeURIComponent(pageToken) : '');
            const r = await fetch(u, { headers: { Authorization: 'Bearer ' + at.app_access_token }, signal: AbortSignal.timeout(15000) });
            const j = await r.json();
            if (!r.ok || j.code !== 0) throw new Error('departments: ' + JSON.stringify(j).slice(0, 300));
            for (const d of j.data?.items || []) {
              const did = d.open_department_id || d.department_id;
              if (!did) continue;
              org.depts[did] = { id: did, name: d.name || did, parentId: d.parent_department_id && d.parent_department_id !== '0' ? d.parent_department_id : '', leaderId: d.leader_user_id || '', path: [], pathName: '' };
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
          saveOrg(org);
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
          // 依据本次刷新的部门负责人信息，重算所有用户的 leaderOf（无需额外请求）
          for (const [uid, u] of Object.entries(users)) {
            if (!uid.startsWith('fs:') || !(u.groups && u.groups.length)) continue;
            const leaderOf = computeLeaderOf(uid.slice(3), u.groups, org);
            if (JSON.stringify(leaderOf) !== JSON.stringify(u.leaderOf || [])) { u.leaderOf = leaderOf; usersDirty = true; }
          }
          if (usersDirty) saveUsers(users);
          return send(res, 200, { depts: org.depts, fetchedAt: org.fetchedAt, syncedUsers });
        } catch (e) { console.error('组织架构同步失败:', e.message); throw fail('组织架构同步失败：' + (e.message.includes('99991672') || e.message.includes('permission') ? '请为应用开通 contact:department.base:readonly 权限' : '请检查飞书配置与网络'), 502); }
      }
      if (p === '/api/sessions' && method === 'GET') {
        const user = requireUser(req);
        const users = loadUsers();
        const superView = isSuper(user.id);
        const runningJobs = new Map([...jobs.values()].filter(j => j.state === 'running').map(j => [j.sessionId, j.type]));
        return send(res, 200, listSessions().filter(x => x.userId === user.id || superView || canLeadView(user, x.userId) || (Array.isArray(x.shares) && x.shares.includes(user.id))).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(({ sections, lines, text, evaluation, shares, ...s }) => { const questions = (sections || []).flatMap(x => x.questions).filter(q => !q.excluded); const scored = questions.filter(q => q.score !== null); const reallyShared = s.userId !== user.id && Array.isArray(shares) && shares.includes(user.id); const notOwn = s.userId !== user.id && !reallyShared; return { ...s, sharedBy: s.userId === user.id ? '' : (users[s.userId]?.name || '同事'), viaSuper: notOwn && superView, viaLeader: notOwn && !superView && canLeadView(user, s.userId), jobState: runningJobs.get(s.id) || null, questionCount: questions.length, scoredCount: scored.length, avgScore: scored.length ? Math.round(scored.reduce((a, q) => a + q.score, 0) / scored.length * 10) / 10 : null, hasEvaluation: !!evaluation, suggestion: evaluation ? clip(evaluation.suggestion, 200) : '' }; }));
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
        // 选择的岗位 JD：岗位信息从 JD 带出；未选则留空待后续补充（先校验再写文件）
        let jdId = '', role = '';
        const jdParam = url.searchParams.get('jd') || '';
        if (jdParam) {
          const jd = loadJds().jds.find(j => j.id === jdParam);
          if (!jd || !canViewScoped(user, jd)) throw fail('岗位 JD 不存在', 404);
          jdId = jd.id; role = jd.title;
        }
        const sid = id(), storedExt = ext === '.jpeg' ? '.jpg' : ext;
        fs.writeFileSync(path.join(dir, sid + storedExt), file);
        return send(res, 201, save({ id: sid, userId: user.id, fileName: name, file: sid + storedExt, name: name.replace(/\.[^.]+$/, ''), role, summary: '', text, sections: [], lines: [], pageCount: 1, phase: 'prepare', note: '', evaluation: null, ...(jdId ? { jdId } : {}), createdAt: new Date().toISOString() }));
      }
      const jm = p.match(/^\/api\/jobs\/([\w-]+)$/);
      if (jm && method === 'GET') { const job = jobs.get(jm[1]); if (!job) throw fail('任务已结束或服务已重启，请重试', 404); return send(res, 200, publicJob(job)); }
      const sm = p.match(/^\/api\/sessions\/([\w-]+)(?:\/(analyze|evaluate))?$/);
      if (sm) {
        let s = get(sm[1]);
        const user = requireUser(req);
        const owner = s.userId === user.id, shared = !owner && Array.isArray(s.shares) && s.shares.includes(user.id), superView = !owner && !shared && isSuper(user.id), leaderView = !owner && !shared && !superView && canLeadView(user, s.userId);
        if (!owner && !shared && !superView && !leaderView) throw fail('简历不存在', 404);
        if (!sm[2] && method === 'GET') return send(res, 200, s);
        if (!sm[2] && method === 'DELETE') {
          if (!owner) throw fail('只有所有者可删除', 403);
          db.prepare('DELETE FROM sessions WHERE id = ?').run(s.id);
          if (s.file) { const stored = path.join(dir, path.basename(s.file)); if (fs.existsSync(stored)) fs.unlinkSync(stored); }
          res.writeHead(204, { 'Cache-Control': 'no-store' }); return res.end();
        }
        if (!sm[2] && method === 'PATCH') {
          if (superView || leaderView) throw fail('仅可查看，不能修改他人的面试记录', 403);
          const b = await json(req);
          if (typeof b.role === 'string' || 'jdId' in b) {
            if (!owner) throw fail('只有所有者可修改岗位信息', 403);
            if ('jdId' in b) {
              if (!b.jdId) { delete s.jdId; }
              else {
                const jd = loadJds().jds.find(j => j.id === b.jdId);
                if (!jd || !canViewScoped(user, jd)) throw fail('岗位 JD 不存在', 404);
                s.jdId = jd.id; s.role = jd.title; // 关联 JD 后岗位名以 JD 为准
              }
            } else if (typeof b.role === 'string') { s.role = clip(b.role, 100); }
          }
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
          if (existing) return send(res, 202, publicJob(existing));
          if (sm[2] === 'analyze' && s.sections.length && !b.force) throw fail('该简历已生成题目。如需重新识别，请在准备阶段使用「重新识别生成」', 409);
          const lines = (Array.isArray(b.lines) ? b.lines : []).slice(0, 2000).map(l => ({ id: clip(l.id, 40), text: clip(l.text, 1500), page: Math.max(1, Math.min(20, Number(l.page) || 1)), y: Math.max(0, Math.min(1, Number(l.y) || 0)), x: Math.max(0, Math.min(1, Number(l.x) || 0)) }));
          // 重新生成时客户端可不带原文行，回落到首次分析缓存的 lines
          const effLines = lines.length ? lines : (s.lines || []);
          const pages = Math.max(1, Math.min(20, Math.floor(Number(b.pageCount) || s.pageCount || 1)));
          const images = (Array.isArray(b.images) ? b.images : []).filter(x => typeof x === 'string' && /^data:image\/(jpeg|png);base64,/.test(x)).slice(0, 20);
          const records = s.sections.flatMap(sec => sec.questions.filter(q => !q.excluded).map(q => ({ ...q, section: sec.title })));
          if (sm[2] === 'analyze' && !effLines.length && !images.length) throw fail('简历内容尚未加载，请稍后重试');
          if (sm[2] === 'evaluate' && !records.some(q => q.score !== null || q.note.trim()) && !s.note.trim()) throw fail('请先记录评分或面试观察，再生成综合评价');
          const job = { id: id(), sessionId: s.id, type: sm[2], state: 'running', startedAt: new Date().toISOString(), payload: { role: clip(b.role, 100), lines: effLines, pageCount: pages, images, force: b.force === true } };
          jobs.set(job.id, job);
          persistJobs();
          send(res, 202, publicJob(job));
          void executeJob(job);
          return;
        }
      }
      if (method !== 'GET') throw fail('接口不存在', 404);
      let file;
      if (p.startsWith('/files/')) {
        const name = p.slice(7); if (!/^[\w-]+\.(pdf|docx|txt|png|jpg)$/.test(name)) throw fail('文件不存在', 404);
        const user = requireUser(req);
        const owner = get(name.replace(/\.[^.]+$/, ''));
        if (owner.userId !== user.id && !(Array.isArray(owner.shares) && owner.shares.includes(user.id)) && !isSuper(user.id) && !canLeadView(user, owner.userId)) throw fail('文件不存在', 404);
        file = path.join(dir, name);
      } else {
        file = path.resolve(distDir, '.' + (p === '/' ? '/index.html' : p));
        if (!file.startsWith(distDir + path.sep)) throw fail('文件不存在', 404);
      }
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw fail('文件不存在', 404);
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-cache' }); fs.createReadStream(file).pipe(res);
    } catch (e) { if (!res.headersSent) send(res, e.status || 500, { error: e.status ? e.message : '服务处理失败，请重试' }); else res.end(); }
  });
  server._db = db; // 暴露给测试做数据种子/断言
  server.on('close', () => { try { db.close(); } catch {} });
  return server;
}
if (require.main === module) { const port = Number(process.env.PORT) || 8080, host = process.env.HOST || '0.0.0.0'; createApp().listen(port, host, () => { const nets = require('os').networkInterfaces(); const lan = Object.values(nets).flat().filter(Boolean).find(n => n.family === 'IPv4' && !n.internal); console.log(`知马已启动：http://localhost:${port}${lan ? `（局域网：http://${lan.address}:${port}）` : ''}`); }); }
module.exports = { createApp, normalizeOutline, normalizeQuestions };
