import { useRef, useState } from 'react'
import './tutorial.css'
const scenes = [
  ["Whoa there, Champ! Welcome to the Battlecoin Arena! Every round here, you're not swinging swords — you're calling whether Bitcoin's price goes UP or DOWN before the timer hits zero!", "Two teams are always dueling for the crown: Team UP and Team DOWN. Your job? Read the battlefield, figure out who's about to win, and back 'em before it happens!"],
  ["Drag that card into the BUY LANE, and you'll scoop up 10 shares of Team UP at the current ASK — 19¢ each.", "Watch the total as you drag. It updates live! 10 shares × 19¢ = $1.90. In a real match, that number can still move if the price moves before you drop it, so keep an eye on it right up until you let go."],
  ["Quick rule. Buying always costs you the ASK: the lowest price any seller in the arena is willing to let shares go for. You just paid it, fair and square."],
  ["Now that you're holding UP shares, see this new card? That's YOUR position — 10 shares of Team UP, ready to cash out whenever you want.", "Notice you couldn't drag anything into the Sell Lane before you owned shares. Makes sense — you can't cash out of a team you never joined!", "Want to back Team DOWN instead? You'd play a DOWN card, not 'sell' this one."],
  ["If you drag your position into the SELL LANE, you cash out at the BID: 18¢ a share. Right now that'd hand you back $1.80: 10 shares × 18¢.", "Notice how you paid $1.90 to get in, but selling right away only gets you $1.80? Yep. That 1¢-per-share gap between Bid and Ask is called the spread. It's the toll for trading right now instead of waiting for a better price."],
  ["Before you drag any card, glance at the MIDPOINT — the Bid and Ask averaged together. It's the crowd's best single guess at Team UP's real odds: about 18.5% this round. Handy for deciding if a team's worth playing a card on."],
  ["Team DOWN works the exact same: drag a DOWN card into the Buy Lane and you pay the Ask: 82¢. Hold shares, and the Sell Lane pays you the Bid: 81¢. Same rules, different team."],
  ["Notice how Team UP's Ask (19¢) plus Team DOWN's Bid (81¢) equals exactly 100? Same story with Down's Ask (82¢) and Up's Bid (18¢). These teams aren't just rivals in name — every cent one gains, the other gives back. Only one team takes the crown when the timer hits zero."],
  ["Pop quiz, Champ! You've got a fresh UP card and NO position yet. Which lane do you drag it to — and what price do you pay?"],
  ["So here's the whole playbook: Buy Lane costs the Ask, Sell Lane pays the Bid, and you can only sell shares you actually hold. Check the Midpoint if you just want the crowd's gut feeling before you commit a card.", "Ready to make your first real call? The Arena's waiting, Champ!"]
]

export function useTutorial(held, onBuy) {
  const [scene,setScene] = useState(0), [line,setLine] = useState(0)
  const [answer,setAnswer] = useState(null), [selected,setSelected] = useState(false)
  const [dragging,setDragging] = useState(null)
  const buyLane = useRef(null), pointer = useRef(null)
  const lastLine = line === scenes[scene].length - 1
  const awaitingBuy = scene === 1 && lastLine && !held
  const awaitingDown = scene === 5 && lastLine
  function next() { if (!lastLine) setLine(line+1); else {setScene(scene+1);setLine(0)} }
  function reset() {setScene(0);setLine(0);setAnswer(null);setSelected(false);setDragging(null);pointer.current=null}
  function buy() {if(awaitingBuy && onBuy()) {setSelected(false);setDragging(null)}}
  function release(event) {
    if(pointer.current !== event.pointerId)return
    const rect=buyLane.current?.getBoundingClientRect()
    if(rect && event.clientX>=rect.left && event.clientX<=rect.right && event.clientY>=rect.top && event.clientY<=rect.bottom)buy()
    pointer.current=null;setDragging(null)
  }
  return {scene,line,answer,setAnswer,selected,setSelected,dragging,setDragging,buyLane,pointer,lastLine,awaitingBuy,awaitingDown,next,reset,buy,release,held}
}
export function TutorialDialogue({lesson, onFinish}) {
  const {scene,line,answer,setAnswer,lastLine,awaitingBuy,awaitingDown,next,held}=lesson
  const feedback=answer==='buy' ? "Exactly! No position yet means only the Buy Lane's open, and buying always costs the Ask." : "Can't sell what you don't hold, Champ! The Sell Lane only lights up once you own shares. Buy Lane it is — and that's the Ask, 19¢."
  return <aside className="control-rail tutorial-dialogue" aria-label="Chip dialogue"><header><span className="tutorial-chip" aria-hidden="true">₿</span><div><h2>Chip</h2><small>Your arena guide</small></div></header><div className="tutorial-dialogue-body"><p aria-live="polite">{scene===1 && held ? "Nice! You just joined Team UP. That gold's in the fight now." : scene===8 && answer ? feedback : scenes[scene][line]}</p>
    {scene===8 && !answer ? <div className="tutorial-answers"><button onClick={()=>setAnswer('buy')}>Buy Lane · 19¢ Ask</button><button onClick={()=>setAnswer('sell')}>Sell Lane · 18¢ Bid</button></div> : awaitingBuy ? <p className="tutorial-prompt">Drag the UP card into the Buy Lane, or select it and tap the lane.</p> : awaitingDown ? <p className="tutorial-prompt">Tap Down Bid or Down Ask above.</p> : <button className="primary-button" onClick={scene===9 && lastLine ? onFinish : next}>{scene===9 && lastLine ? 'Start Match' : 'Tap to continue'}</button>}
    </div><footer><small>Practice market · prices fixed</small><button className="icon-button" onClick={onFinish}>Skip tutorial</button></footer></aside>
}
export function TutorialQuotes({side, market, lesson}) {
  const {scene,awaitingDown,next}=lesson
  return <><small>{side==='UP'?'YES / UP':'NO / DOWN'}</small><strong className={scene===5 && side==='UP'?'tutorial-focus':''}><small>Midpoint </small>{side==='UP'?'18.5c':'81.5c'}</strong><span className="tutorial-quotes">{['Bid','Ask'].map(field=>{
    const highlight=side==='UP' ? (field==='Ask' && [1,2,7].includes(scene)) || (field==='Bid' && scene===4) : scene===6 || (scene===7 && field==='Bid')
    return <button key={field} className={highlight?'tutorial-focus':''} disabled={!(awaitingDown && side==='DOWN')} onClick={next}>{field} {market[`${field.toLowerCase()}${side==='UP'?'Up':'Down'}`]}c</button>
  })}</span></>
}
export function TutorialLanes({lesson,ui}) {
  return ui.buyLane && <div className="tutorial-lanes"><button ref={lesson.buyLane} className={lesson.scene===1?'tutorial-focus':''} disabled={!lesson.awaitingBuy || !lesson.selected} onClick={lesson.buy}><b>BUY LANE</b><span>{lesson.selected?'10 UP × 19¢ = $1.90':'Pay the Ask'}</span></button>{ui.sellLane && <button disabled className={[3,4].includes(lesson.scene)?'tutorial-focus':''}><b>SELL LANE</b><span>{lesson.scene===8?'No position · locked':'10 UP × 18¢ = $1.80'}</span></button>}</div>
}
export function TutorialDeck({lesson,ui,Portrait,capital}) {
  return <><div className="capital"><div className="capital-title"><small>Practice capital</small><b>${capital.toFixed(2)}</b></div><small>Market value $100</small></div><div className="deck-center"><div className="deck tutorial-deck">
    {ui.upCard && (!lesson.held || lesson.scene===8) && <button className="deck-card team-up" disabled={!lesson.awaitingBuy} aria-label="Buy 10 UP card" aria-pressed={lesson.selected} onClick={()=>lesson.setSelected(true)} onPointerDown={event=>{if(!lesson.awaitingBuy || event.button!==0)return;lesson.pointer.current=event.pointerId;event.currentTarget.setPointerCapture(event.pointerId);lesson.setSelected(true)}} onPointerMove={event=>{if(lesson.pointer.current===event.pointerId)lesson.setDragging({x:event.clientX,y:event.clientY})}} onPointerUp={lesson.release} onPointerCancel={()=>{lesson.pointer.current=null;lesson.setDragging(null);lesson.setSelected(false)}}><Portrait kind="balloon"/><span>Buy 10 UP</span><b>$1.90 · Ask 19c</b></button>}
    {ui.positionCard && lesson.held && <div className={`deck-card team-up ${lesson.scene===3?'tutorial-focus':''}`}><Portrait kind="balloon"/><span>Sell 10 UP</span><b>$1.80 · Bid 18c</b></div>}
    {ui.downCard && <div className="deck-card team-down"><Portrait kind="balloon" side="DOWN"/><span>Buy 10 DOWN</span><b>$8.20 · Ask 82c</b></div>}
  </div></div>{lesson.dragging && <div className="tutorial-drag" style={{left:lesson.dragging.x,top:lesson.dragging.y}}>10 UP · $1.90</div>}</>
}
export function TutorialHistory({lesson}) {
  return <section className="positions-panel tutorial-history" aria-label="Tutorial practice status"><h2>{lesson.scene===8?'Quick battle check':lesson.held?'Your practice position':'Welcome to the arena'}</h2><p>{lesson.scene===8?'Imagine a fresh UP card and no position for this question. Your practice shares are still held.':lesson.held?'10 UP shares · Bought at 19c · Cost $1.90':"Follow Chip's guidance. We'll introduce one action at a time."}</p>{lesson.scene===4 && <p>Keep your shares for now — selling is a preview.</p>}{lesson.scene===7 && <p>19c + 81c = 100c · 82c + 18c = 100c</p>}</section>
}
