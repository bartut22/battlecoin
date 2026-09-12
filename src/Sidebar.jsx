import { useEffect, useState } from 'react'
import { airdrop, getBalance } from './solana.js'
import './sidebar.css'

const short = (pubkey) => pubkey ? `${pubkey.slice(0, 4)}…${pubkey.slice(-4)}` : ''

export default function Sidebar({ open, onOpen, onClose, user, wallet, onLogout }) {
  const [sound, setSound] = useState(true)
  const [balance, setBalance] = useState(null)
  const [busy, setBusy] = useState(false)
  const [walletError, setWalletError] = useState('')

  useEffect(() => {
    if (!open || !wallet) return
    let cancelled = false
    getBalance(wallet).then(b => { if (!cancelled) setBalance(b) }).catch(() => {})
    return () => { cancelled = true }
  }, [open, wallet])

  const requestAirdrop = async () => {
    setBusy(true); setWalletError('')
    try { setBalance(await airdrop(wallet)) }
    catch { setWalletError('Airdrop failed — devnet faucet may be rate-limited, try again shortly.') }
    finally { setBusy(false) }
  }

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
        {wallet ? <div className="sidebar-wallet">
          <span title={wallet.publicKey}>{short(wallet.publicKey)}</span>
          <p>{balance == null ? 'Loading balance…' : `${balance} SOL`} · Solana devnet</p>
          {walletError && <p className="sidebar-wallet-error">{walletError}</p>}
          <button className="sidebar-connect" onClick={requestAirdrop} disabled={busy}>{busy ? 'Requesting…' : 'Request devnet SOL'}</button>
        </div> : <div className="sidebar-wallet">
          <span>Not connected</span>
          <p>No wallet on this account yet.</p>
          <button className="sidebar-connect" disabled>Connect wallet</button>
        </div>}
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
