import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import LoginScreen from './LoginScreen.jsx'
import { getSession, logout } from './auth.js'
import './style.css'

function Root() {
  const [user, setUser] = useState(getSession())
  const onLogout = () => { logout(); setUser(null) }
  return user ? <App user={user} onLogout={onLogout} /> : <LoginScreen onAuth={setUser} />
}

createRoot(document.getElementById('root')).render(<Root />)
