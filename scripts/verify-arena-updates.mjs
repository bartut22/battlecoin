import { chromium, expect } from '@playwright/test'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'

const browser=await chromium.launch({channel:'msedge',headless:true})
const errors=[]
try {
  await mkdir('artifacts',{recursive:true})
  const page=await browser.newPage({viewport:{width:1440,height:960}})
  page.on('pageerror',error=>errors.push(error.message))
  await page.clock.install({time:new Date('2026-09-12T18:01:00Z')})
  await page.addInitScript(()=>{
    localStorage.setItem('battlecoin_session',JSON.stringify({username:'Arena test'}))
    localStorage.setItem('battlecoin-market-arena-tutorial-v2','1')
  })
  const books={
    up:{bids:[{price:'.34',size:String(75/.34)}],asks:[{price:'.36',size:'1000'}]},
    down:{bids:[{price:'.64',size:String(75/.64)}],asks:[{price:'.66',size:'1000'}]},
  }
  for(const [outcome,offset] of [['up',.34],['down',.64]]){
    for(let i=1;i<8;i++){
      books[outcome].bids.push({price:String(Number((offset-i*.01).toFixed(2))),size:String(180+i*17)})
      books[outcome].asks.push({price:String(Number((offset+.02+i*.01).toFixed(2))),size:String(100+i*19)})
    }
  }
  await page.route('**/gamma/markets/slug/*',route=>{
    const slug=route.request().url().split('/').pop()
    return route.fulfill({json:{slug,active:true,conditionId:slug,outcomes:'["Up","Down"]',clobTokenIds:'["up","down"]',question:'Bitcoin Up or Down - 5 minutes',priceToBeat:77214.61}})
  })
  await page.route('**/clob/book?*',route=>route.fulfill({json:books[new URL(route.request().url()).searchParams.get('token_id')]}))
  await page.route('**/poly/api/**',route=>route.fulfill({json:{openPrice:77214.61}}))
  await page.routeWebSocket('wss://ws-live-data.polymarket.com',socket=>socket.onMessage(message=>{if(message==='PING')socket.send('PONG')}))
  let ws
  await page.routeWebSocket('wss://ws-subscriptions-clob.polymarket.com/ws/market',socket=>{
    ws=socket;socket.onMessage(message=>{if(message==='PING')socket.send('PONG')})
  })
  await page.goto('http://127.0.0.1:5174/?verify=arena-updates')
  await expect(page.locator('.feed-status')).toHaveText('Live market')
  await expect(page.locator('.outcome.positive strong')).toHaveText('35c')
  await page.waitForFunction(()=>document.querySelector('.canvas-host canvas')?.dataset.frontX)
  await page.evaluate(()=>document.fonts.ready)
  assert.ok(await page.evaluate(()=>document.fonts.check('600 20px "Pixelify Sans"')))
  assert.match(await page.locator('.outcome strong').first().evaluate(el=>getComputedStyle(el).fontFamily),/Pixelify Sans/)
  assert.equal(await page.locator('.market-rollover').count(),0)
  const arena=await page.locator('.canvas-host canvas').boundingBox()
  await page.getByRole('button',{name:'Dune Ranger $5.00',exact:true}).click()
  await page.mouse.move(arena.x+arena.width*.39,arena.y+arena.height*.48)
  await page.screenshot({path:'artifacts/pixel-hover.png',fullPage:true})
  await page.mouse.click(arena.x+arena.width*.39,arena.y+arena.height*.48)
  await expect(page.getByRole('button',{name:/Cancel O-/})).toHaveCount(1)
  await expect(page.locator('.positions-panel tbody tr td').nth(1)).toHaveText('34c')
  ws.send(JSON.stringify({event_type:'last_trade_price',asset_id:'up',side:'SELL',price:'.34',size:String(25/.34),transaction_hash:'full-hit'}))
  await page.waitForFunction(()=>Number(document.querySelector('.canvas-host canvas').dataset.troopsConsumed)>=2)
  await page.screenshot({path:'artifacts/pixel-full-hit.png',fullPage:true})
  await expect(page.getByRole('button',{name:/Cancel O-/})).toHaveCount(0)
  ws.send(JSON.stringify({event_type:'last_trade_price',asset_id:'down',side:'SELL',price:'.64',size:String(5/.64),transaction_hash:'partial-hit'}))
  await page.waitForFunction(()=>Number(document.querySelector('.canvas-host canvas').dataset.partialHits)>0)
  for(const price of [0,1]){
    ws.send(JSON.stringify({event_type:'book',asset_id:'up',bids:[{price:String(price),size:'100'}],asks:[{price:String(price),size:'100'}]}))
    await expect(page.locator('.outcome.positive strong')).toHaveText(price*100+'c')
    await page.waitForFunction(expected=>Math.abs(Number(document.querySelector('.canvas-host canvas').dataset.frontX)-expected)<.1,price===0?312:1335)
    await page.screenshot({path:`artifacts/pixel-${price*100}c.png`,fullPage:true})
  }
  await page.clock.setSystemTime(new Date('2026-09-12T18:05:01Z'))
  await expect(page.locator('.market-rollover')).toBeVisible({timeout:20000})
  assert.equal(await page.locator('.modal-backdrop').count(),0)
  await page.getByRole('button',{name:'My cards',exact:true}).click()
  await expect(page.getByRole('spinbutton',{name:'Dune Ranger notional'})).toBeVisible()
  await page.screenshot({path:'artifacts/pixel-rollover.png',fullPage:true})
  await page.getByRole('button',{name:'Dismiss new market notification'}).click()
  await expect(page.locator('.market-rollover')).toHaveCount(0)
  await page.getByRole('spinbutton',{name:'Dune Ranger notional',exact:true}).fill('7')
  await page.getByRole('button',{name:'Dune Ranger $7.00',exact:true}).click()
  await page.mouse.click(arena.x+arena.width*.39,arena.y+arena.height*.48)
  await expect(page.locator('.capital-title b')).toHaveText('$88.00')
  await page.getByRole('button',{name:/Cancel O-/}).click()
  await expect(page.locator('.capital-title b')).toHaveText('$95.00')
  await page.getByRole('spinbutton',{name:'Dune Ranger notional',exact:true}).fill('5')
  await page.getByRole('button',{name:'Sand Bomber $20.00',exact:true}).click()
  await page.mouse.click(arena.x+arena.width*.39,arena.y+arena.height*.48)
  await expect(page.locator('.capital-title b')).toHaveText('$75.00')
  await page.getByRole('button',{name:'Positions',exact:true}).click()
  await expect(page.getByRole('button',{name:/Close P-/})).toHaveCount(1)
  await page.getByRole('button',{name:/Close P-/}).click()
  await expect(page.locator('.capital-title b')).toHaveText('$93.89')
  await page.getByRole('button',{name:'History',exact:true}).click()
  await expect(page.locator('.positions-panel tbody')).toContainText('closed')
  await page.getByRole('button',{name:/^Open orders/}).click()
  await page.getByRole('button',{name:'Settings',exact:true}).click()
  await page.getByRole('button',{name:'2c',exact:true}).click()
  await page.getByRole('spinbutton',{name:'Rune Golem market unit value',exact:true}).fill('500')
  await page.screenshot({path:'artifacts/pixel-settings.png',fullPage:true})
  await page.getByRole('button',{name:'1c',exact:true}).click()
  await page.getByRole('spinbutton',{name:'Rune Golem market unit value',exact:true}).fill('250')
  await page.getByRole('button',{name:'Open account menu'}).click()
  await expect(page.getByRole('button',{name:'Log out',exact:true})).toBeVisible()
  await page.screenshot({path:'artifacts/pixel-account.png',fullPage:true})
  await page.getByRole('button',{name:'Close sidebar'}).click()
  await page.getByRole('button',{name:'Tutorial',exact:true}).click()
  await page.screenshot({path:'artifacts/pixel-tutorial.png',fullPage:true})
  await page.getByRole('button',{name:'Enter arena',exact:true}).click()
  await page.getByRole('button',{name:'Book',exact:true}).click()
  const layouts=[]
  for(const viewport of [{width:1920,height:1080},{width:1440,height:960},{width:1024,height:768},{width:768,height:1024},{width:390,height:844}]){
    await page.setViewportSize(viewport)
    await page.screenshot({path:`artifacts/pixel-layout-${viewport.width}.png`,fullPage:true})
    const canvasPng=(await page.locator('.canvas-host canvas').screenshot()).toString('base64')
    const layout=await page.evaluate(async png=>{
      const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right}}
      const canvas=new Image();canvas.src='data:image/png;base64,'+png;await canvas.decode()
      const sample=document.createElement('canvas');sample.width=160;sample.height=90
      const ctx=sample.getContext('2d');ctx.drawImage(canvas,0,0,160,90)
      const pixels=ctx.getImageData(0,0,160,90).data
      const colors=new Set();for(let i=0;i<pixels.length;i+=4)colors.add(`${pixels[i]},${pixels[i+1]},${pixels[i+2]}`)
      return {arena:box('.arena'),deck:box('.deck-bar'),portfolio:box('.positions-panel'),overflow:document.documentElement.scrollWidth>innerWidth,colors:colors.size}
    },canvasPng)
    assert.ok(layout.arena.bottom<=layout.deck.top+1)
    assert.ok(layout.deck.bottom<=layout.portfolio.top+1)
    assert.equal(layout.overflow,false)
    assert.ok(layout.colors>100,'Arena canvas must contain rendered artwork')
    layouts.push({viewport,...layout})
  }
  assert.deepEqual(errors,[])
  console.log(JSON.stringify({verified:['pixel font','bid hover and placement','full and partial troop hits','0c / 100c','nonmodal rollover','editable cards','cancel refund','taker fill and close','PnL history','settings','account panel','tutorial','responsive layout','nonblank canvas'],layouts}))
} finally { await browser.close() }
