export const TROOP_KINDS = [
  { kind: 'scout', name: 'Dune Ranger', value: 25 },
  { kind: 'guard', name: 'Sand Guard', value: 100 },
  { kind: 'anchor', name: 'Rune Golem', value: 250 },
]
export const CARD_KINDS = [
  TROOP_KINDS[0], TROOP_KINDS[1],
  { kind: 'balloon', name: 'Sand Bomber', value: 20 },
  TROOP_KINDS[2],
]
export const BALLOON_KINDS = [
  { kind: 'balloon-small', size: 'small', name: 'Sand Bomber', value: 20 },
  { kind: 'balloon-medium', size: 'medium', name: 'Caravan Bomber', value: 100 },
  { kind: 'balloon-large', size: 'large', name: 'Siege Bomber', value: 500 },
]
export function balloonSizeFor(notional, values = {}) {
  return [...BALLOON_KINDS].reverse().find(item => Number(notional) >= Number(values[item.size] ?? item.value))?.size || 'small'
}
let pending
export function loadCharacterArt() {
  if (pending) return pending
  pending = new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const frames = { UP: {}, DOWN: {} }
      for (const [row, side] of ['UP', 'DOWN'].entries()) for (const [column, troop] of CARD_KINDS.entries()) {
        const canvas = document.createElement('canvas')
        canvas.width = 256; canvas.height = 256
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        ctx.imageSmoothingEnabled = false
        const cellWidth = image.width / 4, cellHeight = image.height / 2
        const scale = Math.min(256 / cellWidth, 256 / cellHeight)
        const width = cellWidth * scale, height = cellHeight * scale
        ctx.drawImage(image, column * cellWidth, row * cellHeight, cellWidth, cellHeight, (256 - width) / 2, (256 - height) / 2, width, height)
        // The generated atlas uses a chroma backdrop; remove it once during sprite loading.
        const pixels = ctx.getImageData(0, 0, 256, 256)
        for (let i = 0; i < pixels.data.length; i += 4) {
          const r = pixels.data[i], g = pixels.data[i + 1], b = pixels.data[i + 2]
          if (r > 125 && b > 105 && Math.min(r, b) - g > 65) pixels.data[i + 3] = 0
        }
        ctx.putImageData(pixels, 0, 0)
        frames[side][troop.kind] = canvas
      }
      const balloons = new Image()
      balloons.onload = () => {
        // Explicit atlas bounds keep the wide siege canopy inside its own frame.
        const columns = [[64, 290], [432, 484], [984, 552]]
        for (const [row, side] of ['UP', 'DOWN'].entries()) for (const [column, model] of BALLOON_KINDS.entries()) {
          const [left, width] = columns[column], canvas = document.createElement('canvas')
          canvas.width = 256; canvas.height = 256
          const ctx = canvas.getContext('2d', { willReadFrequently: true })
          ctx.imageSmoothingEnabled = false
          const scale = 240 / Math.max(width, 512), w = width * scale, h = 512 * scale
          ctx.drawImage(balloons, left * balloons.width / 1536, row * balloons.height / 2, width * balloons.width / 1536, balloons.height / 2, (256 - w) / 2, (256 - h) / 2, w, h)
          const pixels = ctx.getImageData(0, 0, 256, 256)
          for (let i = 0; i < pixels.data.length; i += 4) {
            const [r, g, b] = pixels.data.subarray(i, i + 3)
            if (Math.min(r, b) - g > 35) pixels.data[i + 3] = 0
          }
          ctx.putImageData(pixels, 0, 0); frames[side][model.kind] = canvas
        }
        frames.UP.balloon = frames.UP['balloon-small']; frames.DOWN.balloon = frames.DOWN['balloon-small']
        resolve(frames)
      }
      balloons.onerror = () => { pending = null; reject(new Error('Unable to load balloon artwork')) }
      balloons.src = '/assets/sand-balloon-roster.png'
    }
    image.onerror = () => { pending = null; reject(new Error('Unable to load troop artwork')) }
    image.src = '/assets/sand-troops-pixel.png'
  })
  return pending
}
