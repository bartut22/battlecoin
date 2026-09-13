import { groupedOrderbookRows, marketCoverage } from './market-engine.js'
export const ARENA = { width: 1600, height: 900, left: 280, right: 1355, top: 110, bottom: 790 }
export function frontX(market) {
  return ARENA.left + (ARENA.right - ARENA.left) * marketCoverage(market).upCoverage
}
export function bidRanks(market, side) {
  const front = frontX(market), direction = side === 'UP' ? -1 : 1
  const width = side === 'UP' ? front - ARENA.left : ARENA.right - front
  const band = market.participantNotional?.priceBand || 1
  const rows = groupedOrderbookRows(market, side, 'bid', band).slice(0, 4)
  const gap = Math.min(76, width / (rows.length + 1))
  return rows.map((row, depth) => ({ ...row, x: front + direction * gap * (depth + .65), depth, gap }))
}
export function bidAtPoint(market, point, selectedSide = null) {
  const b = ARENA
  if (point.x < b.left || point.x > b.right || point.y < b.top || point.y > b.bottom) return null
  const pointSide = point.x <= frontX(market) ? 'UP' : 'DOWN'
  if (selectedSide && selectedSide !== pointSide) return null
  const side = selectedSide || pointSide
  const ranks = bidRanks(market, side)
  return ranks.sort((a, b) => Math.abs(a.x - point.x) - Math.abs(b.x - point.x))[0] || null
}
