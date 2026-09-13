export const DEFAULT_CARD_VALUES = [
  { id: 'limit-scout', name: 'Dune Ranger', kind: 'scout', notional: 5, hp: 280, damage: 58, speed: 54, count: 1 },
  { id: 'wall-guard', name: 'Sand Guard', kind: 'guard', notional: 10, hp: 360, damage: 68, speed: 38, count: 1 },
  { id: 'taker-balloon', name: 'Sand Bomber', kind: 'balloon', notional: 20, hp: 720, damage: 230, speed: 24, count: 1 },
  { id: 'anchor-maker', name: 'Rune Golem', kind: 'anchor', notional: 25, hp: 940, damage: 132, speed: 27, count: 1 },
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
export function groupedOrderbookRows(market, side, type = 'bid', bandCents = 1) {
  const rows = orderbookRows(market).filter(row => row.side === side && row.type === type)
  const band = clamp(Math.round(numberValue(bandCents, 1)), 1, 10)
  if (band === 1) return rows
  const groups = []
  for (let index = 0; index < rows.length; index += band) {
    const members = rows.slice(index, index + band)
    const first = members[0], last = members.at(-1)
    groups.push({
      ...first,
      id: `${first.side}-${first.type}-band-${band}-${index / band}`,
      quantity: members.reduce((sum, row) => sum + row.quantity, 0),
      notional: members.reduce((sum, row) => sum + row.notional, 0),
      rangeLow: Math.min(first.price, last.price),
      rangeHigh: Math.max(first.price, last.price),
      bandCents: band,
      members,
    })
  }
  return groups
}
export function notionalCharacters(notional, values = { scout: 25, guard: 100, anchor: 250 }, cap = 24) {
  let remaining = Math.max(0, numberValue(notional))
  const denominations = Object.entries(values)
    .map(([kind, value]) => ({ kind, value: Math.max(1, numberValue(value, 1)) }))
    .sort((a, b) => b.value - a.value)
  const smallest = denominations.at(-1) || { kind: 'scout', value: 1 }
  const chunks = []
  while (remaining > 1e-8 && chunks.length < cap) {
    if (chunks.length === cap - 1) {
      const finalKind = denominations.find(item => item.value <= remaining)?.kind || smallest.kind
      chunks.push({ kind: finalKind, notional: remaining })
      break
    }
    const denomination = denominations.find(item => item.value <= remaining) || smallest
    const amount = Math.min(remaining, denomination.value)
    chunks.push({ kind: denomination.kind, notional: amount })
    remaining -= amount
  }
  return chunks
}
export function editableCard(cards, index, value) {
  return cards.map((card, i) => i === index ? { ...card, notional: clamp(numberValue(value, card.notional), 1, 100000) } : card)
}
export function editableTaker(takers, side, index, value) {
  const next = { up: [...takers.up], down: [...takers.down] }
  next[side][index] = clamp(numberValue(value, next[side][index]), 1, 1000000)
  return next
}
