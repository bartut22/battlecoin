import test from 'node:test'
import assert from 'node:assert/strict'
import { AMBIENT_ZONES, FIELD_RECT, overlaps, palmOffset, zoneIsClear } from '../src/ambience-layout.js'
import { TOWERS, ARENA } from '../src/frontline.js'

test('all scenery animation zones stay outside the trading field and tower footprints', () => {
  for (const zone of Object.values(AMBIENT_ZONES)) {
    assert.equal(overlaps(zone, FIELD_RECT, 25), false)
    for (const tower of TOWERS) assert.equal(overlaps(zone, { x: tower.x - 72, y: tower.y - 85, width: 144, height: 170 }, 40), false)
  }
})
test('nearby actors suppress ambient motion with an explicit forty pixel buffer', () => {
  const zone = AMBIENT_ZONES.riverNorth
  assert.equal(zoneIsClear(zone, [{ x: 800, y: 60, width: 68, height: 100 }]), false)
  assert.equal(zoneIsClear(zone, [{ x: 400, y: 300, width: 68, height: 100 }]), true)
})
test('tree motion keeps edge vertices locked and uses only small integer pixel offsets', () => {
  const zone = AMBIENT_ZONES.palmsNorth
  for (let t = 0; t < 20; t += .1) {
    assert.deepEqual(palmOffset(0, 0, t, zone), { x: 0, y: 0 })
    const d = palmOffset(125, 80, t, zone)
    assert.ok(Number.isInteger(d.x) && Number.isInteger(d.y))
    assert.ok(Math.abs(d.x) <= 3 && Math.abs(d.y) <= 1)
  }
})
test('tower footprints are matched relative to their nearest interior wall', () => {
  assert.equal(ARENA.left - TOWERS[0].x, TOWERS[1].x - ARENA.right)
  assert.equal(TOWERS[0].y, TOWERS[1].y)
})
