// AI 管培生面试管理 —— 纯 Node 内置模块实现（含 node:sqlite），无任何 npm 依赖
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

const { PARTS, GUIDE, questions } = require('./data/questions.js');

const PORT = 3000;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'interview.db');
const LEGACY_JSON = path.join(DATA_DIR, 'db.json');
const RESUME_DIR = path.join(DATA_DIR, 'resumes');

const JSON_LIMIT = 20 * 1024 * 1024; // 20MB
const PDF_LIMIT = 50 * 1024 * 1024;  // 50MB

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.ico': 'image/x-icon'
};

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(RESUME_DIR, { recursive: true });

// ---------- SQLite 数据层 ----------
const sq = new DatabaseSync(DB_FILE);
sq.exec('PRAGMA journal_mode = WAL');
sq.exec('PRAGMA foreign_keys = ON');
sq.exec(`
CREATE TABLE IF NOT EXISTS interviewers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT
);
CREATE TABLE IF NOT EXISTS candidates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  note TEXT,
  resume TEXT,
  created_at TEXT
);
CREATE TABLE IF NOT EXISTS interviews (
  id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  created_at TEXT,
  status TEXT,
  comment TEXT
);
CREATE TABLE IF NOT EXISTS scores (
  interview_id TEXT NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  interviewer_id TEXT NOT NULL REFERENCES interviewers(id) ON DELETE CASCADE,
  score INTEGER,
  note TEXT,
  updated_at TEXT,
  PRIMARY KEY (interview_id, question_id, interviewer_id)
);
`);

// 幂等迁移：candidates 增加 generated_questions 列（AI 简历分析结果，TEXT 存 JSON）
const candCols = sq.prepare('PRAGMA table_info(candidates)').all().map(c => c.name);
if (!candCols.includes('generated_questions')) {
  sq.exec('ALTER TABLE candidates ADD COLUMN generated_questions TEXT');
  console.log('已为 candidates 表添加 generated_questions 列');
}
// 幂等迁移：candidates 增加 hidden_questions 列（按面试者隐藏的题目 id，TEXT 存 JSON 数组）
if (!candCols.includes('hidden_questions')) {
  sq.exec('ALTER TABLE candidates ADD COLUMN hidden_questions TEXT');
  console.log('已为 candidates 表添加 hidden_questions 列');
}
// 幂等迁移：interviews 增加 evaluation 列（AI 综合评价，TEXT 存 JSON）
const ivCols = sq.prepare('PRAGMA table_info(interviews)').all().map(c => c.name);
if (!ivCols.includes('evaluation')) {
  sq.exec('ALTER TABLE interviews ADD COLUMN evaluation TEXT');
  console.log('已为 interviews 表添加 evaluation 列');
}

// ---------- 旧 db.json 数据迁移（幂等：导入后重命名为 db.json.migrated） ----------
(function migrateLegacyJSON() {
  if (!fs.existsSync(LEGACY_JSON)) return;
  let legacy;
  try {
    legacy = JSON.parse(fs.readFileSync(LEGACY_JSON, 'utf-8'));
  } catch (e) {
    console.error('db.json 解析失败，跳过迁移：', e.message);
    return;
  }
  const hasData = (legacy.interviewers && legacy.interviewers.length) ||
    (legacy.candidates && legacy.candidates.length) ||
    (legacy.interviews && legacy.interviews.length);
  if (hasData) {
    const tx = (fn) => { sq.exec('BEGIN'); try { fn(); sq.exec('COMMIT'); } catch (e) { sq.exec('ROLLBACK'); throw e; } };
    tx(() => {
      for (const it of legacy.interviewers || []) {
        sq.prepare('INSERT OR IGNORE INTO interviewers (id, name, created_at) VALUES (?, ?, ?)')
          .run(it.id, it.name, it.createdAt || null);
      }
      for (const c of legacy.candidates || []) {
        sq.prepare('INSERT OR IGNORE INTO candidates (id, name, phone, note, resume, created_at) VALUES (?, ?, ?, ?, ?, ?)')
          .run(c.id, c.name, c.phone || '', c.note || '', c.resume || null, c.createdAt || null);
      }
      for (const iv of legacy.interviews || []) {
        sq.prepare('INSERT OR IGNORE INTO interviews (id, candidate_id, created_at, status, comment) VALUES (?, ?, ?, ?, ?)')
          .run(iv.id, iv.candidateId, iv.createdAt || null, iv.status || '进行中', iv.comment || '');
        for (const [qid, cells] of Object.entries(iv.scores || {})) {
          for (const [iid, cell] of Object.entries(cells || {})) {
            sq.prepare(`INSERT INTO scores (interview_id, question_id, interviewer_id, score, note, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?)
                        ON CONFLICT(interview_id, question_id, interviewer_id)
                        DO UPDATE SET score=excluded.score, note=excluded.note, updated_at=excluded.updated_at`)
              .run(iv.id, qid, iid, typeof cell.score === 'number' ? cell.score : null, cell.note || '', cell.updatedAt || null);
          }
        }
      }
    });
    console.log('已将 db.json 旧数据迁移到 SQLite (interview.db)');
  }
  let target = LEGACY_JSON + '.migrated';
  if (fs.existsSync(target)) {
    target = LEGACY_JSON + '.' + new Date().toISOString().replace(/[:.]/g, '-') + '.migrated';
  }
  fs.renameSync(LEGACY_JSON, target);
})();

// ---------- LLM 配置与调用（config.json，Key 不入库不入日志） ----------
function loadLLMConfig() {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf-8'));
  } catch (e) {
    return null;
  }
}

async function callLLM(messages) {
  const cfg = loadLLMConfig();
  if (!cfg || !cfg.baseUrl || !cfg.apiKey || !cfg.model) {
    const err = new Error('LLM 未配置（config.json 缺失或字段不全）'); err.status = 500; throw err;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 240000); // 推理模型 reasoning 耗时，实测约 110-170s，留足余量
  let res;
  try {
    res = await fetch(cfg.baseUrl.replace(/\/+$/, '') + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.apiKey },
      body: JSON.stringify({
        model: cfg.model, messages,
        response_format: { type: 'json_object' },
        max_tokens: 12000, temperature: 0.3
      }),
      signal: controller.signal
    });
  } catch (e) {
    const err = new Error(e.name === 'AbortError' ? 'LLM 请求超时（240s）' : 'LLM 请求失败：' + e.message);
    err.status = 502; throw err;
  } finally { clearTimeout(timer); }
  if (!res.ok) {
    const err = new Error('LLM 接口返回 ' + res.status); err.status = 502; throw err;
  }
  let data;
  try { data = await res.json(); } catch (e) {
    const err = new Error('LLM 返回非 JSON'); err.status = 502; throw err;
  }
  const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!content) { const err = new Error('LLM 返回内容为空'); err.status = 502; throw err; }
  return content;
}

// 优先按纯 JSON 解析，失败则做花括号提取兜底
function extractJSON(text) {
  try { return JSON.parse(text); } catch (e) {}
  const m = String(text).match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch (e) {} }
  return null;
}

// ---------- AI 简历分析异步任务 ----------
const analyzeJobs = new Map();               // jobId -> job
const runningAnalyzeByCandidate = new Map(); // candidateId -> jobId（防连击）
const ANALYZE_JOB_TTL = 10 * 60 * 1000;      // 完成/失败 10 分钟后清理

const ANALYZE_SYSTEM_PROMPT = '你是资深技术面试官兼招聘专家，正在为「AI 管培生」岗位（看重 Agent 使用能力、AI 基础概念、工程落地经验、学习与成长潜力）设计针对候选人简历项目经历的面试问题。\n' +
  '硬性要求：\n' +
  '1. 每个项目出 3-4 题，每题必须引用简历中的具体细节（项目里的数字、技术选型、职责描述中的具体动作），禁止"请介绍一下这个项目"这类万能问题。\n' +
  '2. 题目类型混搭：经历深挖（STAR 行为面试法：当时什么背景、你负责什么、你具体做了什么、结果如何有无数据）、技术取舍（为什么选 A 不选 B、遇到过什么坑）、行为题（冲突 / 赶 deadline / 推动他人），且至少 1 题考察 AI 工具在项目中的真实使用。多问"你当时怎么做的"，少问"你会怎么做"。\n' +
  '3. 每题附 point（考察点，给面试官看的评分参考，1-2 句）、followUp（1 条追问话术，用于验证候选人是不是真做过，例如"这个方案有什么缺点？""当时具体数据是多少？"）和 expected（参考答案：技术取舍题写出参考要点，含应提到的关键词/权衡点；STAR 行为题/经历题没有标准答案，写"预期答案要点"——一个好答案应覆盖的 2-4 条关键点。expected 是给面试官对照用的评分参考，不是逐字标准答案）。\n' +
  '只返回 JSON，格式：{"name":"候选人姓名","projects":[{"name":"项目名","questions":[{"q":"问题","point":"考察点","followUp":"追问","expected":"参考答案/预期要点"}]}]}。' +
  '若简历中识别不到姓名，name 填空字符串；若没有项目经历，projects 填空数组。';

async function runAnalyzeJob(jobId, candidateId, images, resumeText) {
  const job = analyzeJobs.get(jobId);
  try {
    let userContent;
    if (images.length) {
      userContent = [
        { type: 'text', text: '以下是候选人简历的截图（共 ' + images.length + ' 页），请识图分析：' },
        ...images.map(u => ({ type: 'image_url', image_url: { url: u } }))
      ];
    } else {
      userContent = '简历文本如下：\n' + resumeText;
    }
    const content = await callLLM([
      { role: 'system', content: ANALYZE_SYSTEM_PROMPT },
      { role: 'user', content: userContent }
    ]);
    const parsed = extractJSON(content);
    if (!parsed || !Array.isArray(parsed.projects)) {
      throw Object.assign(new Error('LLM 返回格式无法解析（不是预期的 JSON 结构）'), {});
    }
    // 归一化：兼容模型返回纯字符串问题（旧格式），统一为 {q, point, followUp, expected}
    const normQ = (item) => {
      if (typeof item === 'string') return { q: item, point: '', followUp: '', expected: '' };
      if (!item || typeof item !== 'object') return null;
      return {
        q: String(item.q || item.question || ''),
        point: String(item.point || ''),
        followUp: String(item.followUp || ''),
        expected: String(item.expected || '')
      };
    };
    const result = {
      name: typeof parsed.name === 'string' ? parsed.name.trim() : '',
      projects: parsed.projects.slice(0, 10).map(pj => ({
        name: String(pj && pj.name || '未命名项目'),
        questions: (Array.isArray(pj.questions) ? pj.questions : []).slice(0, 4).map(normQ).filter(x => x && x.q)
      })).filter(pj => pj.questions.length)
    };
    q.setGenQuestions.run(JSON.stringify(result), candidateId);
    if (result.name) q.backfillName.run(result.name, candidateId);
    job.status = 'done';
    job.result = result;
  } catch (e) {
    job.status = 'error';
    job.error = (e && e.message) || String(e);
  } finally {
    runningAnalyzeByCandidate.delete(candidateId);
    setTimeout(() => analyzeJobs.delete(jobId), ANALYZE_JOB_TTL);
  }
}

// ---------- 数据访问（对外结构保持与原 JSON 版一致） ----------
const q = {
  allInterviewers: sq.prepare('SELECT id, name FROM interviewers ORDER BY created_at, rowid'),
  getInterviewer: sq.prepare('SELECT id, name FROM interviewers WHERE id = ?'),
  addInterviewer: sq.prepare('INSERT INTO interviewers (id, name, created_at) VALUES (?, ?, ?)'),
  delInterviewer: sq.prepare('DELETE FROM interviewers WHERE id = ?'),
  allCandidates: sq.prepare('SELECT * FROM candidates ORDER BY created_at, rowid'),
  getCandidate: sq.prepare('SELECT * FROM candidates WHERE id = ?'),
  addCandidate: sq.prepare('INSERT INTO candidates (id, name, phone, note, resume, created_at) VALUES (?, ?, ?, ?, ?, ?)'),
  updCandidate: sq.prepare('UPDATE candidates SET name = ?, phone = ?, note = ? WHERE id = ?'),
  setHiddenQuestions: sq.prepare('UPDATE candidates SET hidden_questions = ? WHERE id = ?'),
  setResume: sq.prepare('UPDATE candidates SET resume = ? WHERE id = ?'),
  delCandidate: sq.prepare('DELETE FROM candidates WHERE id = ?'),
  setGenQuestions: sq.prepare('UPDATE candidates SET generated_questions = ? WHERE id = ?'),
  backfillName: sq.prepare("UPDATE candidates SET name = ? WHERE id = ? AND (name IS NULL OR name = '' OR name = '未命名')"),
  getInterview: sq.prepare('SELECT * FROM interviews WHERE id = ?'),
  allInterviews: sq.prepare('SELECT * FROM interviews ORDER BY created_at, rowid'),
  findOpenByCandidate: sq.prepare("SELECT * FROM interviews WHERE candidate_id = ? AND status = '进行中' ORDER BY created_at LIMIT 1"),
  addInterview: sq.prepare('INSERT INTO interviews (id, candidate_id, created_at, status, comment) VALUES (?, ?, ?, ?, ?)'),
  updInterview: sq.prepare('UPDATE interviews SET status = ?, comment = ? WHERE id = ?'),
  setEvaluation: sq.prepare('UPDATE interviews SET evaluation = ? WHERE id = ?'),
  scoresOfInterview: sq.prepare('SELECT * FROM scores WHERE interview_id = ?'),
  scoresOfQuestion: sq.prepare('SELECT * FROM scores WHERE interview_id = ? AND question_id = ?'),
  upsertScore: sq.prepare(`INSERT INTO scores (interview_id, question_id, interviewer_id, score, note, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(interview_id, question_id, interviewer_id)
    DO UPDATE SET score = excluded.score, note = excluded.note, updated_at = excluded.updated_at`)
};

function candidateOut(r) {
  if (!r) return null;
  let generatedQuestions = null;
  if (r.generated_questions) {
    try { generatedQuestions = JSON.parse(r.generated_questions); } catch (e) {}
  }
  let hiddenQuestions = [];
  if (r.hidden_questions) {
    try {
      const arr = JSON.parse(r.hidden_questions);
      if (Array.isArray(arr)) hiddenQuestions = arr.filter(x => typeof x === 'string');
    } catch (e) {}
  }
  return { id: r.id, name: r.name, phone: r.phone || '', note: r.note || '', resume: r.resume || null, createdAt: r.created_at, generatedQuestions, hiddenQuestions };
}

function interviewOut(row) {
  if (!row) return null;
  const scores = {};
  for (const s of q.scoresOfInterview.all(row.id)) {
    if (!scores[s.question_id]) scores[s.question_id] = {};
    scores[s.question_id][s.interviewer_id] = {
      score: s.score === null || s.score === undefined ? null : Number(s.score),
      note: s.note || '',
      updatedAt: s.updated_at || null
    };
  }
  return {
    id: row.id, candidateId: row.candidate_id, createdAt: row.created_at,
    status: row.status, scores, comment: row.comment || ''
  };
}

// ---------- 报告数据组装 ----------
// 面试者 AI 生成题的 id -> {question, projectName} 映射（G-项目序号-问题序号）
function genQuestionMap(candidate) {
  const map = {};
  const gq = candidate && candidate.generated_questions;
  if (gq) {
    try {
      const parsed = typeof gq === 'string' ? JSON.parse(gq) : gq;
      (parsed.projects || []).forEach((pj, pi) => {
        (pj.questions || []).forEach((item, qi) => {
          const qt = typeof item === 'string' ? item : String(item.q || '');
          map['G-' + (pi + 1) + '-' + (qi + 1)] = { question: qt, projectName: pj.name || '' };
        });
      });
    } catch (e) {}
  }
  return map;
}

// 有效题目：score 非空 或 note 非空（未打分未备注视为没问到）
function effectiveQuestions(ivRow) {
  const candidate = q.getCandidate.get(ivRow.candidate_id);
  const gqMap = genQuestionMap(candidate);
  const rows = q.scoresOfInterview.all(ivRow.id);
  const byQ = {};
  for (const s of rows) {
    const hasScore = s.score !== null && s.score !== undefined;
    const hasNote = (s.note || '').trim().length > 0;
    if (!hasScore && !hasNote) continue;
    if (!byQ[s.question_id]) byQ[s.question_id] = [];
    const it = q.getInterviewer.get(s.interviewer_id);
    byQ[s.question_id].push({
      interviewerId: s.interviewer_id,
      interviewerName: it ? it.name : s.interviewer_id,
      score: hasScore ? Number(s.score) : null,
      note: s.note || '',
      updatedAt: s.updated_at || null
    });
  }
  const out = [];
  for (const [qid, cells] of Object.entries(byQ)) {
    const fixed = questions.find(x => x.id === qid);
    let question = null, partName = null, part = null;
    if (fixed) { question = fixed.question; partName = fixed.partName; part = fixed.part; }
    else if (gqMap[qid]) { question = gqMap[qid].question; partName = '🤖 简历项目问题'; part = 'G'; }
    if (!question) continue;
    const scored = cells.filter(c => typeof c.score === 'number');
    const avg = scored.length ? scored.reduce((a, c) => a + c.score, 0) / scored.length : null;
    out.push({ id: qid, part, partName, question, scores: cells, avg });
  }
  // 排序：固定题按题库顺序，G 题排最后
  out.sort((a, b) => {
    const ia = a.part === 'G' ? 999 + Number(a.id.slice(2).replace('-', '.')) : questions.findIndex(x => x.id === a.id);
    const ib = b.part === 'G' ? 999 + Number(b.id.slice(2).replace('-', '.')) : questions.findIndex(x => x.id === b.id);
    return ia - ib;
  });
  return out;
}

function buildReportData(ivRow) {
  const candidate = candidateOut(q.getCandidate.get(ivRow.candidate_id));
  const qs = effectiveQuestions(ivRow);
  // Part 平均分（按 5 分制），G 题单独成组
  const partGroups = new Map();
  for (const qq of qs) {
    if (qq.avg === null) continue;
    if (!partGroups.has(qq.partName)) partGroups.set(qq.partName, []);
    partGroups.get(qq.partName).push(qq.avg);
  }
  const partAverages = [];
  for (const [partName, avgs] of partGroups) {
    partAverages.push({ partName, avg: avgs.reduce((a, b) => a + b, 0) / avgs.length });
  }
  const allAvgs = qs.filter(x => x.avg !== null).map(x => x.avg);
  const overallAvg = allAvgs.length ? allAvgs.reduce((a, b) => a + b, 0) / allAvgs.length : null;
  let evaluation = null;
  if (ivRow.evaluation) {
    try { evaluation = JSON.parse(ivRow.evaluation); } catch (e) { evaluation = { overall: ivRow.evaluation }; }
  }
  return {
    interview: { id: ivRow.id, createdAt: ivRow.created_at, status: ivRow.status, comment: ivRow.comment || '' },
    candidate,
    interviewers: q.allInterviewers.all(),
    questions: qs,
    partAverages,
    overallAvg,
    overallAvgPct: overallAvg === null ? null : overallAvg / 5 * 100,
    evaluation
  };
}

const EVAL_SYSTEM_PROMPT = '你是资深技术面试官兼招聘专家。公司在招「AI 管培生」，看重候选人使用 AI Agent 的能力、AI 基础概念、工程落地经验、学习与成长潜力。' +
  '根据给出的某场面试逐题打分记录（题目、各面试官 0-5 分和备注）和百分制总平均分，写一份综合评价。' +
  '要求：具体、言之有物，必须引用题目表现和面试官备注中的细节（如某题的低分原因、某题展现出的亮点），不要套话空话；分数偏低时指出具体差距，分数高时指出具体证据。' +
  '「录用建议」的结论必须严格对齐百分制总平均分（用户消息中会给出该分数，这是已知事实，不许重新计算或质疑）：' +
  '≥ 80 分 → 推荐录用（个别低分项如果只是小瑕疵、不离谱，不影响推荐结论，可在不足中提及但不下调结论）；' +
  '60–80 分 → 可以考虑（指出优势与需要加面/验证的点）；' +
  '< 60 分 → 不建议录用。' +
  '结论措辞可自然但立场不许漂移，且必须在结论中明说档位依据（如"总平均分 87 分，达到推荐线"）。' +
  '只返回 JSON，格式：{"overall":"总体印象（2-3 句）","strengths":["优势1","优势2"],"weaknesses":["不足1","不足2"],"suggestion":"录用建议（含档位依据，1-2 句）"}。';

async function generateEvaluation(ivRow) {
  const qs = effectiveQuestions(ivRow);
  if (!qs.length) {
    const err = new Error('该面试还没有任何有效打分或备注，无法生成综评'); err.status = 400; throw err;
  }
  const candidate = q.getCandidate.get(ivRow.candidate_id);
  // 百分制总平均分（与 report-data 同口径：仅实际打分的题，5 分制平均 ×20）
  const allAvgs = qs.filter(x => x.avg !== null).map(x => x.avg);
  const overallAvg = allAvgs.length ? allAvgs.reduce((a, b) => a + b, 0) / allAvgs.length : null;
  const totalPct = overallAvg === null ? null : Math.round(overallAvg / 5 * 100);
  const lines = [
    '候选人：' + (candidate ? candidate.name : '?'),
    '该候选人百分制总平均分为 ' + (totalPct === null ? '（无法计算）' : totalPct + ' 分') + '（已知事实，录用建议档位必须按此对齐），共 ' + qs.length + ' 道有效题。',
    ''
  ];
  for (const qq of qs) {
    lines.push('【' + qq.id + ' ' + qq.partName + '】' + qq.question);
    for (const c of qq.scores) {
      lines.push('  - ' + c.interviewerName + '：' + (typeof c.score === 'number' ? c.score + ' 分' : '未打分') + (c.note ? '，备注：' + c.note : ''));
    }
    lines.push('  题平均分：' + (qq.avg === null ? '--' : qq.avg.toFixed(1)));
    lines.push('');
  }
  const userMsg = lines.join('\n');
  // 模型偶发输出截断（valid JSON 但字段为空），校验不完整时自动重试一次
  let lastErr = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const content = await callLLM([
        { role: 'system', content: EVAL_SYSTEM_PROMPT },
        { role: 'user', content: userMsg }
      ]);
      const parsed = extractJSON(content);
      if (!parsed || typeof parsed.overall !== 'string') {
        throw new Error('LLM 返回格式无法解析（综评 JSON 结构不符）');
      }
      const result = {
        overall: String(parsed.overall || ''),
        strengths: (Array.isArray(parsed.strengths) ? parsed.strengths : []).map(String),
        weaknesses: (Array.isArray(parsed.weaknesses) ? parsed.weaknesses : []).map(String),
        suggestion: String(parsed.suggestion || ''),
        generatedAt: new Date().toISOString()
      };
      if (!result.suggestion || (!result.strengths.length && !result.weaknesses.length)) {
        throw new Error('LLM 返回内容不完整（综评字段缺失），已自动重试');
      }
      q.setEvaluation.run(JSON.stringify(result), ivRow.id);
      return result;
    } catch (e) {
      lastErr = e;
      if (attempt === 0) continue;
    }
  }
  if (lastErr && !lastErr.status) lastErr.status = 502;
  throw lastErr;
}

function uid() {
  return Date.now().toString(36) + crypto.randomBytes(4).toString('hex');
}

// ---------- 投屏状态（内存） ----------
let screenState = { questionId: null };
const screenClients = new Set();

function broadcastScreen() {
  const payload = 'data: ' + JSON.stringify(screenState) + '\n\n';
  for (const res of screenClients) {
    try { res.write(payload); } catch (e) { screenClients.delete(res); }
  }
}

// 脱敏 + 精简：投屏只需要素材本体（images / material + 类型标记），绝不含题干和答案
function screenPayload(qq) {
  if (!qq) return null;
  const images = qq.images || [];
  const material = qq.material || null;
  let kind = 'none';
  if (images.length > 1) kind = 'images';
  else if (images.length === 1) kind = 'image';
  else if (material) kind = 'material';
  return { id: qq.id, kind, images, material };
}

// ---------- 面试 SSE 频道（按 interview id 分频道广播） ----------
const interviewClients = new Map(); // id -> Set<res>
function broadcastInterview(id) {
  const set = interviewClients.get(id);
  if (!set || !set.size) return;
  const iv = interviewOut(q.getInterview.get(id));
  if (!iv) return;
  const payload = 'data: ' + JSON.stringify(iv) + '\n\n';
  for (const res of set) {
    try { res.write(payload); } catch (e) { set.delete(res); }
  }
}

// ---------- 工具 ----------
function send(res, code, data, headers) {
  const body = typeof data === 'string' ? data : JSON.stringify(data);
  res.writeHead(code, Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, headers || {}));
  res.end(body);
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', c => {
      size += c.length;
      if (size > limit) {
        reject(new Error('payload too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function readJSON(req) {
  const buf = await readBody(req, JSON_LIMIT);
  if (!buf.length) return {};
  try {
    return JSON.parse(buf.toString('utf-8'));
  } catch (e) {
    const err = new Error('invalid JSON');
    err.status = 400;
    throw err;
  }
}

function serveStatic(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) return send(res, 404, { error: 'not found' });
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

// ---------- 路由 ----------
const server = http.createServer(async (req, res) => {  const u = new URL(req.url, 'http://localhost');
  const p = decodeURIComponent(u.pathname);
  const m = req.method;

  try {
    // ---- 静态页面 ----
    if (m === 'GET' && (p === '/' || p === '/index.html')) return serveStatic(res, path.join(PUBLIC_DIR, 'index.html'));
    if (m === 'GET' && p === '/admin.html') return serveStatic(res, path.join(PUBLIC_DIR, 'admin.html'));
    if (m === 'GET' && p === '/interview.html') return serveStatic(res, path.join(PUBLIC_DIR, 'interview.html'));
    if (m === 'GET' && p === '/screen.html') return serveStatic(res, path.join(PUBLIC_DIR, 'screen.html'));

    // ---- 简历 PDF ----
    let mm = p.match(/^\/resumes\/([\w-]+)\.pdf$/);
    if (m === 'GET' && mm) {
      const fp = path.join(RESUME_DIR, mm[1] + '.pdf');
      if (!fs.existsSync(fp)) return send(res, 404, { error: 'resume not found' });
      res.writeHead(200, { 'Content-Type': 'application/pdf' });
      return fs.createReadStream(fp).pipe(res);
    }

    // ---- 其他静态资源（public/ 下，防目录穿越）----
    if (m === 'GET' && !p.startsWith('/api/')) {
      const fp = path.normalize(path.join(PUBLIC_DIR, p));
      if (!fp.startsWith(PUBLIC_DIR)) return send(res, 403, { error: 'forbidden' });
      return serveStatic(res, fp);
    }

    // ---- SSE 投屏流 ----
    if (m === 'GET' && p === '/api/screen/stream') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });
      res.write('data: ' + JSON.stringify(screenState) + '\n\n');
      screenClients.add(res);
      req.on('close', () => screenClients.delete(res));
      return;
    }

    // ---- 投屏状态 ----
    if (m === 'GET' && p === '/api/screen/state') {
      const qq = questions.find(x => x.id === screenState.questionId);
      return send(res, 200, { questionId: screenState.questionId, screen: screenPayload(qq) });
    }
    if (m === 'POST' && p === '/api/screen') {
      const body = await readJSON(req);
      if (body.questionId !== null && !questions.find(x => x.id === body.questionId)) {
        return send(res, 400, { error: 'unknown questionId' });
      }
      screenState = { questionId: body.questionId };
      broadcastScreen();
      return send(res, 200, { ok: true, questionId: screenState.questionId });
    }

    // ---- 题库 ----
    if (m === 'GET' && p === '/api/questions') {
      return send(res, 200, { parts: PARTS, guide: GUIDE, questions });
    }

    // ---- 面试官 ----
    if (p === '/api/interviewers') {
      if (m === 'GET') return send(res, 200, q.allInterviewers.all());
      if (m === 'POST') {
        const body = await readJSON(req);
        if (!body.name || !String(body.name).trim()) return send(res, 400, { error: 'name required' });
        const it = { id: uid(), name: String(body.name).trim() };
        q.addInterviewer.run(it.id, it.name, new Date().toISOString());
        return send(res, 201, it);
      }
    }
    mm = p.match(/^\/api\/interviewers\/([\w-]+)$/);
    if (mm && m === 'DELETE') {
      if (!q.getInterviewer.get(mm[1])) return send(res, 404, { error: 'not found' });
      q.delInterviewer.run(mm[1]); // scores 表 ON DELETE CASCADE 联动删除其评分
      return send(res, 200, { ok: true });
    }

    // ---- 面试者 ----
    if (p === '/api/candidates') {
      if (m === 'GET') return send(res, 200, q.allCandidates.all().map(candidateOut));
      if (m === 'POST') {
        const body = await readJSON(req);
        const name = body.name && String(body.name).trim() ? String(body.name).trim() : '未命名';
        const c = {
          id: uid(), name,
          phone: body.phone || '', note: body.note || '',
          resume: null, createdAt: new Date().toISOString()
        };
        q.addCandidate.run(c.id, c.name, c.phone, c.note, c.resume, c.createdAt);
        return send(res, 201, c);
      }
    }
    mm = p.match(/^\/api\/candidates\/([\w-]+)$/);
    if (mm) {
      const crow = q.getCandidate.get(mm[1]);
      if (!crow) return send(res, 404, { error: 'not found' });
      if (m === 'PATCH') {
        const body = await readJSON(req);
        if (body.hiddenQuestions !== undefined) {
          if (!Array.isArray(body.hiddenQuestions) || !body.hiddenQuestions.every(x => typeof x === 'string')) {
            return send(res, 400, { error: 'hiddenQuestions must be a string array' });
          }
          q.setHiddenQuestions.run(JSON.stringify(body.hiddenQuestions), mm[1]);
        }
        if (body.name !== undefined || body.phone !== undefined || body.note !== undefined) {
          q.updCandidate.run(
            body.name !== undefined ? String(body.name).trim() : crow.name,
            body.phone !== undefined ? body.phone : crow.phone,
            body.note !== undefined ? body.note : crow.note,
            mm[1]
          );
        }
        return send(res, 200, candidateOut(q.getCandidate.get(mm[1])));
      }
      if (m === 'DELETE') {
        q.delCandidate.run(mm[1]); // interviews / scores ON DELETE CASCADE 联动删除
        const fp = path.join(RESUME_DIR, mm[1] + '.pdf');
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
        return send(res, 200, { ok: true });
      }
    }
    // 简历上传（原始 PDF 二进制）
    mm = p.match(/^\/api\/candidates\/([\w-]+)\/resume$/);
    if (mm && m === 'POST') {
      const crow = q.getCandidate.get(mm[1]);
      if (!crow) return send(res, 404, { error: 'not found' });
      const buf = await readBody(req, PDF_LIMIT);
      if (!buf.length) return send(res, 400, { error: 'empty body' });
      if (buf.slice(0, 5).toString('latin1') !== '%PDF-') return send(res, 400, { error: 'not a PDF file' });
      fs.mkdirSync(RESUME_DIR, { recursive: true });
      fs.writeFileSync(path.join(RESUME_DIR, crow.id + '.pdf'), buf);
      q.setResume.run(crow.id + '.pdf', crow.id);
      return send(res, 200, { ok: true, resume: crow.id + '.pdf' });
    }

    // AI 简历分析（异步任务 + 轮询；PDF 文本/图片由客户端 PDF.js 提取后传入）
    mm = p.match(/^\/api\/candidates\/([\w-]+)\/analyze$/);
    if (mm && m === 'POST') {
      const crow = q.getCandidate.get(mm[1]);
      if (!crow) return send(res, 404, { error: 'not found' });
      // 防连击：同一候选人已有 running 的 job 直接复用
      const runningId = runningAnalyzeByCandidate.get(crow.id);
      if (runningId && analyzeJobs.has(runningId)) {
        return send(res, 202, { jobId: runningId, reused: true });
      }
      const body = await readJSON(req);
      const resumeText = String(body.resumeText || '').slice(0, 15000);
      // 图片路径（主）：简历逐页渲染的 JPEG dataURL；文本路径（兜底）：resumeText
      let images = [];
      if (Array.isArray(body.images)) {
        images = body.images.slice(0, 8).filter(s => typeof s === 'string' && /^data:image\/(jpeg|jpg|png);base64,/.test(s));
      }
      if (!images.length && !resumeText.trim()) return send(res, 400, { error: 'images or resumeText required' });
      const jobId = uid();
      analyzeJobs.set(jobId, { id: jobId, candidateId: crow.id, status: 'running', startedAt: Date.now(), result: null, error: null });
      runningAnalyzeByCandidate.set(crow.id, jobId);
      // 后台异步执行，任何异常都捕获进 job，绝不影响进程
      runAnalyzeJob(jobId, crow.id, images, resumeText).catch(e => {
        console.error('analyze job 未捕获异常:', e);
        const job = analyzeJobs.get(jobId);
        if (job && job.status === 'running') {
          job.status = 'error';
          job.error = '内部错误：' + (e && e.message || e);
          runningAnalyzeByCandidate.delete(crow.id);
        }
      });
      return send(res, 202, { jobId });
    }
    mm = p.match(/^\/api\/candidates\/([\w-]+)\/analyze-status$/);
    if (mm && m === 'GET') {
      const jobId = u.searchParams.get('jobId') || '';
      const job = analyzeJobs.get(jobId);
      if (!job || job.candidateId !== mm[1]) return send(res, 404, { error: 'job not found' });
      const out = { status: job.status, elapsedMs: Date.now() - job.startedAt };
      if (job.status === 'done') out.result = job.result;
      if (job.status === 'error') out.error = job.error;
      return send(res, 200, out);
    }

    mm = p.match(/^\/api\/interviews\/([\w-]+)\/evaluation$/);
    if (mm && m === 'POST') {
      const ivRow = q.getInterview.get(mm[1]);
      if (!ivRow) return send(res, 404, { error: 'not found' });
      if (ivRow.evaluation && u.searchParams.get('force') !== '1') {
        return send(res, 200, { cached: true, evaluation: JSON.parse(ivRow.evaluation) });
      }
      const result = await generateEvaluation(ivRow);
      return send(res, 200, { cached: false, evaluation: result });
    }
    mm = p.match(/^\/api\/interviews\/([\w-]+)\/report-data$/);
    if (mm && m === 'GET') {
      const ivRow = q.getInterview.get(mm[1]);
      if (!ivRow) return send(res, 404, { error: 'not found' });
      return send(res, 200, buildReportData(ivRow));
    }

    // ---- 面试记录 ----
    if (p === '/api/interviews') {
      if (m === 'GET') return send(res, 200, q.allInterviews.all().map(interviewOut));
      if (m === 'POST') {
        const body = await readJSON(req);
        if (!q.getCandidate.get(body.candidateId)) return send(res, 400, { error: 'candidate not found' });
        // 同一面试者复用进行中的面试记录
        let row = q.findOpenByCandidate.get(body.candidateId);
        if (!row) {
          const id = uid();
          q.addInterview.run(id, body.candidateId, new Date().toISOString(), '进行中', '');
          row = q.getInterview.get(id);
        }
        return send(res, 200, interviewOut(row));
      }
    }
    // 面试 SSE 流（须在通用 :id 匹配之前）
    mm = p.match(/^\/api\/interviews\/([\w-]+)\/stream$/);
    if (mm && m === 'GET') {
      const iv = interviewOut(q.getInterview.get(mm[1]));
      if (!iv) return send(res, 404, { error: 'not found' });
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });
      res.write('data: ' + JSON.stringify(iv) + '\n\n');
      if (!interviewClients.has(iv.id)) interviewClients.set(iv.id, new Set());
      const set = interviewClients.get(iv.id);
      set.add(res);
      req.on('close', () => set.delete(res));
      return;
    }
    // 单人打分
    mm = p.match(/^\/api\/interviews\/([\w-]+)\/score$/);
    if (mm && m === 'PATCH') {
      const ivRow = q.getInterview.get(mm[1]);
      if (!ivRow) return send(res, 404, { error: 'not found' });
      const body = await readJSON(req);
      const { questionId, interviewerId } = body;
      const isGenQ = /^G-\d+-\d+$/.test(questionId || '');
      if (!isGenQ && !questions.find(x => x.id === questionId)) return send(res, 400, { error: 'unknown questionId' });
      if (!q.getInterviewer.get(interviewerId)) return send(res, 400, { error: 'unknown interviewerId' });
      if (body.score === undefined && body.note === undefined) return send(res, 400, { error: 'score or note required' });
      if (body.score !== undefined && body.score !== null) {
        const s = Number(body.score);
        if (!Number.isFinite(s) || s < 0 || s > 5) return send(res, 400, { error: 'score must be 0-5' });
      }
      const existing = q.scoresOfQuestion.all(mm[1], questionId).find(r => r.interviewer_id === interviewerId);
      const score = body.score !== undefined ? (body.score === null ? null : Number(body.score)) : (existing ? existing.score : null);
      const note = body.note !== undefined ? String(body.note) : (existing ? existing.note : '');
      q.upsertScore.run(mm[1], questionId, interviewerId, score, note, new Date().toISOString());
      broadcastInterview(mm[1]);
      // 返回该题全部面试官分数（结构与旧版一致）
      const cells = {};
      for (const s of q.scoresOfQuestion.all(mm[1], questionId)) {
        cells[s.interviewer_id] = {
          score: s.score === null || s.score === undefined ? null : Number(s.score),
          note: s.note || '',
          updatedAt: s.updated_at || null
        };
      }
      return send(res, 200, { questionId, scores: cells });
    }
    mm = p.match(/^\/api\/interviews\/([\w-]+)$/);
    if (mm) {
      const ivRow = q.getInterview.get(mm[1]);
      if (!ivRow) return send(res, 404, { error: 'not found' });
      if (m === 'GET') return send(res, 200, interviewOut(ivRow));
      if (m === 'PATCH') {
        const body = await readJSON(req);
        if (body.status !== undefined && !['进行中', '已完成'].includes(body.status)) {
          return send(res, 400, { error: 'invalid status' });
        }
        q.updInterview.run(
          body.status !== undefined ? body.status : ivRow.status,
          body.comment !== undefined ? String(body.comment) : ivRow.comment,
          mm[1]
        );
        broadcastInterview(mm[1]);
        return send(res, 200, interviewOut(q.getInterview.get(mm[1])));
      }
    }

    return send(res, 404, { error: 'not found' });
  } catch (e) {
    if (e && e.message === 'payload too large') return send(res, 413, { error: 'payload too large' });
    if (e && e.status) return send(res, e.status, { error: e.message });
    console.error(e);
    return send(res, 500, { error: 'internal server error' });
  }
});

// 长请求防护：异步化后请求本身很短，这里仍显式放宽，避免代理/Node 掐断 SSE 或慢上传
server.requestTimeout = 0;        // 不限制请求总时长（SSE 长连接需要）
server.headersTimeout = 120000;   // 默认 60s，放宽到 120s
server.keepAliveTimeout = 75000;  // 大于常见代理的 60s 空闲超时，避免复用连接被抢先断开

server.listen(PORT, () => {
  console.log('AI 管培生面试管理已启动: http://localhost:' + PORT + '（存储: SQLite data/interview.db）');
  console.log('  首页:        http://localhost:' + PORT + '/');
  console.log('  人员管理:    http://localhost:' + PORT + '/admin.html');
  console.log('  面试官控制台: http://localhost:' + PORT + '/interview.html');
  console.log('  投屏页:      http://localhost:' + PORT + '/screen.html');
});
