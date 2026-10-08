import React, { useState } from 'react';
import { App as AntApp } from 'antd';
import { api } from '../api.js';
import LoginShowcase from './LoginShowcase.jsx';

// 伪二维码：固定种子生成的点阵 + 三个定位角，接入飞书扫码后替换为真实二维码
function QR({ dim }) {
  const cells = React.useMemo(() => {
    let x = 7;
    const out = [];
    for (let r = 0; r < 25; r++) for (let c = 0; c < 25; c++) {
      x = (x * 9301 + 49297) % 233280;
      const finder = (r < 8 && c < 8) || (r < 8 && c > 16) || (r > 16 && c < 8);
      if (!finder && x / 233280 > 0.52) out.push([r, c]);
    }
    return out;
  }, []);
  const finder = (x, y) => (
    <g key={`${x}-${y}`}>
      <rect x={x} y={y} width={7} height={7} fill="currentColor" />
      <rect x={x + 1} y={y + 1} width={5} height={5} fill="#fff" />
      <rect x={x + 2} y={y + 2} width={3} height={3} fill="currentColor" />
    </g>
  );
  return (
    <svg viewBox="-1 -1 27 27" className={`qr-svg${dim ? ' dim' : ''}`} shapeRendering="crispEdges" aria-label="飞书登录二维码">
      {cells.map(([r, c]) => <rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} fill="currentColor" />)}
      {finder(0, 0)}{finder(18, 0)}{finder(0, 18)}
    </svg>
  );
}

export default function Login({ onLogin }) {
  const { message } = AntApp.useApp();
  const [mode, setMode] = useState('feishu');
  const [account, setAccount] = useState('');
  const [pwd, setPwd] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!account.trim()) return setErr('请输入企业邮箱或工号');
    if (!pwd) return setErr('请输入密码');
    setErr('');
    setBusy(true);
    try {
      const auth = await api.login(account.trim(), pwd);
      onLogin(auth);
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login2-page">
      <div className="login2-brand">
        <span className="login2-seal">注</span>
        <span className="login2-brand-name">侧注</span>
        <span className="login2-brand-sub">面试官工作台</span>
      </div>
      <h1 className="login2-headline">让每一场面试，<em>都有据可依</em></h1>

      <div className="login2-card">
        <h2>登录</h2>
        <p className="login2-sub">使用公司账号登录面试官工作台</p>

        <div className="login2-tabs">
          {[['feishu', '飞书登录'], ['password', '账号密码']].map(([k, t]) => (
            <button
              key={k}
              onClick={() => { setMode(k); setErr(''); }}
              className={`login2-tab${mode === k ? ' active' : ''}`}
            >{t}</button>
          ))}
        </div>

        {mode === 'feishu' ? (
          <div className="login2-feishu">
            <div className="qr-box">
              <QR dim />
              <div className="qr-overlay">
                <div className="qr-overlay-title">扫码登录接入中</div>
                <div className="qr-overlay-sub">请先使用账号密码登录</div>
              </div>
            </div>
            <p className="login2-qr-hint">打开<span className="qr-hint-strong">飞书 App</span>，扫一扫登录</p>
            <div className="login2-divider"><span /><span>或</span><span /></div>
            <button className="login2-ghost-btn" onClick={() => message.info('飞书客户端登录接入中，请先使用账号密码登录')}>
              <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
                <path d="M3 5.5 10.5 3l6.5 6-6.5 8L3 14.5z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
              </svg>
              使用飞书客户端登录
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="login2-pwd" noValidate>
            <label className="login2-field">
              <span className="login2-label">企业邮箱 / 工号</span>
              <input
                value={account}
                onChange={e => setAccount(e.target.value)}
                autoComplete="username"
                className="login2-input"
                placeholder="admin"
              />
            </label>
            <label className="login2-field">
              <span className="login2-label login2-label-row">
                <span>密码</span>
                <a href="#" onClick={e => e.preventDefault()} className="login2-forgot">忘记密码</a>
              </span>
              <span className="login2-pwd-wrap">
                <input
                  value={pwd}
                  onChange={e => setPwd(e.target.value)}
                  type={show ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="login2-input"
                  placeholder="请输入密码"
                />
                <button type="button" onClick={() => setShow(!show)} className="login2-show">{show ? '隐藏' : '显示'}</button>
              </span>
            </label>
            <label className="login2-remember">
              <input type="checkbox" defaultChecked />7 天内免登录
            </label>
            {err && <p className="login2-error">{err}</p>}
            <button type="submit" disabled={busy} className="login2-submit">
              {busy ? '登录中…' : '登录'}
            </button>
            <p className="login2-hint">内部演示账号：admin，密码 admin123</p>
          </form>
        )}
      </div>

      <div className="login2-demo">
        <div className="login2-demo-caption">产品演示</div>
        <LoginShowcase />
      </div>

      <footer className="login2-foot">
        仅限企业内部使用，候选人数据按公司信息安全规范存储<br />
        登录即表示同意《内部系统使用规范》与《候选人信息保护协议》
      </footer>
    </div>
  );
}
