import test from 'node:test'
import assert from 'node:assert/strict'
import { marketCoverage, orderbookRows } from '../src/market-engine.js'
import { depthUnits, createLedger } from '../src/simulation.js'
test('displayed midpoint maps exactly to fair-value territory',()=>{
 const c=marketCoverage({bidUp:34,askUp:36,bidDown:64})
 assert.equal(c.upCoverage,.35);assert.equal(c.downCoverage,.65)
})
test('wide spreads use last trade, missing quotes do not invent probability',()=>{
 assert.equal(marketCoverage({bidUp:20,askUp:50,lastTradeUp:38}).upCents,38)
 assert.equal(marketCoverage({bidUp:null,askUp:null}).available,false)
})
test('depth includes correct notional and complementary price distance',()=>{
 const rows=orderbookRows({bidUp:34,askUp:36,book:{UP:{bids:[{price:.34,size:1000}],asks:[]},DOWN:{bids:[{price:.64,size:100}],asks:[]}}})
 assert.equal(rows[0].notional,340);assert.equal(rows[0].distanceCents,1);assert.equal(rows[1].distanceCents,1)
})
test('300 dollars at 25 per unit is twelve; residual and cap preserve notional',()=>{
 assert.equal(depthUnits(300,25).length,12)
 assert.deepEqual(depthUnits(51,25).map(x=>x.notional),[25,25,1])
 const grouped=depthUnits(10000,25,24)
 assert.equal(grouped.length,24);assert.ok(Math.abs(grouped.reduce((s,x)=>s+x.notional,0)-10000)<1e-8)
})
test('cancellation returns reserved capital exactly once',()=>{
 const l=createLedger(100),o=l.place('UP',35,25,'market')
 assert.equal(l.available,75);assert.equal(l.cancel(o.id),true);assert.equal(l.available,100)
 assert.equal(l.cancel(o.id),false);assert.equal(l.available,100)
})
test('partial fills conserve capital and value DOWN gains with correct sign',()=>{
 const l=createLedger(100),o=l.place('DOWN',50,20,'market')
 assert.equal(l.fill(o.id,10,40),10);assert.equal(l.available,81)
 assert.equal(l.open[0].notional,15);assert.equal(l.positions[0].notional,4)
 assert.equal(l.mark({marketId:'market',bidDown:60}),2)
 l.cancel(o.id);assert.equal(l.available,96)
 assert.equal(l.close(l.positions[0].id,60),true)
 assert.equal(l.available,102);assert.equal(l.realized,2);assert.equal(l.positions.length,0)
})
