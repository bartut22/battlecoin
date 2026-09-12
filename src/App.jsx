import { useEffect, useRef, useState } from 'react'
import { createBattle, CARDS } from './battle.js'
import MarketHud from './MarketHud.jsx'
import Sidebar from './Sidebar.jsx'

function Portrait({ kind, className = '' }) {
  return <span className={`portrait portrait-${kind} ${className}`} />
}

export default function App({ user, wallet, onLogout }) {
  const host = useRef(null)
  const battle = useRef(null)
  const [state, setState] = useState({ elixir: 5, time: 136, selected: -1, crowns: [0, 0], ended: false, message: '' })
  const [help, setHelp] = useState(false)
  const [sidebar, setSidebar] = useState(false)
  const [error, setError] = useState('')
  const [round, setRound] = useState(0)
  useEffect(() => {
    let disposed = false
    let cleanup
    createBattle(host.current, setState).then((game) => {
      if (disposed) game.destroy()
      else { battle.current = game; cleanup = () => game.destroy() }
    }).catch(e => setError(e.message))
    return () => { disposed = true; cleanup?.(); battle.current = null }
  }, [round])

  const choose = (index) => battle.current?.select(index)
  useEffect(() => {
    const key = (e) => {
      if (/^[1-4]$/.test(e.key)) choose(Number(e.key) - 1)
      if (e.key === 'Escape') { battle.current?.select(-1); setHelp(false) }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])
  const restart = () => { setError(''); setRound(n => n + 1) }
  return <div className="viewport">
    <section className="game" aria-label="Battlecoin arena">
      <div className="canvas-host" ref={host} />
      <MarketHud />
      <header className="opponent">
        <span className="league-shield">♜</span>
        <div><strong>HUY</strong><span>No Clan</span><small>🏆 155</small></div>
      </header>
      <div className={`timer ${state.time < 30 ? 'urgent' : ''}`}><span>Time left:</span><strong>{Math.floor(state.time / 60)}:{String(state.time % 60).padStart(2, '0')}</strong></div>
      <div className="crown-score red-score"><span>♛</span><b>{state.crowns[1]}</b></div>
      <div className="crown-score blue-score"><span>♛</span><b>{state.crowns[0]}</b></div>
      <button className="chat-button" aria-label="Show game instructions" onClick={() => setHelp(!help)}>•••</button>
      <Sidebar open={sidebar} onOpen={() => setSidebar(true)} onClose={() => setSidebar(false)} user={user} wallet={wallet} onLogout={onLogout} />
      {help && <div className="help"><strong>YOUR MOVE, COMMANDER</strong><p>Pick a card, then tap the left side of the arena. Troops cross the bridges and attack enemy towers.</p><p>Fireball can target anywhere. Elixir refills over time.</p><small>Keys 1–4 select cards · Esc cancels</small><button onClick={() => setHelp(false)}>Got it</button></div>}
      {state.message && <div className="toast" role="status">{state.message}</div>}
      <footer className="battle-hud">
        <div className="hand">
          <div className="next-card"><span>Next:</span><div><Portrait kind="knight" /></div><b>3</b></div>
          {CARDS.map((card, i) => <button key={card.name} onClick={() => choose(i)} className={`card ${state.selected === i ? 'selected' : ''} ${state.elixir < card.cost ? 'unavailable' : ''}`} aria-label={`${card.name}, ${card.cost} elixir`} aria-pressed={state.selected === i} title={`${card.name} · ${card.cost} elixir`}>
            {card.kind === 'fireball' ? <span className="fireball-art">☄</span> : <Portrait kind={card.kind} />}
            <span className="card-name">{card.name}</span><span className="cost">{card.cost}</span><kbd>{i + 1}</kbd>
          </button>)}
        </div>
        <div className="elixir"><b>{Math.floor(state.elixir)}</b><div className="elixir-track"><div style={{ width: `${state.elixir * 10}%` }} /><span /></div><small>10</small></div>
      </footer>
      {error && <div className="result" role="alert"><h2>Unable to start</h2><p>{error}</p><button onClick={restart}>Try again</button></div>}
      {state.ended && <div className="result"><span className="result-crown">♛</span><h1>{state.crowns[0] > state.crowns[1] ? 'VICTORY!' : state.crowns[0] < state.crowns[1] ? 'GOOD BATTLE!' : 'DRAW!'}</h1><p>{state.crowns[0]} — {state.crowns[1]}</p><button onClick={restart}>Battle again</button></div>}
      <div className="game-label">BATTLECOIN <span>TRAINING ARENA</span></div>
    </section>
  </div>
}

