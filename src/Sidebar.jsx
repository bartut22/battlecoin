import { useState } from 'react'
import './sidebar.css'

export default function Sidebar({ open, onOpen, onClose, user, onLogout }) {
  const [sound, setSound] = useState(true)

  return <>
    <button className={`sidebar-strip ${open ? 'open' : ''}`} aria-label="Open account menu" onClick={onOpen}>
      <span className="sidebar-strip-avatar">{user?.[0]?.toUpperCase()}</span>
      <span className="sidebar-strip-arrow">›</span>
    </button>
    <div className={`sidebar-overlay ${open ? 'open' : ''}`} onClick={onClose} />
    <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Account sidebar" aria-hidden={!open}>
      <button className="sidebar-close" aria-label="Close sidebar" onClick={onClose}>×</button>

      <section className="sidebar-section sidebar-profile">
        <div className="sidebar-avatar">{user?.[0]?.toUpperCase()}</div>
        <div><strong>{user}</strong><span>Commander</span></div>
      </section>

      <section className="sidebar-section">
        <h2>Wallet</h2>
        <div className="sidebar-wallet">
          <span>Not connected</span>
          <p>Solana devnet integration coming soon.</p>
          <button className="sidebar-connect" disabled>Connect wallet</button>
        </div>
      </section>

      <section className="sidebar-section">
        <h2>Settings</h2>
        <label className="sidebar-toggle">
          <span>Sound</span>
          <input type="checkbox" checked={sound} onChange={e => setSound(e.target.checked)} />
        </label>
      </section>

      <button className="sidebar-logout" onClick={onLogout}>Log out</button>
    </aside>
  </>
}
