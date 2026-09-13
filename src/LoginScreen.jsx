import { useState } from 'react'
import { login, signup } from './auth.js'
import './login.css'

export default function LoginScreen({ onAuth }) {
  const [mode, setMode] = useState('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [launching, setLaunching] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    const result = mode === 'login' ? await login(username, password) : await signup(username, password)
    setSubmitting(false)
    if (result.error) { setError(result.error); return }
    setLaunching(true)
    setTimeout(() => onAuth(result), 1000)
  }

  const switchMode = (next) => {
    setMode(next)
    setError('')
  }

  return <div className="auth-viewport">
    <form className={`auth-card ${launching ? 'launching' : ''}`} onSubmit={submit}>
      <img className={`auth-logo ${launching ? 'auth-logo-launch' : ''}`} src="/assets/logo.png" alt="Battlecoin" />
      {!launching && <>
        <h1 className="auth-title">BATTLECOIN</h1>
        <div className="auth-tabs">
          <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')}>Log in</button>
          <button type="button" className={mode === 'signup' ? 'active' : ''} onClick={() => switchMode('signup')}>Sign up</button>
        </div>
        <label>Username<input value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" autoFocus /></label>
        <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></label>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button type="submit" className="auth-submit" disabled={submitting}>
          {submitting ? 'Please wait…' : mode === 'login' ? 'Enter the arena' : 'Create account'}
        </button>
      </>}
    </form>
  </div>
}
