import React, { useEffect, useRef, useState } from 'react';
import { Rate, Input } from 'antd';
import { CloseOutlined, UndoOutlined, CheckOutlined } from '@ant-design/icons';

// 单道面试题：选题阶段可叉掉/恢复；面试阶段可打分、写备注（自动保存）。
export default function QuestionCard({ q, phase, onPatch }) {
  const [showExpected, setShowExpected] = useState(false);
  const [note, setNote] = useState(q.note || '');
  const [saved, setSaved] = useState(false);
  const timer = useRef(null);

  useEffect(() => { setNote(q.note || ''); }, [q.id]);

  function saveNote(value) {
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      await onPatch(q.id, { note: value });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }, 800);
  }

  const readOnly = phase === 'review';

  if (q.excluded && phase !== 'prepare') return null;

  return (
    <div className={`q-item${q.excluded ? ' excluded' : ''}`} id={`q-${q.id}`}>
      <div className="q-top">
        <span className={`q-type ${q.type}`}>{q.type}</span>
        <span className="q-point" title={q.point}>{q.point}</span>
        {phase === 'prepare' && !q.excluded && (
          <button className="exclude-btn" title="这道题不问" onClick={() => onPatch(q.id, { excluded: true })}>
            <CloseOutlined /> 叉掉
          </button>
        )}
        {phase === 'prepare' && q.excluded && (
          <button className="restore-btn" onClick={() => onPatch(q.id, { excluded: false })}>
            <UndoOutlined /> 恢复
          </button>
        )}
      </div>

      <div className="q-text">{q.q}</div>

      {!q.excluded && q.followUp && (
        <div className="q-follow"><b>追问</b>{q.followUp}</div>
      )}

      {!q.excluded && q.expected?.length > 0 && (
        <div className="q-expected">
          <span className="q-expected-toggle" onClick={() => setShowExpected(v => !v)}>
            {showExpected ? '▾ 收起参考要点' : '▸ 参考要点（仅供参考）'}
          </span>
          {showExpected && (
            <ul>
              {q.expected.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
        </div>
      )}

      {!q.excluded && phase !== 'prepare' && (
        <div className="q-actions">
          <Rate
            value={q.score || 0}
            disabled={readOnly}
            onChange={v => onPatch(q.id, { score: v || null })}
          />
          {q.score && <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{q.score} 分</span>}
          <span className={`q-saved${saved ? ' show' : ''}`}><CheckOutlined /> 已保存</span>
        </div>
      )}
      {!q.excluded && phase !== 'prepare' && (
        <Input.TextArea
          value={note}
          readOnly={readOnly}
          placeholder={readOnly ? '未留备注' : '随手记下候选人的回答要点…'}
          autoSize={{ minRows: 1, maxRows: 6 }}
          variant="filled"
          style={{ marginTop: 8, fontSize: 12.5, background: 'var(--surface-2)' }}
          onChange={e => { setNote(e.target.value); saveNote(e.target.value); }}
        />
      )}
    </div>
  );
}
