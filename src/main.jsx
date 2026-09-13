import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import LoginScreen from './LoginScreen.jsx'
import { getSession, getUser, logout } from './auth.js'
import { airdrop } from './solana.js'
import './style.css'
import './arena-theme.css'

function initialUser() {
  const username = getSession()
  if (!username) return null
  const record = getUser(username)
  return { username, wallet: record?.wallet ?? null }
}

function Root() {
  const [user, setUser] = useState(initialUser)
  const onLogout = () => { logout(); setUser(null) }
  const onAuth = (result) => {
    setUser({ username: result.username, wallet: result.wallet })
    if (result.isNew && result.wallet) airdrop(result.wallet).catch(() => {})
  }
  return user
    ? <App user={user.username} wallet={user.wallet} onLogout={onLogout} />
    : <LoginScreen onAuth={onAuth} />
}

createRoot(document.getElementById('root')).render(<Root />)
