import React, { useCallback, useEffect, useRef, useState } from 'react';
import { App as AntApp, Button, Input, Modal, Progress, Spin } from 'antd';
import { ArrowLeftOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { api, pollJob } from '../api.js';
import { parseResume } from '../pdf.js';
import Spread from './Spread.jsx';
import Evaluation from './Evaluation.jsx';
import UserMenu from './UserMenu.jsx';

const PHASES = [
  { key: 'prepare', label: '选题' },
  { key: 'interview', label: '面试' },
  { key: 'review', label: '评价' },
];

export default function Workspace({ id, interviewer, onBack, onLogout }) {
  const { message, modal } = AntApp.useApp();
  const [session, setSession] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [busy, setBusy] = useState('');
  const [roleInput, setRoleInput] = useState('');
  const [note, setNote] = useState('');
  const noteTimer = useRef(null);
  const mainRef = useRef(null);

  const reload = useCallback(async () => {
    const s = await api.session(id);
    setSession(s);
    setNote(s.note || '');
    setRoleInput(r => r || s.role || '');
    return s;
  }, [id]);

  useEffect(() => { reload().catch(e => message.error(e.message)); }, [reload, message]);

  // 简历原文解析（页面渲染 + 文本行抽取），题目生成后也需要用于展示
  useEffect(() => {
    if (!session || parsed) return;
    parseResume(session).then(setParsed).catch(e => message.error('简历文件加载失败：' + e.message));
  }, [session, parsed, message]);

  useEffect(() => {
    if (!session?.sections?.length || openId) return;
    const firstProject = session.sections.find(s => s.kind === 'project');
    setOpenId((firstProject || session.sections[0]).id);
  }, [session, openId]);

  async function runAnalyze() {
    if (!parsed) return;
    setBusy('analyze');
    try {
      const job = await api.analyze(id, {
        role: roleInput,
        lines: parsed.lines,
        pageCount: parsed.pageCount,
        images: parsed.images,
      });
      await pollJob(job.id);
      message.success('题目已生成，别在简历旁边了');
      await reload();
    } catch (e) {
      message.error(e.message);
    } finally {
      setBusy('');
    }
  }

  async function patchQuestion(qid, patch) {
    try {
      const s = await api.patch(id, { question: { id: qid, ...patch } });
      setSession(s);
    } catch (e) {
      message.error(e.message);
    }
  }

  async function setPhase(phase) {
    try {
      const s = await api.patch(id, { phase });
      setSession(s);
    } catch (e) {
      message.error(e.message);
    }
  }

  function saveSessionNote(value) {
    clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => {
      api.patch(id, { note: value }).then(setSession).catch(e => message.error(e.message));
    }, 800);
  }

  async function runEvaluate() {
    setBusy('evaluate');
    try {
      const job = await api.evaluate(id);
      await pollJob(job.id);
      message.success('综合评价已生成');
      await reload();
    } catch (e) {
      message.error(e.message);
    } finally {
      setBusy('');
    }
  }

  function jumpToQuestion(qid) {
    const sec = session.sections.find(s => s.questions.some(q => q.id === qid));
    if (!sec) return;
    setOpenId(sec.id);
    setTimeout(() => {
      document.getElementById(`q-${qid}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 120);
  }

  if (!session) {
    return <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}><Spin size="large" /></div>;
  }

  const phase = session.phase;
  const phaseIdx = PHASES.findIndex(p => p.key === phase);
  const allQ = session.sections.flatMap(s => s.questions);
  const activeQ = allQ.filter(q => !q.excluded);
  const scoredQ = activeQ.filter(q => q.score !== null);
  const notedQ = activeQ.filter(q => q.note?.trim());

  // 未生成题目：解析 + 出题引导页
  if (!session.sections.length) {
    return (
      <>
        <Topbar name={session.name} role={session.role} onBack={onBack} interviewer={interviewer} onLogout={onLogout} />
        <div className="empty-analyze">
          {busy === 'analyze' ? (
            <div className="analyzing">
              <h2>正在通读简历…</h2>
              <div className="analyzing-bar"><i /></div>
              <div className="analyzing-line">识别项目与经历，逐段设计有针对性的问题，通常需要半分钟</div>
            </div>
          ) : !parsed ? (
            <div className="analyzing">
              <Spin size="large" />
              <div className="analyzing-line">正在翻开简历…</div>
            </div>
          ) : (
            <>
              <div className="upload-seal" style={{ margin: '0 auto' }}>读</div>
              <h2>简历已就位，共 {parsed.pageCount} 页</h2>
              <p>
                接下来会逐段通读简历，为每个项目设计 3 道有区分度的问题，<br />
                题目会直接别在简历的对应位置。可先确认面试的岗位方向：
              </p>
              <Input
                value={roleInput}
                onChange={e => setRoleInput(e.target.value)}
                placeholder="目标岗位，例如：AI 应用开发工程师（留空则按简历求职方向）"
                style={{ maxWidth: 380, marginBottom: 20 }}
              />
              <div>
                <Button type="primary" size="large" icon={<ThunderboltOutlined />} onClick={runAnalyze}>
                  生成面试题
                </Button>
              </div>
            </>
          )}
        </div>
      </>
    );
  }

  const sectionsByPage = new Map();
  session.sections.forEach(sec => {
    const p = sec.anchor.page || 1;
    if (!sectionsByPage.has(p)) sectionsByPage.set(p, []);
    sectionsByPage.get(p).push(sec);
  });

  return (
    <>
      <Topbar name={session.name} role={session.role} onBack={onBack} interviewer={interviewer} onLogout={onLogout}>
        <div className="phase-steps">
          {PHASES.map((p, i) => (
            <React.Fragment key={p.key}>
              {i > 0 && <span className="phase-link" />}
              <button
                className={`phase-step${i === phaseIdx ? ' active' : ''}${i < phaseIdx ? ' done' : ''}`}
                onClick={() => setPhase(p.key)}
              >
                <span className="num">{i + 1}</span>{p.label}
              </button>
            </React.Fragment>
          ))}
        </div>
      </Topbar>

      <div className="work">
        <div className="work-main" ref={mainRef}>
          {(parsed?.pages || []).map(pg => {
            const secs = sectionsByPage.get(pg.page) || [];
            if (!secs.length && !pg.url && !pg.text) return null;
            const startIndex = [...sectionsByPage.entries()]
              .filter(([p]) => p < pg.page)
              .reduce((n, [, list]) => n + list.length, 0);
            return (
              <Spread
                key={pg.page}
                page={pg}
                sections={secs}
                startIndex={startIndex}
                phase={phase}
                openId={openId}
                onToggle={sid => setOpenId(cur => (cur === sid ? null : sid))}
                onPatch={patchQuestion}
              />
            );
          })}
        </div>

        <aside className="work-side">
          <div className="side-label">候选人</div>
          <div className="candidate-name">{session.name || session.fileName}</div>
          {session.role && <div className="candidate-role">{session.role}</div>}
          {session.summary && <div className="candidate-summary">{session.summary}</div>}

          <div className="side-label">进度</div>
          <div className="stat-row">
            <div className="stat-cell"><div className="stat-num">{activeQ.length}</div><div className="stat-cap">在册题目</div></div>
            <div className="stat-cell"><div className="stat-num">{scoredQ.length}</div><div className="stat-cap">已评分</div></div>
            <div className="stat-cell"><div className="stat-num">{notedQ.length}</div><div className="stat-cap">有备注</div></div>
          </div>
          <Progress
            percent={activeQ.length ? Math.round((scoredQ.length / activeQ.length) * 100) : 0}
            strokeColor="var(--accent)"
            style={{ marginTop: 14 }}
          />

          {phase === 'prepare' && (
            <>
              <div className="side-label">选题</div>
              <p style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.9 }}>
                逐段过一遍题目，不合适的直接叉掉；点击简历上的编号图钉可展开对应段落。选好后进入面试。
              </p>
              <Button type="primary" block size="large" onClick={() => setPhase('interview')}>
                开始面试（{activeQ.length} 题）
              </Button>
            </>
          )}

          {phase === 'interview' && (
            <>
              <div className="side-label">面试记录</div>
              <Input.TextArea
                value={note}
                placeholder="整体印象、题外的观察…"
                autoSize={{ minRows: 3, maxRows: 8 }}
                variant="filled"
                style={{ background: 'var(--surface-2)', fontSize: 12.5 }}
                onChange={e => { setNote(e.target.value); saveSessionNote(e.target.value); }}
              />
              <Button
                type="primary"
                block
                size="large"
                style={{ marginTop: 14 }}
                onClick={() => {
                  modal.confirm({
                    title: '结束面试并生成综合评价？',
                    content: `将基于 ${scoredQ.length} 条评分和 ${notedQ.length} 条备注生成评价，生成后仍可按最新记录重新生成。`,
                    okText: '生成评价',
                    cancelText: '再面面',
                    onOk: async () => { await setPhase('review'); await runEvaluate(); },
                  });
                }}
              >
                结束面试，生成评价
              </Button>
            </>
          )}

          {phase === 'review' && (
            <>
              <div className="side-label">综合评价</div>
              <Evaluation
                evaluation={session.evaluation}
                generating={busy === 'evaluate'}
                onRegenerate={runEvaluate}
                onJump={jumpToQuestion}
                sections={session.sections}
              />
            </>
          )}
        </aside>
      </div>
    </>
  );
}

function Topbar({ name, role, onBack, interviewer, onLogout, children }) {
  return (
    <header className="topbar">
      <div className="brand" onClick={onBack}>侧注 <em>SIDENOTE</em></div>
      <Button type="text" icon={<ArrowLeftOutlined />} onClick={onBack}>档案</Button>
      {children}
      <div className="topbar-spacer" />
      <div style={{ textAlign: 'right', marginRight: 8 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{name || '未识别'}</div>
        {role && <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{role}</div>}
      </div>
      <UserMenu name={interviewer} onLogout={onLogout} />
    </header>
  );
}
