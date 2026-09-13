import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
const browser=await chromium.launch({channel:'msedge',headless:true})
try {
  const page=await browser.newPage({viewport:{width:1440,height:960}}), errors=[]
  page.on('pageerror',e=>errors.push(e.message))
  await page.goto('http://127.0.0.1:5174/')
  const result=await page.evaluate(async()=>{
    const {createBattle}=await import('/src/battle.js')
    document.querySelector('#root').style.display='none'
    const host=document.createElement('div');host.style.cssText='width:1280px;height:720px';document.body.appendChild(host)
    const market={marketId:'load-test',slug:'load-test',feedStatus:'live',bidUp:49,askUp:50,bidDown:50,askDown:51,endTime:new Date(Date.now()+300000).toISOString(),participantNotional:{priceBand:1,values:{scout:25,guard:100,anchor:250}}}
    const book=size=>({UP:{bids:Array.from({length:490},(_,i)=>({price:(490-i)/1000,size:size+i})),asks:Array.from({length:500},(_,i)=>({price:(500+i)/1000,size:size+i}))},DOWN:{bids:Array.from({length:500},(_,i)=>({price:(500-i)/1000,size:size+i})),asks:Array.from({length:490},(_,i)=>({price:(510+i)/1000,size:size+i}))}})
    market.book=book(800)
    const game=await createBattle(host,()=>{},{market})
    const samples=[],frames=[];let active=true,last=performance.now()
    const frame=now=>{frames.push(now-last);last=now;if(active)requestAnimationFrame(frame)};requestAnimationFrame(frame)
    for(let i=0;i<60;i++){
      market.book=book(i%3===0?100:800)
      market.trades=Array.from({length:8},(_,j)=>({id:`${i}-${j}`,side:j%2?'UP':'DOWN',direction:'SELL',price:j%2?.49:.50,size:50+j*25,notional:25+j*12}))
      const start=performance.now();game.setMarket({market:{...market}});samples.push(performance.now()-start)
      await new Promise(r=>setTimeout(r,80))
    }
    await new Promise(r=>setTimeout(r,3500));active=false
    const canvas=host.querySelector('canvas'),metrics={maxUpdate:Math.max(...samples),meanUpdate:samples.reduce((a,b)=>a+b)/samples.length,longFrames:frames.filter(t=>t>150).length,frames:frames.length,bombs:canvas.dataset.bombsDropped,consumed:canvas.dataset.troopsConsumed,scene:canvas.dataset.sceneObjects}
    game.destroy();host.remove();return metrics
  })
  assert.deepEqual(errors,[])
  assert.ok(result.frames>30,'The animation loop must remain responsive')
  assert.ok(Number(result.scene)<300,'Transient effects must drain after a burst')
  console.log(JSON.stringify(result))
} finally {await browser.close()}
