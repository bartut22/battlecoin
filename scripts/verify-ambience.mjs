import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
const browser=await chromium.launch({channel:'msedge',headless:true})
try {
  const page=await browser.newPage({viewport:{width:1600,height:900}}), errors=[]
  page.on('pageerror',e=>errors.push(e.message))
  await page.goto('http://127.0.0.1:5174/')
  const result=await page.evaluate(async()=>{
    const pixiUrl=performance.getEntriesByType('resource').find(entry=>new URL(entry.name).pathname.endsWith('/pixi__js.js')).name
    const {Application,Assets,Rectangle}=await import(pixiUrl)
    const {createAmbience}=await import('/src/arena-ambience.js')
    const {AMBIENT_ZONES,FIELD_REGIONS,isFoliage}=await import('/src/ambience-layout.js')
    document.querySelector('#root').style.display='none'
    const app=new Application();await app.init({width:1600,height:900,resolution:1,antialias:false})
    document.body.appendChild(app.canvas)
    const texture=await Assets.load('/assets/arena-pixel-grounded.png');texture.source.scaleMode='nearest'
    const ambience=createAmbience(texture);app.stage.addChild(ambience.scene)
    const pixels=()=>app.renderer.extract.pixels({target:app.stage,frame:new Rectangle(0,0,1600,900)}).pixels
    const capture=(time,actors=[],reduced=false)=>{ambience.tick(time,()=>actors,reduced);app.render();return pixels()}
    const first=capture(0),leafFrame=capture(2.5),second=capture(6.5),third=capture(12)
    const count=(a,b,rect)=>{
      let changed=0
      for(let y=rect.y;y<rect.y+rect.height;y++)for(let x=rect.x;x<rect.x+rect.width;x++){
        const i=(y*1600+x)*4;if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2])changed++
      }
      return changed
    }
    const differences=Object.fromEntries(Object.entries(AMBIENT_ZONES).map(([name,z])=>[name,count(first,name==='tumbleweed'?third:second,z)]))
    const fieldChange=FIELD_REGIONS.reduce((n,r)=>n+count(first,third,r),0)
    let rockChanges=0,leafChanges=0
    for(const name of ['palmsNorth','palmsSouth']){
      const z=AMBIENT_ZONES[name]
      for(let y=z.y;y<z.y+z.height;y++)for(let x=z.x;x<z.x+z.width;x++){
        const i=(y*1600+x)*4
        if(first[i]!==leafFrame[i]||first[i+1]!==leafFrame[i+1]||first[i+2]!==leafFrame[i+2]){
          if(isFoliage(first[i],first[i+1],first[i+2]))leafChanges++;else rockChanges++
        }
      }
    }
    const allActors=[{x:0,y:0,width:1600,height:900}],blocked=capture(12.2,allActors)
    const still=capture(15,[],true),stillLater=capture(20,[],true)
    const blockedDifference=count(blocked,still,{x:0,y:0,width:1600,height:900})
    const reducedDifference=count(still,stillLater,{x:0,y:0,width:1600,height:900})
    capture(12.5)
    window.ambientApp=app
    return {differences,fieldChange,rockChanges,leafChanges,blockedDifference,reducedDifference,eventMode:ambience.scene.eventMode}
  })
  assert.ok(Object.values(result.differences).every(value=>value>0),JSON.stringify(result))
  assert.equal(result.fieldChange,0,'Ambient animation must not touch field pixels')
  assert.equal(result.rockChanges,0,'Rocks and other non-foliage pixels must remain still')
  assert.ok(result.leafChanges>0,'Foliage must still move')
  assert.equal(result.blockedDifference,0,'Actors must suppress effects inside their clearance')
  assert.equal(result.reducedDifference,0)
  assert.equal(result.eventMode,'none')
  await page.screenshot({path:'artifacts/ambient-scenery.png'})
  await page.evaluate(()=>window.ambientApp.destroy(true,{children:true}))
  assert.deepEqual(errors,[])
  console.log(JSON.stringify(result))
} finally {await browser.close()}
