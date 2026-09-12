import { useState } from 'react'
import './market-hud.css'

export default function MarketHud() {
  const [market] = useState({
    utc: '05:16:23',
    symbol: 'BTC/USD',
    venue: 'AGGREGATED SPOT',
    price: 77184.16,
    change24h: 0.03,
    pressure: 'Contested',
    liquidationVenue: 'Hyperliquid',
    liquidationSide: 'long',
    liquidationAmount: 183000,
    liquidationPrice: 77044,
    sellWall: 43400000,
    buyWall: 41900000,
  })
  const dollars = (value, digits = 0) => value.toLocaleString('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: digits, maximumFractionDigits: digits,
  })

  return <aside className="market-overlay" aria-label="Market overview, demo values">
    <time className="market-clock">UTC {market.utc}</time>
    <div className="market-heading">
      <div className="market-quote">
        <div className="market-caption">{market.symbol} · {market.venue}</div>
        <strong className="market-price">{dollars(market.price, 2)}</strong>
        <span className={`market-change ${market.change24h < 0 ? 'negative' : ''}`}>
          {market.change24h >= 0 ? '+' : ''}{market.change24h.toFixed(2)}% <span>24h</span>
        </span>
      </div>
      <div className="market-pressure">
        <div className="market-caption">MARKET PRESSURE</div>
        <strong>{market.pressure}</strong>
        <p>{market.liquidationVenue} · Liquidated {market.liquidationSide} · {dollars(market.liquidationAmount / 1000)}K @ {dollars(market.liquidationPrice)}</p>
      </div>
    </div>
    <div className="market-wall sell-wall"><span className="market-caption">SELL WALL</span><strong>{dollars(market.sellWall / 1000000, 1)}M</strong></div>
    <div className="market-wall buy-wall"><span className="market-caption">BUY WALL</span><strong>{dollars(market.buyWall / 1000000, 1)}M</strong></div>
    <div className="market-icons" aria-hidden="true">
      <span><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" /><path d="M12 2v4m0 12v4M2 12h4m12 0h4" /></svg></span>
      <span><svg viewBox="0 0 24 24"><path d="M11 5 6 9H3v6h3l5 4V5ZM16 9l5 6m0-6-5 6M3 21 21 3" /></svg></span>
    </div>
  </aside>
}
