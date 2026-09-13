import { ARENA } from './frontline.js'

// All motion stays beyond the trading field, with a further buffer around actors.
export const AMBIENT_ZONES = {
  palmsNorth: { x: 0, y: 0, width: 250, height: 175 },
  palmsSouth: { x: 0, y: 725, width: 250, height: 175 },
  riverNorth: { x: 795, y: 0, width: 88, height: 150 },
  riverSouth: { x: 795, y: 750, width: 88, height: 150 },
  wind: { x: 10, y: 35, width: 220, height: 85 },
  windSouth: { x: 10, y: 765, width: 220, height: 85 },
  tumbleweed: { x: 1528, y: 35, width: 68, height: 260 },
}
export const ACTOR_CLEARANCE = 40
export function overlaps(a, b, padding = 0) {
  return a.x < b.x + b.width + padding && a.x + a.width > b.x - padding &&
    a.y < b.y + b.height + padding && a.y + a.height > b.y - padding
}
export function zoneIsClear(zone, actors) {
  return !actors.some(actor => overlaps(zone, actor, ACTOR_CLEARANCE))
}
export function palmOffset(x, y, time, zone) {
  // Stationary edge vertices keep the untouched background and walls seamless.
  const nx = (x - zone.x) / zone.width, ny = (y - zone.y) / zone.height
  if (nx <= .08 || nx >= .92 || ny <= .14 || ny >= .86) return { x: 0, y: 0 }
  const weight = Math.sin(nx * Math.PI) * Math.sin(ny * Math.PI)
  return { x: Math.round(Math.sin(time * 1.4 + y / 150) * 3 * weight), y: Math.round(Math.sin(time * .9 + x / 110) * weight) }
}
export const FIELD_RECT = { x: ARENA.left, y: ARENA.top, width: ARENA.right - ARENA.left, height: ARENA.bottom - ARENA.top }
// The exposed river occupies notches in the field outline, not playable land.
export const FIELD_REGIONS = [
  { x: 312, y: 78, width: 453, height: 744 },
  { x: 765, y: 181, width: 144, height: 539 },
  { x: 909, y: 78, width: 426, height: 744 },
]
export function isFoliage(r, g, b) { return g - r > 8 && g > b * 1.08 }
export function riverPosition(lane, index, time) {
  return { x: 806 + lane * 22, y: ((index * 92 + lane * 31 + Math.floor(time * 10) * 4) % 992) - 46 }
}
export function tumbleweedPosition(t) {
  const z = AMBIENT_ZONES.tumbleweed
  return { x: z.x + z.width / 2 + Math.round(Math.sin(t * Math.PI * 8) * 3), y: z.y + 24 + t * (z.height - 48) }
}
