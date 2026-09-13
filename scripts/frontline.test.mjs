import test from 'node:test'
import assert from 'node:assert/strict'
import { ARENA, bidRanks, bidAtPoint, frontX } from '../src/frontline.js'
const market={bidUp:34,askUp:36,bidDown:64,askDown:66,book:{
 UP:{bids:[{price:.34,size:1000},{price:.33,size:500},{price:.32,size:250}],asks:[]},
 DOWN:{bids:[{price:.64,size:1000},{price:.63,size:400}],asks:[]},
}}
test('both best bids are the ranks nearest the probability front',()=>{
 const x=frontX(market),up=bidRanks(market,'UP'),down=bidRanks(market,'DOWN')
 assert.equal(x,ARENA.left+(ARENA.right-ARENA.left)*.35)
 assert.ok(up[0].x<x && down[0].x>x)
 assert.ok(up[0].x>up[1].x && down[0].x<down[1].x)
})
test('long UP placements snap to UP bid prices without deriving arbitrary prices from x',()=>{
 const ranks=bidRanks(market,'UP')
 assert.equal(bidAtPoint(market,{x:ranks[0].x,y:400},'UP').price,34)
 assert.equal(bidAtPoint(market,{x:ranks[1].x,y:400},'UP').price,33)
 assert.equal(bidAtPoint(market,{x:bidRanks(market,'DOWN')[0].x,y:400},'UP'),null)
 assert.equal(bidAtPoint(market,{x:bidRanks(market,'DOWN')[0].x,y:400},'DOWN').price,64)
})
test('thin territories keep bid ranks inside the walls',()=>{
 for(const price of [1,99]){
  const m={...market,bidUp:price-.5,askUp:price+.5}
  for(const side of ['UP','DOWN'])for(const row of bidRanks(m,side)){
   assert.ok(row.x>=ARENA.left && row.x<=ARENA.right)
  }
 }
})
test('arena price-band settings group ranks nearest fair value',()=>{
 const grouped={...market,participantNotional:{priceBand:2}}
 const ranks=bidRanks(grouped,'UP')
 assert.equal(ranks.length,2)
 assert.equal(ranks[0].rangeHigh,34);assert.equal(ranks[0].rangeLow,33)
 assert.equal(ranks[0].notional,340+165)
})
