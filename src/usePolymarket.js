import { useCallback, useRef, useSyncExternalStore } from 'react'
import { createPolymarketFeed } from './polymarket-feed.js'

export default function usePolymarket(enabled = true) {
  const feedRef = useRef(null)
  if (feedRef.current === null) feedRef.current = createPolymarketFeed()

  const feed = feedRef.current
  const subscribe = useCallback(listener => enabled ? feed.subscribe(listener) : () => {}, [feed, enabled])
  const market = useSyncExternalStore(subscribe, feed.getSnapshot, feed.getSnapshot)
  return { market, retry: feed.retry }
}

export { usePolymarket }
