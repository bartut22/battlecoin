import { Application, Assets, Container, Graphics, Sprite, Text, Rectangle, Texture } from 'pixi.js'
import { DEFAULT_CARD_VALUES, DEFAULT_MARKET, marketCoverage, notionalCharacters } from './market-engine.js'
import { createLedger } from './simulation.js'
import { loadCharacterArt } from './character-art.js'
import { bidRanks, bidAtPoint, frontX } from './frontline.js'
export const CARDS = DEFAULT_CARD_VALUES
const W=1600,H=900,LEFT=280,RIGHT=1355,TOP=110,BOTTOM=790
export async function createBattle(host,onChange,config={}) {
  const app=new Application()
  await app.init({width:W,height:H,antialias:true,resolution:Math.min(devicePixelRatio,2),autoDensity:true,background:'#345536'})
  host.appendChild(app.canvas)
  const resizeCanvas=()=>{
    const scale=Math.min(host.clientWidth/W,host.clientHeight/H)
    if(!Number.isFinite(scale)||scale<=0)return
    app.canvas.style.setProperty('width',`${W*scale}px`,'important')
    app.canvas.style.setProperty('height',`${H*scale}px`,'important')
  }
  const canvasResizeObserver=new ResizeObserver(resizeCanvas)
  canvasResizeObserver.observe(host)
  resizeCanvas()
  let assets
  try {assets=await Promise.all(['/assets/arena-sand-left-trees.png','/assets/golem_green.json','/assets/golem_red.json','/assets/green_balloon_shaded.png','/assets/red_balloon_shaded.png','/assets/tower_primary_green.png','/assets/tower_primary_red.png'].map(path=>Assets.load(path)))}
  catch(error){app.destroy(true,{children:true});throw error}
  const background=new Sprite(assets[0]);background.width=H;background.height=W;background.rotation=Math.PI/2;background.x=W;app.stage.addChild(background)
  let art
  try { art = await loadCharacterArt() } catch (error) { app.destroy(true,{children:true});throw error }
  const characterTextures = Object.fromEntries(['UP','DOWN'].map(side=>[side,Object.fromEntries(Object.entries(art[side]).map(([kind,canvas])=>{
    const texture=Texture.from(canvas);texture.source.scaleMode='nearest';return [kind,texture]
  }))]))
  const shade=new Graphics(),lines=new Graphics(),field=new Container(),labels=new Container(),preview=new Graphics()
  field.sortableChildren=true
  app.stage.addChild(shade,lines,field,labels,preview)
  for(const [index,x] of [[5,165],[6,1435]]){const s=new Sprite(assets[index]);s.anchor.set(.5);s.width=170;s.scale.y=s.scale.x;s.position.set(x,H/2);app.stage.addChild(s)}
  let market=config.market||DEFAULT_MARKET,cards=config.cards||CARDS
  const ledger=createLedger(100), units=new Map(), retreating=[], flights=[], bombs=[], blasts=[], seenTrades=new Set()
  let fundedCapital=100
  let orderSide=config.orderSide||'UP', bombId=0
  let selected=-1,elapsed=0,lastUi=0,message='',messageUntil=0,drawnFair=.5,targetFair=.5,marketId=null,hover=null
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches
  const text=(value,size=16,color='#fff')=>new Text({text:value,style:{fontFamily:'Arial',fontSize:size,fontWeight:'600',fill:color,stroke:{color:'#182718',width:3}}})
  const hoverLabel=text('',20,'#fff5b3');hoverLabel.anchor.set(.5);hoverLabel.visible=false;app.stage.addChild(hoverLabel)
  function addUnit(key,side,x,y,own=false,kind='scout'){
    const wrap=new Container(),texture=characterTextures[side][kind]
    const sprite=new Sprite(texture);sprite.anchor.set(.5,1)
    const height=own?(kind==='balloon'?86:68):48
    sprite.height=height;sprite.scale.x=Math.abs(sprite.scale.y)
    if(side==='DOWN') sprite.scale.x *= -1
    if(own){
      for(const [dx,dy] of [[-2,0],[2,0],[0,-2],[0,2],[-2,-2],[2,2]]){
        const outline=new Sprite(texture);outline.anchor.copyFrom(sprite.anchor);outline.scale.copyFrom(sprite.scale);outline.tint=0xffda68;outline.position.set(dx,dy);wrap.addChild(outline)
      }
    }
    const ring=new Graphics().ellipse(0,1,16,5).fill({color:own?'#ffda68':side==='UP'?'#346d32':'#82383c',alpha:.65})
    wrap.addChildAt(ring,0);wrap.addChild(sprite)
    wrap.position.set(x,y+15);wrap.alpha=0
    field.addChild(wrap)
    const unit={key,side,wrap,sprite,targetX:x,targetY:y,own,kind,age:0,notional:0}
    units.set(key,unit);return unit
  }
  function retreat(unit,scared=true){
    units.delete(unit.key);unit.retreat=0
    if(scared){const alert=text('!',24,'#ffdc85');alert.anchor.set(.5);alert.y=-75;unit.wrap.addChild(alert)}
    retreating.push(unit)
  }
  function syncBook(){
    const wanted=new Set()
    const visibleRanks=['UP','DOWN'].flatMap(side=>bidRanks(market,side))
    const existingRows=new Set(visibleRanks.map(row=>row.id))
    labels.removeChildren().forEach(c=>c.destroy())
    for(const side of ['UP','DOWN']){
      const ranks=bidRanks(market,side), direction=side==='UP'?-1:1
      const values=market.participantNotional?.values||{scout:25,guard:100,anchor:250}
      ranks.forEach((row,depth)=>{
        const chunks=notionalCharacters(row.notional,values,24)
        chunks.forEach((chunk,index)=>{
          const key='book:'+row.id+':'+index;wanted.add(key)
          const column=Math.floor(index/12),slot=index%12
          const x=Math.max(LEFT+8,Math.min(RIGHT-8,row.x+direction*column*Math.min(23,row.gap*.28)))
          const y=TOP+125+slot*41
          let unit=units.get(key)
          if(unit && unit.kind!==chunk.kind){unit.wrap.destroy({children:true});units.delete(key);unit=null}
          unit=unit||addUnit(key,side,x,y,false,chunk.kind)
          unit.targetX=x;unit.targetY=y;unit.notional=chunk.notional;unit.bookPrice=row.price;unit.rowId=row.id
          unit.sprite.alpha=depth===0?1:.7
        })
        const count=chunks.length
        const priceLabel=row.rangeLow!=null&&row.rangeLow!==row.rangeHigh?row.rangeLow.toFixed(0)+'-'+row.rangeHigh.toFixed(0)+'c':row.price.toFixed(1)+'c'
        if(row.gap>60||depth===0){
          const badge=text(priceLabel,17,side==='UP'?'#baffcb':'#ffd1d4')
          badge.anchor.set(.5);badge.position.set(row.x,TOP+68);labels.addChild(badge)
        }
        if(depth===0){
          const label=text(side+' BID '+priceLabel+' | $'+row.notional.toFixed(0)+' | '+count+(count===1?' troop':' troops'),18,side==='UP'?'#a4ffc0':'#ffc1c5')
          label.anchor.set(side==='UP'?0:1,.5);label.position.set(side==='UP'?LEFT+10:RIGHT-10,BOTTOM-22);labels.addChild(label)
        }
      })
    }
    for(const [key,unit] of units)if(key.startsWith('book:')&&!wanted.has(key)){
      const stillVisibleRank=bidRanks(market,unit.side).some(row=>row.id===unit.rowId)
      retreat(unit,!existingRows.has(unit.rowId)||stillVisibleRank)
    }
    for(const order of ledger.open){
      const unit=units.get(order.id);if(!unit)continue
      const rows=bidRanks(market,order.side)
      const exact=rows.find(row=>Math.abs(row.price-order.price)<.0001)
      if(exact) unit.targetX=exact.x
    }
  }
  function showMessage(value){message=value;messageUntil=elapsed+3;publish()}
  function cancelOrder(id){
    if(ledger.cancel(id)){const unit=units.get(id);if(unit)retreat(unit);showMessage('Order cancelled. Reserved capital returned.')}
  }
  function closePosition(id){
    const position=ledger.positions.find(p=>p.id===id)
    if(!position || position.marketId!==marketId || market.feedStatus!=='live'){showMessage('Position is awaiting live pricing or settlement');return}
    const bids=market.book?.[position.side]?.bids||[]
    let remaining=position.quantity,proceeds=0
    for(const level of bids){const quantity=Math.min(remaining,Number(level.size));proceeds+=quantity*Number(level.price);remaining-=quantity;if(remaining<1e-8)break}
    if(remaining>1e-8){showMessage('Insufficient bid liquidity to close this position');return}
    ledger.close(id,proceeds/position.quantity*100);showMessage('Simulated position closed at available bids')
  }
  function tradeFlight(trade,own=false,point=null){
    if(flights.length>=12 && !own)return
    const targetSide=trade.direction==='BUY'?(trade.side==='UP'?'DOWN':'UP'):trade.side
    const targetPrice=targetSide===trade.side?trade.price*100:100-trade.price*100
    const candidates=[...units.values()].filter(u=>u.side===targetSide&&u.key.startsWith('book:'))
    const target=candidates.sort((a,b)=>Math.abs((a.bookPrice||0)-targetPrice)-Math.abs((b.bookPrice||0)-targetPrice))[0]
    const sprite=new Container(),balloon=new Sprite(characterTextures[trade.side].balloon)
    balloon.anchor.set(.5,1);balloon.height=90;balloon.scale.x=balloon.scale.y
    if(own) for(const [x,y] of [[-3,0],[3,0],[0,-3],[0,3]]){
      const gold=new Sprite(balloon.texture);gold.anchor.copyFrom(balloon.anchor);gold.scale.copyFrom(balloon.scale);gold.tint=0xffdc69;gold.position.set(x,y);sprite.addChild(gold)
    }
    sprite.addChild(balloon)
    const notional=Number(trade.notional)||(Number(trade.size)*Number(trade.price))
    const sizeLabel=text((own?'MY TAKER ':'TAKER ')+(Number.isFinite(notional)?'$'+notional.toFixed(notional>=100?0:2):'--'),16,own?'#ffe48a':'#fff7dc')
    sizeLabel.anchor.set(.5,1);sizeLabel.y=-94;sprite.addChild(sizeLabel)
    field.addChild(sprite)
    flights.push({sprite,own,age:0,dropped:false,startX:trade.side==='UP'?150:1450,x:point?.x||target?.targetX||frontX(market),y:point?.y||target?.targetY||450,target})
  }
  function dropBomb(flight){
    const bomb=new Graphics().circle(0,0,12).fill('#252639').stroke({color:flight.own?'#ffe084':'#d1d6e1',width:3})
      .moveTo(0,-12).quadraticCurveTo(8,-24,15,-17).stroke({color:'#f2cb8e',width:3})
      .circle(15,-17,4).fill('#ff964f')
    bomb.position.set(flight.x,flight.y-120);field.addChild(bomb)
    bombs.push({id:++bombId,g:bomb,x:flight.x,y:flight.y,age:0,target:flight.target})
    app.canvas.dataset.bombsDropped=String(bombId)
  }
  function explode(bomb){
    const ring=new Graphics();ring.position.set(bomb.x,bomb.y);field.addChild(ring)
    blasts.push({ring,age:0})
    if(bomb.target&&!bomb.target.wrap.destroyed){bomb.target.hitUntil=elapsed+.55;bomb.target.sprite.tint=0xffb975}
  }
  function consumeTrades(){
    for(const trade of market.trades?.length?market.trades:market.trade?[market.trade]:[]){
      if(seenTrades.has(trade.id))continue
      seenTrades.add(trade.id);if(seenTrades.size>2000)seenTrades.delete(seenTrades.values().next().value)
      tradeFlight(trade)
      if(trade.direction!=='SELL')continue
      let remaining=Number(trade.size)
      for(const order of [...ledger.open].sort((a,b)=>b.price-a.price)){
        if(order.marketId!==market.marketId||order.side!==trade.side||order.price<trade.price*100)continue
        const filled=ledger.fill(order.id,remaining,trade.price*100);remaining-=filled
        if(!ledger.open.some(o=>o.id===order.id)){const unit=units.get(order.id);if(unit)retreat(unit)}
        if(remaining<=0)break
      }
    }
  }
  function setMarket(next){
    market=next.market||market;cards=next.cards||cards
    orderSide=next.orderSide||orderSide
    if(market.marketId!==marketId){
      for(const order of [...ledger.open])ledger.cancel(order.id,'expired')
      for(const unit of [...units.values()])retreat(unit)
      marketId=market.marketId;seenTrades.clear()
    }
    const coverage=marketCoverage(market)
    if(coverage.available)targetFair=coverage.upCoverage
    syncBook()
    if(market.feedStatus==='live')consumeTrades()
    publish()
  }
  function publish(){
    onChange({selected,capital:ledger.available,fundedCapital,time:market.endTime?Math.max(0,Math.ceil((Date.parse(market.endTime)-Date.now())/1000)):0,
      message,ended:false,crowns:[0,0],openOrders:ledger.open.map(o=>({...o})),completedOrders:ledger.completed.slice(0,100),
      positions:ledger.positions.map(p=>({...p,status:p.marketId===marketId?'held':'awaiting settlement'})),
      unrealizedPnl:ledger.mark(market),realizedPnl:ledger.realized})
  }
  function select(index){selected=selected===index?-1:index;preview.clear();publish()}
  function local(x,y){const r=app.canvas.getBoundingClientRect();return {x:(x-r.left)*W/r.width,y:(y-r.top)*H/r.height}}
  function deploy(p){
    if(selected<0)return
    if(market.feedStatus!=='live'){showMessage('Waiting for a live market connection');return}
    if(p.x<LEFT||p.x>RIGHT||p.y<TOP||p.y>BOTTOM){showMessage('Choose a square inside the arena');return}
    const picked=bidAtPoint(market,p,orderSide)
    if(!picked){showMessage('Place your '+orderSide+' order on the '+orderSide+' side of the front line');return}
    const side=orderSide,card=cards[selected]
    const bid=side==='UP'?market.bidUp:market.bidDown
    if(!bid){showMessage('No bid available for this outcome');return}
    if(card.kind==='balloon'){
      const asks=market.book?.[side]?.asks||[]
      let remaining=card.notional
      const fills=[]
      for(const level of asks){
        const cost=Math.min(remaining,Number(level.price)*Number(level.size))
        if(cost>0)fills.push({price:Number(level.price)*100,cost})
        remaining-=cost;if(remaining<1e-8)break
      }
      if(remaining>1e-6||card.notional>ledger.available){showMessage('Insufficient capital or ask liquidity');return}
      for(const fill of fills){const o=ledger.place(side,fill.price,fill.cost,marketId);if(o)ledger.fill(o.id,o.quantity,fill.price)}
      tradeFlight({side,direction:'BUY',price:fills[0].price/100,notional:card.notional},true,p)
      showMessage('Simulated taker filled at available asks')
    }else{
      const rounded=picked.price
      const order=ledger.place(side,rounded,card.notional,marketId)
      if(!order){showMessage('Insufficient capital');return}
      addUnit(order.id,side,picked.x,Math.max(TOP+95,Math.min(BOTTOM-75,Math.round(p.y/41)*41)),true,card.kind)
      showMessage(side+' limit order placed at '+rounded.toFixed(1)+'c')
    }
    selected=-1;preview.clear();publish()
  }
  app.stage.eventMode='static';app.stage.hitArea=new Rectangle(0,0,W,H)
  app.stage.on('pointerdown',e=>deploy(e.global))
  app.stage.on('pointermove',e=>{hover=e.global})
  app.stage.on('pointerleave',()=>{hover=null;preview.clear()})
  app.ticker.add(ticker=>{
    const dt=Math.min(.05,ticker.deltaMS/1000);elapsed+=dt
    drawnFair=reduced?targetFair:drawnFair+(targetFair-drawnFair)*(1-Math.exp(-dt*6))
    const boundary=LEFT+(RIGHT-LEFT)*drawnFair
    shade.clear()
    if(marketCoverage(market).available){
      shade.rect(LEFT,TOP,boundary-LEFT,BOTTOM-TOP).fill({color:'#1fab53',alpha:.25})
      shade.rect(boundary,TOP,RIGHT-boundary,BOTTOM-TOP).fill({color:'#e84455',alpha:.24})
    }
    lines.clear().moveTo(boundary,TOP).lineTo(boundary,BOTTOM).stroke({color:'#fff3bf',width:3,alpha:.95})
    for(let i=0;i<=14;i++){const x=LEFT+(RIGHT-LEFT)*i/14;lines.moveTo(x,TOP).lineTo(x,BOTTOM).stroke({color:'#fff',width:1,alpha:selected>=0?.22:.05})}
    if(selected>=0&&hover&&hover.x>LEFT&&hover.x<RIGHT&&hover.y>TOP&&hover.y<BOTTOM){
      const picked=bidAtPoint(market,hover,orderSide)
      preview.clear()
      hoverLabel.visible=!!picked
      if(picked){
        preview.roundRect(picked.x-25,Math.round(hover.y/41)*41-45,50,50,8).fill({color:'#ffdf79',alpha:.35}).stroke({color:'#ffdf79',width:3})
        hoverLabel.text=cards[selected].name+'  |  '+orderSide+' '+(cards[selected].kind==='balloon'?'TAKER @ ASK':'BID @ '+picked.price.toFixed(1)+'c')+'  |  $'+cards[selected].notional
        hoverLabel.position.set(Math.max(LEFT+110,Math.min(RIGHT-110,picked.x)),Math.max(TOP+25,hover.y-90))
      }
    }else {preview.clear();hoverLabel.visible=false}
    for(const unit of [...units.values()]){
      unit.age+=dt;unit.wrap.alpha=Math.min(1,unit.age*4)
      unit.wrap.x+=(unit.targetX-unit.wrap.x)*(1-Math.exp(-dt*8))
      unit.wrap.y+=(unit.targetY-unit.wrap.y)*(1-Math.exp(-dt*8))
      unit.wrap.zIndex=unit.wrap.y
      if(unit.hitUntil){
        if(elapsed<unit.hitUntil)unit.wrap.x+=Math.sin(elapsed*48)*3
        else{unit.hitUntil=0;unit.sprite.tint=0xffffff}
      }
      if(unit.expires&&elapsed>unit.expires)retreat(unit)
    }
    for(let i=retreating.length-1;i>=0;i--){
      const u=retreating[i];u.retreat+=dt
      u.wrap.x+=(u.side==='UP'?-1:1)*dt*65
      u.wrap.y+=Math.sin(u.retreat*40)*1.3
      u.wrap.alpha=Math.max(0,1-u.retreat/1.0)
      if(u.retreat>=1){u.wrap.destroy({children:true});retreating.splice(i,1)}
    }
    for(let i=flights.length-1;i>=0;i--){
      const flight=flights[i];flight.age+=dt;const t=Math.min(1,flight.age/1.1)
      flight.sprite.position.set(flight.startX+(flight.x-flight.startX)*t,400+(flight.y-120-400)*t-(reduced?0:45*Math.sin(t*Math.PI)))
      flight.sprite.zIndex=2000
      if(t===1&&!flight.dropped){flight.dropped=true;dropBomb(flight)}
      if(flight.age>1.6)flight.sprite.alpha=Math.max(0,1-(flight.age-1.6)*2)
      if(flight.age>2.1){flight.sprite.destroy({children:true});flights.splice(i,1)}
    }
    for(let i=bombs.length-1;i>=0;i--){
      const bomb=bombs[i];bomb.age+=dt;const t=Math.min(1,bomb.age/.55)
      bomb.g.y=bomb.y-120+120*t*t;bomb.g.rotation=reduced?0:t*3
      bomb.g.zIndex=2001
      if(t===1){explode(bomb);bomb.g.destroy();bombs.splice(i,1)}
    }
    for(let i=blasts.length-1;i>=0;i--){
      const blast=blasts[i];blast.age+=dt;const t=Math.min(1,blast.age/.6)
      blast.ring.clear().circle(0,0,12+t*40).fill({color:'#ffbd56',alpha:(1-t)*.65}).stroke({color:'#fff4bc',width:5*(1-t)})
      for(let spark=0;spark<7;spark++){const a=spark*Math.PI*2/7;blast.ring.circle(Math.cos(a)*t*65,Math.sin(a)*t*38,5*(1-t)).fill({color:'#ffdb78',alpha:1-t})}
      if(t===1){blast.ring.destroy();blasts.splice(i,1)}
    }
    if(message&&elapsed>messageUntil)message=''
    if(elapsed-lastUi>.2){publish();lastUi=elapsed}
  })
  setMarket(config)
  return {setMarket,select,cancelOrder,closePosition,depositCapital(amount=100){ledger.deposit(amount);fundedCapital+=amount;showMessage('Added $'+amount+' simulated funds')},
    dragStart(index){selected=index;publish()},dragMove(x,y){hover=local(x,y)},dragEnd(x,y){deploy(local(x,y));selected=-1;hover=null;preview.clear();publish()},dragCancel(){selected=-1;hover=null;preview.clear();publish()},
    destroy(){canvasResizeObserver.disconnect();app.destroy(true,{children:true})}}
}
