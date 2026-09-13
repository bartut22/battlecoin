import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { CircleHelp, Plus, RefreshCw, X, ExternalLink, Settings2, BookOpen, SlidersHorizontal, Flag, ArrowLeft, ArrowRight, ShieldCheck, Wallet, Crosshair } from 'lucide-react'
import { createBattle } from './battle.js'
import { loadCharacterArt, TROOP_KINDS, BALLOON_KINDS } from './character-art.js'
import usePolymarket from './usePolymarket.js'
import { DEFAULT_CARD_VALUES, DEFAULT_TAKER_VALUES, editableCard, marketCoverage, notionalCharacters, orderbookRows } from './market-engine.js'
import Sidebar from './Sidebar.jsx'
import { CentIcon, CentMessage } from './CentIcon.jsx'
import TutorialDemo from './TutorialDemo.jsx'
import { convertSolToCapital, getBalance, SOL_USD_RATE, NETWORK_LABEL } from './solana.js'

const usd = value => Number(value || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
const cents = value => value == null ? '--' : <>{Number(value).toFixed(1).replace(/\.0$/, '')}<CentIcon/></>
const btc = value => value == null ? '--' : '$' + Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const tutorialKey = 'battlecoin-market-arena-tutorial-v3'
const CARD_GROUPS = [{ id: 'limit', name: 'Limit troops' }, { id: 'balloon', name: 'Taker balloons' }]
const isCardGroup = (card, group) => (card.kind === 'balloon') === (group === 'balloon')
function NewMarketNotice({ market }) {
  const previous = useRef(null)
  const [notice, setNotice] = useState(null)
  useEffect(() => {
    if (!market.marketId) return
    if (previous.current && previous.current !== market.marketId) {
      setNotice({ id: market.marketId, title: market.title })
    }
    previous.current = market.marketId
  }, [market.marketId, market.title])
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 6500)
    return () => clearTimeout(timer)
  }, [notice])
  return notice && <aside className="market-rollover" role="status" aria-live="polite" aria-atomic="true">
    <Flag size={20} /><div><strong>New market opened</strong><span>{notice.title}</span></div>
    <button className="icon-button" aria-label="Dismiss new market notification" onClick={() => setNotice(null)}><X size={16} /></button>
  </aside>
}
function CoinLogo() { return <span className="coin-logo" aria-label="Battlecoin"><img src="/assets/logo.png" alt="" /></span> }
const Portrait = memo(function Portrait({ kind, balloonSize, side = 'UP' }) {
  const canvas = useRef(null)
  const artKind = kind === 'balloon' && balloonSize ? `balloon-${balloonSize}` : kind
  useEffect(() => {
    let active = true
    loadCharacterArt().then(frames => {
      if (!active || !canvas.current) return
      const ctx = canvas.current.getContext('2d')
      ctx.imageSmoothingEnabled = false
      ctx.clearRect(0, 0, 256, 256)
      const frame = frames[side][artKind] || frames[side].balloon
      if (frame) ctx.drawImage(frame, 0, 0)
    }).catch(() => {})
    return () => { active = false }
  }, [artKind, side])
  return <canvas ref={canvas} className={`unit-portrait unit-${artKind} side-${side.toLowerCase()}`} width="256" height="256" aria-hidden="true" />
})
function Tutorial({ remember, setRemember, onClose }) {
  const [step, setStep] = useState(0)
  const modal = useRef(null)
  const steps = [
    { name: 'Briefing', icon: ShieldCheck, title: 'Welcome to Battlecoin', content: <>
      <p>Command a paper trading army with $100 in simulated capital. Polymarket supplies the reference prices, public order book, and trade activity for this demo.</p>
      <p className="tutorial-status"><ShieldCheck size={18}/><strong>Live trading is currently disabled for this demo.</strong></p>
      <p>There are no active native exchange participants. Your orders, fills, positions, and P&amp;L are simulated; no trades are submitted to Polymarket or a native exchange.</p>
    </> },
    { name: 'Your army', icon: Flag, title: 'Choose your formation', content: <>
      <div className="tutorial-roster" aria-hidden="true"><Portrait kind="scout"/><Portrait kind="guard"/><Portrait kind="anchor"/><Portrait kind="balloon" balloonSize="small"/><Portrait kind="balloon" balloonSize="medium"/><Portrait kind="balloon" balloonSize="large"/></div>
      <p>Choose Long/UP or Short/DOWN, then select or drag a card into the arena. Limit troops rest at your chosen price until the simulation can fill them.</p>
      <p>The taker balloons to the right of the limit deck simulate taking available liquidity. Choose small Sand Bomber, medium Caravan Bomber, or large Siege Bomber. Edit each card's notional in My cards.</p>
      <p className="tutorial-ownership"><span className="gold-dot"/><strong>Gold outlines identify your own simulated troops and balloons.</strong></p>
    </> },
    { name: 'Market signals', icon: Crosshair, title: 'Read the battlefield', content: <>
      <p>The boundary follows estimated fair value from Polymarket reference data. When sized two-sided quotes are available, the estimate uses a microprice and balances complementary outcomes.</p>
      <p>Other troops represent aggregated public book depth, and other balloons visualize public trades. They are not individual traders or active native exchange participants. Retreats show removed liquidity; public depth cannot identify every cancellation.</p>
      <p>Settings controls price grouping, troop denominations, and the small, medium, and large balloon thresholds for public trade visuals. These thresholds do not change your order sizes.</p>
    </> },
    { name: 'Wallet & record', icon: Wallet, title: 'Manage your demo', content: <>
      <p>Solana deposit and withdrawal integration is available in your account menu on <strong>{NETWORK_LABEL}</strong>. Deposits request test SOL; withdrawals transfer SOL to a destination on that network.</p>
      <p>Convert transfers wallet SOL to the demo vault and credits simulated capital at the fixed demo rate of {usd(SOL_USD_RATE)} per SOL. This wallet transfer does not place an exchange trade, and simulated profits are not withdrawable SOL.</p>
      <p>Track resting orders, positions, and your saved activity in the portfolio below the arena. Cancel orders or close positions to manage your paper trading session.</p>
    </> },
  ]
  useEffect(() => {
    const previous = document.activeElement
    modal.current?.focus()
    return () => { previous?.focus() }
  }, [])
  const current = steps[step], Icon = current.icon
  function keyDown(event) {
    if (event.key === 'Escape') { event.preventDefault(); onClose(); return }
    if (event.key !== 'Tab') return
    const elements = [...modal.current.querySelectorAll('button:not(:disabled), input, a[href]')]
    const first = elements[0], last = elements.at(-1)
    if (event.shiftKey && (document.activeElement === first || document.activeElement === modal.current)) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && (document.activeElement === last || document.activeElement === modal.current)) { event.preventDefault(); first?.focus() }
  }
  return <div className="modal-backdrop tutorial-backdrop"><section ref={modal} tabIndex={-1} className="tutorial-modal" role="dialog" aria-modal="true" aria-labelledby="tutorial-title" onKeyDown={keyDown}>
    <header className="tutorial-header"><span><Flag size={16}/>Battlecoin / Field guide</span><button className="icon-button" title="Close tutorial" aria-label="Close tutorial" onClick={onClose}><X size={18}/></button></header>
    <nav className="tutorial-steps" aria-label="Tutorial chapters">{steps.map((item,index)=><button key={item.name} aria-current={step===index?'step':undefined} onClick={()=>setStep(index)}><span>{String(index+1).padStart(2,'0')}</span>{item.name}</button>)}</nav>
    <div className="tutorial-chapter" aria-live="polite"><div className="tutorial-title"><Icon size={24}/><h2 id="tutorial-title">{current.title}</h2></div><TutorialDemo chapter={step}/>{current.content}</div>
    <footer className="tutorial-actions"><label className="remember"><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)}/>Don't show again</label><div><button className="icon-button" title="Previous chapter" aria-label="Previous chapter" disabled={step===0} onClick={()=>setStep(value=>value-1)}><ArrowLeft size={18}/></button><button className="primary-button" onClick={()=>step===steps.length-1?onClose():setStep(value=>value+1)}>{step===steps.length-1?'Enter demo':'Continue'}<ArrowRight size={18}/></button></div></footer>
  </section></div>
}
function Blotter({ state, history, onCancel, onClose }) {
  const [view, setView] = useState('Open orders')
  const rows = view === 'Open orders' ? state.openOrders || [] : view === 'Positions' ? state.positions || [] : history || []
  return <section className="positions-panel" aria-label="Portfolio">
    <header className="portfolio-header"><nav aria-label="Portfolio views">{['Open orders', 'Positions', 'History'].map(name => <button key={name} onClick={() => setView(name)} aria-pressed={view === name}>{name}{name === 'Open orders' && <span>{state.openOrders?.length || 0}</span>}</button>)}</nav>
      <div className="pnl"><span>Unrealized <b>{usd(state.unrealizedPnl)}</b></span><span>Realized <b>{usd(state.realizedPnl)}</b></span></div>
    </header>
    <div className="table-scroll"><table><thead><tr><th>Outcome</th><th>Price</th><th>Notional</th><th>Status</th><th aria-label="Actions" /></tr></thead>
      <tbody>{rows.length ? rows.map(row => <tr key={row.id}><td className={row.side === 'UP' ? 'positive' : 'negative'}>{row.side}</td><td>{cents(row.price)}</td><td>{usd(row.notional)}</td><td>{row.status || 'Position'}</td><td>{view === 'Open orders' && <button className="icon-button" title="Cancel order" aria-label={`Cancel ${row.id}`} onClick={() => onCancel(row.id)}><X size={14} /></button>}{view === 'Positions' && row.status !== 'awaiting settlement' && <button className="icon-button" title="Close position" aria-label={`Close ${row.id}`} onClick={() => onClose(row.id)}><X size={14}/></button>}</td></tr>) : <tr><td colSpan="5" className="empty-state">{view === 'Open orders' ? 'No resting orders' : view === 'Positions' ? 'No filled positions' : 'No completed orders'}</td></tr>}</tbody></table></div>
  </section>
}
const Controls = memo(function Controls({ market, cards, setCards, participant, setParticipant, capital, fundedCapital }) {
  const [view, setView] = useState('Book')
  const [side, setSide] = useState('UP')
  const rows = useMemo(() => orderbookRows(market).filter(row => row.side === side), [market, side])
  const exampleSummary = useMemo(() => {
    const example = notionalCharacters(850, participant.values)
    return TROOP_KINDS.map(troop => ({name:troop.name,count:example.filter(item=>item.kind===troop.kind).length})).filter(item=>item.count>0)
  }, [participant.values])
  const capitalPercent = Math.max(0, Math.min(100, capital / Math.max(1, fundedCapital || 100) * 100))
  return <aside className="control-rail" aria-label="Market and card settings">
    <div className="rail-top">
    <section className="capital" aria-label="Available demo capital"><div className="capital-title"><small>Available capital</small><b>{usd(capital)}</b></div><div className="elixir-bar" role="meter" aria-label="Available simulated trading capital" aria-valuemin="0" aria-valuemax={fundedCapital||100} aria-valuenow={capital}><i style={{width:`${capitalPercent}%`}}/></div><div className="capital-actions"><span>{usd(fundedCapital||100)} simulated funding</span></div></section>
    <nav className="rail-tabs" aria-label="Market settings views">{[['Book',BookOpen],['My cards',Settings2],['Settings',SlidersHorizontal]].map(([label,Icon]) => <button key={label} aria-pressed={view === label} onClick={() => setView(label)} title={label}><Icon size={16}/><span>{label}</span></button>)}</nav>
    </div>
    <div className="rail-content">
    {view === 'Book' && <section className="rail-section"><div className="section-heading"><h2>Order book</h2><small>Live L2</small></div>
      <div className="quote-board"><div className="quote-head"><span>Outcome</span><span>Bid</span><span>Ask</span></div>{['UP','DOWN'].map(value=><button key={value} className={value.toLowerCase()} aria-pressed={side===value} onClick={()=>setSide(value)}><strong>{value}</strong><b>{cents(value==='UP'?market.bidUp:market.bidDown)}</b><b>{cents(value==='UP'?market.askUp:market.askDown)}</b></button>)}</div>
      <div className="book-side-label"><span>{side} depth</span><small>{cents(participant.priceBand)} visual bands</small></div>
      {['ask','bid'].map(type => <div className="book-group" key={type}><h3>{type === 'bid' ? 'Bids' : 'Asks'}</h3><table><thead><tr><th>Price</th><th>Notional</th><th>From line</th><th>Troops</th></tr></thead><tbody>{rows.filter(row => row.type === type).slice(0,8).map(row => <tr key={row.id} className={type}><td>{cents(row.price)}</td><td>{usd(row.notional)}</td><td>{cents(row.distanceCents)}</td><td>{notionalCharacters(row.notional,participant.values).length}</td></tr>)}</tbody></table></div>)}
      {!rows.length && <p className="empty-state">Waiting for market depth</p>}
    </section>}
    {view === 'My cards' && <section className="rail-section"><div className="section-heading"><h2>Order cards</h2><small>My simulated size</small></div>{CARD_GROUPS.map(group=><section className="card-settings-group" key={group.id} aria-label={group.name}><h3>{group.name}</h3>{cards.map((card,index) => isCardGroup(card,group.id) && <div className="card-setting" key={card.id}><Portrait kind={card.artKind || card.kind} balloonSize={card.balloonSize}/><div><strong>{card.name}</strong><small>{card.kind === 'balloon' ? 'Taker order' : 'Limit order'}</small></div><label><span>Notional $</span><input aria-label={`${card.name} notional`} type="number" min="1" max="100000" step="1" value={card.notional} onChange={e => setCards(current => editableCard(current,index,e.target.value))}/></label></div>)}</section>)}</section>}
    {view === 'Settings' && <section className="rail-section"><div className="section-heading"><h2>Arena settings</h2><small>Depth renderer</small></div>
      <div className="setting-block"><label>Price grouping</label><div className="segmented compact">{[1,2,5].map(value=><button key={value} aria-label={`${value} cents`} aria-pressed={participant.priceBand===value} onClick={()=>setParticipant(current=>({...current,priceBand:value}))}>{cents(value)}</button>)}</div><small>Group nearby price levels around fair value.</small></div>
      <div className="section-heading troop-heading"><h2>Troop denominations</h2><small>Automatic mix</small></div>
      {TROOP_KINDS.map(troop => <div className="card-setting" key={troop.kind}><Portrait kind={troop.kind}/><div><strong>{troop.name}</strong><small>Market depth</small></div><label><span>Notional $</span><input type="number" min="1" max="100000" aria-label={`${troop.name} market unit value`} value={participant.values[troop.kind]} onChange={e => setParticipant(current => ({...current,values:{...current.values,[troop.kind]:Math.max(1,Math.min(100000,Number(e.target.value)||1))}}))}/></label></div>)}
      <div className="scale-example"><b>$850 depth becomes</b><span>{exampleSummary.map(item=>`${item.count} ${item.name}`).join(' · ')}</span></div>
      <div className="section-heading troop-heading"><h2>Balloon thresholds</h2><small>Public trade visuals</small></div>
      {BALLOON_KINDS.map(balloon => <div className="card-setting" key={balloon.kind}><Portrait kind={balloon.kind}/><div><strong>{balloon.name}</strong><small>{balloon.size} / public trades</small></div><label><span>Threshold $</span><input type="number" min="1" max="100000" step="1" aria-label={`${balloon.name} public trade threshold`} value={participant.balloonValues[balloon.size]} onChange={e => setParticipant(current => ({...current,balloonValues:{...current.balloonValues,[balloon.size]:Math.max(1,Math.min(100000,Number(e.target.value)||1))}}))}/></label></div>)}
    </section>}
    </div>
  </aside>
})

export default function App({ user, userId, wallet, onLogout }) {
  const [sidebar, setSidebar] = useState(false)
  const host = useRef(null), battle = useRef(null), drag = useRef(null)
  const [cards,setCards] = useState(DEFAULT_CARD_VALUES)
  const [participant,setParticipant] = useState({priceBand:1,values:{scout:25,guard:100,anchor:250},balloonValues:{small:20,medium:100,large:500}})
  const [orderSide,setOrderSide] = useState('UP')
  const {market:liveMarket,retry} = usePolymarket()
  const market = useMemo(() => ({...liveMarket,participantNotional:participant}),[liveMarket,participant])
  const config = useMemo(() => ({market,cards,orderSide,takers:DEFAULT_TAKER_VALUES}),[market,cards,orderSide])
  const latestConfig = useRef(config); latestConfig.current = config
  const [state,setState] = useState({capital:100,fundedCapital:100,time:0,selected:-1,openOrders:[],completedOrders:[],positions:[]})
  const [tutorial,setTutorial] = useState(() => localStorage.getItem(tutorialKey) !== '1')
  const [remember,setRemember] = useState(false), [error,setError] = useState('')
  const [solBalance,setSolBalance] = useState(null)
  const [convertAmount,setConvertAmount] = useState('0.1')
  const [converting,setConverting] = useState(false)
  const [convertError,setConvertError] = useState('')
  const [history,setHistory] = useState([])
  useEffect(() => {
    if (!wallet) return
    let cancelled = false
    getBalance(wallet).then(b => { if (!cancelled) setSolBalance(b) }).catch(() => {})
    return () => { cancelled = true }
  }, [wallet])
  const historyStatus = { open: 'Filled', close: 'Closed', cancel: 'Cancelled' }
  async function loadHistory() {
    if (!userId) return
    try {
      const res = await fetch(`/api/trades?user_id=${userId}&limit=100`)
      if (!res.ok) return
      const rows = await res.json()
      setHistory(rows.map(row => ({
        id: 'H-' + row.id,
        side: row.side,
        price: Number(row.price_cents),
        notional: Number(row.notional_usd),
        status: historyStatus[row.kind] || row.kind,
      })))
    } catch { /* best-effort; history just stays stale */ }
  }
  useEffect(() => { loadHistory() }, [userId])
  async function convert() {
    setConverting(true); setConvertError('')
    try {
      const { balance, usd: gained } = await convertSolToCapital(wallet, Number(convertAmount))
      setSolBalance(balance)
      battle.current?.depositCapital(gained)
    } catch (err) { setConvertError(err.message || 'Conversion failed.') }
    finally { setConverting(false) }
  }
  async function recordTrade(event) {
    if (!userId) return
    try {
      const res = await fetch('/api/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          market_slug: event.marketSlug || 'unknown',
          side: event.side,
          price_cents: event.priceCents,
          notional_usd: event.notionalUsd,
          kind: event.kind,
        }),
      })
      if (res.ok) loadHistory()
    } catch { /* best-effort; local trading still works if this fails */ }
  }
  useEffect(() => {
    let disposed = false, game
    createBattle(host.current,setState,latestConfig.current,recordTrade).then(value => {
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
  const capitalControls = <div className="sol-convert">
    <small>{solBalance == null ? 'Wallet: —' : `Wallet: ${solBalance} SOL`}</small>
    <div className="sol-convert-row">
      <input aria-label="SOL amount to convert" type="number" min="0" step="0.01" value={convertAmount} onChange={e=>setConvertAmount(e.target.value)} />
      <button onClick={convert} disabled={converting || !wallet}><Plus size={14}/>{converting ? 'Converting…' : `Convert (${SOL_USD_RATE}/SOL)`}</button>
    </div>
    {convertError && <small className="convert-error" role="alert">{convertError}</small>}
  </div>
  return <>
    <Sidebar open={sidebar} onOpen={() => setSidebar(true)} onClose={() => setSidebar(false)} user={user} wallet={wallet} onLogout={onLogout} capitalControls={capitalControls} />
    <NewMarketNotice market={market} />
    <main className="exchange">
    <header className="exchange-header"><CoinLogo/><div className="header-market"><b>BTC arena</b><span>Polymarket reference / Paper trading demo</span></div><div className={`feed-status ${market.feedStatus}`} title={market.feedMessage}><i/>{live ? 'Live data' : market.feedStatus}</div><span className="sim-badge">Live trading disabled</span><button className="icon-button" title="Tutorial" aria-label="Tutorial" onClick={()=>setTutorial(true)}><CircleHelp size={18}/></button></header>
    <div className="workspace">
      <div className="main-column">
        <header className="market-strip"><div className="outcome positive" title={`Fair value source: ${coverage.available ? coverage.source : 'Waiting for data'}`}><small>UP / Fair value</small><strong>{coverage.available ? cents(coverage.upCents) : '--'}</strong><span>Bid {cents(market.bidUp)} · Ask {cents(market.askUp)}</span></div><div className="market-center"><a href={market.slug ? `https://polymarket.com/event/${market.slug}` : 'https://polymarket.com'} target="_blank" rel="noreferrer">{market.title || 'BTC Up or Down'}<ExternalLink size={12}/></a><div className="market-metrics"><div title={market.referenceApproximate?'Captured from live Polymarket RTDS after this round opened':'Opening Polymarket RTDS reference'}><small>Price to beat</small><b>{btc(market.priceToBeat)}</b></div><div><small>Distance</small><b className={(market.currentBtc||0)>=(market.priceToBeat||Infinity)?'positive':'negative'}>{market.currentBtc!=null&&market.priceToBeat!=null?(market.currentBtc-market.priceToBeat>=0?'+':'')+btc(market.currentBtc-market.priceToBeat):'--'}</b></div><div><small>Time remaining</small><b>{Math.floor((state.time||0)/60)}:{String((state.time||0)%60).padStart(2,'0')}</b></div></div></div><div className="outcome negative" title={`Fair value source: ${coverage.available ? coverage.source : 'Waiting for data'}`}><small>DOWN / Fair value</small><strong>{coverage.available ? cents(coverage.downCents) : '--'}</strong><span>Bid {cents(market.bidDown)} · Ask {cents(market.askDown)}</span></div></header>
        <section className="arena" aria-label="Live market arena"><div className="canvas-host" ref={host}/>{market.feedStatus==='unavailable' && <div className="feed-notice" role="status"><span>{market.feedMessage}</span><button className="icon-button" title="Reconnect" aria-label="Reconnect" onClick={retry}><RefreshCw size={16}/></button></div>}{state.message && <div className="arena-toast" role="status"><CentMessage text={state.message}/></div>}{error && <div className="feed-notice" role="alert">{error}</div>}</section>
        <footer className="deck-bar">
          <div className="deck-center"><div className={`order-banner team-${orderSide.toLowerCase()}`} aria-label="Order outcome"><button className="up" aria-pressed={orderSide==='UP'} onClick={()=>setOrderSide('UP')}><Flag size={14}/><span>Long/UP</span></button><button className="down" aria-pressed={orderSide==='DOWN'} onClick={()=>setOrderSide('DOWN')}><span>Short/DOWN</span><Flag size={14}/></button></div>
            <div className="deck-groups">{CARD_GROUPS.map(group=><section className={`deck-group deck-group-${group.id}`} key={group.id} aria-label={group.name}><h2>{group.name}</h2><div className="deck">{cards.map((card,index)=>isCardGroup(card,group.id) && <button key={card.id} className={`deck-card ${state.selected===index?'selected':''} team-${orderSide.toLowerCase()}`} disabled={!live || state.capital < card.notional} aria-pressed={state.selected===index} aria-label={`${card.name}${card.balloonSize ? `, ${card.balloonSize} taker balloon` : ', limit troop'}, ${usd(card.notional)} simulated`} title={!live ? 'Waiting for live reference data' : state.capital < card.notional ? 'Insufficient simulated capital' : `${card.name}: ${usd(card.notional)} simulated`} onPointerDown={e=>down(e,index)} onPointerMove={move} onPointerUp={up} onPointerCancel={()=>{drag.current=null;battle.current?.dragCancel()}} onClick={e=>{if(e.detail===0)battle.current?.select(index)}}><Portrait kind={card.artKind || card.kind} balloonSize={card.balloonSize} side={orderSide}/><span>{card.name}</span><b className={card.notional>=1000?'long-notional':undefined}>{usd(card.notional)}</b></button>)}</div></section>)}</div>
          </div></footer>
        <Blotter state={state} history={history} onCancel={id=>battle.current?.cancelOrder(id)} onClose={id=>battle.current?.closePosition(id)}/>
      </div>
      <Controls market={market} cards={cards} setCards={setCards} participant={participant} setParticipant={setParticipant} capital={state.capital} fundedCapital={state.fundedCapital}/>
    </div>
    {tutorial && <Tutorial remember={remember} setRemember={setRemember} onClose={()=>{if(remember)localStorage.setItem(tutorialKey,'1');else localStorage.removeItem(tutorialKey);setTutorial(false)}}/>}
  </main>
  </>
}
