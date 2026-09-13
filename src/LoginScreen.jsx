import { useState } from 'react'
import { login, signup } from './auth.js'
import './login.css'

export default function LoginScreen({ onAuth }) {
  const [mode, setMode] = useState('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const submit = (e) => {
    e.preventDefault()
    const result = mode === 'login' ? login(username, password) : signup(username, password)
    if (result.error) setError(result.error)
    else onAuth(result)
  }

  const switchMode = (next) => {
    setMode(next)
    setError('')
  }

  return <div className="auth-viewport">
    <form className="auth-card" onSubmit={submit}>
      <img className="auth-logo" src="/assets/logo.png" alt="Battlecoin" />
      <h1 className="auth-title">BATTLECOIN</h1>
      <div className="auth-tabs">
        <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')}>Log in</button>
        <button type="button" className={mode === 'signup' ? 'active' : ''} onClick={() => switchMode('signup')}>Sign up</button>
      </div>
      <label>Username<input value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" autoFocus /></label>
      <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></label>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <button type="submit" className="auth-submit">{mode === 'login' ? 'Enter the arena' : 'Create account'}</button>
    </form>
  </div>
}
