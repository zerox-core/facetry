import React from 'react';
import { Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';

// 综合评价：总体观察 / 优势 / 待验证 / 下一轮 / 复核建议，证据题可点击跳回简历旁的原题。
export default function Evaluation({ evaluation, generating, onRegenerate, onJump, sections }) {
  if (!evaluation) {
    return (
      <div className="eval-block" style={{ textAlign: 'center', padding: '26px 16px' }}>
        <p style={{ marginBottom: 14 }}>面试记录就绪后，生成一份有据可查的综合评价。</p>
        <Button type="primary" loading={generating} onClick={onRegenerate} block>
          生成综合评价
        </Button>
      </div>
    );
  }

  const ev = evaluation;
  const qNo = id => {
    let n = 0;
    for (const sec of sections || []) {
      for (const q of sec.questions) {
        if (q.excluded) continue;
        n += 1;
        if (q.id === id) return n;
      }
    }
    return null;
  };

  return (
    <div>
      <div className="eval-block">
        <h4>总体观察</h4>
        <p className="eval-overall">{ev.overall}</p>
        {ev.evidence?.length > 0 && (
          <div className="eval-evidence">
            {ev.evidence.map(id => {
              const n = qNo(id);
              return n ? <span key={id} className="eval-chip" onClick={() => onJump(id)}>题 {n}</span> : null;
            })}
          </div>
        )}
      </div>

      {ev.strengths?.length > 0 && (
        <div className="eval-block">
          <h4>有依据的优势</h4>
          <ul>{ev.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </div>
      )}
      {ev.weaknesses?.length > 0 && (
        <div className="eval-block">
          <h4>待验证与不足</h4>
          <ul>{ev.weaknesses.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </div>
      )}
      {ev.nextSteps?.length > 0 && (
        <div className="eval-block">
          <h4>下一轮可验证</h4>
          <ul>{ev.nextSteps.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </div>
      )}

      <div className="eval-block" style={{ borderLeft: '3px solid var(--accent)' }}>
        <h4>复核建议</h4>
        <p>{ev.suggestion}</p>
        <div className="eval-time">生成于 {new Date(ev.generatedAt).toLocaleString('zh-CN')}</div>
      </div>

      <Button icon={<ReloadOutlined />} loading={generating} onClick={onRegenerate} block>
        根据最新记录重新生成
      </Button>
    </div>
  );
}
