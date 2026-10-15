import { useState, useMemo, useEffect } from 'react'
import { Btn, useToast } from './ui'

interface LoginModalProps {
  open: boolean
  onClose: () => void
  onSuccess: (userName: string) => void
}

// 模拟点阵二维码
function MockQR({ scanned }: { scanned: boolean }) {
  const cells = useMemo(() => {
    let x = 7
    const out: [number, number][] = []
    for (let r = 0; r < 23; r++) for (let c = 0; c < 23; c++) {
      x = (x * 9301 + 49297) % 233280
      const finder = (r < 7 && c < 7) || (r < 7 && c > 15) || (r > 15 && c < 7)
      if (!finder && x / 233280 > 0.53) out.push([r, c])
    }
    return out
  }, [])

  const finder = (x: number, y: number) => (
    <g key={`${x}-${y}`}>
      <rect x={x} y={y} width={7} height={7} fill="#18212b" rx="1" />
      <rect x={x + 1} y={y + 1} width={5} height={5} fill="#fffefa" />
      <rect x={x + 2} y={y + 2} width={3} height={3} fill="#18212b" rx="0.5" />
    </g>
  )

  return (
    <div className="relative w-44 h-44 bg-paper p-3 border border-line rounded-[6px] shadow-xs flex items-center justify-center">
      <svg viewBox="-1 -1 25 25" className={`w-full h-full text-base transition-opacity duration-300 ${scanned ? 'opacity-20 blur-[1px]' : ''}`}>
        {cells.map(([r, c]) => <rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} fill="#18212b" />)}
        {finder(0, 0)}{finder(16, 0)}{finder(0, 16)}
      </svg>
      {scanned && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-paper/85 rounded-[6px] animate-in fade-in">
          <span className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[16px] shadow-sm mb-1">✓</span>
          <span className="text-[12px] font-semibold text-ink">已在飞书确认</span>
          <span className="text-[10.5px] text-ink/50 mt-0.5">正在为您同步组织权限…</span>
        </div>
      )}
    </div>
  )
}

export default function LoginModal({ open, onClose, onSuccess }: LoginModalProps) {
  const toast = useToast()
  const [mode, setMode] = useState<'feishu' | 'account'>('feishu')
  const [scanned, setScanned] = useState(false)
  const [account, setAccount] = useState('wanglu@facetry.cn')
  const [pwd, setPwd] = useState('••••••••')

  useEffect(() => {
    if (!open) setScanned(false)
  }, [open])

  if (!open) return null

  const handleSimulateScan = () => {
    setScanned(true)
    setTimeout(() => {
      onSuccess('王璐 · HR')
      onClose()
      toast('飞书免密扫码登录成功！欢迎回来，王璐')
    }, 700)
  }

  const handleAccountLogin = () => {
    onSuccess('王璐 · HR')
    onClose()
    toast('账号密码登录成功！')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-base/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="panel-elevated w-96 rounded-[8px] bg-paper p-6 shadow-2xl border border-line relative">
        <button onClick={onClose} className="absolute right-4 top-4 text-ink/40 hover:text-ink text-[16px] cursor-pointer">✕</button>

        {/* 顶部标题 */}
        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-[4px] bg-amber text-base font-serif font-black text-[18px] shadow-xs mb-2">
            知
          </div>
          <h2 className="text-[16px] font-bold text-ink">知马 · 人才招聘工作台</h2>
          <p className="text-[12px] text-ink/50 mt-0.5">面向高能效团队的智能招聘与面试系统</p>
        </div>

        {/* 登录方式 Tab */}
        <div className="flex border-b border-line mb-5">
          <button
            onClick={() => setMode('feishu')}
            className={`flex-1 pb-2.5 text-[12.5px] font-medium text-center relative transition-colors cursor-pointer ${mode === 'feishu' ? 'text-ink font-semibold' : 'text-ink/45 hover:text-ink'}`}
          >
            飞书企业扫码
            {mode === 'feishu' && <span className="absolute inset-x-6 bottom-0 h-[2px] bg-amber rounded-t-sm" />}
          </button>
          <button
            onClick={() => setMode('account')}
            className={`flex-1 pb-2.5 text-[12.5px] font-medium text-center relative transition-colors cursor-pointer ${mode === 'account' ? 'text-ink font-semibold' : 'text-ink/45 hover:text-ink'}`}
          >
            内部账号密码
            {mode === 'account' && <span className="absolute inset-x-6 bottom-0 h-[2px] bg-amber rounded-t-sm" />}
          </button>
        </div>

        {/* 飞书扫码方式 */}
        {mode === 'feishu' && (
          <div className="flex flex-col items-center">
            <MockQR scanned={scanned} />
            <div className="text-[11.5px] text-ink/55 mt-3 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>请使用手机飞书扫描上方二维码</span>
            </div>

            {/* 模拟演示按钮 */}
            <div className="w-full mt-4 pt-3 border-t border-line/70">
              <button
                onClick={handleSimulateScan}
                disabled={scanned}
                className="w-full h-9 bg-amber text-base font-semibold text-[12.5px] rounded-[4px] shadow-xs hover:brightness-105 active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>✦ 一键模拟飞书扫码登录</span>
              </button>
              <div className="text-[10.5px] text-center text-ink/40 mt-1.5">
                (演示环境直接体验完整权限与流程)
              </div>
            </div>
          </div>
        )}

        {/* 账号密码方式 */}
        {mode === 'account' && (
          <div className="space-y-3.5">
            <div>
              <label className="block text-[11.5px] text-ink/60 font-medium mb-1">企业邮箱 / 账号：</label>
              <input
                value={account}
                onChange={e => setAccount(e.target.value)}
                className="w-full h-8 px-2.5 border border-line rounded-[3px] bg-[#faf8f3] text-[12.5px] outline-none"
              />
            </div>
            <div>
              <label className="block text-[11.5px] text-ink/60 font-medium mb-1">登录密码：</label>
              <input
                type="password"
                value={pwd}
                onChange={e => setPwd(e.target.value)}
                className="w-full h-8 px-2.5 border border-line rounded-[3px] bg-[#faf8f3] text-[12.5px] outline-none"
              />
            </div>
            <Btn primary className="w-full h-9 text-[13px] mt-2" onClick={handleAccountLogin}>
              立即登录
            </Btn>
          </div>
        )}
      </div>
    </div>
  )
}
