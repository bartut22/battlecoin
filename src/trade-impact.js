// Divide a grouped row into the exact price levels represented by each character.
export function troopLiquidity(row, chunks) {
  const levels = (row.members || [row]).map(level => ({ price: level.price, notional: level.notional }))
  let index = 0
  return chunks.map(chunk => {
    let remaining = chunk.notional
    const portions = []
    while (remaining > 1e-8 && index < levels.length) {
      const level = levels[index], notional = Math.min(remaining, level.notional)
      if (notional > 0) portions.push({ price: level.price, notional })
      remaining -= notional; level.notional -= notional
      if (level.notional < 1e-8) index++
    }
    return portions
  })
}

// Match traded contracts to rendered bid depth; BUY uses the complementary outcome.
export function tradeImpacts(trade, units) {
  const side = trade.direction === 'BUY' ? (trade.side === 'UP' ? 'DOWN' : 'UP') : trade.side
  const price = (side === trade.side ? trade.price : 1 - trade.price) * 100
  let remaining = Number(trade.size)
  if (!(remaining > 0) || !(price > 0 && price <= 100)) return []
  const hits = []
  for (const unit of units) {
    if (unit.side !== side || !unit.key.startsWith('book:')) continue
    const levels = unit.liquidity || [{ price: unit.bookPrice, notional: unit.notional }]
    const atPrice = levels.filter(level => Math.abs(level.price - price) < .0001).reduce((sum, level) => sum + level.notional, 0)
    const available = Math.max(0, unit.notional - (unit.pendingNotional || 0))
    const pendingAtPrice = unit.pendingByPrice?.[price.toFixed(4)] || 0
    const notional = Math.min(remaining * price / 100, available, Math.max(0, atPrice - pendingAtPrice))
    if (notional <= 1e-8) continue
    hits.push({ unit, price, notional, consumed: notional >= available - 1e-8 })
    remaining -= notional / (price / 100)
    if (remaining < 1e-8) break
  }
  return hits
}
