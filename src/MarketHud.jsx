import './market-hud.css'

const MOCK = {
  liquidationVenue: 'Hyperliquid',
  liquidationSide: 'long',
  liquidationAmount: 183000,
  liquidationPrice: 77044,
  sellWall: 43400000,
  buyWall: 41900000,
}

function pressureLabel(priceCents) {
  if (priceCents == null) return 'Unknown'
  if (priceCents >= 55) return 'Bullish'
  if (priceCents <= 45) return 'Bearish'
  return 'Contested'
}

export default function MarketHud({ utc, status, spot, priceCents, change }) {
  const dollars = (value, digits = 0) => value.toLocaleString('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: digits, maximumFractionDigits: digits,
  })

  const offline = status === 'offline'
  const priceText = spot != null ? dollars(spot, 2) : '—'
  const changeText = change != null ? dollars(Math.abs(change), 2) : '—'
  const pressure = offline ? 'Offline' : pressureLabel(priceCents)

  return <aside className="market-overlay" aria-label="Market overview: live BTC/USD spot and round probability from the pricing engine; liquidation and wall figures are demo placeholders">
    <time className="market-clock">UTC {utc}</time>
    <div className="market-heading">
      <div className="market-quote">
        <div className="market-caption">BTC/USD · KRAKEN {offline ? '(offline)' : ''}</div>
        <strong className="market-price">{priceText}</strong>
        <span className={`market-change ${change < 0 ? 'negative' : ''}`}>
          {change != null ? (change >= 0 ? '+' : '−') : ''}{changeText} <span>since last tick</span>
        </span>
      </div>
      <div className="market-pressure">
        <div className="market-caption">MARKET PRESSURE</div>
        <strong>{pressure}</strong>
        <p>{priceCents != null ? `Round probability ${priceCents}c` : 'Waiting on pricing engine…'} · {MOCK.liquidationVenue} · Liquidated {MOCK.liquidationSide} · {dollars(MOCK.liquidationAmount / 1000)}K @ {dollars(MOCK.liquidationPrice)}</p>
      </div>
    </div>
    <div className="market-wall sell-wall"><span className="market-caption">SELL WALL</span><strong>{dollars(MOCK.sellWall / 1000000, 1)}M</strong></div>
    <div className="market-wall buy-wall"><span className="market-caption">BUY WALL</span><strong>{dollars(MOCK.buyWall / 1000000, 1)}M</strong></div>
    <div className="market-icons" aria-hidden="true">
      <span><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" /><path d="M12 2v4m0 12v4M2 12h4m12 0h4" /></svg></span>
      <span><svg viewBox="0 0 24 24"><path d="M11 5 6 9H3v6h3l5 4V5ZM16 9l5 6m0-6-5 6M3 21 21 3" /></svg></span>
    </div>
  </aside>
}
