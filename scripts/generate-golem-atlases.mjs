import { readFileSync, writeFileSync } from 'node:fs'

// The supplied sheets have uneven row spacing. Keep a common 110x90
// canvas and foot baseline instead of dividing the image into equal cells.
const rows = { s: 34, se: 134, e: 242, ne: 347, n: 469 }
for (const color of ['green', 'red']) {
  // Read each PNG independently: the two team sheets can have different sizes.
  const png = readFileSync(new URL(`../public/assets/golem_walk_${color}.png`, import.meta.url))
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20)
  const sx = width / 441, sy = height / 565
  const w = Math.round(110 * sx), h = Math.round(90 * sy)
  const frames = {}, animations = {}
  for (const [direction, y] of Object.entries(rows)) {
    animations[direction] = []
    for (let i = 0; i < 4; i++) {
      const name = `${direction}_${i}`
      animations[direction].push(name)
      const frame = { x: Math.round(i * 110 * sx), y: Math.round(y * sy), w, h }
      if (frame.x + w > width || frame.y + h > height) throw new Error(`${color}: ${name} exceeds the sheet`)
      frames[name] = { frame, rotated: false, trimmed: false,
        spriteSourceSize: { x: 0, y: 0, w, h }, sourceSize: { w, h } }
    }
  }
  writeFileSync(new URL(`../public/assets/golem_${color}.json`, import.meta.url), JSON.stringify({
    frames, animations, meta: { image: `golem_walk_${color}.png`, format: 'RGBA8888', size: { w: width, h: height }, scale: '1' },
  }, null, 2) + '\n')
}
