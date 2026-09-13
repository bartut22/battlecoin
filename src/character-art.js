export const TROOP_KINDS = [
  { kind: 'scout', name: 'Ranger', value: 25 },
  { kind: 'guard', name: 'Guardian', value: 100 },
  { kind: 'anchor', name: 'Crystal Golem', value: 500 },
]
let pending
export function loadCharacterArt() {
  if (pending) return pending
  pending = new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const frames = { UP: {}, DOWN: {} }
      for (const [row, side] of ['UP', 'DOWN'].entries()) for (const [column, troop] of TROOP_KINDS.entries()) {
        const canvas = document.createElement('canvas')
        canvas.width = 256; canvas.height = 256
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        ctx.drawImage(image, column * image.width / 3, row * image.height / 2, image.width / 3, image.height / 2, 0, 0, 256, 256)
        // The generated atlas uses a chroma backdrop; remove it once during sprite loading.
        const pixels = ctx.getImageData(0, 0, 256, 256)
        for (let i = 0; i < pixels.data.length; i += 4) {
          const r = pixels.data[i], g = pixels.data[i + 1], b = pixels.data[i + 2]
          if (r > 125 && b > 105 && Math.min(r, b) - g > 65) pixels.data[i + 3] = 0
        }
        ctx.putImageData(pixels, 0, 0)
        frames[side][troop.kind] = canvas
      }
      resolve(frames)
    }
    image.onerror = () => { pending = null; reject(new Error('Unable to load troop artwork')) }
    image.src = '/assets/troop-roster-keyed.png'
  })
  return pending
}
