import { useEffect, useRef, useState } from 'react'
import { Application, Container, Graphics } from 'pixi.js'

export default function App() {
  const host = useRef(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let disposed = false
    let ready = false
    const app = new Application()

    async function setup() {
      await app.init({
        background: '#171923', resizeTo: host.current, antialias: true,
      })
      if (disposed) {
        app.destroy(true, { children: true })
        return
      }
      ready = true
      host.current.appendChild(app.canvas)

      const coin = app.stage.addChild(new Container())
      coin.addChild(new Graphics()
        .circle(0, 0, 56).fill('#f5b942')
        .circle(0, 0, 44).stroke({ width: 4, color: '#a66b16' })
        .rect(-7, -25, 14, 50).fill('#a66b16'))

      let elapsed = 0
      app.ticker.add((ticker) => {
        elapsed += ticker.deltaTime / 60
        coin.position.set(app.screen.width / 2, app.screen.height / 2)
        coin.scale.x = 0.3 + Math.abs(Math.cos(elapsed)) * 0.7
      })
    }
    setup().catch((cause) => {
      if (!disposed) setError(`Unable to load the scene: ${cause.message}`)
    })
    return () => {
      disposed = true
      if (ready) app.destroy(true, { children: true })
    }
  }, [])

  return <main ref={host} className="scene" aria-label="Battlecoin 2D scene">
    {error && <p role="alert">{error}</p>}
  </main>
}
