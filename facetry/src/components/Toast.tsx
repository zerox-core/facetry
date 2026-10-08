import { useEffect, useState } from 'react'

let listener: (msg: string) => void = () => {}

/** 全局轻提示：2.4 秒后自动消失 */
export function toast(message: string) {
  listener(message)
}

export function ToastHost() {
  const [message, setMessage] = useState('')
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    listener = (msg) => {
      setMessage(msg)
      clearTimeout(timer)
      timer = setTimeout(() => setMessage(''), 2400)
    }
    return () => {
      listener = () => {}
      clearTimeout(timer)
    }
  }, [])
  if (!message) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 top-16 z-50 flex justify-center">
      <div className="login-fade rounded-lg bg-[#1d2939] px-4 py-2.5 text-sm text-white shadow-[var(--shadow-lift)]">
        {message}
      </div>
    </div>
  )
}
