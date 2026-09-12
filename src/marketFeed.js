import { useEffect, useRef, useState } from 'react'

const ROUND_SECONDS = 60
const POLL_MS = 2000
const VOLATILITY = '0.6'

export function useMarketFeed() {
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

  return { utc, ...live }
}
