import test from 'node:test'
import assert from 'node:assert/strict'
import { GRID_X, GRID_Y, gridCell, selectableCell, smoothSnap } from '../src/placement-grid.js'

test('every painted tile center maps back to exactly its own cell', () => {
  for (let col = 0; col < GRID_X.length - 1; col++) for (let row = 0; row < GRID_Y.length - 1; row++) {
    const cell = gridCell((GRID_X[col] + GRID_X[col + 1]) / 2, (GRID_Y[row] + GRID_Y[row + 1]) / 2)
    assert.equal(cell.col, col); assert.equal(cell.row, row)
  }
  assert.equal(gridCell(GRID_X[0] - .01, GRID_Y[0]), null)
  assert.equal(gridCell(GRID_X[0], GRID_Y.at(-1) + .01), null)
  assert.equal(gridCell(NaN, 500), null)
  assert.equal(gridCell(GRID_X.at(-1), GRID_Y.at(-1)).col, GRID_X.length - 2)
})

test('snapping eases without overshoot and is independent of frame rate', () => {
  assert(smoothSnap(0, 100, 1 / 60) > 0)
  assert(smoothSnap(0, 100, 1 / 60) < 100)
  const twoFrames = smoothSnap(smoothSnap(0, 100, 1 / 60), 100, 1 / 60)
  assert(Math.abs(twoFrames - smoothSnap(0, 100, 1 / 30)) < 1e-9)
})

test('both brown lanes and both river columns are excluded', () => {
  const fromPixels = (x, y) => gridCell(x * 450 / 720, y * 910 / 1440)
  for (const x of [170, 195, 535, 555]) {
    assert.equal(selectableCell(fromPixels(x, 300)), false)
    assert.equal(selectableCell(fromPixels(x, 900)), false)
  }
  for (const y of [650, 710]) assert.equal(selectableCell(fromPixels(330, y)), false)
  for (const y of [300, 900]) assert.equal(selectableCell(fromPixels(330, y)), true)
})
