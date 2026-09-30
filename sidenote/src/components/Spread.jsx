import React, { useLayoutEffect, useRef, useState } from 'react';
import QuestionCard from './QuestionCard.jsx';

const KIND_LABEL = { project: '项目', experience: '经历', skills: '技能', education: '教育' };
const EST_CHIP = 40;
const EST_CARD = 380;

// 一页简历 + 右侧批注栏。题目卡按锚点纵坐标吸附，重叠时自动向下顺延，
// 页面上用编号大头针标记锚点，引线连到批注卡。
export default function Spread({ page, sections, startIndex, phase, openId, onToggle, onPatch }) {
  const sheetRef = useRef(null);
  const [pageH, setPageH] = useState(0);
  const [heights, setHeights] = useState({});

  useLayoutEffect(() => {
    if (!sheetRef.current) return;
    const ro = new ResizeObserver(entries => {
      setPageH(entries[0].contentRect.height);
    });
    ro.observe(sheetRef.current);
    return () => ro.disconnect();
  }, [page]);

  const sorted = [...sections].sort((a, b) => a.anchor.y - b.anchor.y);

  let cursor = 0;
  const items = sorted.map(sec => {
    const open = sec.id === openId;
    const target = sec.anchor.y * pageH;
    const top = Math.max(target, cursor);
    const h = heights[sec.id] || (open ? EST_CARD : EST_CHIP);
    cursor = top + h + 10;
    return { sec, open, top };
  });

  function measure(id, el) {
    if (!el) return;
    const h = el.offsetHeight;
    setHeights(prev => (prev[id] === h ? prev : { ...prev, [id]: h }));
  }

  return (
    <div className="spread">
      <div className="page-wrap">
        <div className="page-sheet" ref={sheetRef}>
          {page.url
            ? <img src={page.url} alt={`简历第 ${page.page} 页`} />
            : <div className="page-text">{page.text?.join('\n')}</div>}
          {sorted.map((sec, i) => {
            const activeCount = sec.questions.filter(q => !q.excluded).length;
            const allOut = activeCount === 0;
            return (
              <button
                key={sec.id}
                className={`pin${sec.id === openId ? ' open' : ''}${allOut ? ' all-excluded' : ''}`}
            style={{ left: `${Math.min(0.96, Math.max(0.03, (sec.anchor.x || 0.06) - 0.045)) * 100}%`, top: `${sec.anchor.y * 100}%` }}
                title={`${sec.title}，共 ${activeCount} 题`}
                onClick={() => onToggle(sec.id)}
              >
                {startIndex + i + 1}
              </button>
            );
          })}
        </div>
        <div className="page-no">第 {page.page} 页</div>
      </div>

      <div className="gutter" style={{ minHeight: Math.max(pageH, cursor) }}>
        {items.map(({ sec, open, top }) => {
          const activeCount = sec.questions.filter(q => !q.excluded).length;
          const scoredCount = sec.questions.filter(q => !q.excluded && q.score !== null).length;
          return (
            <div className="note-stack" key={sec.id} style={{ top }} ref={el => measure(sec.id, el)}>
              <div className="leader" style={{ top: Math.max(6, sec.anchor.y * pageH - top + 14) }} />
              {open ? (
                <div className="section-card" id={`sec-${sec.id}`}>
                  <div className="section-card-head" onClick={() => onToggle(sec.id)}>
                    <span className="chip-num">{sorted.indexOf(sec) + startIndex + 1}</span>
                    <span className="chip-title">{sec.title}</span>
                    <span className="kind-tag">{KIND_LABEL[sec.kind] || '经历'}</span>
                    <span className="chip-count">
                      {phase === 'interview' ? `${scoredCount}/${activeCount} 已评` : `${activeCount} 题`}
                    </span>
                  </div>
                  {sec.anchor.quote && <div className="section-quote">{sec.anchor.quote}</div>}
                  <div>
                    {sec.questions.map(q => (
                      <QuestionCard key={q.id} q={q} phase={phase} onPatch={onPatch} />
                    ))}
                    {sec.questions.every(q => q.excluded) && (
                      <div style={{ padding: '12px 14px', fontSize: 12, color: 'var(--ink-3)' }}>
                        本段题目已全部叉掉
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="section-chip" onClick={() => onToggle(sec.id)}>
                  <span className="chip-num">{sorted.indexOf(sec) + startIndex + 1}</span>
                  <span className="chip-title">{sec.title}</span>
                  <span className="chip-count">{activeCount} 题</span>
                  <span className="chip-open">展开</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
