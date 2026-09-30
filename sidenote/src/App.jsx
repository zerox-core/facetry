import React, { useCallback, useEffect, useState } from 'react';
import { App as AntApp } from 'antd';
import { api, setAuthToken, setAuthErrorHandler } from './api.js';
import Login from './components/Login.jsx';
import Home from './components/Home.jsx';
import Workspace from './components/Workspace.jsx';

const AUTH_KEY = 'sidenote.auth';

export default function App() {
  const { message } = AntApp.useApp();
  const [auth, setAuth] = useState(() => {
    try { return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'); } catch { return null; }
  });
  const [sessions, setSessions] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [configured, setConfigured] = useState(true);

  useEffect(() => {
    api.status().then(s => setConfigured(!!s.configured)).catch(() => {});
  }, []);

  useEffect(() => {
    setAuthToken(auth?.token || null);
    setAuthErrorHandler(() => {
      localStorage.removeItem(AUTH_KEY);
      setAuth(null);
      setOpenId(null);
    });
  }, [auth]);

  const refresh = useCallback(async () => {
    if (!auth) return;
    try {
      setSessions(await api.sessions());
    } catch (e) {
      if (localStorage.getItem(AUTH_KEY)) message.error(e.message);
    }
  }, [auth, message]);

  useEffect(() => { refresh(); }, [refresh]);

  function login(a) {
    localStorage.setItem(AUTH_KEY, JSON.stringify(a));
    setAuth(a);
  }
  function logout() {
    localStorage.removeItem(AUTH_KEY);
    setAuth(null);
    setOpenId(null);
    setSessions(null);
  }

  if (!auth) return <Login onLogin={login} />;

  if (openId) {
    return <Workspace id={openId} interviewer={auth.name} onBack={() => { setOpenId(null); refresh(); }} onLogout={logout} />;
  }
  return (
    <Home
      sessions={sessions}
      configured={configured}
      interviewer={auth.name}
      onLogout={logout}
      onOpen={setOpenId}
      onUploaded={s => { refresh(); setOpenId(s.id); }}
    />
  );
}
