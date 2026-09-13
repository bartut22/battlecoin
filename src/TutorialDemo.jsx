import { useEffect, useRef, useState } from 'react'
import { Pause, Play, RotateCcw } from 'lucide-react'
import { loadCharacterArt } from './character-art.js'
import './tutorial-demo.css'

const CAPTIONS = [
  ['Start with $100 in simulated capital.', 'Reference quotes shape the battlefield.', 'Your gold outline marks a paper order.', 'A taker meets resting liquidity.', 'The troop fills in the simulation.', 'Review the fill in your portfolio.'],
  ['Select a limit troop from your deck.', 'Place it at your chosen bid.', 'It rests at that price, outlined in gold.', 'The balloon represents a taker order.', 'The bomb hits the matching troop.', 'A filled troop leaves the battlefield.'],
  ['Example fair value: UP 35%, DOWN 65%.', 'Bid and ask liquidity changes.', 'The fair-value boundary moves.', 'Depth formations follow their price levels.', 'A trade consumes matching liquidity.', 'Removed depth is not always a cancellation.'],
  ['Example paper capital: $100 available.', 'A $5 limit order reserves $5.', '$95 remains available while it rests.', 'A simulated taker fills the order.', '$5 is now a position, not available capital.', 'Fills and positions appear in the portfolio.'],
]

export default function TutorialDemo({ chapter = 0 }) {
  const canvas = useRef(null), elapsed = useRef(0)
  const [art, setArt] = useState(null), [paused, setPaused] = useState(false), [phase, setPhase] = useState(0), [replay, setReplay] = useState(0)
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => { let alive = true; loadCharacterArt().then(value => { if (alive) setArt(value) }).catch(() => {}); return () => { alive = false } }, [])
  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)'), update = () => setReduced(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  useEffect(() => { elapsed.current = 0; setPhase(0) }, [chapter, replay])
  useEffect(() => {
    if (!canvas.current || !art) return
    const ctx = canvas.current.getContext('2d'), duration = 10.8
    let frame, previous, lastDraw = -1, lastPhase = -1
    const draw = now => {
      const dt = previous == null ? 0 : Math.min(.08, (now - previous) / 1000)
      previous = now
      if (!paused && !reduced && !document.hidden) elapsed.current = (elapsed.current + dt) % duration
      const time = reduced ? 4.8 : elapsed.current, index = Math.min(5, Math.floor(time / 1.8))
      if (index !== lastPhase) { lastPhase = index; setPhase(index) }
      const tick = Math.floor(time * 12)
      if (tick !== lastDraw) {
        lastDraw = tick
        ctx.imageSmoothingEnabled = false
        ctx.clearRect(0, 0, 560, 180)
        ctx.fillStyle = '#d0ad69'; ctx.fillRect(0, 0, 560, 180)
        const fair = chapter === 2 ? .35 + .2 * Math.max(0, Math.min(1, (time - 1.8) / 3.6)) : .5
        const line = Math.round(44 + 472 * fair)
        for (let y = 28; y < 150; y += 24) for (let x = 44; x < 516; x += 24) {
          ctx.fillStyle = x < line ? ((x + y) % 48 ? '#8ea972' : '#9bb57e') : ((x + y) % 48 ? '#c7826b' : '#d3977c')
          ctx.fillRect(x, y, Math.min(24, 516 - x), Math.min(24, 150 - y))
        }
        ctx.fillStyle = '#6c5130'; ctx.fillRect(40, 24, 480, 4); ctx.fillRect(40, 150, 480, 4)
        ctx.fillStyle = '#fff0b5'; ctx.fillRect(line - 2, 28, 4, 122)
        ctx.font = '20px VT323'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#293822'
        ctx.fillText('Long/UP', 48, 12); ctx.fillStyle = '#762c2d'; ctx.fillText('Short/DOWN', 412, 12)
        const sprite = (kind, side, x, y, size, gold = false, alpha = 1) => {
          const image = art[side][kind]
          ctx.save(); ctx.globalAlpha = alpha
          if (gold) { ctx.shadowColor = '#ffdb60'; ctx.shadowBlur = 0; for (const [dx, dy] of [[-2,0],[2,0],[0,-2],[0,2]]) { ctx.shadowOffsetX = dx; ctx.shadowOffsetY = dy; ctx.drawImage(image, x - size / 2, y - size, size, size) } }
          ctx.shadowOffsetX = ctx.shadowOffsetY = 0
          ctx.drawImage(image, x - size / 2, y - size, size, size); ctx.restore()
        }
        const targetX = line - 60, targetY = 125
        sprite('guard', 'DOWN', line + 80, 124, 55)
        sprite('anchor', 'DOWN', line + 137, 111, 55)
        sprite('scout', 'UP', Math.max(76, line - 133), 106, 48)
        const placement = Math.max(0, Math.min(1, (time - 1) / 1.8))
        const x = 72 + (targetX - 72) * placement, y = 176 + (targetY - 176) * placement
        ctx.strokeStyle = '#ffe59a'; ctx.lineWidth = 2; ctx.strokeRect(targetX - 20, 105, 40, 40)
        if (time < 7.6 || reduced) sprite('scout', 'UP', x, y, 64, true)
        if (time >= 5.4 && time < 8.4 && !reduced) {
          const approach = Math.min(1, (time - 5.4) / 1.25), balloonX = 468 + (targetX - 468) * approach
          sprite('balloon-small', 'DOWN', balloonX, 81, 75)
          if (time > 6.7) {
            const fall = Math.min(1, (time - 6.7) / .9)
            ctx.fillStyle = '#392d23'; ctx.fillRect(targetX - 4, 71 + 48 * fall * fall, 8, 8)
          }
        }
        if (time >= 7.6 && !reduced) {
          const death = Math.min(1, (time - 7.6) / 1)
          ctx.save(); ctx.globalAlpha = 1 - death
          for (let i = 0; i < 9; i++) { const a = i * Math.PI * 2 / 9; ctx.fillStyle = i % 2 ? '#ffe08a' : '#84603e'; ctx.fillRect(Math.round(targetX + Math.cos(a) * death * 35), Math.round(110 + Math.sin(a) * death * 25), 5, 5) }
          ctx.restore()
        }
        ctx.fillStyle = '#493620'; ctx.font = '20px VT323'
        ctx.fillText(chapter === 3 && time > 2.8 ? '$95 available  |  $5 ' + (time < 7.6 ? 'reserved' : 'position') : 'Example only  |  No orders are submitted', 48, 167)
      }
      if (!paused && !reduced) frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [art, chapter, paused, reduced, replay])
  return <section className="tutorial-demo" aria-label="Animated trading example">
    <header><strong>Training example</strong><div><button className="icon-button" aria-label={paused ? 'Play tutorial animation' : 'Pause tutorial animation'} disabled={reduced} onClick={() => setPaused(value => !value)}>{paused ? <Play size={16}/> : <Pause size={16}/>}</button><button className="icon-button" aria-label="Replay tutorial animation" disabled={reduced} onClick={() => { elapsed.current = 0; setPaused(false); setReplay(value => value + 1) }}><RotateCcw size={16}/></button></div></header>
    <canvas ref={canvas} width="560" height="180" role="img" aria-label={reduced ? 'A gold-outlined limit troop rests on the UP side; red troops represent opposing depth.' : 'Illustrated paper order placement, matching taker, and simulated fill.'}/>
    <p className="tutorial-demo-caption" aria-live={paused || reduced ? 'off' : 'polite'}>{CAPTIONS[chapter]?.[phase]}{reduced && ' Animation is paused for reduced motion.'}</p>
  </section>
}
