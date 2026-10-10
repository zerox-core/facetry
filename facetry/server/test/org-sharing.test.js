const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../server');

// 组织：p1 研究院（含 g1 AI应用创新组），p2 营销总部（含 g2 品牌组）
const ORG = {
  depts: {
    p1: { id: 'p1', name: '研究院', parentId: '', path: ['p1'], pathName: '研究院' },
    g1: { id: 'g1', name: 'AI应用创新组', parentId: 'p1', path: ['p1', 'g1'], pathName: '研究院 / AI应用创新组' },
    p2: { id: 'p2', name: '营销总部', parentId: '', path: ['p2'], pathName: '营销总部' },
    g2: { id: 'g2', name: '品牌组', parentId: 'p2', path: ['p2', 'g2'], pathName: '营销总部 / 品牌组' },
  },
  fetchedAt: '2026-10-09T00:00:00.000Z',
};
const USERS = {
  'fs:u1': { name: '张三', avatar: '', groups: [{ id: 'g1', name: 'AI应用创新组', pathName: '研究院 / AI应用创新组', path: ['p1', 'g1'] }], leaderOf: ['g1'] },
  'fs:u2': { name: '李四', avatar: '', groups: [{ id: 'g2', name: '品牌组', pathName: '营销总部 / 品牌组', path: ['p2', 'g2'] }] },
  'fs:u3': { name: '王五', avatar: '', groups: [] },
  'fs:admin': { name: '管理员', avatar: '', groups: [{ id: 'g1', name: 'AI应用创新组', pathName: '研究院 / AI应用创新组', path: ['p1', 'g1'] }] },
};
const TOKENS = { 'fs:u1': 't1', 'fs:u2': 't2', 'fs:u3': 't3', 'fs:admin': 'ta' };

async function fixture(t, llm) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'facetry-org-test-'));
  const server = createApp({ dataDir: dir, llm: llm || (() => ({ questions: [] })), config: { admins: ['fs:admin'] } });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  t.after(async () => { await new Promise(r => server.close(r)); const target = path.resolve(dir); if (target.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(target).startsWith('facetry-org-test-')) fs.rmSync(target, { recursive: true, force: true }); });
  fs.writeFileSync(path.join(dir, '_users.json'), JSON.stringify(Object.fromEntries(Object.entries(USERS).map(([id, u]) => [id, { ...u, updatedAt: '2026-10-09T00:00:00.000Z' }]))));
  fs.writeFileSync(path.join(dir, '_org.json'), JSON.stringify(ORG));
  const now = new Date().toISOString();
  fs.writeFileSync(path.join(dir, '_auth.json'), JSON.stringify(Object.fromEntries(Object.entries(TOKENS).map(([uid, tok]) => [tok, { userId: uid, name: USERS[uid].name, avatar: '', createdAt: now }]))));
  const base = 'http://127.0.0.1:' + server.address().port;
  const as = uid => {
    const cookie = 'zm_sess=' + TOKENS[uid];
    return async (p, method = 'GET', data) => {
      const r = await fetch(base + p, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie }, ...(data !== undefined ? { body: JSON.stringify(data) } : {}) });
      return { status: r.status, data: r.status === 204 ? null : await r.json().catch(() => ({})) };
    };
  };
  return { base, dir, as, u1: as('fs:u1'), u2: as('fs:u2'), u3: as('fs:u3'), admin: as('fs:admin') };
}

test('bank questions are shared within the minimal group, hidden from other groups', async t => {
  const f = await fixture(t);
  const { status, data: created } = await f.u1('/api/bank', 'POST', { title: '组内题', q: '只给 AI 组看的题' });
  assert.equal(status, 201);
  assert.equal(created.groupId, 'g1');
  assert.equal(created.groupName, 'AI应用创新组');
  // 同组可见
  const mine = await f.admin('/api/bank');
  assert.ok(mine.data.questions.some(q => q.id === created.id));
  // 别的组不可见
  const other = await f.u2('/api/bank');
  assert.ok(!other.data.questions.some(q => q.id === created.id));
  // 别的组不能改/删（404 对不可见对象）
  assert.equal((await f.u2('/api/bank/' + created.id, 'PATCH', { title: '篡改' })).status, 404);
  assert.equal((await fetch(f.base + '/api/bank/' + created.id, { method: 'DELETE', headers: { Cookie: 'zm_sess=t2' } })).status, 404);
  // 每组的种子基础题是独立副本：本组成员可编辑（互不影响）
  const a1u2 = other.data.questions.find(q => q.id.startsWith('A1'));
  assert.ok(a1u2); assert.ok(a1u2.id !== 'A1');
  assert.equal(a1u2.readonly, false);
  assert.equal((await f.u2('/api/bank/' + a1u2.id, 'PATCH', { title: 'Workflow 和 Agent 的区别' })).status, 200);
  const a1admin = mine.data.questions.find(q => q.id.startsWith('A1'));
  assert.ok(a1admin);
  assert.equal(a1admin.readonly, false);
  assert.equal((await f.admin('/api/bank/' + a1admin.id, 'PATCH', { title: 'Workflow 和 Agent 的区别' })).status, 200);
  // 个人题目（无组）只有创建者可见
  const solo = await f.u3('/api/bank', 'POST', { title: '个人题', q: '只有我自己看' });
  assert.equal(solo.status, 201);
  assert.ok((await f.u3('/api/bank')).data.questions.some(q => q.id === solo.data.id));
  assert.ok(!(await f.u1('/api/bank')).data.questions.some(q => q.id === solo.data.id));
});

test('admin grants give read-only cross-org access including sub-departments', async t => {
  const f = await fixture(t);
  const { data: created } = await f.u1('/api/bank', 'POST', { title: '研究院组题', q: 'AI 组题目' });
  const { data: jd } = await f.u1('/api/jds', 'POST', { title: 'AI 工程师', content: '负责 LLM 应用开发' });
  // 授权前不可见
  assert.ok(!(await f.u3('/api/bank')).data.questions.some(q => q.id === created.id));
  assert.equal((await f.u3('/api/jds')).data.jds.length, 0);
  // 管理员把「研究院」授权给王五
  assert.equal((await f.u3('/api/admin/grants', 'PUT', { userId: 'fs:u3', deptIds: ['p1'] })).status, 403);
  const put = await f.admin('/api/admin/grants', 'PUT', { userId: 'fs:u3', deptIds: ['p1'] });
  assert.equal(put.status, 200);
  // 授权后可见但只读
  const bank = await f.u3('/api/bank');
  const q = bank.data.questions.find(x => x.id === created.id);
  assert.ok(q); assert.equal(q.readonly, true);
  const jds = await f.u3('/api/jds');
  assert.equal(jds.data.jds.length, 1);
  assert.equal(jds.data.jds[0].id, jd.id);
  assert.equal(jds.data.jds[0].readonly, true);
  assert.equal((await f.u3('/api/jds/' + jd.id, 'PATCH', { title: '篡改' })).status, 403);
  // 撤销授权
  await f.admin('/api/admin/grants', 'PUT', { userId: 'fs:u3', deptIds: [] });
  assert.ok(!(await f.u3('/api/bank')).data.questions.some(x => x.id === created.id));
});

test('jd library: group sharing, crud validation and admin overview', async t => {
  const f = await fixture(t);
  assert.equal((await f.u1('/api/jds', 'POST', { title: '', content: 'x' })).status, 400);
  const { status, data: jd } = await f.u1('/api/jds', 'POST', { title: 'AI 管培生', company: '丽珠', content: 'JD 正文', requirements: '硕士以上', tags: ['AI', '校招'] });
  assert.equal(status, 201);
  assert.equal(jd.groupId, 'g1');
  assert.equal(jd.userName, '张三');
  // 同组成员可改
  const patched = await f.admin('/api/jds/' + jd.id, 'PATCH', { title: 'AI 管培生（信息方向）' });
  assert.equal(patched.status, 200);
  assert.equal(patched.data.title, 'AI 管培生（信息方向）');
  // 非本组不可见也不可删
  assert.equal((await f.u2('/api/jds')).data.jds.length, 0);
  assert.equal((await f.u2('/api/jds/' + jd.id, 'DELETE')).status, 404);
  const del = await fetch(f.base + '/api/jds/' + jd.id, { method: 'DELETE', headers: { Cookie: 'zm_sess=ta' } });
  assert.equal(del.status, 204);
  assert.equal((await f.u1('/api/jds')).data.jds.length, 0);
  // 管理总览
  const ov = await f.admin('/api/admin/overview');
  assert.equal(ov.status, 200);
  assert.equal(ov.data.users.length, 4);
  const u1 = ov.data.users.find(u => u.id === 'fs:u1');
  assert.equal(u1.groupName, '研究院 / AI应用创新组');
  assert.equal((await f.u1('/api/admin/overview')).status, 403);
});

test('resumes stay personal but can be shared with specific users', async t => {
  const f = await fixture(t);
  const up = await fetch(f.base + '/api/upload?name=cand.txt', { method: 'POST', headers: { Cookie: 'zm_sess=t1' }, body: '候选人甲\n项目经历' });
  assert.equal(up.status, 201);
  const s = await up.json();
  // 未分享：他人不可见
  assert.equal((await f.u2('/api/sessions')).data.length, 0);
  assert.equal((await f.u2('/api/sessions/' + s.id)).status, 404);
  assert.equal((await fetch(f.base + '/files/' + s.file, { headers: { Cookie: 'zm_sess=t2' } })).status, 404);
  // 分享前他人尝试改分享设置：简历对其隐藏
  const bad = await f.u2('/api/sessions/' + s.id, 'PATCH', { shares: ['fs:u1'] });
  assert.equal(bad.status, 404);
  const shared = await f.u1('/api/sessions/' + s.id, 'PATCH', { shares: ['fs:u2', 'fs:u2'] });
  assert.equal(shared.status, 200);
  assert.deepEqual(shared.data.shares, ['fs:u2']);
  // 被分享者可见、可评分、可查看文件，但不可删/不可生成/不可再分享
  const list = await f.u2('/api/sessions');
  const item = list.data.find(x => x.id === s.id);
  assert.ok(item); assert.equal(item.sharedBy, '张三');
  assert.equal((await f.u2('/api/sessions/' + s.id)).status, 200);
  assert.equal((await f.u2('/api/sessions/' + s.id, 'PATCH', { note: '面试观察' })).status, 200);
  assert.equal((await fetch(f.base + '/files/' + s.file, { headers: { Cookie: 'zm_sess=t2' } })).status, 200);
  assert.equal((await f.u2('/api/sessions/' + s.id, 'PATCH', { shares: [] })).status, 403);
  assert.equal((await f.u2('/api/sessions/' + s.id + '/evaluate', 'POST', {})).status, 403);
  const del = await fetch(f.base + '/api/sessions/' + s.id, { method: 'DELETE', headers: { Cookie: 'zm_sess=t2' } });
  assert.equal(del.status, 403);
  // 取消分享后立刻不可见
  await f.u1('/api/sessions/' + s.id, 'PATCH', { shares: [] });
  assert.equal((await f.u2('/api/sessions/' + s.id)).status, 404);
});

test('bank generation calls the LLM with jd and requirements, and saves scoped questions', async t => {
  let captured;
  const f = await fixture(t, async messages => {
    captured = messages;
    return { questions: [{ title: 'RAG 评测', q: '如何评测 RAG 召回质量？', answer: '评测集+指标', material: '', part: 'B' }, { title: '', q: '  ', answer: '', material: '', part: 'A' }, { title: 'Agent 规划', q: 'Agent 任务拆解失败如何兜底？', answer: '层级规划', material: '背景', part: 'XX' }] };
  });
  assert.equal((await f.u1('/api/bank/generate', 'POST', { jdText: '  ' })).status, 400);
  const r = await f.u1('/api/bank/generate', 'POST', { jdId: undefined, jdText: '负责 LLM 应用', requirements: '偏工程实践，5 题', count: 5 });
  assert.equal(r.status, 200);
  assert.equal(r.data.questions.length, 2);
  assert.equal(r.data.questions[0].title, 'RAG 评测');
  assert.equal(r.data.questions[0].part, 'B');
  assert.equal(r.data.questions[1].part, '');
  assert.equal(r.data.questions[1].partName, 'XX');
  assert.ok(captured[0].content.includes('岗位 JD'));
  assert.ok(captured[1].content.includes('偏工程实践'));
  // 基于岗位库 JD 出题：本组可见可用，别组 404
  const { data: jd } = await f.u1('/api/jds', 'POST', { title: '算法工程师', content: 'JD 内容' });
  const byId = await f.u1('/api/bank/generate', 'POST', { jdId: jd.id, count: 3 });
  assert.equal(byId.status, 200);
  assert.equal((await f.u2('/api/bank/generate', 'POST', { jdId: jd.id, count: 3 })).status, 404);
  // 保存后进入本组题库
  const saved = await f.u1('/api/bank', 'POST', r.data.questions[0]);
  assert.equal(saved.status, 201);
  assert.equal(saved.data.groupId, 'g1');
  assert.ok((await f.admin('/api/bank')).data.questions.some(q => q.id === saved.data.id));
});

test('seed copies are isolated per group and never resurrect after deletion', async t => {
  const f = await fixture(t);
  const b1 = (await f.u1('/api/bank')).data;
  const b2 = (await f.u2('/api/bank')).data;
  // 两组各有自己的种子副本，id 不同
  const s1 = b1.questions.filter(q => q.seed);
  const s2 = b2.questions.filter(q => q.seed);
  assert.equal(s1.length, 41);
  assert.equal(s2.length, 41);
  assert.ok(!s1.some(q => s2.some(x => x.id === q.id)));
  // g1 修改自己的副本，g2 的不受影响
  const t1 = s1.find(q => q.id.startsWith('A2'));
  await f.u1('/api/bank/' + t1.id, 'PATCH', { q: 'g1 改过的题干' });
  const b2again = (await f.u2('/api/bank')).data;
  assert.equal(b2again.questions.find(q => q.id.startsWith('A2')).q.includes('g1 改过'), false);
  // 删除后不复活
  const del = await fetch(f.base + '/api/bank/' + t1.id, { method: 'DELETE', headers: { Cookie: 'zm_sess=t1' } });
  assert.equal(del.status, 204);
  const b1again = (await f.u1('/api/bank')).data;
  assert.equal(b1again.questions.filter(q => q.seed).length, 40);
});

test('custom bank parts are created by name and reused across questions', async t => {
  const f = await fixture(t);
  const { status, data: q1 } = await f.u1('/api/bank', 'POST', { title: 'Docker 一', q: '题干一', part: 'Docker 部署' });
  assert.equal(status, 201);
  assert.equal(q1.partName, 'Docker 部署');
  assert.match(q1.part, /^X[0-9a-f]{6}$/);
  const { data: bank } = await f.u1('/api/bank');
  assert.ok(bank.parts.some(p => p.name === 'Docker 部署' && p.key === q1.part));
  // 分类按组隔离：另一个组用同名分类会创建自己的分类
  const { data: q2 } = await f.u2('/api/bank', 'POST', { title: 'Docker 二', q: '题干二', part: 'Docker 部署' });
  assert.match(q2.part, /^X[0-9a-f]{6}$/);
  assert.notEqual(q2.part, q1.part);
  assert.equal(q2.partName, 'Docker 部署');
  // g1 的 parts 列表里没有 g2 的分类
  const { data: bank1 } = await f.u1('/api/bank');
  const g1PartKeys = bank1.parts.map(p => p.key);
  assert.ok(!g1PartKeys.includes(q2.part));
  assert.ok(g1PartKeys.includes(q1.part));
  // 同组内同名复用同一分类
  const { data: q3 } = await f.admin('/api/bank', 'POST', { title: 'Docker 三', q: '题干三', part: 'Docker 部署' });
  assert.equal(q3.part, q1.part);
  // 改分类为已有名称 / 新名称
  const moved = await f.u2('/api/bank/' + q2.id, 'PATCH', { part: 'Part B · 进阶题' });
  assert.equal(moved.data.part, 'B');
  const back = await f.u2('/api/bank/' + q2.id, 'PATCH', { part: 'Docker 部署' });
  assert.equal(back.data.part, q2.part);
});

test('bank parts can be renamed and questions follow', async t => {
  const f = await fixture(t);
  await f.u1('/api/bank'); // 触发 g1 种子副本
  const r = await f.u1('/api/bank/parts/A', 'PATCH', { name: 'Part A · 通用基础' });
  assert.equal(r.status, 200);
  const { data: bank } = await f.u1('/api/bank');
  assert.equal(bank.parts.find(p => p.key === 'A').name, 'Part A · 通用基础');
  assert.ok(bank.questions.filter(q => q.part === 'A').every(q => q.partName === 'Part A · 通用基础'));
  assert.equal((await f.u1('/api/bank/parts/A', 'PATCH', { name: '  ' })).status, 400);
  assert.equal((await f.u1('/api/bank/parts/NOPE', 'PATCH', { name: 'x' })).status, 404);
  // 别组无权改本组的自定义分类
  const { data: q1 } = await f.u1('/api/bank', 'POST', { title: 'x', q: 'y', part: '组内分类' });
  assert.equal((await f.u2('/api/bank/parts/' + q1.part, 'PATCH', { name: '篡改' })).status, 403);
});

test('super admin sees all orgs, all resumes read-only, and the dashboard', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'facetry-org-test-'));
  const server = createApp({ dataDir: dir, llm: () => ({ questions: [] }), config: { admins: ['fs:admin'], superAdmins: ['fs:u2'] } });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  t.after(async () => { await new Promise(r => server.close(r)); const target = path.resolve(dir); if (target.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(target).startsWith('facetry-org-test-')) fs.rmSync(target, { recursive: true, force: true }); });
  fs.writeFileSync(path.join(dir, '_users.json'), JSON.stringify(Object.fromEntries(Object.entries(USERS).map(([id, u]) => [id, { ...u, updatedAt: '2026-10-09T00:00:00.000Z' }]))));
  fs.writeFileSync(path.join(dir, '_org.json'), JSON.stringify(ORG));
  const now = new Date().toISOString();
  fs.writeFileSync(path.join(dir, '_auth.json'), JSON.stringify(Object.fromEntries(Object.entries(TOKENS).map(([uid, tok]) => [tok, { userId: uid, name: USERS[uid].name, avatar: '', createdAt: now }]))));
  const base = 'http://127.0.0.1:' + server.address().port;
  const as = uid => async (p, method = 'GET', data) => {
    const r = await fetch(base + p, { method, headers: { 'Content-Type': 'application/json', Cookie: 'zm_sess=' + TOKENS[uid] }, ...(data !== undefined ? { body: JSON.stringify(data) } : {}) });
    return { status: r.status, data: r.status === 204 ? null : await r.json().catch(() => ({})) };
  };
  const u1 = as('fs:u1'), u2 = as('fs:u2'), u3 = as('fs:u3');
  // u1(g1) 建 JD、题目、简历
  await u1('/api/jds', 'POST', { title: 'AI 工程师', content: 'JD' });
  await u1('/api/bank', 'POST', { title: '组内题', q: '题干' });
  const up = await fetch(base + '/api/upload?name=c.txt', { method: 'POST', headers: { Cookie: 'zm_sess=t1' }, body: '候选人' });
  const s = await up.json();
  // 超管普通视图只看自己组的内容
  assert.equal((await u2('/api/jds')).data.jds.length, 0);
  assert.ok(!(await u2('/api/bank')).data.questions.some(q => q.title === '组内题'));
  // 通过管理台 group 参数可查看其他组内容（只读）
  const jdsG1 = await u2('/api/jds?group=g1');
  assert.equal(jdsG1.status, 200);
  assert.equal(jdsG1.data.jds.length, 1);
  assert.equal(jdsG1.data.jds[0].readonly, true);
  const bankG1 = await u2('/api/bank?group=g1');
  assert.equal(bankG1.status, 200);
  const g1q = bankG1.data.questions.find(q => q.title === '组内题');
  assert.ok(g1q); assert.equal(g1q.readonly, true);
  // 非超管的 group 参数被忽略（回落到普通视图）
  assert.ok(!(await u1('/api/bank?group=g2')).data.questions.some(q => (q.groupId || '') === 'g2' && q.title === '组内题'));
  assert.ok((await u1('/api/jds?group=g2')).data.jds.every(j => j.groupId === 'g1'));
  // 超管可见所有人的简历列表与详情，但只读
  const list = (await u2('/api/sessions')).data;
  assert.ok(list.some(x => x.id === s.id && x.sharedBy === '张三' && x.viaSuper));
  assert.equal((await u2('/api/sessions/' + s.id)).status, 200);
  assert.equal((await fetch(base + '/files/' + s.file, { headers: { Cookie: 'zm_sess=t2' } })).status, 200);
  // 但只读：不能改他人的面试记录
  assert.equal((await u2('/api/sessions/' + s.id, 'PATCH', { note: 'x' })).status, 403);
  assert.equal((await u2('/api/sessions/' + s.id + '/evaluate', 'POST', {})).status, 403);
  // 看板仅超管可见
  const dash = await u2('/api/admin/dashboard');
  assert.equal(dash.status, 200);
  assert.equal(dash.data.sessions.total, 1);
  assert.equal(dash.data.bank.byGroup.length >= 2, true); // g1 副本 + g2 副本
  assert.equal(dash.data.jds.total, 1);
  assert.ok(dash.data.byUser.some(u => u.userId === 'fs:u1'));
  assert.equal((await u1('/api/admin/dashboard')).status, 403);
  assert.equal((await u3('/api/admin/dashboard')).status, 403);
  // me 返回 isSuper
  assert.equal((await u2('/api/auth/me')).data.user.isSuper, true);
  assert.equal((await u1('/api/auth/me')).data.user.isSuper, false);
});

test('upload with a jd fills role from the JD; invalid jd is rejected', async t => {
  const f = await fixture(t);
  const { data: jd } = await f.u1('/api/jds', 'POST', { title: 'AI 管培生（信息方向）', content: 'JD' });
  const ok = await fetch(f.base + '/api/upload?name=r.txt&jd=' + jd.id, { method: 'POST', headers: { Cookie: 'zm_sess=t1' }, body: '候选人' });
  assert.equal(ok.status, 201);
  const s = await ok.json();
  assert.equal(s.role, 'AI 管培生（信息方向）');
  assert.equal(s.jdId, jd.id);
  const bad = await fetch(f.base + '/api/upload?name=r2.txt&jd=nope', { method: 'POST', headers: { Cookie: 'zm_sess=t1' }, body: '候选人' });
  assert.equal(bad.status, 404);
  const plain = await fetch(f.base + '/api/upload?name=r3.txt', { method: 'POST', headers: { Cookie: 'zm_sess=t1' }, body: '候选人' });
  assert.equal((await plain.json()).role, '');
  // 别组的 JD 不能用
  const { data: jd2 } = await f.u2('/api/jds', 'POST', { title: '品牌专员', content: 'JD' });
  const cross = await fetch(f.base + '/api/upload?name=r4.txt&jd=' + jd2.id, { method: 'POST', headers: { Cookie: 'zm_sess=t1' }, body: '候选人' });
  assert.equal(cross.status, 404);
});

test('group leader sees group members resumes read-only', async t => {
  const f = await fixture(t);
  // 管理员（同组 g1 成员）上传简历
  const up = await fetch(f.base + '/api/upload?name=m.txt', { method: 'POST', headers: { Cookie: 'zm_sess=ta' }, body: '候选人乙' });
  const s = await up.json();
  // 负责人 u1（g1 负责人）可见，标记 viaLeader，只读
  const list = await f.u1('/api/sessions');
  const item = list.data.find(x => x.id === s.id);
  assert.ok(item);
  assert.equal(item.viaLeader, true);
  assert.equal(item.sharedBy, '管理员');
  assert.equal((await f.u1('/api/sessions/' + s.id)).status, 200);
  assert.equal((await fetch(f.base + '/files/' + s.file, { headers: { Cookie: 'zm_sess=t1' } })).status, 200);
  assert.equal((await f.u1('/api/sessions/' + s.id, 'PATCH', { note: 'x' })).status, 403);
  assert.equal((await f.u1('/api/sessions/' + s.id + '/evaluate', 'POST', {})).status, 403);
  // 普通组员（非负责人）不可见
  assert.ok(!(await f.u3('/api/sessions')).data.some(x => x.id === s.id));
  assert.equal((await f.u3('/api/sessions/' + s.id)).status, 404);
  // 别组负责人（u2 不是 g1 负责人）不可见
  assert.equal((await f.u2('/api/sessions/' + s.id)).status, 404);
});

test('analyze feeds group bank as reference with JD-linked questions first', async t => {
  let captured;
  const f = await fixture(t, async messages => {
    // 两阶段：提纲调用 + 出题调用；题库参考注入在出题调用里
    if (messages[0].content.includes('板块提纲')) {
      captured = Array.isArray(messages[1].content) ? messages[1].content.find(c => c.type === 'text')?.text : messages[1].content;
    }
    if (!messages[0].content.includes('综合评价')) {
      return { name: 'x', role: '', summary: '', sections: [{ title: '项目', kind: 'project', anchor: { quote: '项目', page: 1, y: 0.1 }, questions: [{ q: '问题？', point: '', followUp: '', expected: [], type: '经历深挖' }] }] };
    }
    return { overall: 'x', suggestion: 'x', strengths: [], weaknesses: [] };
  });
  const { data: jd } = await f.u1('/api/jds', 'POST', { title: 'AI 工程师', content: 'JD' });
  await f.u1('/api/bank', 'POST', { title: '岗位专属题', q: '岗位题题干', jdId: jd.id });
  await f.u1('/api/bank', 'POST', { title: '通用公共题', q: '通用题干' });
  await f.u2('/api/bank', 'POST', { title: '别组的题', q: '别组题干' });
  const up = await fetch(f.base + '/api/upload?name=r.txt&jd=' + jd.id, { method: 'POST', headers: { Cookie: 'zm_sess=t1' }, body: '候选人\n项目' });
  const s = await up.json();
  const { data: job } = await f.u1('/api/sessions/' + s.id + '/analyze', 'POST', { lines: [{ id: 'p1-l1', text: '项目', page: 1, y: 0.1, x: 0.1 }], pageCount: 1 });
  for (let n = 0; n < 100; n++) {
    const j = await f.u1('/api/jobs/' + job.id);
    if (j.data.state !== 'running') break;
    await new Promise(r => setTimeout(r, 20));
  }
  assert.ok(captured.includes('题库参考'));
  assert.ok(captured.includes('岗位题题干'));
  assert.ok(captured.includes('通用题干'));
  assert.ok(!captured.includes('别组题干'));
  assert.ok(captured.indexOf('岗位题题干') < captured.indexOf('通用题干'));
});

test('user directory powers the share picker', async t => {
  const f = await fixture(t);
  const r = await f.u1('/api/users');
  assert.equal(r.status, 200);
  assert.equal(r.data.users.length, 4);
  const zhang = r.data.users.find(u => u.id === 'fs:u1');
  assert.equal(zhang.name, '张三');
  assert.equal(zhang.groupName, 'AI应用创新组');
});

test('bank questions can be linked to a JD and regrouped', async t => {
  const f = await fixture(t);
  const { data: jd } = await f.u1('/api/jds', 'POST', { title: 'AI 管培生', content: 'JD' });
  // 不存在的岗位 / 别组岗位都不能挂
  assert.equal((await f.u1('/api/bank', 'POST', { title: 'x', q: 'y', jdId: 'nope' })).status, 404);
  const { data: jd2 } = await f.u2('/api/jds', 'POST', { title: '品牌专员', content: 'JD' });
  assert.equal((await f.u1('/api/bank', 'POST', { title: 'x', q: 'y', jdId: jd2.id })).status, 404);
  const { status, data: q } = await f.u1('/api/bank', 'POST', { title: '岗位题', q: '题干', jdId: jd.id });
  assert.equal(status, 201);
  assert.equal(q.jdId, jd.id);
  assert.equal(q.jdTitle, 'AI 管培生');
  const { data: bank } = await f.u1('/api/bank');
  assert.equal(bank.questions.find(x => x.id === q.id).jdTitle, 'AI 管培生');
  // 换挂 / 取消关联
  const moved = await f.u1('/api/bank/' + q.id, 'PATCH', { jdId: '' });
  assert.equal(moved.status, 200);
  assert.ok(!('jdId' in moved.data));
});

test('admins can grant and revoke admin; self-revoke and last-admin are protected', async t => {
  const f = await fixture(t);
  assert.equal((await f.u1('/api/admin/admins', 'PUT', { userId: 'fs:u2', admin: true })).status, 403);
  assert.equal((await f.admin('/api/admin/admins', 'PUT', { userId: 'fs:admin', admin: false })).status, 400);
  const r = await f.admin('/api/admin/admins', 'PUT', { userId: 'fs:u2', admin: true });
  assert.equal(r.status, 200);
  assert.ok((await f.u2('/api/admin/overview')).status === 200);
  const revoke = await f.admin('/api/admin/admins', 'PUT', { userId: 'fs:u2', admin: false });
  assert.equal(revoke.status, 200);
  assert.equal((await f.u2('/api/admin/overview')).status, 403);
});
