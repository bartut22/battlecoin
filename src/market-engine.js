export const DEFAULT_CARD_VALUES = [
  { id: 'limit-scout', name: 'Ranger', kind: 'scout', notional: 5, hp: 280, damage: 58, speed: 54, count: 1 },
  { id: 'wall-guard', name: 'Guardian', kind: 'guard', notional: 10, hp: 360, damage: 68, speed: 38, count: 1 },
  { id: 'taker-balloon', name: 'Balloon', kind: 'balloon', notional: 20, hp: 720, damage: 230, speed: 24, count: 1 },
  { id: 'anchor-maker', name: 'Crystal Golem', kind: 'anchor', notional: 25, hp: 940, damage: 132, speed: 27, count: 1 },
]
export const DEFAULT_TAKER_VALUES = { up: [25, 10, 5], down: [25, 10, 5] }
export const DEFAULT_MARKET = {
  symbol: 'BTC', venue: 'Polymarket', bidUp: null, askUp: null, bidDown: null, askDown: null,
  lastTradeUp: null, feedStatus: 'connecting', participantNotional: { UP: 25, DOWN: 25 },
  book: { UP: { bids: [], asks: [] }, DOWN: { bids: [], asks: [] } },
}
export function clamp(value, min, max) { return Math.min(max, Math.max(min, value)) }
export function numberValue(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}
export function marketCoverage(market) {
  const bid = numberValue(market.bidUp, null), ask = numberValue(market.askUp, null)
  const last = numberValue(market.lastTradeUp, null)
  const spread = bid !== null && ask !== null ? ask - bid : null
  const fair = spread !== null && spread >= 0 && spread <= 10 ? (bid + ask) / 2 : last
  const up = fair === null ? null : clamp(fair, 0, 100)
  return {
    upCents: up, downCents: up === null ? null : 100 - up,
    upCoverage: up === null ? .5 : up / 100, downCoverage: up === null ? .5 : 1 - up / 100,
    available: up !== null, source: spread !== null && spread >= 0 && spread <= 10 ? 'Midpoint' : 'Last trade',
    ambiguityTiles: clamp(Math.round((spread || 0) * 2), 0, 14),
  }
}
export function orderbookRows(market) {
  const fair = marketCoverage(market).upCents
  return ['UP', 'DOWN'].flatMap(side => ['bid', 'ask'].flatMap(type =>
    [...(market.book?.[side]?.[type + 's'] || [])]
      .filter(level => Number(level.price) > 0 && Number(level.price) <= 1 && Number(level.size) > 0)
      .sort((a, b) => type === 'bid' ? b.price - a.price : a.price - b.price)
      .map((level, index) => {
        const price = Number(level.price) * 100, quantity = Number(level.size)
        return {
          id: `${side}-${type}-${price.toFixed(4)}`, side, type, price, quantity,
          notional: Number(level.price) * quantity, best: index === 0,
          distanceCents: fair === null ? null : Math.abs((side === 'DOWN' ? 100 - price : price) - fair),
        }
      })
  ))
}
export function editableCard(cards, index, value) {
  return cards.map((card, i) => i === index ? { ...card, notional: clamp(numberValue(value, card.notional), 1, 100000) } : card)
}
export function editableTaker(takers, side, index, value) {
  const next = { up: [...takers.up], down: [...takers.down] }
  next[side][index] = clamp(numberValue(value, next[side][index]), 1, 1000000)
  return next
}
