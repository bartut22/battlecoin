import { useEffect, useRef, useState } from 'react'
import './market-hud.css'

const ROUND_SECONDS = 60
const POLL_MS = 2000
const VOLATILITY = '0.6'

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

export default function MarketHud() {
  const [utc, setUtc] = useState(() => new Date().toISOString().slice(11, 19))
  const [live, setLive] = useState({ status: 'loading', spot: null, priceCents: null, change: null })
  const round = useRef({ target: null, expiry: 0 })

  useEffect(() => {
    const tick = setInterval(() => setUtc(new Date().toISOString().slice(11, 19)), 1000)
    return () => clearInterval(tick)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function poll() {
      try {
        const now = Date.now()
        if (!round.current.target || now > round.current.expiry) {
          const spotRes = await fetch('/api/spot')
          const spotData = await spotRes.json()
          if (spotData.error) throw new Error(spotData.error)
          round.current = { target: spotData.last, expiry: now + ROUND_SECONDS * 1000 }
        }

        const params = new URLSearchParams({
          target: round.current.target,
          expiry: new Date(round.current.expiry).toISOString(),
          vol: VOLATILITY,
        })
        const res = await fetch(`/api/price?${params}`)
        const data = await res.json()
        if (data.error) throw new Error(data.error)
        if (cancelled) return
        setLive(prev => ({
          status: 'live',
          spot: Number(data.spot),
          priceCents: data.price_cents,
          change: prev.spot ? Number(data.spot) - prev.spot : 0,
        }))
      } catch {
        if (!cancelled) setLive(prev => ({ ...prev, status: 'offline' }))
      }
    }

    poll()
    const id = setInterval(poll, POLL_MS)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  const dollars = (value, digits = 0) => value.toLocaleString('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: digits, maximumFractionDigits: digits,
  })

  const offline = live.status === 'offline'
  const priceText = live.spot != null ? dollars(live.spot, 2) : '—'
  const changeText = live.change != null ? dollars(Math.abs(live.change), 2) : '—'
  const pressure = offline ? 'Offline' : pressureLabel(live.priceCents)

  return <aside className="market-overlay" aria-label="Market overview: live BTC/USD spot and round probability from the pricing engine; liquidation and wall figures are demo placeholders">
    <time className="market-clock">UTC {utc}</time>
    <div className="market-heading">
      <div className="market-quote">
        <div className="market-caption">BTC/USD · KRAKEN {offline ? '(offline)' : ''}</div>
        <strong className="market-price">{priceText}</strong>
        <span className={`market-change ${live.change < 0 ? 'negative' : ''}`}>
          {live.change != null ? (live.change >= 0 ? '+' : '−') : ''}{changeText} <span>since last tick</span>
        </span>
      </div>
      <div className="market-pressure">
        <div className="market-caption">MARKET PRESSURE</div>
        <strong>{pressure}</strong>
        <p>{live.priceCents != null ? `Round probability ${live.priceCents}c` : 'Waiting on pricing engine…'} · {MOCK.liquidationVenue} · Liquidated {MOCK.liquidationSide} · {dollars(MOCK.liquidationAmount / 1000)}K @ {dollars(MOCK.liquidationPrice)}</p>
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
