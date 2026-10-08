import { useState } from 'react'
import type { FormEvent } from 'react'

export default function Login({ onLogin }: { onLogin: (name: string) => void }) {
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !password.trim()) {
      setError('请输入账号和密码')
      return
    }
    onLogin(name.trim())
  }

  return (
    <div className="ws-bar grid min-h-screen place-items-center p-6">
      <form onSubmit={submit} className="login-paper ws-rise relative w-full max-w-sm px-8 py-10">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="grid h-11 w-11 place-items-center rounded-lg bg-amber-400 text-xl font-bold text-[#1d2939]">F</span>
          <h1 className="mt-4 text-xl font-semibold text-slate-900">Facetry 简历评审工作台</h1>
          <p className="mt-1.5 text-sm text-slate-500">上传简历，让问题直接出现在经历旁边</p>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">账号</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            autoComplete="username"
            placeholder="面试官姓名或工号"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none"
          />
        </label>
        <label className="mt-4 block">
          <span className="mb-1 block text-xs font-medium text-slate-500">密码</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            placeholder="任意密码即可进入（本地演示）"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none"
          />
        </label>
        {error && <p className="login-fade mt-3 text-xs text-amber-700">{error}</p>}
        <button
          type="submit"
          className="mt-6 h-10 w-full cursor-pointer rounded-lg bg-amber-400 text-sm font-medium text-[#1d2939] ws-press hover:bg-amber-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          进入工作台
        </button>
        <p className="mt-4 text-center text-xs text-slate-400">简历与记录保存在本机服务</p>
      </form>
    </div>
  )
}
