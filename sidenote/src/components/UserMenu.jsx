import React from 'react';
import { Dropdown } from 'antd';
import { LogoutOutlined, DownOutlined } from '@ant-design/icons';

export default function UserMenu({ name, onLogout }) {
  return (
    <Dropdown
      menu={{
        items: [{ key: 'logout', icon: <LogoutOutlined />, label: '退出登录', onClick: onLogout }],
      }}
      placement="bottomRight"
    >
      <div className="user-menu">
        <span className="user-avatar">{(name || '面').slice(0, 1)}</span>
        <span className="user-name">{name}</span>
        <DownOutlined style={{ fontSize: 10, color: 'var(--ink-3)' }} />
      </div>
    </Dropdown>
  );
}
