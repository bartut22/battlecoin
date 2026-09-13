import { ARENA } from './frontline.js'

// All motion stays beyond the trading field, with a further buffer around actors.
export const AMBIENT_ZONES = {
  palmsNorth: { x: 0, y: 0, width: 250, height: 175 },
  palmsSouth: { x: 0, y: 725, width: 250, height: 175 },
  riverNorth: { x: 795, y: 0, width: 88, height: 30 },
  riverSouth: { x: 795, y: 870, width: 88, height: 30 },
  wind: { x: 10, y: 35, width: 220, height: 85 },
  tumbleweed: { x: 1390, y: 864, width: 200, height: 30 },
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
