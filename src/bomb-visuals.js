import { Container, Graphics, Sprite } from 'pixi.js'

export function createBombVisual(texture, own) {
  const root = new Container({ eventMode: 'none' }), trail = new Graphics(), body = new Container(), sprite = new Sprite(texture), fuse = new Graphics()
  sprite.anchor.set(.42, .68); sprite.height = 40; sprite.scale.x = sprite.scale.y
  if (own) for (const [x, y] of [[-2,0],[2,0],[0,-2],[0,2]]) {
    const gold = new Sprite(texture); gold.anchor.copyFrom(sprite.anchor); gold.scale.copyFrom(sprite.scale); gold.tint = 0xffda68; gold.position.set(x,y); body.addChild(gold)
  }
  body.addChild(sprite); root.addChild(trail, body, fuse)
  return { root, update(t, reduced) {
    body.rotation = reduced ? 0 : -.16 + t * .32
    trail.clear(); fuse.clear()
    if (reduced) return
    const frame = Math.floor(t * 16)
    for (let i = 0; i < 4; i++) trail.rect(-3 + (i % 2) * 4, -31 - i * 6, 3, 3).fill({ color: '#a3967c', alpha: .25 * (1 - i / 4) })
    const size = frame % 2 ? 3 : 2
    fuse.rect(14 + frame % 3, -24, size, size).rect(19, -29 + frame % 2, 2, 2).fill('#ffcf62')
  } }
}

export function drawBombImpact(g, t, full, reduced) {
  g.clear()
  if (reduced) {
    g.rect(-12, -3, 24, 6).rect(-3, -12, 6, 24).fill({ color: full ? '#f4c46c' : '#c99b54', alpha: (1-t)*.65 })
    return
  }
  const radius = (full ? 36 : 22), burst = Math.min(1, t / .25)
  if (t < .38) {
    const r = Math.round((8 + radius * burst * .55) / 4) * 4
    g.rect(-r,-r/2,r*2,r).rect(-r/2,-r,r,r*2).fill({ color:'#d66e37',alpha:1-t/.38 })
    g.rect(-r/2,-r/3,r,r*2/3).rect(-r/3,-r/2,r*2/3,r).fill({ color:'#ffdc7f',alpha:1-t/.38 })
  }
  for (let i=0;i<7;i++) {
    const angle=i*Math.PI*2/7, distance=radius*Math.min(1,t*2)
    const x=Math.round(Math.cos(angle)*distance/3)*3, y=Math.round((Math.sin(angle)*distance*.6-12*t)/3)*3
    const size=t<.35?4:3
    g.rect(x,y,size,size).fill({color:i%2?'#f0b95b':'#896547',alpha:(1-t)*.85})
  }
  if (t>.18) for (let i=0;i<3;i++) {
    const size=8+i*3, x=(i-1)*11+Math.round(Math.sin(i+t*4)*3), y=-10-Math.round(t*(15+i*7))
    g.rect(x-size/2,y,size,size).rect(x-size/2+3,y-3,size-6,3).fill({color:i%2?'#bca889':'#86796a',alpha:(1-t)*.4})
  }
}
