import { useRef, useSyncExternalStore } from 'react'
import { createPolymarketFeed } from './polymarket-feed.js'

export default function usePolymarket() {
  const feedRef = useRef(null)
  if (feedRef.current === null) feedRef.current = createPolymarketFeed()

  const feed = feedRef.current
  const market = useSyncExternalStore(feed.subscribe, feed.getSnapshot, feed.getSnapshot)
  return { market, retry: feed.retry }
}

export { usePolymarket }
