import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
const browser=await chromium.launch({channel:'msedge',headless:true})
try {
  const page=await browser.newPage({viewport:{width:800,height:460}}),errors=[]
  page.on('pageerror',e=>errors.push(e.message))
  await page.goto('http://127.0.0.1:5174/')
  const metrics=await page.evaluate(async()=>{
    const pixiUrl=performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname.endsWith('/pixi__js.js')).name
    const {Application,Texture,Graphics,Rectangle}=await import(pixiUrl)
    const {loadArenaFlags}=await import('/src/arena-flags.js'),{createWindFlag}=await import('/src/wind-flag.js')
    const {loadBombArt}=await import('/src/bomb-art.js'),{createBombVisual,drawBombImpact}=await import('/src/bomb-visuals.js')
    document.querySelector('#root').style.display='none'
    const app=new Application();await app.init({width:800,height:460,resolution:1,background:'#d2b277'});document.body.appendChild(app.canvas)
    const art=await loadArenaFlags(), flags=['UP','DOWN'].map((side,i)=>{
      const flag=createWindFlag(art[side],side);flag.mesh.scale.set(1);flag.mesh.position.set(20+i*560+art[side].anchorX*192,40+art[side].anchorY*256);app.stage.addChild(flag.mesh);return flag
    })
    const get=()=>app.renderer.extract.pixels({target:app.stage,frame:new Rectangle(0,0,800,460)}).pixels
    flags.forEach(f=>f.tick(0,false));const first=get()
    flags.forEach(f=>f.tick(.9,false));const second=get()
    const diff=(a,b,r)=>{let n=0;for(let y=r.y;y<r.y+r.height;y++)for(let x=r.x;x<r.x+r.width;x++){const i=(y*800+x)*4;if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2])n++}return n}
    const cloth=['UP','DOWN'].map((s,i)=>diff(first,second,{x:20+i*560,y:70,width:192,height:100}))
    const poles=['UP','DOWN'].map((s,i)=>diff(first,second,{x:20+i*560+(i?112:64),y:156,width:20,height:95}))
    const bases=['UP','DOWN'].map((s,i)=>diff(first,second,{x:20+i*560,y:242,width:192,height:54}))
    flags.forEach(f=>f.tick(2,true));const reduced=get();flags.forEach(f=>f.tick(5,true))
    const still=diff(reduced,get(),{x:0,y:0,width:800,height:460})
    const bombArt=await loadBombArt(),data=bombArt.getContext('2d').getImageData(0,0,bombArt.width,bombArt.height).data
    let magenta=0,visible=0;for(let i=0;i<data.length;i+=4)if(data[i+3]){visible++;if(Math.min(data[i],data[i+2])-data[i+1]>40)magenta++}
    const texture=Texture.from(bombArt);texture.source.scaleMode='nearest'
    for(const [i,own] of [false,true].entries()) {const bomb=createBombVisual(texture,own);bomb.root.position.set(325+i*140,128);bomb.root.scale.set(2);bomb.update(.4,false);app.stage.addChild(bomb.root)}
    const snapshots=[]
    for(let i=0;i<3;i++) {const g=new Graphics();g.position.set(250+i*150,305);drawBombImpact(g,[.1,.38,.72][i],true,false);app.stage.addChild(g);snapshots.push(g)}
    const hitEarly=get();snapshots.forEach(g=>drawBombImpact(g,.9,true,false));const impactChange=diff(hitEarly,get(),{x:200,y:230,width:400,height:130})
    snapshots.forEach((g,i)=>drawBombImpact(g,[.1,.38,.72][i],true,false));app.render()
    window.demoApp=app
    return {cloth,poles,bases,still,visible,magenta,impactChange}
  })
  assert.ok(metrics.cloth.every(n=>n>100),JSON.stringify(metrics))
  assert.ok(metrics.poles.every(n=>n===0)&&metrics.bases.every(n=>n===0),JSON.stringify(metrics))
  assert.equal(metrics.still,0);assert.equal(metrics.magenta,0);assert.ok(metrics.visible>500);assert.ok(metrics.impactChange>100)
  await page.screenshot({path:'artifacts/flag-bomb-art-check.png'})
  await page.evaluate(()=>window.demoApp.destroy(true,{children:true}))
  assert.deepEqual(errors,[])
  console.log(JSON.stringify(metrics))
} finally {await browser.close()}
