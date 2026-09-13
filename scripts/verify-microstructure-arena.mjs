import { chromium, expect } from '@playwright/test'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
const browser = await chromium.launch({channel:'msedge',headless:true})
const errors = []
try {
  await mkdir('artifacts',{recursive:true})
  const page = await browser.newPage({viewport:{width:1440,height:960}})
  const legacyAssets=[]
  page.on('request',request=>{if(/\/(green|red)_balloon_shaded\.png|\/golem_(green|red)\.json/.test(request.url()))legacyAssets.push(request.url())})
  page.on('pageerror',error=>errors.push(error.message))
  await page.clock.install({time:new Date('2026-09-13T18:01:00Z')})
  await page.addInitScript(()=>{
    localStorage.setItem('battlecoin_session',JSON.stringify({username:'Arena QA',wallet:{publicKey:'demo-wallet'}}))
    localStorage.setItem('battlecoin-market-arena-tutorial-v3','1')
  })
  // Isolate wallet actions from any real validator while checking the relocated controls.
  await page.route('**/src/solana.js*',route=>route.fulfill({contentType:'text/javascript',body:`
    export const SOL_USD_RATE=100, NETWORK_LABEL='test validator';
    export const getBalance=async()=>2;
    export const convertSolToCapital=async(wallet,amount)=>({balance:2-amount,usd:amount*100});
    export const airdrop=async()=>2,withdraw=async()=>1,createWallet=()=>({publicKey:'demo-wallet'});
  `}))
  const books = {
    up:{bids:[{price:.34,size:300}],asks:[{price:.36,size:100}]},
    down:{bids:[{price:.64,size:100}],asks:[{price:.66,size:300}]},
  }
  for(const [side,price] of [['up',.34],['down',.64]]) for(let i=1;i<8;i++) {
    books[side].bids.push({price:Number((price-i*.01).toFixed(2)),size:200+i*20})
    books[side].asks.push({price:Number((price+.02+i*.01).toFixed(2)),size:200+i*20})
  }
  await page.route('**/gamma/events/slug/*',route=>route.fulfill({status:404,body:'Not found'}))
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
  await page.goto('http://127.0.0.1:5174/?verify=microstructure')
  await expect(page.locator('.feed-status')).toHaveText('Live data')
  await expect(page.locator('.outcome.positive strong')).toHaveText('35.5\u00a2')
  await expect(page.locator('.outcome.negative strong')).toHaveText('64.5\u00a2')
  await expect(page.locator('.outcome.positive strong [role=img]')).toHaveAttribute('aria-label','cents')
  await expect(page.locator('.outcome.positive')).toHaveAttribute('title',/Microprice/)
  const canvas = page.locator('.canvas-host canvas')
  await page.waitForFunction(()=>Math.abs(Number(document.querySelector('.canvas-host canvas')?.dataset.frontX)-(312+1023*.355))<.1)
  assert.equal(await page.locator('.rail-footer').count(),0)
  const capital=await page.locator('.rail-top .capital').boundingBox(), tabs=await page.locator('.rail-tabs').boundingBox()
  assert.ok(capital.y+capital.height<=tabs.y+1)
  assert.equal(await page.locator('.deck-bar .capital,.deck-card small').count(),0)
  await expect(page.locator('.deck-group-balloon .deck-card')).toHaveCount(3)
  const army=await page.locator('.deck-group-limit').boundingBox(), air=await page.locator('.deck-group-balloon').boundingBox()
  assert.ok(air.x>=army.x+army.width)
  const portraits=await page.locator('.deck-group-balloon canvas').evaluateAll(canvases=>canvases.map(c=>{
    const data=c.getContext('2d').getImageData(0,0,c.width,c.height).data
    let visible=0,green=0,magenta=0
    for(let i=0;i<data.length;i+=4)if(data[i+3]>100){visible++;if(data[i+1]>data[i]*1.2&&data[i+1]>data[i+2]*1.2)green++;if(Math.min(data[i],data[i+2])-data[i+1]>65)magenta++}
    return {visible,green,magenta}
  }))
  assert.ok(portraits.every(p=>p.visible>1000&&p.green>100&&p.magenta===0),JSON.stringify(portraits))
  const getArena=()=>canvas.boundingBox()
  async function deploy(name){
    await page.getByRole('button',{name}).click()
    const r=await getArena();await page.mouse.click(r.x+r.width*.38,r.y+r.height*.5)
  }
  await deploy(/Dune Ranger, limit troop/)
  await expect(page.getByRole('button',{name:/Cancel O-/})).toHaveCount(1)
  await expect(page.locator('.positions-panel tbody')).toContainText('34\u00a2')
  ws.send(JSON.stringify({event_type:'last_trade_price',asset_id:'up',side:'SELL',price:'.34',size:String(100/.34),transaction_hash:'moving-full-hit'}))
  await page.waitForFunction(()=>document.querySelector('.canvas-host canvas')?.dataset.lastBalloonSize)
  // Move fair value during the approach: each bomb must follow the rendered troop.
  books.up.bids[0].size=400;books.down.asks[0].size=400
  for(const side of ['up','down'])ws.send(JSON.stringify({event_type:'book',asset_id:side,...books[side]}))
  await page.waitForFunction(()=>Number(document.querySelector('.canvas-host canvas').dataset.troopsConsumed)>=2)
  assert.equal(await canvas.getAttribute('data-last-impact-error'),'0')
  await page.screenshot({path:'artifacts/microstructure-death.png',fullPage:true})
  await expect(page.getByRole('button',{name:/Cancel O-/})).toHaveCount(0)
  const dropped=Number(await canvas.getAttribute('data-bombs-dropped'))
  ws.send(JSON.stringify({event_type:'last_trade_price',asset_id:'down',side:'SELL',price:'.64',size:String(5/.64),transaction_hash:'partial-hit'}))
  await page.waitForFunction(()=>Number(document.querySelector('.canvas-host canvas').dataset.partialHits)>0)
  assert.ok(Number(await canvas.getAttribute('data-bombs-dropped'))>dropped)
  await page.getByRole('button',{name:'My cards',exact:true}).click()
  await expect(page.locator('.card-setting small').filter({hasText:/^Taker order$/})).toHaveCount(3)
  await page.getByRole('spinbutton',{name:'Siege Bomber notional',exact:true}).fill('12')
  await deploy(/Siege Bomber, large taker balloon/)
  await expect(page.locator('.capital-title b')).toHaveText('$83.00')
  await page.waitForFunction(()=>document.querySelector('.canvas-host canvas').dataset.lastBalloonSize==='large')
  await page.getByRole('button',{name:'Short/DOWN',exact:true}).click()
  await page.screenshot({path:'artifacts/microstructure-red-cards.png',fullPage:true})
  await page.getByRole('button',{name:/Dune Ranger, limit troop/}).click()
  const downArena=await getArena()
  await page.mouse.click(downArena.x+downArena.width*.48,downArena.y+downArena.height*.5)
  await expect(page.getByRole('button',{name:/Cancel O-/})).toHaveCount(1)
  await page.getByRole('button',{name:/Cancel O-/}).click()
  await expect(canvas).toHaveAttribute('data-retreat-side','DOWN')
  await expect(canvas).toHaveAttribute('data-retreat-facing','1')
  await expect(canvas).toHaveAttribute('data-retreat-outline-aligned','true')
  await page.screenshot({path:'artifacts/short-retreat.png',fullPage:true})
  await page.getByRole('button',{name:'Long/UP',exact:true}).click()
  await deploy(/Dune Ranger, limit troop/)
  await page.getByRole('button',{name:/Cancel O-/}).click()
  await expect(canvas).toHaveAttribute('data-retreat-side','UP')
  await expect(canvas).toHaveAttribute('data-retreat-facing','-1')
  await expect(canvas).toHaveAttribute('data-retreat-outline-aligned','true')
  await page.getByRole('button',{name:'Settings',exact:true}).click()
  await page.getByRole('spinbutton',{name:'Siege Bomber public trade threshold'}).fill('75')
  await page.screenshot({path:'artifacts/microstructure-settings.png',fullPage:true})
  await page.getByRole('button',{name:'Tutorial',exact:true}).click()
  await expect(page.getByRole('dialog')).toContainText('Live trading is currently disabled')
  await page.getByRole('button',{name:/Your army/}).click()
  await expect(page.getByRole('dialog')).toContainText('Gold outlines')
  await expect(page.locator('.tutorial-demo canvas')).toBeVisible()
  await page.getByRole('button',{name:'Pause tutorial animation',exact:true}).click()
  const pausedImage=await page.locator('.tutorial-demo canvas').evaluate(c=>c.toDataURL())
  await page.clock.runFor(500)
  assert.equal(await page.locator('.tutorial-demo canvas').evaluate(c=>c.toDataURL()),pausedImage)
  await page.getByRole('button',{name:'Replay tutorial animation',exact:true}).click()
  await page.clock.runFor(700)
  const movingImage=await page.locator('.tutorial-demo canvas').evaluate(c=>c.toDataURL())
  await page.clock.runFor(2200)
  assert.notEqual(await page.locator('.tutorial-demo canvas').evaluate(c=>c.toDataURL()),movingImage)
  await page.screenshot({path:'artifacts/microstructure-tutorial.png',fullPage:true})
  await page.setViewportSize({width:390,height:844})
  await page.screenshot({path:'artifacts/tutorial-mobile.png',fullPage:true})
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
  await page.emulateMedia({reducedMotion:'reduce'})
  await expect(page.getByRole('button',{name:'Pause tutorial animation',exact:true})).toBeDisabled()
  await expect(page.locator('.tutorial-demo-caption')).toContainText('reduced motion')
  await page.emulateMedia({reducedMotion:'no-preference'})
  await page.setViewportSize({width:1440,height:960})
  await page.getByRole('checkbox',{name:"Don't show again"}).check()
  await page.getByRole('button',{name:'Close tutorial'}).click()
  assert.equal(await page.evaluate(()=>localStorage.getItem('battlecoin-market-arena-tutorial-v3')),'1')
  await page.getByRole('button',{name:'Open account menu'}).click()
  await expect(page.locator('.sidebar-capital')).toBeVisible()
  await page.getByRole('button',{name:'Convert (100/SOL)',exact:true}).click()
  await expect(page.locator('.capital-title b')).toHaveText('$93.00')
  await page.screenshot({path:'artifacts/microstructure-refill-menu.png',fullPage:true})
  const fontFamilies=await page.evaluate(()=>[...new Set([...document.querySelectorAll('.exchange *,.sidebar *')]
    .filter(el=>el instanceof HTMLElement&&[...el.childNodes].some(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim()))
    .map(el=>getComputedStyle(el).fontFamily))])
  assert.ok(fontFamilies.every(font=>font.includes('Pixelify Sans')||font.includes('VT323')),JSON.stringify(fontFamilies))
  assert.match(await page.locator('.outcome strong').first().evaluate(el=>getComputedStyle(el).fontFamily),/VT323/)
  assert.match(await page.locator('.outcome small').first().evaluate(el=>getComputedStyle(el).fontFamily),/Pixelify Sans/)
  await page.getByRole('button',{name:'Close sidebar'}).click()
  await page.getByRole('button',{name:'Book',exact:true}).click()
  await page.evaluate(()=>document.querySelector('.main-column').scrollTo(0,0))
  for(const viewport of [{width:1920,height:1080},{width:1440,height:960},{width:1024,height:768},{width:390,height:844}]) {
    await page.setViewportSize(viewport)
    await page.evaluate(()=>document.querySelector('.main-column').scrollTo(0,0))
    await page.screenshot({path:`artifacts/microstructure-${viewport.width}.png`,fullPage:true})
    const layout=await page.evaluate(()=>{
      const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return {top:r.top,bottom:r.bottom}}
      return {overflow:document.documentElement.scrollWidth>innerWidth,arena:box('.arena'),deck:box('.deck-bar'),portfolio:box('.positions-panel')}
    })
    assert.equal(layout.overflow,false)
    assert.ok(layout.arena.bottom<=layout.deck.top+1)
    assert.ok(layout.deck.bottom<=layout.portfolio.top+1)
  }
  assert.deepEqual(errors,[])
  assert.deepEqual(legacyAssets,[],'Legacy balloon assets must not block arena startup')
  console.log(JSON.stringify({verified:['microprice shared by display/front','three green/red balloon portraits','bid deployment','moving-target impacts','full death and partial hits','own large taker','editable sizes and thresholds','tutorial ownership and persistence','capital above book','refill in sidebar using mocked wallet','restored pixel numerals and cent images','both retreats face home with matching gold outlines','responsive layout'],portraits,fontFamilies}))
} finally { await browser.close() }
