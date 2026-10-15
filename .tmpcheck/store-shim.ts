// SSR 冒烟专用桩：应用代码零改动。
// src/store.ts 的 useStore() = useSyncExternalStore(subscribe, () => version)，缺第三个参数，
// 在 SSR 渲染时会抛错（浏览器里正常）。此处只在渲染测试时把它替换成返回版本号常量的空实现，
// 其余导出原样透传（页面都是直接读模块级单例，useStore 仅用于触发重渲染）。
export * from '../src/store'
export function useStore() {
  return 0
}
