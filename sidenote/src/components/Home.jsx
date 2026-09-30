import React, { useRef, useState } from 'react';
import { App as AntApp, Spin, Alert } from 'antd';
import { api } from '../api.js';
import UserMenu from './UserMenu.jsx';

const PHASE_LABEL = { prepare: '选题中', interview: '面试中', review: '已完成' };

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '刚刚';
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  return `${Math.floor(h / 24)} 天前`;
}

export default function Home({ sessions, configured, interviewer, onLogout, onOpen, onUploaded }) {
  const { message } = AntApp.useApp();
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  async function handleFile(file) {
    if (!file) return;
    setUploading(true);
    try {
      const s = await api.upload(file);
      message.success(`已收录「${s.fileName}」`);
      onUploaded(s);
    } catch (e) {
      message.error(e.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <header className="topbar">
        <div className="brand">侧注 <em>SIDENOTE</em></div>
        <div className="topbar-spacer" />
        {!configured && <Alert type="warning" showIcon message="尚未配置大模型接口，请在 sidenote/config.json 中填写 baseUrl / apiKey / model" style={{ padding: '2px 12px' }} />}
        <UserMenu name={interviewer} onLogout={onLogout} />
      </header>

      <main className="home">
        <div className="hero-kicker">简历面试工作台</div>
        <h1 className="hero-title">把面试题，<br />写在简历旁边。</h1>
        <p className="hero-sub">
          上传候选人简历，系统自动通读全文，把有针对性的面试题别在对应的项目与经历旁边。
          面试前勾选题量，面试中随手打分记录，结束后一键生成有依据的综合评价。
        </p>

        <div className="hero-grid">
          <div>
            <div
              className={`upload-box${dragging ? ' dragging' : ''}`}
              onClick={() => inputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files?.[0]); }}
            >
              {uploading ? <Spin size="large" /> : <div className="upload-seal">注</div>}
              <div className="upload-title">{uploading ? '正在收录…' : '拖入简历，或点击选择'}</div>
              <div className="upload-hint">支持 PDF / Word / TXT / 图片，20 MB 以内<br />简历原文仅用于生成题目，不会被外传</div>
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.docx,.txt,.png,.jpg,.jpeg"
                style={{ display: 'none' }}
                onChange={e => { handleFile(e.target.files?.[0]); e.target.value = ''; }}
              />
            </div>
          </div>

          <div>
            <div className="archive-card">
              <div className="archive-head">
                <span className="archive-title">候选人档案</span>
                <span className="archive-count">{sessions ? `共 ${sessions.length} 份` : ''}</span>
              </div>
              {!sessions ? (
                <div className="archive-empty"><Spin /></div>
              ) : sessions.length === 0 ? (
                <div className="archive-empty">还没有简历，从左边上传第一份吧</div>
              ) : (
                sessions.map(s => (
                  <div key={s.id} className="archive-row" onClick={() => onOpen(s.id)}>
                    <div className="archive-avatar">{(s.name || s.fileName || '?').slice(0, 1)}</div>
                    <div>
                      <div className="archive-name">{s.name || s.fileName}</div>
                      <div className="archive-role">{s.role || '未识别求职方向'}</div>
                    </div>
                    <span className="archive-meta">{s.questionCount ?? 0} 题</span>
                    <span className="archive-meta">{timeAgo(s.updatedAt)}</span>
                    <span className={`phase-badge ${s.phase}`}>{PHASE_LABEL[s.phase] || s.phase}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
