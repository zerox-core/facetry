import React, { useEffect, useState } from 'react';

// 登录页左侧：一个产品窗口，循环演示「上传简历 → 锚点出题 → 现场打分 → 综合评价」
const STEPS = ['上传简历', '锚点出题', '现场打分', '综合评价'];
const DUR = 2600;

const LINES = [
  { text: '主导首页性能优化，LCP 由 4.2s 降至 1.8s', mark: 'hi' },
  { text: '负责组件库建设，覆盖 30+ 业务线' },
  { text: '熟悉大模型应用与 Agent 开发', mark: 'risk' },
];
const TONE = {
  hi: { hl: '#d1fae5', dot: 'demo-dot-green', chip: 'demo-chip-green', t: '亮点' },
  risk: { hl: '#fde68a', dot: 'demo-dot-amber', chip: 'demo-chip-amber', t: '待核实' },
};

export default function LoginShowcase() {
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => setStep(s => (s + 1) % STEPS.length), DUR);
    return () => clearTimeout(t);
  }, [step, paused]);

  const marked = step >= 1;
  const focus = step >= 2;

  return (
    <div className="demo-wrap">
      <div
        className="demo-window"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div className="demo-steps">
          {STEPS.map((s, i) => (
            <button key={s} onClick={() => setStep(i)} className="demo-step">
              <span className={`demo-step-label${i === step ? ' active' : i < step ? ' past' : ''}`}>
                <span className="demo-step-num">{i + 1}</span>{s}
              </span>
              <span className="demo-step-bar">
                <span
                  key={`${step}-${paused}`}
                  className={`demo-step-fill${i < step ? ' filled' : i === step && !paused ? ' running' : ''}`}
                  style={{ animationDuration: `${DUR}ms` }}
                />
              </span>
            </button>
          ))}
        </div>

        <div className="demo-body">
          {/* 左：简历 */}
          <div className="demo-resume">
            <div className="demo-resume-head">
              <span className="demo-resume-name">林晓</span>
              <span className="demo-resume-file">林晓_简历.pdf</span>
            </div>
            <div className="demo-resume-role">高级前端工程师，6 年经验</div>
            <div className="demo-resume-section">项目经历</div>
            <ul className="demo-lines">
              {LINES.map((l, i) => {
                const tone = l.mark && TONE[l.mark];
                const on = marked && !!tone;
                const dim = focus && l.mark !== 'risk';
                return (
                  <li key={i} className={`demo-line${dim ? ' dim' : ''}${focus && l.mark === 'risk' ? ' focus' : ''}`}>
                    <span className={`demo-line-dot${on ? ` ${tone.dot}` : ''}`} style={{ transitionDelay: on ? `${i * 200}ms` : '0ms' }} />
                    <span className="demo-line-text">
                      <span
                        className="demo-line-hl"
                        style={{ backgroundImage: tone ? `linear-gradient(${tone.hl},${tone.hl})` : undefined, backgroundSize: on ? '100% 0.45em' : '0% 0.45em', transitionDelay: on ? `${i * 200}ms` : '0ms' }}
                      >{l.text}</span>
                      {tone && <span className={`demo-line-chip ${tone.chip}${on ? ' on' : ''}`} style={{ transitionDelay: on ? `${400 + i * 200}ms` : '0ms' }}>{tone.t}</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
            <div className="demo-skeleton">
              <div style={{ width: '92%' }} />
              <div style={{ width: '67%' }} />
              <div style={{ width: '80%' }} />
            </div>
            {step === 0 && <div className="demo-scan" />}
          </div>

          {/* 右：随步骤切换的面板 */}
          <div key={step} className="demo-panel demo-fade">
            {step === 0 && (
              <Panel title="解析中">
                {['提取基本信息', '识别项目与经历', '量化成果与技能描述'].map((t, i) => (
                  <div key={t} className="demo-fade demo-task" style={{ animationDelay: `${i * 500}ms`, animationFillMode: 'backwards' }}>
                    <span className="demo-task-check">✓</span>{t}
                  </div>
                ))}
              </Panel>
            )}
            {step === 1 && (
              <Panel title="Aegis 项目，第 2 题">
                <p className="demo-q">MCP 协议中 initialize、tools/call 这几个方法你是如何实现的？</p>
                <div className="demo-basis">依据：自研 MCP 工具协议层…</div>
                <div className="demo-followups">
                  <div>追问：某个 Server 挂了会不会拖垮其余 7 个？</div>
                  <div>追问：注册中心和自动降级分别怎么实现？</div>
                </div>
              </Panel>
            )}
            {step === 2 && (
              <Panel title="现场记录">
                {['协议细节讲得清楚', '降级方案答得一般', '有真实排障经验'].map((p, i) => (
                  <label key={p} className="demo-check-item">
                    <span className="demo-check" style={{ animationDelay: `${300 + i * 450}ms` }}>✓</span>{p}
                  </label>
                ))}
                <div>
                  <div className="demo-score-label">评分</div>
                  <div className="demo-score-row">
                    {[1, 2, 3, 4, 5].map(n => (
                      <span key={n} className={`demo-score${n === 4 ? ' demo-pick' : ''}`}>{n}</span>
                    ))}
                  </div>
                </div>
              </Panel>
            )}
            {step === 3 && (
              <Panel title="综合评价">
                <Stat n={4.0} t="平均评分" tone="demo-dot-blue" />
                <Stat n="93%" t="题目覆盖率" tone="demo-dot-green" />
                <p className="demo-conclusion">工程能力扎实，多智能体经验真实；服务化能力建议下轮继续验证。</p>
              </Panel>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <div>
      <div className="demo-panel-title">{title}</div>
      <div className="demo-panel-body">{children}</div>
    </div>
  );
}
function Stat({ n, t, tone }) {
  return (
    <div className="demo-stat">
      <span className={`demo-stat-dot ${tone}`} />
      <span className="demo-stat-label">{t}</span>
      <span className="demo-stat-num">{n}</span>
    </div>
  );
}
