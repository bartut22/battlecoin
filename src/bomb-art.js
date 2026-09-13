let pending
export function loadBombArt() {
  if (pending) return pending
  pending = new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const source = document.createElement('canvas'); source.width = source.height = 128
      const ctx = source.getContext('2d', { willReadFrequently: true }); ctx.imageSmoothingEnabled = false
      ctx.drawImage(image, 0, 0, 128, 128)
      const pixels = ctx.getImageData(0, 0, 128, 128)
      let left = 128, top = 128, right = 0, bottom = 0
      for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
        const i = (y * 128 + x) * 4, d = pixels.data
        if (Math.min(d[i], d[i + 2]) - d[i + 1] > 40) d[i + 3] = 0
        if (d[i + 3]) { left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y) }
      }
      ctx.putImageData(pixels, 0, 0)
      const result = document.createElement('canvas'); result.width = right - left + 1; result.height = bottom - top + 1
      result.getContext('2d').drawImage(source, left, top, result.width, result.height, 0, 0, result.width, result.height)
      resolve(result)
    }
    image.onerror = () => { pending = null; reject(new Error('Unable to load bomb artwork')) }
    image.src = '/assets/bomb-pixel.png'
  })
  return pending
}
