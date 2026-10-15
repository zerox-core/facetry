// 一次性 SSR 冒烟：用 Vite SSR 管线加载页面组件并真实渲染，检查是否抛异常。
// 目的：编译通过 != 运行不崩。渲染结果不参与断言，只看「是否抛错」。
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { fileURLToPath } from 'node:url'

// store.ts 直接访问 localStorage，SSR 里必须有桩，且必须在 import 模块之前装好。
const mem = new Map()
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  clear: () => mem.clear(),
}
globalThis.window = globalThis.window ?? {}

const go = () => {}

const cases = [
  ['/src/views/Workbench.tsx', { go }],
  ['/src/views/Candidates.tsx', { go }],
  ['/src/views/CandidateDetail.tsx', { cid: 'c1', go }],
  ['/src/views/CandidateDetail.tsx', { cid: 'c2', go }],
  ['/src/views/CandidateDetail.tsx', { cid: 'c-not-exist', go }], // 空值兜底路径
  ['/src/views/Jobs.tsx', { go }],
  ['/src/views/ScheduleManager.tsx', { go }],
  ['/src/views/Approvals.tsx', { go }],
  ['/src/views/Bank.tsx', {}],
  ['/src/views/Admin.tsx', { go }],
  ['/src/views/Overview.tsx', { go }],
  ['/src/views/Result.tsx', { cid: 'c2', go }],
  ['/src/views/ColorBentoDashboard.tsx', { go, onSwitchView: go }],
]

const server = await createServer({
  configFile: 'vite.config.ts',
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
  // 仅测试期：把视图里的 '../store' 指向桩模块，规避 useSyncExternalStore 的 SSR 限制。
  resolve: {
    alias: [{ find: '../store', replacement: fileURLToPath(new URL('./store-shim.ts', import.meta.url)) }],
  },
})

let fail = 0
for (const [path, props] of cases) {
  const label = `${path.replace('/src/views/', '')} ${JSON.stringify(Object.keys(props))}`
  try {
    const mod = await server.ssrLoadModule(path)
    const Comp = mod.default
    if (typeof Comp !== 'function') throw new Error('no default export component')
    const html = renderToString(createElement(Comp, props))
    const kb = (Buffer.byteLength(html) / 1024).toFixed(1)
    console.log(`PASS  ${label.padEnd(52)} html ${kb} KB`)
  } catch (e) {
    fail++
    console.log(`FAIL  ${label.padEnd(52)} ${e && e.message ? e.message.split('\n')[0] : e}`)
  }
}
await server.close()
console.log(fail === 0 ? '\nALL RENDER OK' : `\n${fail} case(s) failed`)
process.exit(fail === 0 ? 0 : 1)
