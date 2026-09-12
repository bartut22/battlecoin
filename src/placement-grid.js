// Tile seams measured on arena.jpg (720 x 1440), before its screen rotation.
// The short shoreline rows and river rows are intentionally not a uniform grid.
export const GRID_X = [62, 122, 182, 242, 302, 360, 419, 478, 537, 596, 656].map(x => x * 450 / 720)
export const GRID_Y = [232, 292, 351, 411, 471, 531, 591, 631, 686, 740, 800, 860, 920, 980, 1040, 1100, 1160].map(y => y * 910 / 1440)
export const GRID_BOUNDS = { left: GRID_X[0], right: GRID_X.at(-1), top: GRID_Y[0], bottom: GRID_Y.at(-1) }
// Exclude every tile touched by either brown lane, plus both river columns.
// In the rotated arena these source-image columns appear as horizontal rows.
export function selectableCell(cell) {
  if (!cell) return false
  const lanes = [[154, 207], [522, 565]]
  const onLane = lanes.some(([left, right]) => cell.left < right * 450 / 720 && cell.right > left * 450 / 720)
  const onRiver = cell.top < 740 * 910 / 1440 && cell.bottom > 631 * 910 / 1440
  return !onLane && !onRiver
}
export function gridCell(x, y) {
  const index = (edges, v) => {
    if (!Number.isFinite(v) || v < edges[0] || v > edges.at(-1)) return -1
    const upper = edges.findIndex(edge => edge > v)
    return upper < 0 ? edges.length - 2 : upper - 1
  }
  const col = index(GRID_X, x), row = index(GRID_Y, y)
  if (col < 0 || row < 0) return null
  const left = GRID_X[col], right = GRID_X[col + 1], top = GRID_Y[row], bottom = GRID_Y[row + 1]
  return { col, row, left, right, top, bottom, x: (left + right) / 2, y: (top + bottom) / 2 }
}
export const smoothSnap = (current, target, dt) => current + (target - current) * (1 - Math.exp(-22 * dt))
