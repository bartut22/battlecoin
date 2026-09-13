import { DEFAULT_MARKET } from './market-engine.js'

// The renderer and quote strip consume the same market shape in both modes.
const levels = (price, direction) => Array.from({length:4}, (_, index) => ({price:(price + direction * index) / 100, size:12.5 / ((price + direction * index) / 100)}))
export const TUTORIAL_MARKET = {
  ...DEFAULT_MARKET, marketId:'tutorial', title:'Bitcoin Up or Down · Practice',
  bidUp:18, askUp:19, bidDown:81, askDown:82, lastTradeUp:18.5,
  marketValue:100, feedStatus:'practice', feedMessage:'Fixed tutorial market · timer paused',
  tutorial:true, trades:[],
  book:{UP:{bids:levels(18,-1),asks:levels(19,1)},DOWN:{bids:levels(81,-1),asks:levels(82,1)}},
}
export function tutorialVisibility(active, scene) {
  return {
    dialogue:active, guidedDeck:active, guidedHistory:active,
    buyLane:active && scene >= 1, sellLane:active && scene >= 3,
    upCard:active && scene >= 1, positionCard:active && scene >= 3 && scene !== 8,
    downCard:active && scene >= 6 && scene !== 8,
  }
}
