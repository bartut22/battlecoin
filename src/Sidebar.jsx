import { useEffect, useState } from 'react'
import { airdrop, withdraw, getBalance, NETWORK_LABEL } from './solana.js'
import './sidebar.css'

const short = (pubkey) => pubkey ? `${pubkey.slice(0, 4)}…${pubkey.slice(-4)}` : ''

export default function Sidebar({ open, onOpen, onClose, user, wallet, onLogout }) {
  const [sound, setSound] = useState(true)
  const [balance, setBalance] = useState(null)
  const [mode, setMode] = useState('deposit')
  const [amount, setAmount] = useState('1')
  const [address, setAddress] = useState('')
  const [busy, setBusy] = useState(false)
  const [walletError, setWalletError] = useState('')
  const [walletNotice, setWalletNotice] = useState('')

  useEffect(() => {
    if (!open || !wallet) return
    let cancelled = false
    getBalance(wallet).then(b => { if (!cancelled) setBalance(b) }).catch(() => {})
    return () => { cancelled = true }
  }, [open, wallet])

  const switchMode = (next) => {
    setMode(next); setWalletError(''); setWalletNotice('')
  }

  const submitDeposit = async (e) => {
    e.preventDefault()
    setBusy(true); setWalletError(''); setWalletNotice('')
    try {
      const next = await airdrop(wallet, Number(amount))
      setBalance(next); setWalletNotice(`Deposited ${amount} SOL.`)
    } catch (err) { setWalletError(err.message || `Deposit failed against ${NETWORK_LABEL} — try again shortly.`) }
    finally { setBusy(false) }
  }

  const submitWithdraw = async (e) => {
    e.preventDefault()
    setBusy(true); setWalletError(''); setWalletNotice('')
    try {
      const next = await withdraw(wallet, address, Number(amount))
      setBalance(next); setWalletNotice(`Withdrew ${amount} SOL.`); setAddress('')
    } catch (err) { setWalletError(err.message || `Withdrawal failed against ${NETWORK_LABEL} — try again shortly.`) }
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
          <p>{balance == null ? 'Loading balance…' : `${balance} SOL`} · {NETWORK_LABEL}</p>

          <div className="wallet-tabs">
            <button type="button" className={mode === 'deposit' ? 'active' : ''} onClick={() => switchMode('deposit')}>Deposit</button>
            <button type="button" className={mode === 'withdraw' ? 'active' : ''} onClick={() => switchMode('withdraw')}>Withdraw</button>
          </div>

          {mode === 'deposit' ? <form onSubmit={submitDeposit} className="wallet-form">
            <label>Amount (SOL)<input type="number" min="0" step="0.1" value={amount} onChange={e => setAmount(e.target.value)} required /></label>
            <button type="submit" className="sidebar-connect" disabled={busy}>{busy ? 'Depositing…' : 'Deposit SOL'}</button>
          </form> : <form onSubmit={submitWithdraw} className="wallet-form">
            <label>To address<input value={address} onChange={e => setAddress(e.target.value)} placeholder="Destination wallet address" required /></label>
            <label>Amount (SOL)<input type="number" min="0" step="0.1" value={amount} onChange={e => setAmount(e.target.value)} required /></label>
            <button type="submit" className="sidebar-connect" disabled={busy}>{busy ? 'Withdrawing…' : 'Withdraw SOL'}</button>
          </form>}

          {walletError && <p className="sidebar-wallet-error">{walletError}</p>}
          {walletNotice && <p className="sidebar-wallet-notice">{walletNotice}</p>}
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
