import test from 'node:test'
import assert from 'node:assert/strict'
import {
  applyBookDelta,
  candidateSlugs,
  discoveryDelay,
  normalizeGammaMarket,
  replaceBook,
} from '../src/polymarket-feed.js'

test('book snapshots and deltas keep executable prices sorted', () => {
  let book = replaceBook({
    bids: [{ price: '0.42', size: '3' }, { price: '0.49', size: '2' }, { price: '0.45', size: '1' }],
    asks: [{ price: '0.61', size: '3' }, { price: '0.52', size: '2' }, { price: '0.55', size: '1' }],
  })
  assert.deepEqual(book.bids.map(level => level.price), [0.49, 0.45, 0.42])
  assert.deepEqual(book.asks.map(level => level.price), [0.52, 0.55, 0.61])

  book = applyBookDelta(book, { side: 'BUY', price: '0.47', size: '8.5' })
  book = applyBookDelta(book, { side: 'SELL', price: '0.51', size: '4' })
  assert.deepEqual(book.bids.map(level => level.price), [0.49, 0.47, 0.45, 0.42])
  assert.deepEqual(book.asks.map(level => level.price), [0.51, 0.52, 0.55, 0.61])
})
test('zero-sized price changes delete exactly that level', () => {
  const original = replaceBook({
    bids: [{ price: '0.48', size: '10' }, { price: '0.47', size: '20' }],
    asks: [{ price: '0.52', size: '30' }],
  })
  const next = applyBookDelta(original, { side: 'BUY', price: '0.48', size: '0' })
  assert.deepEqual(next.bids, [{ price: 0.47, size: 20 }])
  assert.deepEqual(next.asks, original.asks)
})

test('market candidates and validation roll on exact epoch boundaries', () => {
  const before = Date.parse('2026-09-12T23:59:59.999Z')
  const after = Date.parse('2026-09-13T00:00:00.000Z')
  const oldFive = candidateSlugs(before)[0]
  const [newFive, newFifteen] = candidateSlugs(after)

  assert.equal(oldFive.slug, 'btc-updown-5m-1789257300')
  assert.equal(newFive.slug, 'btc-updown-5m-1789257600')
  assert.equal(newFifteen.slug, 'btc-updown-15m-1789257600')
  assert.equal(discoveryDelay(after), 1_000)

  const raw = {
    id: '123',
    conditionId: '0xmarket',
    slug: newFive.slug,
    question: 'Bitcoin Up or Down',
    eventStartTime: new Date(newFive.startMs).toISOString(),
    active: true,
    closed: false,
    acceptingOrders: true,
    enableOrderBook: true,
    outcomes: '["Up", "Down"]',
    clobTokenIds: '["up-token", "down-token"]',
  }
  assert.equal(normalizeGammaMarket(raw, newFive, after)?.endTime, '2026-09-13T00:05:00.000Z')
  assert.equal(normalizeGammaMarket({ ...raw, slug: oldFive.slug }, oldFive, after), null)
  assert.equal(normalizeGammaMarket(raw, newFive, newFive.endMs), null)
})

test('Gamma event responses select the matching market and preserve a published target', () => {
  const now = Date.parse('2026-09-13T00:00:01.000Z')
  const candidate = candidateSlugs(now)[0]
  const market = {
    id: '123', conditionId: '0xmarket', slug: candidate.slug, question: 'Bitcoin Up or Down',
    eventStartTime: new Date(candidate.startMs).toISOString(), active: true, closed: false,
    acceptingOrders: true, enableOrderBook: true, outcomes: '["Up", "Down"]',
    clobTokenIds: '["up-token", "down-token"]',
  }
  const normalized = normalizeGammaMarket({ slug: candidate.slug, eventMetadata: { priceToBeat: 77214.61 }, markets: [market] }, candidate, now)
  assert.equal(normalized.priceToBeat, 77214.61)
  assert.deepEqual(normalized.assets, { UP: 'up-token', DOWN: 'down-token' })
})
