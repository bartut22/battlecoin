import { useEffect, useMemo, useRef, useState } from 'react'
import { CircleHelp, Plus, RefreshCw, X, ExternalLink, Settings2, BookOpen, Users } from 'lucide-react'
import { createBattle } from './battle.js'
import { loadCharacterArt, TROOP_KINDS } from './character-art.js'
import usePolymarket from './usePolymarket.js'
import { DEFAULT_CARD_VALUES, DEFAULT_TAKER_VALUES, editableCard, marketCoverage, orderbookRows } from './market-engine.js'
import Sidebar from './Sidebar.jsx'

const usd = value => Number(value || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
const cents = value => value == null ? '--' : Number(value).toFixed(1).replace(/\.0$/, '') + 'c'
const tutorialKey = 'battlecoin-market-arena-tutorial-v2'
function Portrait({ kind, side = 'UP' }) {
  const canvas = useRef(null)
  useEffect(() => {
    let active = true
    if (kind !== 'balloon') loadCharacterArt().then(frames => {
      if (!active || !canvas.current) return
      const ctx = canvas.current.getContext('2d')
      ctx.clearRect(0, 0, 256, 256)
      ctx.drawImage(frames[side][kind], 0, 0)
    }).catch(() => {})
    return () => { active = false }
  }, [kind, side])
  if (kind === 'balloon') return <img className="unit-portrait balloon-portrait" src={side === 'UP' ? '/assets/green_balloon_shaded.png' : '/assets/red_balloon_shaded.png'} alt="" />
  return <canvas ref={canvas} className={`unit-portrait unit-${kind}`} width="256" height="256" aria-hidden="true" />
}
function Blotter({ state, onCancel, onClose }) {
  const [view, setView] = useState('Open orders')
  const rows = view === 'Open orders' ? state.openOrders || [] : view === 'Positions' ? state.positions || [] : state.completedOrders || []
  return <section className="positions-panel" aria-label="Portfolio">
    <header className="portfolio-header"><nav aria-label="Portfolio views">{['Open orders', 'Positions', 'History'].map(name => <button key={name} onClick={() => setView(name)} aria-pressed={view === name}>{name}{name === 'Open orders' && <span>{state.openOrders?.length || 0}</span>}</button>)}</nav>
      <div className="pnl"><span>Unrealized <b>{usd(state.unrealizedPnl)}</b></span><span>Realized <b>{usd(state.realizedPnl)}</b></span></div>
    </header>
    <div className="table-scroll"><table><thead><tr><th>Outcome</th><th>Price</th><th>Notional</th><th>Status</th><th aria-label="Actions" /></tr></thead>
      <tbody>{rows.length ? rows.map(row => <tr key={row.id}><td className={row.side === 'UP' ? 'positive' : 'negative'}>{row.side}</td><td>{cents(row.price)}</td><td>{usd(row.notional)}</td><td>{row.status || 'Position'}</td><td>{view === 'Open orders' && <button className="icon-button" title="Cancel order" aria-label={`Cancel ${row.id}`} onClick={() => onCancel(row.id)}><X size={14} /></button>}{view === 'Positions' && row.status !== 'awaiting settlement' && <button className="icon-button" title="Close position" aria-label={`Close ${row.id}`} onClick={() => onClose(row.id)}><X size={14}/></button>}</td></tr>) : <tr><td colSpan="5" className="empty-state">{view === 'Open orders' ? 'No resting orders' : view === 'Positions' ? 'No filled positions' : 'No completed orders'}</td></tr>}</tbody></table></div>
  </section>
}
function Controls({ market, cards, setCards, participant, setParticipant }) {
  const [view, setView] = useState('Book')
  const [side, setSide] = useState('UP')
  const rows = orderbookRows(market).filter(row => row.side === side)
  const unitValue = participant[side]
  return <aside className="control-rail" aria-label="Market and card settings">
    <nav className="rail-tabs" aria-label="Market settings views">{[['Book',BookOpen],['My cards',Settings2],['Participants',Users]].map(([label,Icon]) => <button key={label} aria-pressed={view === label} onClick={() => setView(label)} title={label}><Icon size={16}/><span>{label}</span></button>)}</nav>
    {view === 'Book' && <section className="rail-section"><div className="section-heading"><h2>Order book</h2><small>L2 depth</small></div>
      <div className="segmented">{['UP','DOWN'].map(value => <button className={value.toLowerCase()} key={value} aria-pressed={side === value} onClick={() => setSide(value)}>{value === 'UP' ? 'Yes / Up' : 'No / Down'}</button>)}</div>
      <div className="quote-pair"><div><small>Best bid</small><b>{cents(side === 'UP' ? market.bidUp : market.bidDown)}</b></div><div><small>Best ask</small><b>{cents(side === 'UP' ? market.askUp : market.askDown)}</b></div></div>
      {['ask','bid'].map(type => <div className="book-group" key={type}><h3>{type === 'bid' ? 'Bids' : 'Asks'}</h3><table><thead><tr><th>Price</th><th>Notional</th><th>From line</th><th>Units</th></tr></thead><tbody>{rows.filter(row => row.type === type).slice(0,8).map(row => <tr key={row.id} className={type}><td>{cents(row.price)}</td><td>{usd(row.notional)}</td><td>{cents(row.distanceCents)}</td><td>{Math.ceil(row.notional / unitValue)}</td></tr>)}</tbody></table></div>)}
      {!rows.length && <p className="empty-state">Waiting for market depth</p>}
    </section>}
    {view === 'My cards' && <section className="rail-section"><div className="section-heading"><h2>My cards</h2><small>Simulated USD</small></div>{cards.map((card,index) => <div className="card-setting" key={card.id}><Portrait kind={card.kind}/><div><strong>{card.name}</strong><small>{card.kind === 'balloon' ? 'Taker' : 'Limit order'}</small></div><label><span>Notional $</span><input aria-label={`${card.name} notional`} type="number" min="1" max="100000" step="1" value={card.notional} onChange={e => setCards(current => editableCard(current,index,e.target.value))}/></label></div>)}</section>}
    {view === 'Participants' && <section className="rail-section"><div className="section-heading"><h2>Market troops</h2><small>USD per unit</small></div>
      {TROOP_KINDS.map(troop => <div className="card-setting" key={troop.kind}><Portrait kind={troop.kind}/><div><strong>{troop.name}</strong><small>Market depth</small></div><label><span>Each unit $</span><input type="number" min="1" max="100000" aria-label={`${troop.name} market unit value`} value={participant.values[troop.kind]} onChange={e => setParticipant(current => {const value=Math.max(1,Math.min(100000,Number(e.target.value)||1));return {...current,values:{...current.values,[troop.kind]:value},UP:current.kindUP===troop.kind?value:current.UP,DOWN:current.kindDOWN===troop.kind?value:current.DOWN}})}/></label></div>)}
      {['UP','DOWN'].map(value => <div className="participant-setting" key={value}><strong className={value==='UP'?'positive':'negative'}>{value==='UP'?'UP army':'DOWN army'}</strong><label>Depth character<select aria-label={`${value} depth character`} value={participant['kind'+value]} onChange={e=>setParticipant(current=>({...current,['kind'+value]:e.target.value,[value]:current.values[e.target.value]}))}>{TROOP_KINDS.map(t=><option key={t.kind} value={t.kind}>{t.name}</option>)}</select></label><span>{usd(participant[value])} per character</span></div>)}
      <div className="scale-example"><b>$300 depth</b><span>{Math.ceil(300 / participant.UP)} UP characters</span><span>{Math.ceil(300 / participant.DOWN)} DOWN characters</span></div></section>}
    <footer className="rail-footer"><span className="gold-dot"/>Your orders <span className="muted">Gold outline</span></footer>
  </aside>
}

export default function App({ user, wallet, onLogout }) {
  const [sidebar, setSidebar] = useState(false)
  const host = useRef(null), battle = useRef(null), drag = useRef(null)
  const [cards,setCards] = useState(DEFAULT_CARD_VALUES)
  const [participant,setParticipant] = useState({UP:25,DOWN:25,kindUP:'scout',kindDOWN:'scout',values:{scout:25,guard:100,anchor:500}})
  const [orderSide,setOrderSide] = useState('UP')
  const {market:liveMarket,retry} = usePolymarket()
  const market = useMemo(() => ({...liveMarket,participantNotional:participant}),[liveMarket,participant])
  const config = useMemo(() => ({market,cards,orderSide,takers:DEFAULT_TAKER_VALUES}),[market,cards,orderSide])
  const latestConfig = useRef(config); latestConfig.current = config
  const [state,setState] = useState({capital:100,time:0,selected:-1,openOrders:[],completedOrders:[],positions:[]})
  const [tutorial,setTutorial] = useState(() => localStorage.getItem(tutorialKey) !== '1')
  const [remember,setRemember] = useState(false), [error,setError] = useState('')
  useEffect(() => {
    let disposed = false, game
    createBattle(host.current,setState,latestConfig.current).then(value => {
      if (disposed) value.destroy()
      else { game=value; battle.current=value; value.setMarket(latestConfig.current) }
    }).catch(e=>setError(e.message))
    return () => { disposed=true; game?.destroy(); battle.current=null }
  },[])
  useEffect(()=>{battle.current?.setMarket(config)},[config])
  const coverage = marketCoverage(market)
  const live = market.feedStatus === 'live'
  function down(event,index) {
    if(event.button !== 0) return
    drag.current={id:event.pointerId,index,x:event.clientX,y:event.clientY,moved:false}
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  function move(event) {
    const d=drag.current; if(!d || d.id!==event.pointerId) return
    if(!d.moved && Math.hypot(event.clientX-d.x,event.clientY-d.y)>5) {d.moved=true;battle.current?.dragStart(d.index)}
    if(d.moved) battle.current?.dragMove(event.clientX,event.clientY)
  }
  function up(event) {
    const d=drag.current; if(!d) return
    if(d.moved) battle.current?.dragEnd(event.clientX,event.clientY)
    else battle.current?.select(d.index)
    drag.current=null
  }
  return <>
    <Sidebar open={sidebar} onOpen={() => setSidebar(true)} onClose={() => setSidebar(false)} user={user} wallet={wallet} onLogout={onLogout} />
    <main className="exchange">
    <header className="exchange-header"><div className="brand">BATTLECOIN<span>BTC Up or Down</span></div><div className={`feed-status ${market.feedStatus}`} title={market.feedMessage}><i/>{live ? 'Live Polymarket' : market.feedStatus}</div><span className="sim-badge">Simulated funds</span><button className="icon-button" title="Tutorial" aria-label="Tutorial" onClick={()=>setTutorial(true)}><CircleHelp size={18}/></button></header>
    <div className="workspace">
      <div className="main-column">
        <header className="market-strip"><div className="outcome positive"><small>YES / UP</small><strong>{coverage.available ? cents(coverage.upCents) : '--'}</strong></div><div className="market-title"><a href={market.slug ? `https://polymarket.com/event/${market.slug}` : 'https://polymarket.com'} target="_blank" rel="noreferrer">{market.title || 'Finding current BTC market'}<ExternalLink size={12}/></a><span>{coverage.source} <b>{Math.floor((state.time||0)/60)}:{String((state.time||0)%60).padStart(2,'0')}</b></span></div><div className="outcome negative"><small>NO / DOWN</small><strong>{coverage.available ? cents(coverage.downCents) : '--'}</strong></div></header>
        <section className="arena" aria-label="Live market arena"><div className="canvas-host" ref={host}/>{!live && <div className="feed-notice" role="status"><span>{market.feedMessage}</span><button className="icon-button" title="Reconnect" aria-label="Reconnect" onClick={retry}><RefreshCw size={16}/></button></div>}{state.message && <div className="arena-toast" role="status">{state.message}</div>}{error && <div className="feed-notice" role="alert">{error}</div>}</section>
        <footer className="deck-bar"><div className="capital"><small>Elixir capital</small><b>{usd(state.capital)}</b><button onClick={()=>battle.current?.depositCapital(100)}><Plus size={14}/>Deposit $100</button></div>
          <div className="deck-center"><div className="order-side" aria-label="Order outcome">{['UP','DOWN'].map(side=><button key={side} className={side.toLowerCase()} aria-pressed={orderSide===side} onClick={()=>setOrderSide(side)}>{side==='UP'?'Long UP':'Long DOWN'}</button>)}</div>
            <div className="deck">{cards.map((card,index)=><button key={card.id} className={`deck-card ${state.selected===index?'selected':''} team-${orderSide.toLowerCase()}`} disabled={!live || state.capital < card.notional} aria-pressed={state.selected===index} aria-label={`${card.name} ${usd(card.notional)}`} onPointerDown={e=>down(e,index)} onPointerMove={move} onPointerUp={up} onPointerCancel={()=>{drag.current=null;battle.current?.dragCancel()}} onClick={e=>{if(e.detail===0)battle.current?.select(index)}}><Portrait kind={card.kind} side={orderSide}/><span>{card.name}</span><b>{usd(card.notional)}</b></button>)}</div>
          </div><div className="deck-legend"><span className="gold-dot"/>My orders</div></footer>
        <Blotter state={state} onCancel={id=>battle.current?.cancelOrder(id)} onClose={id=>battle.current?.closePosition(id)}/>
      </div>
      <Controls market={market} cards={cards} setCards={setCards} participant={participant} setParticipant={setParticipant}/>
    </div>
    {tutorial && <div className="modal-backdrop"><section className="tutorial-modal" role="dialog" aria-modal="true" aria-label="Simulated funds tutorial"><CircleHelp size={26}/><h2>Your market arena</h2><p>You start with $100 in simulated funds. Deposits add demo capital only.</p><ol><li>The boundary follows Polymarket's displayed UP probability.</li><li>Drag a card onto the UP or DOWN field to place a simulated order. Your units have gold outlines.</li><li>Change card amounts and the dollars represented by other participants in the right panel.</li></ol><p>Characters represent aggregated price levels, not individual traders. Retreats show liquidity removed; public depth cannot identify every cancellation.</p><label className="remember"><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)}/>Don't show again</label><button className="primary-button" onClick={()=>{if(remember)localStorage.setItem(tutorialKey,'1');setTutorial(false)}}>Enter arena</button></section></div>}
  </main>
  </>
}
