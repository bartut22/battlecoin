import { useEffect, useMemo, useRef, useState } from 'react'
import { CircleHelp, Plus, RefreshCw, X, ExternalLink, Settings2, BookOpen, SlidersHorizontal, Flag } from 'lucide-react'
import { createBattle } from './battle.js'
import { loadCharacterArt, TROOP_KINDS } from './character-art.js'
import usePolymarket from './usePolymarket.js'
import { DEFAULT_CARD_VALUES, DEFAULT_TAKER_VALUES, editableCard, marketCoverage, notionalCharacters, orderbookRows } from './market-engine.js'
import Sidebar from './Sidebar.jsx'
import { useTutorial, TutorialDialogue, TutorialQuotes, TutorialLanes, TutorialDeck, TutorialHistory } from './Tutorial.jsx'
import { TUTORIAL_MARKET, tutorialVisibility } from './tutorial-state.js'
import { convertSolToCapital, getBalance, SOL_USD_RATE } from './solana.js'

const usd = value => Number(value || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
const cents = value => value == null ? '--' : Number(value).toFixed(1).replace(/\.0$/, '') + 'c'
const btc = value => value == null ? '--' : '$' + Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
function CoinLogo() { return <span className="coin-logo" aria-label="Battlecoin"><img src="/assets/logo.png" alt="" /></span> }
function Portrait({ kind, side = 'UP' }) {
  const canvas = useRef(null)
  useEffect(() => {
    let active = true
    loadCharacterArt().then(frames => {
      if (!active || !canvas.current) return
      const ctx = canvas.current.getContext('2d')
      ctx.clearRect(0, 0, 256, 256)
      ctx.drawImage(frames[side][kind], 0, 0)
    }).catch(() => {})
    return () => { active = false }
  }, [kind, side])
  return <canvas ref={canvas} className={`unit-portrait unit-${kind} side-${side.toLowerCase()}`} width="256" height="256" aria-hidden="true" />
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
  const example = notionalCharacters(850, participant.values)
  const exampleSummary = TROOP_KINDS.map(troop => ({name:troop.name,count:example.filter(item=>item.kind===troop.kind).length})).filter(item=>item.count>0)
  return <aside className="control-rail" aria-label="Market and card settings">
    <nav className="rail-tabs" aria-label="Market settings views">{[['Book',BookOpen],['My cards',Settings2],['Settings',SlidersHorizontal]].map(([label,Icon]) => <button key={label} aria-pressed={view === label} onClick={() => setView(label)} title={label}><Icon size={16}/><span>{label}</span></button>)}</nav>
    {view === 'Book' && <section className="rail-section"><div className="section-heading"><h2>Order book</h2><small>Live L2</small></div>
      <div className="quote-board"><div className="quote-head"><span>Outcome</span><span>Bid</span><span>Ask</span></div>{['UP','DOWN'].map(value=><button key={value} className={value.toLowerCase()} aria-pressed={side===value} onClick={()=>setSide(value)}><strong>{value}</strong><b>{cents(value==='UP'?market.bidUp:market.bidDown)}</b><b>{cents(value==='UP'?market.askUp:market.askDown)}</b></button>)}</div>
      <div className="book-side-label"><span>{side} depth</span><small>{participant.priceBand}c visual bands</small></div>
      {['ask','bid'].map(type => <div className="book-group" key={type}><h3>{type === 'bid' ? 'Bids' : 'Asks'}</h3><table><thead><tr><th>Price</th><th>Notional</th><th>From line</th><th>Troops</th></tr></thead><tbody>{rows.filter(row => row.type === type).slice(0,8).map(row => <tr key={row.id} className={type}><td>{cents(row.price)}</td><td>{usd(row.notional)}</td><td>{cents(row.distanceCents)}</td><td>{notionalCharacters(row.notional,participant.values).length}</td></tr>)}</tbody></table></div>)}
      {!rows.length && <p className="empty-state">Waiting for market depth</p>}
    </section>}
    {view === 'My cards' && <section className="rail-section"><div className="section-heading"><h2>Order cards</h2><small>My simulated size</small></div>{cards.map((card,index) => <div className="card-setting" key={card.id}><Portrait kind={card.kind}/><div><strong>{card.name}</strong><small>{card.kind === 'balloon' ? 'Taker' : 'Limit order'}</small></div><label><span>Notional $</span><input aria-label={`${card.name} notional`} type="number" min="1" max="100000" step="1" value={card.notional} onChange={e => setCards(current => editableCard(current,index,e.target.value))}/></label></div>)}</section>}
    {view === 'Settings' && <section className="rail-section"><div className="section-heading"><h2>Arena settings</h2><small>Depth renderer</small></div>
      <div className="setting-block"><label>Price grouping</label><div className="segmented compact">{[1,2,5].map(value=><button key={value} aria-pressed={participant.priceBand===value} onClick={()=>setParticipant(current=>({...current,priceBand:value}))}>{value}c</button>)}</div><small>Group nearby price levels around fair value.</small></div>
      <div className="section-heading troop-heading"><h2>Troop denominations</h2><small>Automatic mix</small></div>
      {TROOP_KINDS.map(troop => <div className="card-setting" key={troop.kind}><Portrait kind={troop.kind}/><div><strong>{troop.name}</strong><small>Market depth</small></div><label><span>Notional $</span><input type="number" min="1" max="100000" aria-label={`${troop.name} market unit value`} value={participant.values[troop.kind]} onChange={e => setParticipant(current => ({...current,values:{...current.values,[troop.kind]:Math.max(1,Math.min(100000,Number(e.target.value)||1))}}))}/></label></div>)}
      <div className="scale-example"><b>$850 depth becomes</b><span>{exampleSummary.map(item=>`${item.count} ${item.name}`).join(' · ')}</span></div></section>}
    <footer className="rail-footer"><span className="gold-dot"/>Your orders <span className="muted">Gold outline</span></footer>
  </aside>
}

export default function App({ user, wallet, onLogout }) {
  const tutorialKey = `battlecoin-market-arena-tutorial-v3:account:${encodeURIComponent(user)}`
  const [sidebar, setSidebar] = useState(false)
  const host = useRef(null), battle = useRef(null), drag = useRef(null)
  const [cards,setCards] = useState(DEFAULT_CARD_VALUES)
  const [participant,setParticipant] = useState({priceBand:1,values:{scout:25,guard:100,anchor:250}})
  const [orderSide,setOrderSide] = useState('UP')
  const [tutorial,setTutorial] = useState(() => localStorage.getItem(tutorialKey) !== '1')
  const {market:liveMarket,retry} = usePolymarket(!tutorial)
  const market = useMemo(() => ({...(tutorial ? TUTORIAL_MARKET : liveMarket),participantNotional:tutorial ? {priceBand:1,values:{scout:5,guard:25,anchor:50}} : participant}),[tutorial,liveMarket,participant])
  const config = useMemo(() => ({market,cards,orderSide,takers:DEFAULT_TAKER_VALUES}),[market,cards,orderSide])
  const latestConfig = useRef(config); latestConfig.current = config
  const [state,setState] = useState({capital:100,fundedCapital:100,time:0,selected:-1,openOrders:[],completedOrders:[],positions:[]})
  const lesson = useTutorial(tutorial && state.positions.some(position=>position.marketId==='tutorial'),()=>battle.current?.buyTutorialShares())
  const tutorialUI = tutorialVisibility(tutorial,lesson.scene)
  function finishTutorial(){localStorage.setItem(tutorialKey,'1');setTutorial(false)}
  function startTutorial(){if(tutorial)return;lesson.reset();setTutorial(true)}
  const [error,setError] = useState('')
  const [solBalance,setSolBalance] = useState(null)
  const [convertAmount,setConvertAmount] = useState('0.1')
  const [converting,setConverting] = useState(false)
  const [convertError,setConvertError] = useState('')
  useEffect(() => {
    if (!wallet) return
    let cancelled = false
    getBalance(wallet).then(b => { if (!cancelled) setSolBalance(b) }).catch(() => {})
    return () => { cancelled = true }
  }, [wallet])
  async function convert() {
    setConverting(true); setConvertError('')
    try {
      const { balance, usd: gained } = await convertSolToCapital(wallet, Number(convertAmount))
      setSolBalance(balance)
      battle.current?.depositCapital(gained)
    } catch (err) { setConvertError(err.message || 'Conversion failed.') }
    finally { setConverting(false) }
  }
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
  const capitalPercent = Math.max(0, Math.min(100, state.capital / Math.max(1, state.fundedCapital || 100) * 100))
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
    <main className={`exchange ${tutorial ? 'in-tutorial' : ''}`}>
    <header className="exchange-header"><CoinLogo/><div className="header-market"><b>BTC arena</b><span>Polymarket simulation</span></div><div className={`feed-status ${market.feedStatus}`} title={market.feedMessage}><i/>{live ? 'Live market' : market.feedStatus}</div><span className="sim-badge">Simulated funds</span><button className="icon-button" title="Tutorial" aria-label="Tutorial" onClick={startTutorial}><CircleHelp size={18}/></button></header>
    <div className="workspace">
      <div className="main-column">
        <header className="market-strip"><div className="outcome positive">{tutorial ? <TutorialQuotes side="UP" market={market} lesson={lesson}/> : <><small>YES / UP</small><strong>{coverage.available ? cents(coverage.upCents) : '--'}</strong><span>Bid {cents(market.bidUp)} · Ask {cents(market.askUp)}</span></>}</div><div className="market-center">{tutorial ? <b>{market.title}</b> : <a href={market.slug ? `https://polymarket.com/event/${market.slug}` : 'https://polymarket.com'} target="_blank" rel="noreferrer">{market.title || 'BTC Up or Down'}<ExternalLink size={12}/></a>}<div className="market-metrics">{tutorial ? <><div><small>Market value</small><b>$100</b></div><div><small>Prices</small><b>Fixed practice data</b></div><div><small>Time remaining</small><b>5:00 · paused</b></div></> : <><div title={market.referenceApproximate?'Captured from live Polymarket RTDS after this round opened':'Opening Polymarket RTDS reference'}><small>Price to beat</small><b>{btc(market.priceToBeat)}</b></div><div><small>Distance</small><b className={(market.currentBtc||0)>=(market.priceToBeat||Infinity)?'positive':'negative'}>{market.currentBtc!=null&&market.priceToBeat!=null?(market.currentBtc-market.priceToBeat>=0?'+':'')+btc(market.currentBtc-market.priceToBeat):'--'}</b></div><div><small>Time remaining</small><b>{Math.floor((state.time||0)/60)}:{String((state.time||0)%60).padStart(2,'0')}</b></div></>}</div></div><div className="outcome negative">{tutorial ? <TutorialQuotes side="DOWN" market={market} lesson={lesson}/> : <><small>NO / DOWN</small><strong>{coverage.available ? cents(coverage.downCents) : '--'}</strong><span>Bid {cents(market.bidDown)} · Ask {cents(market.askDown)}</span></>}</div></header>
        <section className="arena" aria-label="Live market arena"><div className="canvas-host" ref={host}/>{tutorial && <TutorialLanes lesson={lesson} ui={tutorialUI}/>}{market.feedStatus==='unavailable' && <div className="feed-notice" role="status"><span>{market.feedMessage}</span><button className="icon-button" title="Reconnect" aria-label="Reconnect" onClick={retry}><RefreshCw size={16}/></button></div>}{state.message && <div className="arena-toast" role="status">{state.message}</div>}{error && <div className="feed-notice" role="alert">{error}</div>}</section>
        <footer className="deck-bar">{tutorialUI.guidedDeck ? <TutorialDeck lesson={lesson} ui={tutorialUI} Portrait={Portrait} capital={state.capital}/> : <><div className="capital"><div className="capital-title"><small>Elixir capital</small><b>{usd(state.capital)}</b></div><div className="elixir-bar" role="meter" aria-label="Available trading capital" aria-valuemin="0" aria-valuemax={state.fundedCapital||100} aria-valuenow={state.capital}><i style={{width:`${capitalPercent}%`}}/></div><div className="capital-actions"><span>{usd(state.fundedCapital||100)} funded</span></div>
          <div className="sol-convert">
            <small>{solBalance == null ? 'Wallet: —' : `Wallet: ${solBalance} SOL`}</small>
            <div className="sol-convert-row">
              <input aria-label="SOL amount to convert" type="number" min="0" step="0.01" value={convertAmount} onChange={e=>setConvertAmount(e.target.value)} />
              <button onClick={convert} disabled={converting || !wallet}><Plus size={14}/>{converting ? 'Converting…' : `Convert (${SOL_USD_RATE}/SOL)`}</button>
            </div>
            {convertError && <small className="convert-error">{convertError}</small>}
          </div>
        </div>
          <div className="deck-center"><div className={`order-banner team-${orderSide.toLowerCase()}`} aria-label="Order outcome"><button className="up" aria-pressed={orderSide==='UP'} onClick={()=>setOrderSide('UP')}><Flag size={14}/><span>Long UP</span></button><button className="down" aria-pressed={orderSide==='DOWN'} onClick={()=>setOrderSide('DOWN')}><span>Long DOWN</span><Flag size={14}/></button></div>
            <div className="deck">{cards.map((card,index)=><button key={card.id} className={`deck-card ${state.selected===index?'selected':''} team-${orderSide.toLowerCase()}`} disabled={!live || state.capital < card.notional} aria-pressed={state.selected===index} aria-label={`${card.name} ${usd(card.notional)}`} onPointerDown={e=>down(e,index)} onPointerMove={move} onPointerUp={up} onPointerCancel={()=>{drag.current=null;battle.current?.dragCancel()}} onClick={e=>{if(e.detail===0)battle.current?.select(index)}}><Portrait kind={card.kind} side={orderSide}/><span>{card.name}</span><b>{usd(card.notional)}</b></button>)}</div>
          </div><div className="deck-legend"><span className="gold-dot"/>My orders</div></>}</footer>
        <>{tutorialUI.guidedHistory ? <TutorialHistory lesson={lesson}/> : <Blotter state={state} onCancel={id=>battle.current?.cancelOrder(id)} onClose={id=>battle.current?.closePosition(id)}/>}</>
      </div>
      {tutorialUI.dialogue ? <TutorialDialogue lesson={lesson} onFinish={finishTutorial}/> : <Controls market={market} cards={cards} setCards={setCards} participant={participant} setParticipant={setParticipant}/>}
    </div>
  </main>

  </>
}

