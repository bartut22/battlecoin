export const DEFAULT_CARD_VALUES = [
  { id: 'limit-scout', name: 'Dune Ranger', kind: 'scout', notional: 5, hp: 280, damage: 58, speed: 54, count: 1 },
  { id: 'wall-guard', name: 'Sand Guard', kind: 'guard', notional: 10, hp: 360, damage: 68, speed: 38, count: 1 },
  { id: 'anchor-maker', name: 'Rune Golem', kind: 'anchor', notional: 25, hp: 940, damage: 132, speed: 27, count: 1 },
  ...[['small', 'Sand Bomber', 5], ['medium', 'Caravan Bomber', 20], ['large', 'Siege Bomber', 50]].map(([balloonSize, name, notional]) => ({ id: `taker-balloon-${balloonSize}`, name, kind: 'balloon', artKind: `balloon-${balloonSize}`, balloonSize, notional, count: 1 })),
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
function quoteEstimate(market, side) {
  const suffix = side === 'UP' ? 'Up' : 'Down'
  const bid = numberValue(market['bid' + suffix], null), ask = numberValue(market['ask' + suffix], null)
  if (bid === null || ask === null || bid < 0 || ask > 100 || bid > ask) return null
  const sizeAt = (type, price) => (market.book?.[side]?.[type] || []).reduce((sum, level) => {
    const size = numberValue(level.size), levelPrice = numberValue(level.price, null)
    return levelPrice !== null && Math.abs(levelPrice * 100 - price) < .00001 && size > 0 ? sum + size : sum
  }, 0)
  const bidSize = sizeAt('bids', bid), askSize = sizeAt('asks', ask)
  if (!(bidSize > 0 && askSize > 0)) return null
  // Opposite-side weighting: bid pressure pulls the estimate toward the ask.
  return { price: (ask * bidSize + bid * askSize) / (bidSize + askSize), depth: bidSize + askSize, bid, ask }
}
export function marketCoverage(market) {
  const bid = numberValue(market.bidUp, null), ask = numberValue(market.askUp, null)
  const last = numberValue(market.lastTradeUp, null)
  const spread = bid !== null && ask !== null ? ask - bid : null
  const upBook = quoteEstimate(market, 'UP'), downBook = quoteEstimate(market, 'DOWN')
  let fair, source
  if (upBook || downBook) {
    // Complementary outcomes express the same probability. Pool compatible BBO
    // estimates by displayed contract depth; do not pool a crossed/stale pair.
    const compatible = upBook && downBook && Math.max(upBook.bid, 100 - downBook.ask) <= Math.min(upBook.ask, 100 - downBook.bid) + 1e-8
    fair = compatible ? (upBook.price * upBook.depth + (100 - downBook.price) * downBook.depth) / (upBook.depth + downBook.depth)
      : upBook ? upBook.price : 100 - downBook.price
    source = 'Microprice'
  } else {
    const midpointAvailable = spread !== null && spread >= 0 && spread <= 10 && bid >= 0 && ask <= 100
    fair = midpointAvailable ? (bid + ask) / 2 : last
    source = midpointAvailable ? 'Midpoint fallback' : last !== null ? 'Last trade' : 'Unavailable'
  }
  const up = fair === null ? null : clamp(fair, 0, 100)
  return {
    upCents: up, downCents: up === null ? null : 100 - up,
    upCoverage: up === null ? .5 : up / 100, downCoverage: up === null ? .5 : 1 - up / 100,
    available: up !== null, source,
    ambiguityTiles: clamp(Math.round((spread || 0) * 2), 0, 14),
  }
}
export function orderbookRows(market) {
  const fair = marketCoverage(market).upCents
  return ['UP', 'DOWN'].flatMap(side => ['bid', 'ask'].flatMap(type =>
    [...(market.book?.[side]?.[type + 's'] || [])]
      .filter(level => level.price !== null && level.price !== '' && Number(level.price) >= 0 && Number(level.price) <= 1 && Number(level.size) > 0)
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
