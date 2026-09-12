import { Application, Assets, Container, Graphics, Sprite, Texture, Rectangle, Text } from 'pixi.js'

export const CARDS = [
  { name: 'Knight', kind: 'knight', cost: 3, hp: 550, damage: 100, speed: 35 },
  { name: 'Balloon', kind: 'balloon', cost: 5, hp: 720, damage: 230, speed: 23 },
  { name: 'Guards', kind: 'knight', cost: 3, hp: 260, damage: 60, speed: 43, count: 3 },
  { name: 'Fireball', kind: 'fireball', cost: 4 },
]
const W = 450, RIVER = 424
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
  try { textures = await Promise.all([Assets.load('/assets/arena.jpg'), Assets.load('/assets/characters.png')]) }
  catch (error) { app.destroy(true, { children: true }); throw error }
  const background = new Sprite(textures[0]); background.width = VIEW_H; background.height = VIEW_W; background.rotation = Math.PI / 2; background.x = VIEW_W; app.stage.addChild(background)
  const atlas = textures[1]
  const parts = {}
  // Each generated illustration occupies one atlas cell. Frame the visible art tightly.
  const frames = { redTower: [0.03, .04, .27, .43], blueTower: [.355, .04, .27, .43], redKing: [.637, .02, .357, .455], blueKing: [.008, .495, .353, .47], balloon: [.365, .493, .287, .47], knight: [.663, .54, .33, .435] }
  for (const [name, f] of Object.entries(frames)) parts[name] = new Texture({ source: atlas.source, frame: new Rectangle(f[0] * atlas.width, f[1] * atlas.height, f[2] * atlas.width, f[3] * atlas.height) })
  const shadows = new Container(); app.stage.addChild(shadows)
  const field = new Container(); field.sortableChildren = true; app.stage.addChild(field)
  const effects = new Container(); effects.position.set(VIEW_W, 0); effects.rotation = Math.PI / 2; effects.scale.set(SY, SX); app.stage.addChild(effects)
  const guide = new Graphics(); guide.position.set(VIEW_W, 0); guide.rotation = Math.PI / 2; guide.scale.set(SY, SX); app.stage.addChild(guide)
  let selected = -1, elixir = 5, time = 136, elapsed = 0, enemyClock = 0, ended = false, message = '', messageUntil = 0
  const crowns = [0, 0], towers = [], troops = [], particles = []
  let lastUi = 0
  const text = (value, size = 14) => new Text({ text: value, style: { fontFamily: 'Arial, sans-serif', fontSize: size, fontWeight: '900', fill: '#ffffff', stroke: { color: '#30321d', width: 3 } } })
  function sprite(kind, x, y, width) {
    const s = new Sprite(parts[kind]); s.anchor.set(.5, 1); s.width = width * 1.5; s.scale.y = s.scale.x; place(s, x, y); field.addChild(s); return s
  }
  function addTower(x, y, team, king = false) {
    const s = sprite(king ? (team ? 'redKing' : 'blueKing') : (team ? 'redTower' : 'blueTower'), x, y, king ? 82 : 59)
    s.scale.y *= .8
    const hp = king ? 3600 : team && x < 200 ? 2629 : 2512
    const bar = new Container(); const meter = new Graphics(); const label = text(String(hp), 12); label.anchor.set(.5, 1); label.y = -3
    bar.addChild(meter, label); const position = project(x, y); bar.position.set(position.x, position.y - s.height + 6); bar.scale.set(1.4); bar.zIndex = position.y + 1; field.addChild(bar)
    const level = text('12', 11); level.style.fill = '#ffdf57'; level.position.set(-36, -15); bar.addChild(level)
    if (king) bar.visible = false
    const t = { x, y: y - 23, team, hp, max: hp, s, bar, meter, label, king, cooldown: 0 }
    towers.push(t); drawHealth(t); return t
  }
  function drawHealth(t) {
    t.meter.clear().roundRect(-27, -2, 54, 7, 2).fill('#302e24').roundRect(-26, -1, 52 * Math.max(0, t.hp / t.max), 5, 1).fill(t.team ? '#f36b76' : '#50baff')
    t.label.text = String(Math.max(0, Math.ceil(t.hp)))
  }
  addTower(225, 211, 1, true); addTower(111, 285, 1); addTower(337, 285, 1)
  addTower(111, 666, 0); addTower(337, 666, 0); addTower(225, 748, 0, true)
  function spawn(card, x, y, team) {
    for (let i = 0; i < (card.count || 1); i++) {
      const px = x + i * 17 - ((card.count || 1) - 1) * 8
      const s = sprite(card.kind, px, y, card.kind === 'balloon' ? 57 : 27)
      if (team && card.kind !== 'balloon') s.tint = '#ffad9b'
      const shadow = new Graphics().ellipse(0, 0, card.kind === 'balloon' ? 18 : 10, 5).fill({ color: '#243823', alpha: .3 }); shadows.addChild(shadow)
      troops.push({ ...card, x: px, y, team, s, shadow, max: card.hp, cooldown: 0, phase: Math.random() * 6, crossed: team ? y > RIVER + 28 : y < RIVER - 28 })
    }
  }
  function burst(x, y, color, count = 13) {
    for (let i = 0; i < count; i++) {
      const g = new Graphics().circle(0, 0, 2 + Math.random() * 4).fill(color); g.position.set(x, y); effects.addChild(g)
      particles.push({ g, vx: (Math.random() - .5) * 130, vy: -Math.random() * 120, life: .5 + Math.random() * .5 })
    }
  }
  function damage(target, amount) {
    if (target.hp <= 0) return
    target.hp -= amount; burst(target.x, target.y - 15, '#ffe5a3', 4)
    if (target.bar) { drawHealth(target); target.bar.visible = true }
    if (target.hp <= 0) {
      burst(target.x, target.y, '#baaa82', 24); target.s.visible = false
      if (target.bar) {
        target.bar.visible = false; crowns[1 - target.team] += target.king ? 3 - crowns[1 - target.team] : 1
        if (target.king) ended = true
      }
    }
  }
  const flash = (value) => { message = value; messageUntil = elapsed + 1.7; publish() }
  function publish() { onChange({ selected, elixir, time: Math.ceil(time), crowns: [...crowns], ended, message }) }
  function select(index) {
    if (ended) return
    selected = index === selected ? -1 : index
    guide.clear()
    if (selected >= 0) {
      const spell = CARDS[selected].kind === 'fireball'
      guide.rect(29, spell ? 135 : RIVER + 28, 392, spell ? 665 : 345).fill({ color: '#77d9ff', alpha: .07 }).stroke({ color: '#a3eaff', width: 2, alpha: .55 })
    }
    publish()
  }
  function deploy(event) {
    if (ended || selected < 0) return
    const x = event.global.y / SY, y = (VIEW_W - event.global.x) / SX
    const card = CARDS[selected]
    if (elixir < card.cost) { flash('Not enough elixir'); return }
    if (x < 28 || x > 422 || y < 135 || y > 800) { flash('Deploy inside the arena'); return }
    if (card.kind !== 'fireball' && y < RIVER + 28) { flash('Deploy on the left side of the river'); return }
    if (card.kind === 'fireball') {
      burst(x, y, '#ff982e', 65)
      for (const target of [...towers, ...troops]) if (target.team === 1 && Math.hypot(target.x - x, target.y - y) < 85) damage(target, target.bar ? 380 : 650)
    } else spawn(card, x, y, 0)
    elixir -= card.cost; selected = -1; guide.clear(); publish()
  }
  app.stage.eventMode = 'static'; app.stage.hitArea = new Rectangle(0, 0, VIEW_W, VIEW_H); app.stage.on('pointerdown', deploy)
  spawn(CARDS[1], 337, 451, 1); spawn(CARDS[2], 334, 475, 0)
  app.ticker.add(ticker => {
    const dt = Math.min(ticker.deltaMS / 1000, .05)
    elapsed += dt
    if (!ended) {
      time = Math.max(0, time - dt); elixir = Math.min(10, elixir + dt / 1.5); enemyClock += dt
      if (time === 0) ended = true
      if (enemyClock > 8) { enemyClock = 0; spawn(Math.random() > .55 ? CARDS[1] : CARDS[0], Math.random() > .5 ? 111 : 337, 307, 1) }
      for (const u of troops) {
        if (u.hp <= 0) continue
        u.cooldown -= dt
        const nearby = troops.filter(v => v.team !== u.team && v.hp > 0 && Math.hypot(v.x - u.x, v.y - u.y) < 60)
        const targets = u.kind === 'balloon' ? [] : nearby
        if (!targets.length) targets.push(...towers.filter(t => t.team !== u.team && t.hp > 0))
        targets.sort((a, b) => Math.hypot(a.x - u.x, a.y - u.y) - Math.hypot(b.x - u.x, b.y - u.y))
        const target = targets[0]; if (!target) continue
        const distance = Math.hypot(target.x - u.x, target.y - u.y)
        if (distance < (target.bar ? 43 : 23)) {
          if (u.cooldown <= 0) { damage(target, u.damage); u.cooldown = u.kind === 'balloon' ? 1.7 : .85 }
        } else {
          let tx = target.x, ty = target.y
          if (!u.crossed && u.kind !== 'balloon' && (u.team ? target.y > RIVER : target.y < RIVER)) {
            tx = u.x < W / 2 ? 111 : 337; ty = RIVER + (u.team ? 38 : -38)
            if (Math.abs(u.y - ty) < 5) u.crossed = true
          }
          const length = Math.hypot(tx - u.x, ty - u.y) || 1
          u.x += (tx - u.x) / length * u.speed * dt; u.y += (ty - u.y) / length * u.speed * dt
        }
        place(u.s, u.x, u.y); u.s.y += Math.sin(elapsed * 7 + u.phase) * 2; u.s.zIndex += u.kind === 'balloon' ? 80 : 0
        place(u.shadow, u.x, u.y); u.shadow.scale.set(1.5)
      }
      for (const t of towers) {
        t.cooldown -= dt
        if (t.hp <= 0) continue
        const target = troops.find(u => u.team !== t.team && u.hp > 0 && Math.hypot(u.x - t.x, u.y - t.y) < 145)
        if (target && t.cooldown <= 0) { damage(target, t.king ? 100 : 75); t.cooldown = 1; burst(target.x, target.y - 10, '#fff4ca', 3) }
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
  return { select, destroy() { app.destroy(true, { children: true }) } }
}

