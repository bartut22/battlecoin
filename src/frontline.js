import { groupedOrderbookRows, marketCoverage } from './market-engine.js'
export const ARENA = { width: 1600, height: 900, left: 312, right: 1335, top: 78, bottom: 822 }
// Interior of the rotated map, including the bridge but excluding river and masonry.
export const FIELD_OUTLINE = [312,78,765,78,765,181,909,181,909,78,1335,78,1335,822,909,822,909,720,765,720,765,822,312,822]
export const TOWERS = [{ side: 'UP', x: 150, y: 430 }, { side: 'DOWN', x: ARENA.left + ARENA.right - 150, y: 430 }]
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
