// Screen-space compass, clockwise from east. Four views support mirroring;
// north uses the mirrored variant when approached from the left.
export function golemFacing(dx, dy) {
  const octant = (Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8
  const directions = ['e', 'se', 's', 'se', 'e', 'ne', 'n', 'ne']
  return { direction: directions[octant], mirror: octant >= 3 && octant <= 5 || octant === 6 && dx < 0 }
}

export function animateGolem(unit, dx, dy, dt, moving) {
  if (Math.hypot(dx, dy) > .001) unit.facing = golemFacing(dx, dy)
  unit.walkTime = moving ? unit.walkTime + dt : 0
  const frame = moving ? Math.floor(unit.walkTime * 8) % 4 : 0
  unit.s.texture = unit.golem.animations[unit.facing.direction][frame]
  unit.s.scale.x = Math.abs(unit.s.scale.x) * (unit.facing.mirror ? -1 : 1)
}
