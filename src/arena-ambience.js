import { Container, Graphics, MeshPlane } from 'pixi.js'
import { ARENA } from './frontline.js'
import { AMBIENT_ZONES, palmOffset, zoneIsClear } from './ambience-layout.js'

export function createAmbience(texture) {
  const scene = new Container({ label: 'peripheral-scenery', eventMode: 'none', interactiveChildren: false })
  const background = new MeshPlane({ texture, verticesX: 37, verticesY: 65 })
  background.scale.set(ARENA.height / texture.width, ARENA.width / texture.height)
  background.rotation = Math.PI / 2
  background.x = ARENA.width
  scene.addChild(background)
  const buffer = background.geometry.getBuffer('aPosition')
  const rest = buffer.data.slice()
  const movingVertices = []
  for (let i = 0; i < rest.length; i += 2) {
    const x = Math.round(ARENA.width - rest[i + 1] / texture.height * ARENA.width)
    const y = Math.round(rest[i] / texture.width * ARENA.height)
    for (const name of ['palmsNorth', 'palmsSouth']) {
      const zone = AMBIENT_ZONES[name]
      if (x > zone.x && x < zone.x + zone.width && y > zone.y && y < zone.y + zone.height) movingVertices.push({ i, x, y, name })
    }
  }
  const effects = new Graphics({ label: 'scenery-pixels', eventMode: 'none' })
  const clip = new Graphics()
  for (const name of ['riverNorth', 'riverSouth', 'wind', 'tumbleweed']) {
    const z = AMBIENT_ZONES[name]
    clip.rect(z.x, z.y, z.width, z.height).fill('#fff')
  }
  effects.mask = clip
  scene.addChild(effects, clip)
  let previousFrame = -1
  function tick(time, getActors, reduced) {
    const frame = reduced ? 0 : Math.floor(time * 10)
    if (frame === previousFrame) return
    previousFrame = frame
    const actors = getActors()
    const clear = Object.fromEntries(Object.entries(AMBIENT_ZONES).map(([key, z]) => [key, zoneIsClear(z, actors)]))
    for (const vertex of movingVertices) {
      const d = !reduced && clear[vertex.name] ? palmOffset(vertex.x, vertex.y, time, AMBIENT_ZONES[vertex.name]) : { x: 0, y: 0 }
      buffer.data[vertex.i] = rest[vertex.i] + d.y * texture.width / ARENA.height
      buffer.data[vertex.i + 1] = rest[vertex.i + 1] - d.x * texture.height / ARENA.width
    }
    buffer.update()
    effects.clear()
    if (reduced) return
    // Short, looping foam streaks stay in the exposed river ends, not the bridge.
    for (const name of ['riverNorth', 'riverSouth']) if (clear[name]) {
      const z = AMBIENT_ZONES[name]
      for (let row = 0; row < 3; row++) for (let stripe = 0; stripe < 4; stripe++) {
        const x = z.x + ((stripe * 27 + frame * 2 + row * 9) % (z.width + 20)) - 16
        const y = z.y + 3 + row * 10
        effects.rect(x, y, 12, 2).rect(x + 9, y - 2, 5, 2).fill({ color: row % 2 ? '#d1f4cf' : '#46e0e3', alpha: .55 })
      }
    }
    const gust = time % 19
    if (clear.wind && gust > 5 && gust < 8.5) {
      const t = (gust - 5) / 3.5, z = AMBIENT_ZONES.wind
      for (let i = 0; i < 3; i++) {
        const x = Math.round(z.x - 65 + t * (z.width + 120) - i * 17), y = z.y + 19 + i * 17
        effects.rect(x, y, 36, 2).rect(x + 34, y - 2, 12, 2).rect(x + 44, y - 4, 6, 2).fill({ color: '#fff3c7', alpha: Math.sin(t * Math.PI) * .55 })
      }
    }
    const roll = time % 24
    if (clear.tumbleweed && roll > 9 && roll < 16) {
      const t = (roll - 9) / 7, z = AMBIENT_ZONES.tumbleweed
      const x = z.x + 12 + t * (z.width - 24), y = z.y + 16 - Math.abs(Math.sin(t * Math.PI * 8)) * 3
      const phase = Math.floor(t * 24) * Math.PI / 6
      const twigs = [[-3,-3],[-1,-4],[1,-4],[3,-3],[4,-1],[4,1],[3,3],[1,4],[-1,4],[-3,3],[-4,1],[-4,-1],[-2,-1],[0,-2],[2,-1],[-1,1],[1,2],[0,0]]
      for (const [i, [dx, dy]] of twigs.entries()) {
        const px = Math.round((x + (dx * Math.cos(phase) - dy * Math.sin(phase)) * 2) / 2) * 2
        const py = Math.round((y + (dx * Math.sin(phase) + dy * Math.cos(phase)) * 2) / 2) * 2
        effects.rect(px, py, 3, 3).fill({ color: i % 3 ? '#8e6739' : '#c69d56', alpha: Math.min(1, t * 10, (1 - t) * 10) })
      }
    }
  }
  return { scene, tick }
}
