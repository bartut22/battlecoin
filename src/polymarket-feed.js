const GAMMA_BASE = '/gamma'
const CLOB_BASE = '/clob'
const MARKET_SOCKET_URL = 'wss://ws-subscriptions-clob.polymarket.com/ws/market'

const DISCOVERY_INTERVAL_MS = 10_000
const ROLLOVER_DISCOVERY_MS = 1_000
const ROLLOVER_WINDOW_MS = 15_000
const PUBLISH_INTERVAL_MS = 250
const PING_INTERVAL_MS = 10_000
const HEARTBEAT_TIMEOUT_MS = 25_000
const MAX_BUFFERED_DELTAS = 2_000
const MAX_TRADE_BATCH = 250

const INTERVALS = [
  { label: '5m', seconds: 300 },
  { label: '15m', seconds: 900 },
]

function emptyOutcomeBook() {
  return { bids: [], asks: [] }
}

export function emptyBook() {
  return { UP: emptyOutcomeBook(), DOWN: emptyOutcomeBook() }
}

function finitePositive(value) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

function normalizeLevels(levels, descending) {
  const byPrice = new Map()
  for (const level of Array.isArray(levels) ? levels : []) {
    const price = finitePositive(level?.price)
    const size = finitePositive(level?.size)
    if (price === null || size === null || price > 1) continue
    byPrice.set(String(price), { price, size })
  }
  return [...byPrice.values()].sort((a, b) => descending ? b.price - a.price : a.price - b.price)
}

export function replaceBook(snapshot) {
  return {
    bids: normalizeLevels(snapshot?.bids, true),
    asks: normalizeLevels(snapshot?.asks, false),
  }
}

export function applyBookDelta(book, change) {
  const direction = String(change?.side || '').toUpperCase()
  const side = direction === 'BUY' ? 'bids' : direction === 'SELL' ? 'asks' : null
  const price = finitePositive(change?.price)
  const size = Number(change?.size)
  if (!side || price === null || price > 1 || !Number.isFinite(size) || size < 0) return book

  const nextLevels = book[side].filter(level => level.price !== price)
  if (size > 0) nextLevels.push({ price, size })
  nextLevels.sort((a, b) => side === 'bids' ? b.price - a.price : a.price - b.price)
  return { ...book, [side]: nextLevels }
}

function parseArray(value) {
  if (Array.isArray(value)) return value
  if (typeof value !== 'string') return null
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function candidateSlugs(nowMs = Date.now()) {
  const nowSeconds = Math.floor(nowMs / 1_000)
  return INTERVALS.map(({ label, seconds }) => {
    const startSeconds = Math.floor(nowSeconds / seconds) * seconds
    return {
      slug: `btc-updown-${label}-${startSeconds}`,
      startMs: startSeconds * 1_000,
      endMs: (startSeconds + seconds) * 1_000,
      intervalSeconds: seconds,
    }
  })
}

export function normalizeGammaMarket(raw, candidate, nowMs = Date.now()) {
  if (!raw || raw.slug !== candidate.slug || nowMs < candidate.startMs || nowMs >= candidate.endMs) return null
  if (raw.active !== true || raw.closed === true || raw.acceptingOrders === false || raw.enableOrderBook === false) return null

  const eventStart = Date.parse(raw.eventStartTime)
  if (Number.isFinite(eventStart) && Math.abs(eventStart - candidate.startMs) > 2_000) return null

  const outcomes = parseArray(raw.outcomes)
  const tokenIds = parseArray(raw.clobTokenIds)
  if (!outcomes || !tokenIds || outcomes.length !== tokenIds.length) return null

  const assets = {}
  for (let index = 0; index < outcomes.length; index += 1) {
    const outcome = String(outcomes[index]).trim().toUpperCase()
    const tokenId = String(tokenIds[index] || '').trim()
    if ((outcome === 'UP' || outcome === 'DOWN') && tokenId) assets[outcome] = tokenId
  }
  if (!assets.UP || !assets.DOWN) return null

  const marketId = String(raw.conditionId || raw.id || '').trim()
  if (!marketId) return null
  return {
    marketId,
    title: String(raw.question || raw.title || raw.slug),
    slug: raw.slug,
    startMs: candidate.startMs,
    endMs: candidate.endMs,
    endTime: new Date(candidate.endMs).toISOString(),
    assets,
  }
}

export function discoveryDelay(nowMs = Date.now()) {
  const fiveMinuteMs = INTERVALS[0].seconds * 1_000
  const elapsed = nowMs % fiveMinuteMs
  if (elapsed < ROLLOVER_WINDOW_MS) return ROLLOVER_DISCOVERY_MS
  return Math.min(DISCOVERY_INTERVAL_MS, fiveMinuteMs - elapsed + 100)
}

function timestampMs(value, fallback) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return number < 10_000_000_000 ? number * 1_000 : number
}

function cents(price) {
  return Number.isFinite(price) ? Math.round(price * 1_000) / 10 : null
}

function makeInitialMarket(nowMs) {
  return {
    marketId: null,
    title: null,
    slug: null,
    endTime: null,
    feedStatus: 'connecting',
    feedMessage: 'Finding the current BTC market',
    updatedAt: new Date(nowMs).toISOString(),
    lastTradeUp: null,
    bidUp: null,
    askUp: null,
    bidDown: null,
    askDown: null,
    book: emptyBook(),
    trade: null,
    trades: [],
  }
}

function responseError(response, label) {
  return new Error(`${label} returned ${response.status}`)
}

export function createPolymarketFeed(options = {}) {
  const fetchImpl = options.fetch || globalThis.fetch?.bind(globalThis)
  const WebSocketImpl = options.WebSocket || globalThis.WebSocket
  const now = options.now || Date.now
  const scheduleTimeout = options.setTimeout || globalThis.setTimeout.bind(globalThis)
  const cancelTimeout = options.clearTimeout || globalThis.clearTimeout.bind(globalThis)
  const scheduleInterval = options.setInterval || globalThis.setInterval.bind(globalThis)
  const cancelInterval = options.clearInterval || globalThis.clearInterval.bind(globalThis)
  const gammaBase = options.gammaBase || GAMMA_BASE
  const clobBase = options.clobBase || CLOB_BASE
  const socketUrl = options.socketUrl || MARKET_SOCKET_URL

  let running = false
  let subscribers = 0
  let generation = 0
  let connectionSequence = 0
  let snapshot = makeInitialMarket(now())
  let info = null
  let book = emptyBook()
  let trade = null
  let lastTradeUp = null
  let status = snapshot.feedStatus
  let message = snapshot.feedMessage
  let updatedAt = snapshot.updatedAt
  let pendingTrades = []
  let bufferedDeltas = { UP: [], DOWN: [] }
  let bookReady = { UP: false, DOWN: false }
  let bookTimestamp = { UP: 0, DOWN: 0 }
  let heartbeatReady = false
  let lastPongAt = 0
  let socket = null
  let discoveryAbort = null
  let booksAbort = null
  let discoveryTimer = null
  let expiryTimer = null
  let reconnectTimer = null
  let publishTimer = null
  let pingTimer = null
  let heartbeatTimer = null
  let lastPublishAt = 0
  let reconnectAttempt = 0
  const listeners = new Set()

  const clearTimer = (name) => {
    const timer = ({ discoveryTimer, expiryTimer, reconnectTimer, publishTimer })[name]
    if (timer !== null) cancelTimeout(timer)
    if (name === 'discoveryTimer') discoveryTimer = null
    if (name === 'expiryTimer') expiryTimer = null
    if (name === 'reconnectTimer') reconnectTimer = null
    if (name === 'publishTimer') publishTimer = null
  }

  const clearSocketTimers = () => {
    if (pingTimer !== null) cancelInterval(pingTimer)
    if (heartbeatTimer !== null) cancelInterval(heartbeatTimer)
    pingTimer = null
    heartbeatTimer = null
  }

  const touch = (at = now()) => {
    updatedAt = new Date(at).toISOString()
  }

  const buildSnapshot = () => {
    const up = book.UP
    const down = book.DOWN
    return {
      marketId: info?.marketId ?? null,
      title: info?.title ?? null,
      slug: info?.slug ?? null,
      endTime: info?.endTime ?? null,
      feedStatus: status,
      feedMessage: message,
      updatedAt,
      lastTradeUp,
      bidUp: cents(up.bids[0]?.price),
      askUp: cents(up.asks[0]?.price),
      bidDown: cents(down.bids[0]?.price),
      askDown: cents(down.asks[0]?.price),
      book: {
        UP: { bids: [...up.bids], asks: [...up.asks] },
        DOWN: { bids: [...down.bids], asks: [...down.asks] },
      },
      trade,
      trades: pendingTrades,
    }
  }

  const flush = () => {
    publishTimer = null
    lastPublishAt = now()
    snapshot = buildSnapshot()
    pendingTrades = []
    for (const listener of listeners) listener()
  }

  const publish = () => {
    if (publishTimer !== null) return
    const wait = Math.max(0, PUBLISH_INTERVAL_MS - (now() - lastPublishAt))
    publishTimer = scheduleTimeout(flush, wait)
  }

  const setStatus = (nextStatus, nextMessage) => {
    status = nextStatus
    message = nextMessage
    touch()
    publish()
  }

  const closeSocket = () => {
    connectionSequence += 1
    clearSocketTimers()
    clearTimer('reconnectTimer')
    booksAbort?.abort()
    booksAbort = null
    const current = socket
    socket = null
    if (current) {
      current.onopen = null
      current.onmessage = null
      current.onerror = null
      current.onclose = null
      try { current.close() } catch { /* already closed */ }
    }
    heartbeatReady = false
    lastPongAt = 0
  }

  const isCurrentConnection = (cycle, sequence, candidateSocket) => (
    running && cycle === generation && sequence === connectionSequence && socket === candidateSocket
  )

  const maybeLive = () => {
    if (!socket || socket.readyState !== WebSocketImpl.OPEN || !heartbeatReady || !bookReady.UP || !bookReady.DOWN) return
    reconnectAttempt = 0
    setStatus('live', 'Live Polymarket order book')
  }

  const applyBufferedDeltas = (outcome) => {
    for (const entry of bufferedDeltas[outcome]) {
      if (entry.timestamp >= bookTimestamp[outcome]) {
        book[outcome] = applyBookDelta(book[outcome], entry.change)
        bookTimestamp[outcome] = entry.timestamp
      }
    }
    bufferedDeltas[outcome] = []
  }

  const acceptBook = (outcome, payload, eventTime) => {
    if (bookReady[outcome] && eventTime < bookTimestamp[outcome]) return
    if (outcome === 'UP' && lastTradeUp === null && finitePositive(payload.last_trade_price) !== null) lastTradeUp = cents(Number(payload.last_trade_price))
    book[outcome] = replaceBook(payload)
    bookReady[outcome] = true
    bookTimestamp[outcome] = eventTime
    applyBufferedDeltas(outcome)
    touch(eventTime || now())
    publish()
    maybeLive()
  }

  const acceptDelta = (outcome, change, eventTime) => {
    if (!bookReady[outcome]) {
      const queue = bufferedDeltas[outcome]
      queue.push({ change, timestamp: eventTime })
      if (queue.length > MAX_BUFFERED_DELTAS) queue.splice(0, queue.length - MAX_BUFFERED_DELTAS)
      return
    }
    if (eventTime < bookTimestamp[outcome]) return
    book[outcome] = applyBookDelta(book[outcome], change)
    bookTimestamp[outcome] = eventTime
    touch(eventTime)
    publish()
  }

  const acceptTrade = (outcome, payload) => {
    const price = finitePositive(payload.price)
    const size = finitePositive(payload.size)
    const direction = String(payload.side || '').toUpperCase()
    if (price === null || price > 1 || size === null || (direction !== 'BUY' && direction !== 'SELL')) return
    const eventTime = timestampMs(payload.timestamp, now())
    const nextTrade = {
      id: String(payload.transaction_hash || payload.hash || `${payload.asset_id}:${eventTime}:${price}:${size}:${direction}`),
      side: outcome,
      direction,
      price,
      size,
      timestamp: eventTime,
    }
    trade = nextTrade
    if (outcome === 'UP') lastTradeUp = cents(price)
    pendingTrades.push(nextTrade)
    if (pendingTrades.length > MAX_TRADE_BATCH) pendingTrades.splice(0, pendingTrades.length - MAX_TRADE_BATCH)
    touch(eventTime)
    publish()
  }

  const parseMessages = (data) => {
    if (data === 'PONG') return 'PONG'
    if (typeof data !== 'string') return []
    try {
      const parsed = JSON.parse(data)
      return Array.isArray(parsed) ? parsed : [parsed]
    } catch {
      return []
    }
  }

  const handleMessage = (data) => {
    const messages = parseMessages(data)
    if (messages === 'PONG') {
      heartbeatReady = true
      lastPongAt = now()
      maybeLive()
      return
    }
    const assetOutcomes = new Map([[info.assets.UP, 'UP'], [info.assets.DOWN, 'DOWN']])
    for (const payload of messages) {
      const eventType = payload?.event_type
      const eventTime = timestampMs(payload?.timestamp, now())
      if (eventType === 'book') {
        const outcome = assetOutcomes.get(String(payload.asset_id))
        if (outcome) acceptBook(outcome, payload, eventTime)
      } else if (eventType === 'price_change') {
        for (const change of Array.isArray(payload.price_changes) ? payload.price_changes : []) {
          const outcome = assetOutcomes.get(String(change.asset_id))
          if (outcome) acceptDelta(outcome, change, eventTime)
        }
      } else if (eventType === 'last_trade_price') {
        const outcome = assetOutcomes.get(String(payload.asset_id))
        if (outcome) acceptTrade(outcome, payload)
      }
    }
  }

  const fetchFreshBooks = async (cycle, sequence, candidateSocket) => {
    booksAbort?.abort()
    const controller = new AbortController()
    booksAbort = controller
    await Promise.all(Object.entries(info.assets).map(async ([outcome, tokenId]) => {
      try {
        const response = await fetchImpl(`${clobBase}/book?token_id=${encodeURIComponent(tokenId)}`, {
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]),
          cache: 'no-store',
        })
        if (!response.ok) throw responseError(response, 'CLOB book')
        const payload = await response.json()
        if (!isCurrentConnection(cycle, sequence, candidateSocket)) return
        acceptBook(outcome, payload, timestampMs(payload.timestamp, now()))
      } catch (error) {
        if (error?.name !== 'AbortError' && isCurrentConnection(cycle, sequence, candidateSocket)) {
          message = 'Waiting for complete Polymarket book snapshots'
          publish()
        }
      }
    }))
    if (booksAbort === controller) booksAbort = null
  }

  const connect = () => {
    if (!running || !info || now() >= info.endMs) return
    if (!fetchImpl || !WebSocketImpl) {
      setStatus('unavailable', 'This browser cannot open the Polymarket feed')
      return
    }

    closeSocket()
    bookReady = { UP: false, DOWN: false }
    bookTimestamp = { UP: 0, DOWN: 0 }
    bufferedDeltas = { UP: [], DOWN: [] }
    heartbeatReady = false
    const cycle = generation
    const sequence = connectionSequence
    const candidateSocket = new WebSocketImpl(socketUrl)
    socket = candidateSocket
    setStatus(book.UP.bids.length || book.DOWN.bids.length ? 'stale' : 'connecting', 'Connecting to Polymarket')

    candidateSocket.onopen = () => {
      if (!isCurrentConnection(cycle, sequence, candidateSocket)) return
      candidateSocket.send(JSON.stringify({ assets_ids: [info.assets.UP, info.assets.DOWN], type: 'market' }))
      candidateSocket.send('PING')
      lastPongAt = now()
      pingTimer = scheduleInterval(() => {
        if (isCurrentConnection(cycle, sequence, candidateSocket) && candidateSocket.readyState === WebSocketImpl.OPEN) candidateSocket.send('PING')
      }, PING_INTERVAL_MS)
      heartbeatTimer = scheduleInterval(() => {
        if (!isCurrentConnection(cycle, sequence, candidateSocket)) return
        if (lastPongAt && now() - lastPongAt > HEARTBEAT_TIMEOUT_MS) candidateSocket.close()
      }, PING_INTERVAL_MS)
      fetchFreshBooks(cycle, sequence, candidateSocket)
    }

    candidateSocket.onmessage = event => {
      if (isCurrentConnection(cycle, sequence, candidateSocket)) handleMessage(event.data)
    }
    candidateSocket.onerror = () => {
      if (isCurrentConnection(cycle, sequence, candidateSocket)) candidateSocket.close()
    }
    candidateSocket.onclose = () => {
      if (!isCurrentConnection(cycle, sequence, candidateSocket)) return
      socket = null
      clearSocketTimers()
      booksAbort?.abort()
      booksAbort = null
      heartbeatReady = false
      setStatus('stale', 'Polymarket connection lost; reconnecting')
      if (now() >= info.endMs) return
      const delay = Math.min(10_000, 1_000 * (2 ** Math.min(reconnectAttempt, 4)))
      reconnectAttempt += 1
      reconnectTimer = scheduleTimeout(connect, delay)
    }
  }

  const scheduleExpiry = () => {
    clearTimer('expiryTimer')
    if (!info) return
    const cycle = generation
    expiryTimer = scheduleTimeout(() => {
      if (!running || cycle !== generation || !info || now() < info.endMs) return
      closeSocket()
      setStatus('stale', 'Market expired; finding the next BTC market')
      discover()
    }, Math.max(0, info.endMs - now() + 25))
  }

  const installMarket = (nextInfo) => {
    if (info?.marketId === nextInfo.marketId) {
      scheduleExpiry()
      if (!socket && reconnectTimer === null) connect()
      return
    }
    closeSocket()
    info = nextInfo
    book = emptyBook()
    trade = null
    lastTradeUp = null
    pendingTrades = []
    bookReady = { UP: false, DOWN: false }
    bookTimestamp = { UP: 0, DOWN: 0 }
    bufferedDeltas = { UP: [], DOWN: [] }
    reconnectAttempt = 0
    setStatus('connecting', 'Loading the live Polymarket order book')
    scheduleExpiry()
    connect()
  }

  const fetchCandidate = async (candidate, signal) => {
    try {
      const response = await fetchImpl(`${gammaBase}/markets/slug/${encodeURIComponent(candidate.slug)}`, {
        signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]),
        cache: 'no-store',
      })
      if (!response.ok) return null
      return normalizeGammaMarket(await response.json(), candidate, now())
    } catch (error) {
      if (error?.name === 'AbortError') throw error
      return null
    }
  }

  const scheduleDiscovery = () => {
    clearTimer('discoveryTimer')
    if (!running) return
    discoveryTimer = scheduleTimeout(discover, discoveryDelay(now()))
  }

  async function discover() {
    if (!running || !fetchImpl) {
      if (running) setStatus('unavailable', 'This browser cannot query Polymarket')
      return
    }
    clearTimer('discoveryTimer')
    discoveryAbort?.abort()
    const controller = new AbortController()
    discoveryAbort = controller
    const cycle = generation
    const candidates = candidateSlugs(now())

    try {
      const results = await Promise.all(candidates.map(candidate => fetchCandidate(candidate, controller.signal)))
      if (!running || cycle !== generation || discoveryAbort !== controller) return
      const found = results.find(Boolean)
      if (found) installMarket(found)
      else if (!info || now() >= info.endMs) {
        if (info && now() >= info.endMs) closeSocket()
        setStatus(info ? 'stale' : 'unavailable', info
          ? 'Market expired; waiting for the next BTC market'
          : 'No active BTC 5-minute or 15-minute market is available')
      }
    } catch (error) {
      if (error?.name !== 'AbortError' && running && cycle === generation) {
        setStatus(info ? 'stale' : 'unavailable', 'Polymarket discovery is temporarily unavailable')
      }
    } finally {
      if (discoveryAbort === controller) discoveryAbort = null
      if (running && cycle === generation) scheduleDiscovery()
    }
  }

  const stop = () => {
    if (!running) return
    running = false
    generation += 1
    discoveryAbort?.abort()
    discoveryAbort = null
    clearTimer('discoveryTimer')
    clearTimer('expiryTimer')
    clearTimer('publishTimer')
    closeSocket()
  }

  const start = () => {
    if (running) return
    running = true
    generation += 1
    setStatus(info ? 'stale' : 'connecting', info ? 'Refreshing Polymarket' : 'Finding the current BTC market')
    discover()
  }

  const retry = () => {
    if (!running) {
      start()
      return
    }
    generation += 1
    discoveryAbort?.abort()
    discoveryAbort = null
    clearTimer('discoveryTimer')
    clearTimer('expiryTimer')
    closeSocket()
    setStatus(info ? 'stale' : 'connecting', 'Retrying Polymarket now')
    discover()
  }

  const subscribe = (listener) => {
    listeners.add(listener)
    subscribers += 1
    if (subscribers === 1) start()
    return () => {
      if (!listeners.delete(listener)) return
      subscribers = Math.max(0, subscribers - 1)
      if (subscribers === 0) stop()
    }
  }

  return {
    getSnapshot: () => snapshot,
    subscribe,
    retry,
    start,
    stop,
  }
}
