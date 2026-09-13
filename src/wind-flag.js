import { MeshPlane, Texture } from 'pixi.js'
import { flagOffset } from './flag-motion.js'

export function createWindFlag(art, side, phase = 0) {
  const texture = Texture.from(art.canvas); texture.source.scaleMode = 'nearest'
  const mesh = new MeshPlane({ texture, verticesX: 25, verticesY: 33, eventMode: 'none' })
  mesh.pivot.set(art.anchorX * 192, art.anchorY * 256)
  mesh.scale.set(142 / 256)
  const buffer = mesh.geometry.getBuffer('aPosition'), rest = buffer.data.slice(), cloth = []
  for (let i = 0; i < rest.length; i += 2) {
    const x = rest[i], y = rest[i + 1]
    if ((side === 'UP' ? x > 84 : x < 108) && y >= 36 && y <= 112) cloth.push(i)
  }
  let last = -1
  return { mesh, tick(time, reduced) {
    const frame = reduced ? -2 : Math.floor(time * 12)
    if (last === frame) return
    last = frame
    for (const i of cloth) {
      const offset = reduced ? { x: 0, y: 0 } : flagOffset(rest[i], rest[i + 1], side, time + phase)
      buffer.data[i] = rest[i] + offset.x; buffer.data[i + 1] = rest[i + 1] + offset.y
    }
    buffer.update()
  } }
}
