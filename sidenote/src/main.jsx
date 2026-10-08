import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider, App as AntApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import App from './App.jsx';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <ConfigProvider
    locale={zhCN}
    theme={{
      token: {
        colorPrimary: '#3370ff',
        colorInfo: '#3370ff',
        colorLink: '#3370ff',
        colorText: '#1b1f27',
        colorTextSecondary: '#5b6472',
        colorBorder: '#d5dae3',
        colorBgContainer: '#ffffff',
        borderRadius: 10,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Segoe UI', sans-serif",
      },
      components: {
        Button: { borderRadius: 10 },
        Rate: { starSize: 18 },
      },
    }}
  >
    <AntApp>
      <App />
    </AntApp>
  </ConfigProvider>
);
