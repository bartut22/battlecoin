// River banks include the shoreline walls. Ground units use the bridge decks.
export const BANK_TOP = 396, BANK_BOTTOM = 466
const BRIDGES = [111, 337], HALF_WIDTH = 18

export function groundSegmentClear(a, b) {
  if (Math.max(a.y, b.y) <= BANK_TOP || Math.min(a.y, b.y) >= BANK_BOTTOM) return true
  const dy = b.y - a.y
  const t0 = dy ? (BANK_TOP - a.y) / dy : 0
  const t1 = dy ? (BANK_BOTTOM - a.y) / dy : 1
  const start = Math.max(0, Math.min(t0, t1)), end = Math.min(1, Math.max(t0, t1))
  const x0 = a.x + (b.x - a.x) * start, x1 = a.x + (b.x - a.x) * end
  return BRIDGES.some(x => Math.abs(x0 - x) <= HALF_WIDTH && Math.abs(x1 - x) <= HALF_WIDTH)
}

export function groundWaypoint(unit, target) {
  let goal = { x: target.x, y: target.y }
  // A flying target over water can only be approached from shore.
  if (!groundSegmentClear(goal, goal)) {
    goal.y = Math.abs(unit.y - BANK_TOP) < Math.abs(unit.y - BANK_BOTTOM) ? BANK_TOP : BANK_BOTTOM
  }
  const nodes = [unit, goal, ...BRIDGES.flatMap(x => [{ x, y: BANK_TOP }, { x, y: BANK_BOTTOM }])]
  const distances = nodes.map(() => Infinity), previous = [], visited = new Set()
  distances[0] = 0
  for (let step = 0; step < nodes.length; step++) {
    let next = -1
    for (let i = 0; i < nodes.length; i++) if (!visited.has(i) && (next < 0 || distances[i] < distances[next])) next = i
    if (next < 0 || !Number.isFinite(distances[next])) break
    if (next === 1) {
      let hop = 1
      while (previous[hop] !== 0) hop = previous[hop]
      return nodes[hop]
    }
    visited.add(next)
    for (let i = 0; i < nodes.length; i++) {
      if (visited.has(i) || !groundSegmentClear(nodes[next], nodes[i])) continue
      const distance = distances[next] + Math.hypot(nodes[next].x - nodes[i].x, nodes[next].y - nodes[i].y)
      if (distance < distances[i]) { distances[i] = distance; previous[i] = next }
    }
  }
  return unit
}
