export function flagOffset(x, y, side, time) {
  const free = side === 'UP' ? (x - 84) / 80 : (108 - x) / 80
  if (free <= 0 || y < 36 || y > 112) return { x: 0, y: 0 }
  const weight = Math.min(1, free) ** 1.3
  const wave = Math.sin(time * 2.7 - free * 4 + y / 48)
  return { x: Math.round(Math.cos(time * 1.9 - free * 3) * 2 * weight), y: Math.round(wave * 7 * weight) }
}
