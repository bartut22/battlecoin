import { Application, Assets, Container, Graphics, Sprite, Texture, Rectangle } from 'pixi.js'
import { animateGolem } from './golem.js'
import { groundSegmentClear, groundWaypoint } from './navigation.js'
import { createTerritory, spawnPositions } from './territory.js'
import { GRID_X, GRID_Y, gridCell, selectableCell, smoothSnap } from './placement-grid.js'

export const CARDS = [
  { name: 'Knight', kind: 'knight', cost: 3, hp: 550, damage: 100, speed: 35 },
  { name: 'Balloon', kind: 'balloon', cost: 5, hp: 720, damage: 230, speed: 23 },
  { name: 'Guards', kind: 'knight', cost: 3, hp: 260, damage: 60, speed: 43, count: 3 },
  { name: 'Fireball', kind: 'fireball', cost: 4 },
]
const W = 450
const VIEW_W = 1600, VIEW_H = 900, MAP_HEIGHT = 910
const SX = VIEW_W / MAP_HEIGHT, SY = VIEW_H / W
// Rotate the tactical map: blue defends the left, red defends the right.
const project = (x, y) => ({ x: VIEW_W - y * SX, y: x * SY })
const place = (object, x, y) => { const p = project(x, y); object.position.set(p.x, p.y); object.zIndex = p.y }
export async function createBattle(host, onChange) {
  const app = new Application()
  await app.init({ width: VIEW_W, height: VIEW_H, antialias: true, resolution: Math.min(devicePixelRatio, 2), autoDensity: true, background: '#254b3a' })
  host.appendChild(app.canvas)
  let textures
  try { textures = await Promise.all([Assets.load('/assets/arena.jpg'), Assets.load('/assets/characters.png'), Assets.load('/assets/golem_green.json'), Assets.load('/assets/golem_red.json'), Assets.load('/assets/green_balloon_shaded.png'), Assets.load('/assets/red_balloon_shaded.png')]) }
  catch (error) { app.destroy(true, { children: true }); throw error }
  const background = new Sprite(textures[0]); background.width = VIEW_H; background.height = VIEW_W; background.rotation = Math.PI / 2; background.x = VIEW_W; app.stage.addChild(background)
  const atlas = textures[1]
  const parts = {}
  // Each generated illustration occupies one atlas cell. Frame the visible art tightly.
  const frames = { redTower: [0.03, .04, .27, .43], blueTower: [.355, .04, .27, .43], redKing: [.637, .02, .357, .455], blueKing: [.008, .495, .353, .47], balloon: [.365, .493, .287, .47], knight: [.663, .54, .33, .435] }
  for (const [name, f] of Object.entries(frames)) parts[name] = new Texture({ source: atlas.source, frame: new Rectangle(f[0] * atlas.width, f[1] * atlas.height, f[2] * atlas.width, f[3] * atlas.height) })
  parts.greenBalloon = textures[4]
  parts.redBalloon = textures[5]
  const towerFiles = {
    blueKing: 'tower_primary_green.png', blueTower: 'tower_secondary_green.png',
    redKing: 'tower_primary_red.png', redTower: 'tower_secondary_red.png',
  }
  const customTowers = new Set()
  // Each standalone PNG independently replaces its legacy atlas frame.
  // Missing files keep the existing art until the replacement is uploaded.
  const towerEntries = Object.entries(towerFiles)
  const towerAssets = await Promise.allSettled(towerEntries.map(([, file]) => Assets.load(`/assets/${file}`)))
  towerAssets.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      const [name] = towerEntries[index]
      parts[name] = result.value; customTowers.add(name)
    }
  })
  const shadows = new Container(); app.stage.addChild(shadows)
  const field = new Container(); field.sortableChildren = true; app.stage.addChild(field)
  const effects = new Container(); effects.position.set(VIEW_W, 0); effects.rotation = Math.PI / 2; effects.scale.set(SY, SX); app.stage.addChild(effects)
  const guide = new Graphics(); guide.eventMode = 'none'; app.stage.addChild(guide)
  const placement = new Container(); placement.eventMode = 'none'; placement.visible = false; app.stage.addChild(placement)
  const cellHighlight = new Graphics(), ghost = new Sprite(), tooltip = new Graphics()
  ghost.anchor.set(.5, 1); ghost.alpha = .65
  placement.addChild(cellHighlight, ghost, tooltip)
  let hoveredCell = null, pointer = null
  let selected = -1, elixir = 5, time = 136, elapsed = 0, enemyClock = 0, ended = false, message = '', messageUntil = 0
  const crowns = [0, 0], troops = [], particles = []
  let lastUi = 0
  const territory = createTerritory()
  function sprite(kind, x, y, width) {
    const s = new Sprite(parts[kind]); s.anchor.set(.5, 1); s.width = width * 1.5; s.scale.y = s.scale.x; place(s, x, y); field.addChild(s); return s
  }
  function addTower(x, y, team, king = false) {
    const kind = king ? (team ? 'redKing' : 'blueKing') : (team ? 'redTower' : 'blueTower')
    const s = sprite(kind, x, y, (king ? 82 : 59) * 1.4)
    if (!customTowers.has(kind)) s.scale.y *= .8
  }
  // Decorative towers sit beyond the arena end walls at map y 140 / 745.
  addTower(225, 65, 1, true); addTower(111, 105, 1); addTower(337, 105, 1)
  addTower(111, 805, 0); addTower(337, 805, 0); addTower(225, 850, 0, true)
  function spawn(card, x, y, team) {
    for (const { x: px } of spawnPositions(card, x, y)) {
      const golem = card.kind === 'knight' ? textures[team ? 3 : 2] : null
      const s = golem ? new Sprite(golem.animations.e[0]) : sprite(team ? 'redBalloon' : 'greenBalloon', px, y, 57 * 1.2)
      // Keep the display size independent of source resolution.
      if (golem) { s.anchor.set(.5, 1); s.scale.set(91.8 / s.texture.height); place(s, px, y); field.addChild(s) }
      const shadow = new Graphics().ellipse(0, 0, card.kind === 'balloon' ? 18 : 10, 5).fill({ color: '#243823', alpha: .3 }); shadows.addChild(shadow)
      const unit = { ...card, x: px, y, team, s, shadow, golem, walkTime: 0, facing: { direction: 'e', mirror: !!team }, max: card.hp, cooldown: 0, phase: Math.random() * 6 }
      if (golem) animateGolem(unit, team ? -1 : 1, 0, 0, false)
      if (card.kind === 'balloon') s.y -= 30
      place(shadow, px, y); shadow.y -= 10; shadow.scale.set(1.5)
      troops.push(unit)
    }
  }
  function burst(x, y, color, count = 13) {
    for (let i = 0; i < count; i++) {
      const g = new Graphics().circle(0, 0, 2 + Math.random() * 4).fill(color); g.position.set(x, y); effects.addChild(g)
      particles.push({ g, vx: (Math.random() - .5) * 130, vy: -Math.random() * 120, life: .5 + Math.random() * .5 })
    }
  }
  function damage(target, amount) {
    if (!Number.isFinite(target.hp) || target.hp <= 0) return
    target.hp -= amount; burst(target.x, target.y - 15, '#ffe5a3', 4)
    if (target.hp <= 0) {
      burst(target.x, target.y, '#baaa82', 24); target.s.visible = false

    }
  }
  const flash = (value) => { message = value; messageUntil = elapsed + 1.7; publish() }
  function publish() { onChange({ selected, elixir, time: Math.ceil(time), crowns: [...crowns], ended, message }) }
  function placementError(cell) {
    if (!cell || selected < 0 || ended) return 'Deploy inside the walls'
    if (!selectableCell(cell)) return 'Choose a tile away from the paths and river'
    const card = CARDS[selected], team = territory.teamAt(cell.x, cell.y)
    if (elixir < card.cost) return 'Not enough elixir'
    if (team === null) return 'Deploy inside the walls'
    if (card.kind !== 'fireball') {
      const positions = spawnPositions(card, cell.x, cell.y)
      if (positions.some(p => territory.teamAt(p.x, p.y) !== team)) return 'Keep the whole troop group inside the area'
      if (card.kind === 'knight' && positions.some(p => !groundSegmentClear(p, p))) return 'Golems must deploy on land or a bridge'
    }
    return ''
  }
  function previewAt(x, y) {
    pointer = { x, y }
    const cell = gridCell(x, y)
    if (placementError(cell)) { placement.visible = false; hoveredCell = null; return }
    const team = territory.teamAt(cell.x, cell.y), region = territory.regions.find(r => r.team === team)
    const card = CARDS[selected], center = project(cell.x, cell.y)
    if (!placement.visible) placement.position.set(center.x, center.y)
    placement.visible = true; hoveredCell = cell
    const width = (cell.bottom - cell.top) * SX, height = (cell.right - cell.left) * SY
    cellHighlight.clear().rect(-width / 2, -height / 2, width, height).fill({ color: region.outline, alpha: .35 }).stroke({ color: region.outline, width: 3 })
    ghost.visible = card.kind !== 'fireball'
    if (ghost.visible) {
      ghost.texture = card.kind === 'knight' ? textures[team ? 3 : 2].animations.e[0] : parts[team ? 'redBalloon' : 'greenBalloon']
      ghost.scale.set(card.kind === 'knight' ? 91.8 / ghost.texture.height : 102.6 / ghost.texture.width)
      if (card.kind === 'knight' && team) ghost.scale.x *= -1
      ghost.y = card.kind === 'balloon' ? -30 : 0
    }
    // Intentionally blank: a tooltip shell for future placement information.
    tooltip.clear().roundRect(-42, -118, 84, 28, 7).fill({ color: '#14251e', alpha: .88 }).stroke({ color: region.outline, width: 2 })
  }
  function drawDeploymentAreas() {
    guide.clear()
    if (selected < 0) return
    for (const region of territory.regions) {
      if (region.bottom <= region.top) continue
      for (let col = 0; col < GRID_X.length - 1; col++) for (let row = 0; row < GRID_Y.length - 1; row++) {
        const cell = gridCell((GRID_X[col] + GRID_X[col + 1]) / 2, (GRID_Y[row] + GRID_Y[row + 1]) / 2)
        if (!selectableCell(cell)) continue
        const top = Math.max(cell.top, region.top), bottom = Math.min(cell.bottom, region.bottom)
        if (bottom <= top) continue
        const corner = project(cell.left, bottom)
        guide.rect(corner.x, corner.y, (bottom - top) * SX, (cell.right - cell.left) * SY)
          .fill({ color: region.fill, alpha: .28 })
          .stroke({ color: region.outline, width: 1.5, alpha: .85, alignment: 1 })
      }
    }
  }
  function select(index, force = false) {
    if (ended) return
    selected = index === selected && !force ? -1 : index
    placement.visible = false; hoveredCell = null; pointer = null
    drawDeploymentAreas()
    publish()
  }
  function deploy(event) {
    if (ended || selected < 0) return
    const cell = gridCell(event.global.y / SY, (VIEW_W - event.global.x) / SX)
    const error = placementError(cell)
    if (error) { flash(error); return }
    const { x, y } = cell, card = CARDS[selected], team = territory.teamAt(x, y)
    if (card.kind === 'fireball') {
      burst(x, y, '#ff982e', 65)
      for (const target of troops) if (target.team !== team && Math.hypot(target.x - x, target.y - y) < 85) damage(target, 650)
    } else spawn(card, x, y, team)
    elixir -= card.cost; selected = -1; guide.clear(); placement.visible = false; hoveredCell = null; publish()
  }
  app.stage.eventMode = 'static'; app.stage.hitArea = new Rectangle(0, 0, VIEW_W, VIEW_H); app.stage.on('pointerdown', deploy)
  app.stage.on('pointermove', event => previewAt(event.global.y / SY, (VIEW_W - event.global.x) / SX))
  app.stage.on('pointerleave', () => { pointer = null; hoveredCell = null; placement.visible = false })
  function clientPoint(clientX, clientY) {
    const rect = app.canvas.getBoundingClientRect()
    return { x: (clientX - rect.left) * VIEW_W / rect.width, y: (clientY - rect.top) * VIEW_H / rect.height }
  }
  spawn(CARDS[1], 337, 451, 1); spawn(CARDS[2], 334, 475, 0)
  app.ticker.add(ticker => {
    const dt = Math.min(ticker.deltaMS / 1000, .05)
    elapsed += dt
    if (pointer && selected >= 0) previewAt(pointer.x, pointer.y)
    if (ended || selected < 0) placement.visible = false
    if (placement.visible && hoveredCell) {
      const target = project(hoveredCell.x, hoveredCell.y)
      placement.x = smoothSnap(placement.x, target.x, dt)
      placement.y = smoothSnap(placement.y, target.y, dt)
    }
    if (!ended) {
      time = Math.max(0, time - dt); elixir = Math.min(10, elixir + dt / 1.5); enemyClock += dt
      if (time === 0) ended = true
      if (enemyClock > 8) { enemyClock = 0; spawn(Math.random() > .55 ? CARDS[1] : CARDS[0], Math.random() > .5 ? 111 : 337, 307, 1) }
      for (const u of troops) {
        if (u.hp <= 0) continue
        u.cooldown -= dt
        const previousX = u.x, previousY = u.y
        // Troops defend and fight; decorative towers are never targets.
        const targets = troops.filter(v => v.team !== u.team && v.hp > 0)
        targets.sort((a, b) => Math.hypot(a.x - u.x, a.y - u.y) - Math.hypot(b.x - u.x, b.y - u.y))
        const target = targets[0]; if (!target) { if (u.golem) animateGolem(u, 0, 0, dt, false); continue }
        const distance = Math.hypot(target.x - u.x, target.y - u.y)
        if (distance < 23) {
          if (u.cooldown <= 0) { damage(target, u.damage); u.cooldown = u.kind === 'balloon' ? 1.7 : .85 }
        } else {
          const waypoint = u.golem ? groundWaypoint(u, target) : target
          const dx = waypoint.x - u.x, dy = waypoint.y - u.y
          const length = Math.hypot(dx, dy) || 1
          const step = Math.min(u.speed * dt, length)
          u.x += dx / length * step; u.y += dy / length * step
        }
        if (u.golem) {
          const moving = Math.hypot(u.x - previousX, u.y - previousY) > .001
          const dx = moving ? u.x - previousX : target.x - u.x
          const dy = moving ? u.y - previousY : target.y - u.y
          animateGolem(u, -dy * SX, dx * SY, dt, moving)
        }
        place(u.s, u.x, u.y)
        if (u.kind === 'balloon') { u.s.y += -30 + Math.sin(elapsed * 7 + u.phase) * 2; u.s.zIndex += 80 }
        place(u.shadow, u.x, u.y); u.shadow.y -= 10; u.shadow.scale.set(1.5)
      }
      for (let i = troops.length - 1; i >= 0; i--) if (troops[i].hp <= 0) { troops[i].s.destroy(); troops[i].shadow.destroy(); troops.splice(i, 1) }
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]; p.life -= dt; p.g.x += p.vx * dt; p.g.y += p.vy * dt; p.vy += 160 * dt; p.g.alpha = Math.max(0, p.life)
      if (p.life <= 0) { p.g.destroy(); particles.splice(i, 1) }
    }
    if (message && elapsed > messageUntil) message = ''
    if (elapsed - lastUi > .1) { publish(); lastUi = elapsed }
  })
  publish()
  return {
    select,
    dragStart(index) { select(index, true) },
    dragMove(x, y) { const p = clientPoint(x, y); previewAt(p.y / SY, (VIEW_W - p.x) / SX) },
    dragEnd(x, y) {
      const p = clientPoint(x, y)
      deploy({ global: p })
      select(-1)
    },
    dragCancel() { select(-1) },
    // Future game-state logic can move the line through this single entry point.
    // No automatic shifting is enabled yet.
    setTerritoryBoundary(value) { territory.setBoundary(value); drawDeploymentAreas() },
    destroy() { app.destroy(true, { children: true }) },
  }
}

