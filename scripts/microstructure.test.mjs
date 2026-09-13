import test from 'node:test'
import assert from 'node:assert/strict'
import { marketCoverage, orderbookRows, DEFAULT_CARD_VALUES } from '../src/market-engine.js'
import { frontX, ARENA } from '../src/frontline.js'
import { balloonSizeFor } from '../src/character-art.js'

const quote = (bidSize, askSize) => ({ bidUp: 34, askUp: 36, book: { UP: { bids: [{ price: .34, size: bidSize }], asks: [{ price: .36, size: askSize }] } } })
test('queue imbalance moves the shared estimate inside the actual spread', () => {
  const market = quote(300, 100), c = marketCoverage(market)
  assert.equal(c.source, 'Microprice'); assert.equal(c.upCents, 35.5)
  assert.equal(marketCoverage(quote(100, 300)).upCents, 34.5)
  assert.equal(c.downCents, 64.5)
  assert.equal(frontX(market), ARENA.left + (ARENA.right - ARENA.left) * .355)
  assert.equal(orderbookRows(market)[0].distanceCents, 1.5)
})
test('both complementary outcome books contribute; DOWN alone is supported', () => {
  const market = { ...quote(300, 100), bidDown: 64, askDown: 66 }
  market.book.DOWN = { bids: [{price: .64, size: 100}], asks: [{price: .66, size: 300}] }
  assert.equal(marketCoverage(market).upCents, 35.5)
  market.book.DOWN.bids[0].size = 300; market.book.DOWN.asks[0].size = 100
  assert.equal(marketCoverage(market).upCents, 35)
  delete market.book.UP; market.bidUp = null; market.askUp = null
  assert.equal(marketCoverage(market).upCents, 34.5)
})
test('sizes must match best quotes; stale and invalid depth is not borrowed', () => {
  const market = quote(300, 100)
  market.book.UP.bids[0].price = .33
  assert.equal(marketCoverage(market).source, 'Midpoint fallback')
  market.book.UP.bids[0] = { price: .34, size: -100 }
  assert.equal(marketCoverage(market).upCents, 35)
  assert.equal(marketCoverage({bidUp:50,askUp:40}).available, false)
})
test('a populated wide spread uses depth, with no artificial 1c/99c boundary', () => {
  const market = quote(300, 100)
  market.askUp = 54; market.book.UP.asks[0].price = .54
  assert.equal(marketCoverage(market).upCents, 49)
  for(const price of [0, 100]) {
    const c = marketCoverage({bidUp:price,askUp:price,book:{UP:{bids:[{price:price/100,size:10}],asks:[{price:price/100,size:10}]}}})
    assert.equal(c.upCents, price)
  }
})
test('three editable taker sizes follow limit cards; public size thresholds are independent', () => {
  assert.deepEqual(DEFAULT_CARD_VALUES.slice(3).map(c=>c.balloonSize), ['small','medium','large'])
  assert.equal(balloonSizeFor(99), 'small')
  assert.equal(balloonSizeFor(100), 'medium')
  assert.equal(balloonSizeFor(500), 'large')
  assert.equal(balloonSizeFor(80,{small:5,medium:25,large:75}), 'large')
})
