// Both deployment shading and team assignment use this single territory model.
// Map y runs right-to-left on screen: red owns lower y, green owns higher y.
import { GRID_BOUNDS } from './placement-grid.js'
export const DEPLOY_BOUNDS = Object.freeze({ ...GRID_BOUNDS })
export const INITIAL_BOUNDARY = (DEPLOY_BOUNDS.top + DEPLOY_BOUNDS.bottom) / 2

export function createTerritory(initialBoundary = INITIAL_BOUNDARY) {
  let boundary = INITIAL_BOUNDARY
  const territory = {
    setBoundary(value) {
      if (!Number.isFinite(value)) throw new TypeError('Territory boundary must be finite')
      boundary = Math.max(DEPLOY_BOUNDS.top, Math.min(DEPLOY_BOUNDS.bottom, value))
    },
    get regions() {
      return [
        { ...DEPLOY_BOUNDS, top: boundary, team: 0, fill: '#39dc65', outline: '#78ff98' },
        { ...DEPLOY_BOUNDS, bottom: boundary, team: 1, fill: '#ec4657', outline: '#ff8b96' },
      ]
    },
    teamAt(x, y) {
      const b = DEPLOY_BOUNDS
      if (!Number.isFinite(x) || !Number.isFinite(y) || x < b.left || x > b.right || y < b.top || y > b.bottom) return null
      // The shared edge belongs to green, so every valid point has one owner.
      return y >= boundary ? 0 : 1
    },
  }
  territory.setBoundary(initialBoundary)
  return territory
}

export function spawnPositions(card, x, y) {
  const count = card.count || 1
  return Array.from({ length: count }, (_, i) => ({ x: x + (i - (count - 1) / 2) * 17, y }))
}
