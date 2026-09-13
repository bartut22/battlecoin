import test from 'node:test'
import assert from 'node:assert/strict'
import { flagOffset } from '../src/flag-motion.js'

test('wind never moves flag poles, attachments or stone bases', () => {
  for (const side of ['UP','DOWN']) for (let time=0;time<10;time+=.25) {
    for (const y of [20,48,80,112,160,234,256]) assert.deepEqual(flagOffset(side==='UP'?72:120,y,side,time),{x:0,y:0})
    for (const x of [0,48,96,144,192]) assert.deepEqual(flagOffset(x,234,side,time),{x:0,y:0})
  }
})
test('both free cloth edges ripple in bounded integer pixels', () => {
  for (const [side,x] of [['UP',156],['DOWN',36]]) {
    const samples=Array.from({length:40},(_,i)=>flagOffset(x,64,side,i/10))
    assert.ok(new Set(samples.map(v=>v.y)).size>4)
    assert.ok(samples.every(v=>Number.isInteger(v.x)&&Number.isInteger(v.y)&&Math.abs(v.x)<=2&&Math.abs(v.y)<=7))
  }
})
