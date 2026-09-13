import './market-hud.css'
import { delegateBattleTasks } from './hermes-delegation.js'
import { marketCoverage, orderbookRows } from './market-engine.js'

export default function MarketHud({ market, cards, takers, onMarketChange, onCardValueChange, onTakerValueChange }) {
  const coverage = marketCoverage(market)
  const routes = delegateBattleTasks(cards, takers, market).slice(0, 3)
  const bookRows = orderbookRows(market)
  const dollars = (value, digits = 0) => Number(value).toLocaleString('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: digits, maximumFractionDigits: digits,
  })
  const setMarket = (key, value) => onMarketChange({ ...market, [key]: value })

  return <aside className="market-overlay" aria-label="Market overview, tutorial values">
    <time className="market-clock">Hermes routed · simulated funds</time>
    <div className="market-heading">
      <div className="market-quote">
        <div className="market-caption">{market.symbol} · {market.venue}</div>
        <strong className="market-price">{dollars(market.price, 2)}</strong>
        <span className="market-change">UP {coverage.upCents}% left · DOWN {coverage.downCents}% right</span>
      </div>
      <div className="market-pressure">
        <div className="market-caption">Pressure split</div>
        <strong>{Math.round(coverage.upCoverage * 100)}% / {Math.round(coverage.downCoverage * 100)}%</strong>
        <p>{coverage.ambiguityTiles} tiles from {market.spreadCents}c spread</p>
      </div>
    </div>

    <div className="market-wall sell-wall"><span className="market-caption">BID DOWN</span><strong>{market.bidDown}c</strong></div>
    <div className="market-wall buy-wall"><span className="market-caption">BID UP</span><strong>{market.bidUp}c</strong></div>

    <section className="market-editor" aria-label="Editable tutorial controls">
      <div className="editor-row two">
        <label>Bid Up<input type="number" min="1" max="99" value={market.bidUp} onChange={e => setMarket('bidUp', e.target.value)} /></label>
        <label>Bid Down<input type="number" min="1" max="99" value={market.bidDown} onChange={e => setMarket('bidDown', e.target.value)} /></label>
      </div>
      <div className="editor-row two">
        <label>Ask Up<input type="number" min="1" max="99" value={market.askUp} onChange={e => setMarket('askUp', e.target.value)} /></label>
        <label>Ask Down<input type="number" min="1" max="99" value={market.askDown} onChange={e => setMarket('askDown', e.target.value)} /></label>
      </div>
      <div className="editor-row four compact-book">
        <label>UP bid $<input type="number" min="1" step="100" value={market.bidUpNotional} onChange={e => setMarket('bidUpNotional', e.target.value)} /></label>
        <label>UP ask $<input type="number" min="1" step="100" value={market.askUpNotional} onChange={e => setMarket('askUpNotional', e.target.value)} /></label>
        <label>DOWN bid $<input type="number" min="1" step="100" value={market.bidDownNotional} onChange={e => setMarket('bidDownNotional', e.target.value)} /></label>
        <label>DOWN ask $<input type="number" min="1" step="100" value={market.askDownNotional} onChange={e => setMarket('askDownNotional', e.target.value)} /></label>
      </div>
      <div className="editor-row spread-row">
        <button type="button" aria-label="Reduce ambiguity spread" onClick={() => setMarket('spreadCents', Math.max(1, Number(market.spreadCents) - 1))}>‹</button>
        <label>Spread / ambiguity<input type="range" min="1" max="14" value={market.spreadCents} onChange={e => setMarket('spreadCents', e.target.value)} /></label>
        <button type="button" aria-label="Increase ambiguity spread" onClick={() => setMarket('spreadCents', Math.min(14, Number(market.spreadCents) + 1))}>›</button>
      </div>
      <div className="editor-row deck-values">
        {cards.map((card, index) => <label key={card.id}>{card.name}<input type="number" min="1" step="50" value={card.notional} onChange={e => onCardValueChange(index, e.target.value)} /></label>)}
      </div>
      <div className="editor-row takers">
        <div><b>UP takers</b>{takers.up.map((value, index) => <input key={index} type="number" min="1" step="50" value={value} onChange={e => onTakerValueChange('up', index, e.target.value)} />)}</div>
        <div><b>DOWN takers</b>{takers.down.map((value, index) => <input key={index} type="number" min="1" step="50" value={value} onChange={e => onTakerValueChange('down', index, e.target.value)} />)}</div>
      </div>
    </section>

    <section className="hermes-routes" aria-label="Hermes delegation routes">
      {routes.map((route) => <div key={`${route.kind}-${route.label}`}>
        <span>{route.agent.name}</span>
        <strong>{route.label}</strong>
        <small>{route.agent.model} · {route.agent.reasoning} · {dollars(route.notional)}</small>
      </div>)}
    </section>

    <section className="book-tape" aria-label="Order book depth">
      {bookRows.map((row) => <div key={`${row.side}-${row.type}`} className={row.side === 'UP' ? 'up-row' : 'down-row'}>
        <span>{row.side} {row.type}</span>
        <strong>{row.price}c</strong>
        <small>{dollars(row.notional)} · {row.distanceCents.toFixed(1)}c from line</small>
      </div>)}
    </section>
  </aside>
}
