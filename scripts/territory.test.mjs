import test from 'node:test'
import assert from 'node:assert/strict'
import { createTerritory, DEPLOY_BOUNDS as b, spawnPositions } from '../src/territory.js'
import { groundSegmentClear } from '../src/navigation.js'

test('regions cover the full arena without a gap or overlapping interiors', () => {
  const t = createTerritory()
  for (const boundary of [b.top, 350, 442, 520, b.bottom]) {
    t.setBoundary(boundary)
    const [green, red] = t.regions
    assert.equal(red.bottom, green.top)
    assert.equal(red.top, b.top)
    assert.equal(green.bottom, b.bottom)
    assert.equal((green.bottom - green.top + red.bottom - red.top) * (b.right - b.left), (b.bottom - b.top) * (b.right - b.left))
    for (let y = b.top; y <= b.bottom; y++) assert.equal(t.teamAt(225, y), y >= boundary ? 0 : 1)
    assert.equal(t.teamAt(225, boundary), 0)
  }
})

test('moving the boundary updates ownership; invalid points never acquire a team', () => {
  const t = createTerritory()
  assert.equal(t.teamAt(225, 500), 0)
  t.setBoundary(520)
  assert.equal(t.teamAt(225, 500), 1)
  for (const [x, y] of [[b.left - 1, 500], [b.right + 1, 500], [225, b.top - 1], [225, b.bottom + 1], [NaN, 500]]) assert.equal(t.teamAt(x, y), null)
  assert.throws(() => t.setBoundary(NaN), TypeError)
})

test('formations respect walls and bridges on both teams', () => {
  const t = createTerritory()
  for (const y of [300, 500]) {
    const positions = spawnPositions({ count: 3 }, 111, y)
    assert(positions.every(p => groundSegmentClear(p, p)))
    assert(positions.every(p => t.teamAt(p.x, p.y) === t.teamAt(111, y)))
  }
  assert(spawnPositions({ count: 3 }, 111, 430).every(p => groundSegmentClear(p, p)))
  assert(spawnPositions({ count: 3 }, 125, 430).some(p => !groundSegmentClear(p, p)))
  assert(!groundSegmentClear({ x: 225, y: 430 }, { x: 225, y: 430 }))
  assert(spawnPositions({ count: 3 }, b.left, 500).some(p => t.teamAt(p.x, p.y) === null))
})
