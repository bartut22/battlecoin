import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
const browser=await chromium.launch({channel:'msedge',headless:true})
try {
 const page=await browser.newPage({viewport:{width:1440,height:960}})
 await page.addInitScript(()=>{localStorage.setItem('battlecoin_session','test');localStorage.setItem('battlecoin-market-arena-tutorial-v2','1')})
 const now=Date.now(),start=Math.floor(now/300000)*300000
 await page.route('**/gamma/markets/slug/*',route=>{
  const slug=route.request().url().split('/').pop()
  return route.fulfill({json:{slug,active:true,conditionId:'fixture-market',outcomes:'["Up","Down"]',clobTokenIds:'["up","down"]',question:'BTC test market'}})
 })
 const books={up:{bids:[{price:'.34',size:String(300/.34)}],asks:[{price:'.36',size:'1000'}]},down:{bids:[{price:'.64',size:'1000'}],asks:[{price:'.66',size:'1000'}]}}
 await page.route('**/clob/book?*',route=>route.fulfill({json:{...books[new URL(route.request().url()).searchParams.get('token_id')],timestamp:String(Date.now())}}))
 let ws
 await page.routeWebSocket('wss://ws-subscriptions-clob.polymarket.com/ws/market',socket=>{
  ws=socket;socket.onMessage(message=>{if(message==='PING')socket.send('PONG')})
 })
 await page.goto('http://127.0.0.1:5174/?verify=orders')
 await page.getByText('Live Polymarket',{exact:true}).waitFor()
 await page.locator('.outcome.positive strong').filter({hasText:'35c'}).waitFor()
 await page.getByRole('button',{name:'Ranger $5.00',exact:true}).click()
 const arena=await page.locator('.canvas-host canvas').boundingBox()
 await page.mouse.click(arena.x+arena.width*.25,arena.y+arena.height*.48)
 await page.getByRole('button',{name:/Cancel O-/}).waitFor()
 await page.getByText('$95.00',{exact:true}).waitFor()
 assert.equal(await page.locator('.positions-panel tbody tr td').nth(1).innerText(),'34c')
 await page.screenshot({path:'artifacts/arena-own-order.png',fullPage:true})
 await page.getByRole('button',{name:/Cancel O-/}).click()
 await page.getByText('$100.00',{exact:true}).waitFor()
 assert.equal(await page.getByRole('button',{name:/Cancel O-/}).count(),0)
 ws.send(JSON.stringify({event_type:'book',asset_id:'up',timestamp:String(Date.now()+100),bids:[{price:'.44',size:String(300/.44)}],asks:[{price:'.46',size:'1000'}]}))
 await page.locator('.outcome.positive strong').filter({hasText:'45c'}).waitFor()
 await page.screenshot({path:'artifacts/arena-price-transition.png',fullPage:true})
 await page.getByRole('button',{name:'Balloon $20.00',exact:true}).click()
 await page.mouse.click(arena.x+arena.width*.32,arena.y+arena.height*.5)
 await page.getByText('$80.00',{exact:true}).waitFor()
 await page.waitForFunction(()=>Number(document.querySelector('.canvas-host canvas').dataset.bombsDropped)>0)
 await page.screenshot({path:'artifacts/arena-bomb-drop.png',fullPage:true})
 await page.getByRole('button',{name:'Positions',exact:true}).click()
 await page.getByRole('button',{name:/Close P-/}).waitFor()
 await page.getByRole('button',{name:/Close P-/}).click()
 assert.equal(await page.getByRole('button',{name:/Close P-/}).count(),0)
 console.log('Verified 35% ->45% live update, own order placement, cancellation refund, taker fill, position close.')
} finally { await browser.close() }
