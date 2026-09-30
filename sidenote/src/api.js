let authToken = null;
let onAuthError = null;

export function setAuthToken(token) { authToken = token; }
export function setAuthErrorHandler(fn) { onAuthError = fn; }

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !path.endsWith('/login')) {
    onAuthError?.();
    throw new Error(data.error || '登录已过期，请重新登录');
  }
  if (!res.ok && res.status !== 202) throw new Error(data.error || '请求失败，请重试');
  return { status: res.status, data };
}

export const api = {
  login: (username, password) => request('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  }).then(r => r.data),
  status: () => request('/api/status').then(r => r.data),
  sessions: () => request('/api/sessions').then(r => r.data),
  session: id => request(`/api/sessions/${id}`).then(r => r.data),
  job: id => request(`/api/jobs/${id}`).then(r => r.data),
  upload(file) {
    return request(`/api/upload?name=${encodeURIComponent(file.name)}`, { method: 'POST', body: file }).then(r => r.data);
  },
  patch(id, body) {
    return request(`/api/sessions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(r => r.data);
  },
  analyze(id, body) {
    return request(`/api/sessions/${id}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(r => r.data);
  },
  evaluate(id) {
    return request(`/api/sessions/${id}/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    }).then(r => r.data);
  },
};

export function pollJob(jobId, onTick, interval = 1500) {
  return new Promise((resolve, reject) => {
    const timer = setInterval(async () => {
      try {
        const job = await api.job(jobId);
        onTick?.(job);
        if (job.state === 'done') { clearInterval(timer); resolve(job); }
        if (job.state === 'error') { clearInterval(timer); reject(new Error(job.error || '处理失败')); }
      } catch (e) { clearInterval(timer); reject(e); }
    }, interval);
  });
}
