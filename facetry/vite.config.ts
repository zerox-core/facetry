import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  // 相对 base：构建产物可部署在站点根或 /apps/xxx 子路径下
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    // 代理目标跟随 PORT（与服务端默认 8080 一致）；本机 8080 被占用时用 PORT=8081 npm run dev / npm run server 一起换
    proxy: {
      '/api': `http://127.0.0.1:${process.env.PORT || 8080}`,
      '/files': `http://127.0.0.1:${process.env.PORT || 8080}`,
    },
  },
})
