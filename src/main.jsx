import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import LoginScreen from './LoginScreen.jsx'
import { getSession, logout } from './auth.js'
import { airdrop } from './solana.js'
import './style.css'
import './arena-theme.css'

function initialUser() {
  return getSession()
}

function Root() {
  const [user, setUser] = useState(initialUser)
  const onLogout = () => { logout(); setUser(null) }
  const onAuth = (result) => {
    setUser({ username: result.username, userId: result.userId, wallet: result.wallet })
    if (result.isNew && result.wallet) airdrop(result.wallet).catch(() => {})
  }
  return user
    ? <App user={user.username} userId={user.userId} wallet={user.wallet} onLogout={onLogout} />
    : <LoginScreen onAuth={onAuth} />
}

createRoot(document.getElementById('root')).render(<Root />)
