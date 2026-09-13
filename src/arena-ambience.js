import { Container, Graphics, MeshPlane } from 'pixi.js'
import { ARENA } from './frontline.js'
import { AMBIENT_ZONES, isFoliage, palmOffset, riverPosition, tumbleweedPosition, zoneIsClear } from './ambience-layout.js'

export function createAmbience(texture) {
  const scene = new Container({ label: 'peripheral-scenery', eventMode: 'none', interactiveChildren: false })
  const background = new MeshPlane({ texture, verticesX: 91, verticesY: 161 })
  background.scale.set(ARENA.height / texture.width, ARENA.width / texture.height)
  background.rotation = Math.PI / 2
  background.x = ARENA.width
  scene.addChild(background)
  const buffer = background.geometry.getBuffer('aPosition')
  const rest = buffer.data.slice()
  const movingVertices = []
  // Only deform triangles whose entire neighborhood is foliage. Rocks, trunks,
  // sand and masonry remain fixed even when surrounded by moving leaves.
  const sample = document.createElement('canvas'); sample.width = ARENA.width; sample.height = ARENA.height
  const ctx = sample.getContext('2d', { willReadFrequently: true }); ctx.imageSmoothingEnabled = false
  ctx.translate(ARENA.width, 0); ctx.rotate(Math.PI / 2)
  ctx.drawImage(texture.source.resource, 0, 0, ARENA.height, ARENA.width)
  const colors = ctx.getImageData(0, 0, ARENA.width, ARENA.height).data
  const leafNeighborhood = (x,y) => {
    for(let dy=-13;dy<=13;dy++)for(let dx=-13;dx<=13;dx++) {
      const px=x+dx,py=y+dy
      if(px<0||px>=ARENA.width||py<0||py>=ARENA.height)return false
      const i=(py*ARENA.width+px)*4
      if(!isFoliage(colors[i],colors[i+1],colors[i+2]))return false
    }
    return true
  }
  for (let i = 0; i < rest.length; i += 2) {
    const x = Math.round(ARENA.width - rest[i + 1] / texture.height * ARENA.width)
    const y = Math.round(rest[i] / texture.width * ARENA.height)
    for (const name of ['palmsNorth', 'palmsSouth']) {
      const zone = AMBIENT_ZONES[name]
      if (x > zone.x && x < zone.x + zone.width && y > zone.y && y < zone.y + zone.height && leafNeighborhood(x,y)) movingVertices.push({ i, x, y, name })
    }
  }
  const effects = new Graphics({ label: 'scenery-pixels', eventMode: 'none' })
  const clip = new Graphics()
  for (const name of ['riverNorth', 'riverSouth', 'wind', 'windSouth', 'tumbleweed']) {
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
    // One vertical current continues under the bridge; only its exposed ends render.
    for (let lane=0;lane<3;lane++)for(let index=0;index<11;index++) {
      const {x,y}=riverPosition(lane,index,time)
      const name=y<181?'riverNorth':'riverSouth',z=AMBIENT_ZONES[name]
      if(!clear[name]||y+26<z.y||y>z.y+z.height)continue
      effects.rect(x,y,3,21).rect(x+3,y+15,3,11).fill({color:lane%2?'#caf3da':'#62e4e4',alpha:.52})
    }
    const gust = time % 19
    for(const name of ['wind','windSouth'])if (clear[name] && gust > 5 && gust < 8.5) {
      const t = (gust - 5) / 3.5, z = AMBIENT_ZONES[name]
      for (let i = 0; i < 3; i++) {
        const x = Math.round(z.x - 65 + t * (z.width + 120) - i * 17), y = z.y + 19 + i * 17
        effects.rect(x, y, 36, 2).rect(x + 34, y - 2, 12, 2).rect(x + 44, y - 4, 6, 2).fill({ color: '#fff3c7', alpha: Math.sin(t * Math.PI) * .55 })
      }
    }
    const roll = time % 24
    if (clear.tumbleweed && roll > 9 && roll < 16) {
      const t = (roll - 9) / 7
      const {x,y} = tumbleweedPosition(t)
      const phase = Math.floor(t * 24) * Math.PI / 6
      const twigs = [[-3,-3],[-1,-4],[1,-4],[3,-3],[4,-1],[4,1],[3,3],[1,4],[-1,4],[-3,3],[-4,1],[-4,-1],[-2,-1],[0,-2],[2,-1],[-1,1],[1,2],[0,0]]
      for (const [i, [dx, dy]] of twigs.entries()) {
        const px = Math.round((x + (dx * Math.cos(phase) - dy * Math.sin(phase)) * 4.5) / 2) * 2
        const py = Math.round((y + (dx * Math.sin(phase) + dy * Math.cos(phase)) * 4.5) / 2) * 2
        effects.rect(px, py, 5, 5).fill({ color: i % 3 ? '#8e6739' : '#d4ae69', alpha: Math.min(1, t * 10, (1 - t) * 10) })
      }
    }
  }
  return { scene, tick }
}
