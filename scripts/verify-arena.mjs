import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
const browser = await chromium.launch({channel:'msedge',headless:true})
const page = await browser.newPage({viewport:{width:1440,height:960}})
const errors=[]
page.on('pageerror',e=>errors.push(e.message))
await page.addInitScript(()=>{
 localStorage.setItem('battlecoin_session','visual-test')
 localStorage.setItem('battlecoin-market-arena-tutorial-v2','1')
})
await page.goto('http://127.0.0.1:5174/?verify=arena')
await page.waitForSelector('canvas')
await page.getByText('Live Polymarket',{exact:true}).waitFor({timeout:45000})
await mkdir('artifacts',{recursive:true})
await page.screenshot({path:'artifacts/arena-desktop.png',fullPage:true})
const rects=await page.evaluate(()=>{
 const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}}
 return {arena:box('.arena'),portfolio:box('.positions-panel'),rail:box('.control-rail'),deck:box('.deck-bar'),overflow:document.documentElement.scrollWidth>innerWidth}
})
if(rects.arena.bottom>rects.deck.y+1||rects.deck.bottom>rects.portfolio.y+1||rects.arena.right>rects.rail.x+1||rects.overflow)throw Error('Layout overlap: '+JSON.stringify(rects))
await page.getByRole('button',{name:'Deposit $100',exact:true}).click()
await page.getByText('$200.00',{exact:true}).waitFor()
await page.getByRole('button',{name:'My cards',exact:true}).click()
await page.getByRole('spinbutton',{name:'Ranger notional',exact:true}).fill('7')
await page.getByRole('button',{name:'Ranger $7.00',exact:true}).waitFor()
await page.getByRole('button',{name:'Participants',exact:true}).click()
await page.getByRole('spinbutton',{name:'Ranger market unit value'}).fill('25')
await page.getByText('12 UP characters',{exact:true}).waitFor()
await page.getByRole('combobox',{name:'UP depth character',exact:true}).selectOption('guard')
await page.getByText('3 UP characters',{exact:true}).waitFor()
await page.getByRole('spinbutton',{name:'Guardian market unit value',exact:true}).fill('50')
await page.getByText('6 UP characters',{exact:true}).waitFor()
const alpha=await page.evaluate(async()=>{
 const {loadCharacterArt}=await import('/src/character-art.js')
 const frames=await loadCharacterArt()
 return Object.values(frames.UP).map(c=>{
  const pixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data
  let clear=0,solid=0
  for(let i=3;i<pixels.length;i+=4){if(pixels[i]===0)clear++;if(pixels[i]===255)solid++}
  return {clear,solid}
 })
})
if(alpha.some(frame=>frame.clear<10000||frame.solid<10000))throw Error('Character silhouette alpha validation failed')
await page.screenshot({path:'artifacts/arena-settings.png',fullPage:true})
await page.setViewportSize({width:390,height:844})
await page.screenshot({path:'artifacts/arena-mobile.png',fullPage:true})
if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Mobile overflow')
console.log(JSON.stringify({layout:rects,errors,verified:['live websocket','deposit','editable cards','300/25 =12','desktop/mobile layout']}))
await browser.close()
if(errors.length)process.exitCode=1
