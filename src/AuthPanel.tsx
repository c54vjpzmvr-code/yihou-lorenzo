import { useState, type FormEvent } from 'react'
import { ArrowRight, Eye, EyeOff, LoaderCircle, Shirt } from 'lucide-react'
import { cloud } from './cloud'

type Mode = 'login' | 'register' | 'forgot'

function authMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : ''
  if (/invalid login credentials/i.test(message)) return '邮箱或密码不正确。'
  if (/user already registered/i.test(message)) return '这个邮箱已经注册，请直接登录。'
  if (/password.*short/i.test(message)) return '密码至少需要 6 位。'
  if (/rate limit/i.test(message)) return '操作太频繁，请稍后重试。'
  return message || '操作失败，请稍后重试。'
}

export default function AuthPanel({ recovery = false, onRecovered }: { recovery?: boolean; onRecovered?: () => void }) {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  function switchMode(next: Mode) {
    setMode(next)
    setError('')
    setMessage('')
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!cloud) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      if (recovery) {
        const { error: cause } = await cloud.auth.updateUser({ password })
        if (cause) throw cause
        onRecovered?.()
        return
      }
      if (mode === 'forgot') {
        const { error: cause } = await cloud.auth.resetPasswordForEmail(email, {
          redirectTo: `${location.origin}${location.pathname}`,
        })
        if (cause) throw cause
        setMessage('重设密码的邮件已发出，请检查邮箱。')
      } else if (mode === 'register') {
        const { data, error: cause } = await cloud.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${location.origin}${location.pathname}` },
        })
        if (cause) throw cause
        if (!data.session) setMessage('注册邮件已发出。请打开邮件确认后登录。')
      } else {
        const { error: cause } = await cloud.auth.signInWithPassword({ email, password })
        if (cause) throw cause
      }
    } catch (cause) {
      setError(authMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  return <div className="auth-page">
    <header className="auth-header"><span className="brand-mark"><Shirt size={24} strokeWidth={1.8} /></span><span><strong>衣候</strong><small>YI HOU</small></span></header>
    <main className="auth-main"><div className="auth-form-wrap">
      <p className="eyebrow">MY WARDROBE</p>
      <h1>{recovery ? '设置新密码' : mode === 'register' ? '创建衣候账户' : mode === 'forgot' ? '找回密码' : '欢迎回来'}</h1>
      <p className="auth-intro">{recovery ? '设置完成后，继续使用你的衣橱。' : mode === 'forgot' ? '我们会向你的邮箱发送重设链接。' : '你的衣服和收藏会跟随账户，随时在不同设备打开。'}</p>
      {!recovery && mode !== 'forgot' ? <div className="auth-tabs" role="tablist" aria-label="账户方式"><button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')}>登录</button><button type="button" role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'active' : ''} onClick={() => switchMode('register')}>注册</button></div> : null}
      <form className="auth-form" onSubmit={submit}>
        {!recovery ? <><label htmlFor="auth-email">邮箱</label><input id="auth-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" /></> : null}
        {recovery || mode !== 'forgot' ? <><label htmlFor="auth-password">{recovery ? '新密码' : '密码'}</label><div className="auth-password"><input id="auth-password" type={visible ? 'text' : 'password'} autoComplete={recovery ? 'new-password' : mode === 'register' ? 'new-password' : 'current-password'} minLength={mode === 'login' && !recovery ? undefined : 6} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="至少 6 位" /><button type="button" onClick={() => setVisible((value) => !value)} aria-label={visible ? '隐藏密码' : '显示密码'} title={visible ? '隐藏密码' : '显示密码'}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></> : null}
        {error ? <p className="auth-error" role="alert">{error}</p> : null}
        {message ? <p className="auth-message" role="status">{message}</p> : null}
        <button className="auth-submit" type="submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={18} /> : null}{recovery ? '保存新密码' : mode === 'register' ? '创建账户' : mode === 'forgot' ? '发送邮件' : '登录'}<ArrowRight size={18} /></button>
      </form>
      {!recovery ? <button className="auth-secondary" type="button" onClick={() => switchMode(mode === 'forgot' ? 'login' : 'forgot')}>{mode === 'forgot' ? '返回登录' : '忘记密码？'}</button> : null}
    </div></main>
  </div>
}
