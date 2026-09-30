import React, { useState } from 'react';
import { App as AntApp, Button, Input } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { api } from '../api.js';

function FeishuMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M2.8 6.2c5.2-.6 10.2.8 13.4 4-2.6-.9-5.7-.8-8.4.5-1.7.8-3 2.1-3.8 3.7C3 12.6 2.4 9.6 2.8 6.2Z" fill="#fff" opacity=".95"/>
      <path d="M21.2 17.8c-4.4 2.2-9.6 2-13.3-.4 2.4.4 5-.2 7.2-1.7 1.6-1.1 2.7-2.6 3.3-4.3 1.4 1.5 2.3 3.9 2.8 6.4Z" fill="#fff" opacity=".75"/>
    </svg>
  );
}

export default function Login({ onLogin }) {
  const { message } = AntApp.useApp();
  const [showAccount, setShowAccount] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!username.trim() || !password) { setError('请输入用户名和密码'); return; }
    setLoading(true);
    setError('');
    try {
      const auth = await api.login(username.trim(), password);
      onLogin(auth);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-center">
        <div className="login-seal">注</div>
        <h1 className="login-name">侧注</h1>
        <p className="login-tagline">把面试题，写在简历旁边</p>

        <button
          className="feishu-btn"
          onClick={() => message.info('飞书登录接入中，请先使用账号密码登录')}
        >
          <FeishuMark />
          使用飞书登录
        </button>

        <div className="login-divider">
          <span />
          <button className="login-alt" onClick={() => setShowAccount(v => !v)}>
            {showAccount ? '收起账号登录' : '使用账号密码登录'}
          </button>
          <span />
        </div>

        <div className={`login-account${showAccount ? ' open' : ''}`}>
          <div className="login-account-inner">
            <Input
              size="large"
              prefix={<UserOutlined style={{ color: 'var(--ink-3)' }} />}
              placeholder="用户名"
              value={username}
              onChange={e => setUsername(e.target.value)}
              onPressEnter={submit}
              style={{ marginBottom: 12 }}
            />
            <Input.Password
              size="large"
              prefix={<LockOutlined style={{ color: 'var(--ink-3)' }} />}
              placeholder="密码"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onPressEnter={submit}
            />
            {error && <div className="login-error">{error}</div>}
            <Button
              type="primary"
              size="large"
              block
              loading={loading}
              onClick={submit}
              style={{ marginTop: 16, height: 44, fontWeight: 600 }}
            >
              进入工作台
            </Button>
          </div>
        </div>

        <p className="login-foot">专为面试官打造的简历面试助手</p>
      </div>
    </div>
  );
}
