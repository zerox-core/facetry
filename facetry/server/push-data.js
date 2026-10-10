#!/usr/bin/env node
// 一次性数据迁移：把本地 SQLite 全部表数据与简历附件推送到线上实例
// 前提：线上已设置 IMPORT_TOKEN 环境变量并发布（迁移完成后应在平台移除该变量）
// 用法：node server/push-data.js <目标地址> <IMPORT_TOKEN>
//   目标地址为应用入口（不带尾斜杠），预发布如 http://<node>:<port>，正式如 http://<host>/apps/zhangjintai-omrunk1w
//   数据来源默认读取 server/.env 的 SQLITE_PATH，未设置时依次尝试 data/facetry.db、data/app.db
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const [, , baseArg, token, dbArg] = process.argv;
if (!baseArg || !token) {
  console.error('用法: node server/push-data.js <目标地址> <IMPORT_TOKEN> [数据库路径]');
  process.exit(1);
}
const base = baseArg.replace(/\/+$/, '');

try { process.loadEnvFile(path.join(__dirname, '.env')); } catch {}
const dbPath = dbArg || process.env.SQLITE_PATH
  || (fs.existsSync(path.join(__dirname, 'data', 'facetry.db')) ? path.join(__dirname, 'data', 'facetry.db') : path.join(__dirname, 'data', 'app.db'));
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dbPath)) { console.error('数据库不存在:', dbPath); process.exit(1); }

const TABLES = ['sessions', 'bank_questions', 'bank_parts', 'bank_meta', 'jds', 'users', 'grants', 'org', 'meta', 'auth'];
const BATCH = 200;

async function post(urlPath, body, raw) {
  const r = await fetch(base + urlPath, {
    method: 'POST',
    headers: raw
      ? { 'Content-Type': 'application/octet-stream', 'x-import-token': token }
      : { 'Content-Type': 'application/json', 'x-import-token': token },
    body,
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${urlPath} -> ${r.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : {};
}

async function main() {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  console.log('源数据库:', dbPath, '-> 目标:', base);
  for (const table of TABLES) {
    let rows;
    try { rows = db.prepare(`SELECT * FROM ${table}`).all(); } catch { console.log(`跳过 ${table}（源库无此表）`); continue; }
    let sent = 0;
    for (let i = 0; i < rows.length; i += BATCH) {
      const res = await post('/api/admin/import', JSON.stringify({ table, rows: rows.slice(i, i + BATCH) }));
      sent += res.imported;
    }
    console.log(`${table}: ${sent} 行`);
  }
  // 简历附件：按会话记录里引用的存储文件名推送
  let files = 0;
  for (const row of db.prepare('SELECT data FROM sessions').all()) {
    let s;
    try { s = JSON.parse(row.data); } catch { continue; }
    if (!s.file) continue;
    const fp = path.join(dataDir, path.basename(s.file));
    if (!fs.existsSync(fp)) { console.log(`附件缺失，跳过: ${s.file}`); continue; }
    await post('/api/admin/import-file?name=' + encodeURIComponent(path.basename(s.file)), fs.readFileSync(fp), true);
    files++;
    console.log(`附件: ${s.file} (${s.name || s.id})`);
  }
  console.log(`完成：附件 ${files} 个`);
  db.close();
}

main().catch(e => { console.error('迁移失败:', e.message); process.exit(1); });
