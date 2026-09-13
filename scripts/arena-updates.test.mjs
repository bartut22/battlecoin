import test from 'node:test'
import assert from 'node:assert/strict'
import { marketCoverage, orderbookRows } from '../src/market-engine.js'
import { replaceBook, applyBookDelta } from '../src/polymarket-feed.js'
import { createLedger } from '../src/simulation.js'
import { ARENA, frontX } from '../src/frontline.js'
import { tradeImpacts, troopLiquidity } from '../src/trade-impact.js'

test('zero and 100 cents survive book parsing, updates and territory display', () => {
  const book = replaceBook({bids:[{price:'0',size:'100'}],asks:[{price:'1',size:'50'}]})
  assert.equal(book.bids[0].price,0)
  assert.equal(book.asks[0].price,1)
  assert.equal(applyBookDelta(book,{side:'BUY',price:'0',size:'25'}).bids[0].size,25)
  assert.equal(applyBookDelta(book,{side:'BUY',price:'0',size:'0'}).bids.length,0)
  assert.equal(orderbookRows({book:{UP:book}})[0].notional,0)
  for (const price of [0,100]) {
    const market={bidUp:price,askUp:price}
    assert.equal(marketCoverage(market).upCents,price)
    assert.equal(frontX(market),price===0?ARENA.left:ARENA.right)
  }
  assert.equal(replaceBook({bids:[{price:null,size:10},{price:'',size:10}]}).bids.length,0)
})

test('100c orders and zero-value exits conserve capital; zero-dollar division is rejected', () => {
  const ledger=createLedger(100)
  assert.equal(ledger.place('UP',0,25,'m'),null)
  const order=ledger.place('UP',100,25,'m')
  assert.equal(order.quantity,25)
  ledger.fill(order.id,25,100)
  assert.equal(ledger.close(ledger.positions[0].id,0),true)
  assert.equal(ledger.available,75)
  assert.equal(ledger.realized,-25)
})

const troop=(key,side='UP',bookPrice=50,notional=25)=>({key:'book:'+key,side,bookPrice,notional})
test('a 25 dollar hit consumes one troop, a smaller hit recoils, and sweeps preserve size', () => {
  const units=[troop('a'),troop('b'),troop('c')]
  const trade={side:'UP',direction:'SELL',price:.5,size:50}
  assert.deepEqual(tradeImpacts(trade,units).map(h=>[h.notional,h.consumed]),[[25,true]])
  assert.deepEqual(tradeImpacts({...trade,size:10},units).map(h=>[h.notional,h.consumed]),[[5,false]])
  assert.deepEqual(tradeImpacts({...trade,size:110},units).map(h=>[h.notional,h.consumed]),[[25,true],[25,true],[5,false]])
  assert.equal(tradeImpacts({...trade,price:.4},units).length,0)
})

test('BUY hits complementary bids by quantity and reserves in-flight damage only once', () => {
  const units=[troop('a','DOWN',65),troop('b','DOWN',65)]
  const trade={side:'UP',direction:'BUY',price:.35,size:25/.65}
  const hits=tradeImpacts(trade,units)
  assert.equal(hits[0].unit,units[0])
  assert.equal(hits[0].consumed,true)
  units[0].pendingNotional=25
  assert.equal(tradeImpacts(trade,units)[0].unit,units[1])
})

test('grouped troops take damage only from the executed underlying level', () => {
  const row={members:[{price:50,notional:15},{price:49,notional:35}]}
  const portions=troopLiquidity(row,[{notional:25},{notional:25}])
  assert.deepEqual(portions,[[{price:50,notional:15},{price:49,notional:10}],[{price:49,notional:25}]])
  const units=portions.map((liquidity,i)=>({...troop(String(i)),liquidity}))
  const hits=tradeImpacts({side:'UP',direction:'SELL',price:.49,size:35/.49},units)
  assert.deepEqual(hits.map(hit=>[hit.notional,hit.consumed]),[[10,false],[25,true]])
})
