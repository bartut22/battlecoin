# Battlecoin Market Arena

React, Vite and PixiJS. Run `npm install`, then `npm run dev -- --host 127.0.0.1 --port 5174`.
Build with `npm run build`; `npm run preview` includes the same public API proxies.

## Live market data

Gamma discovers the currently active BTC 5-minute market, falling back to the active 15-minute market.
Discovery repeats every 10 seconds and accelerates around rollover. Both outcome tokens subscribe directly
to Polymarket's public market WebSocket. Book snapshots, price changes, zero-size deletions and trades
update the arena. Reconnects refresh both books, and expired/disconnected feeds disable placement.

The boundary follows Polymarket's displayed UP probability: midpoint for spreads up to 10 cents,
last traded price for wider spreads. DOWN coverage is its complement. Neither side is normalized
by order size. Missing probability is shown as unavailable, not a fabricated quote.

Sources:
- https://docs.polymarket.com/concepts/prices-orderbook
- https://docs.polymarket.com/api-reference/wss/market
- https://docs.polymarket.com/api-reference/markets/get-market-by-slug

Public market data needs no API key. The included local .env remains server-side; never prefix private
credentials with VITE_. Vite proxies /gamma and /clob; a static production host must provide these routes.

## Arena and portfolio

- Available simulated capital starts at $100 and never regenerates. Deposit adds $100.
- My cards controls each card's dollar notional. Long UP / Long DOWN selects the order outcome.
  Dropping onto a rank snaps to that outcome's actual bid price, including the best bid at the front.
- Participants assigns dollar denominations to Ranger, Guardian and Crystal Golem and selects
  the representative character for each outcome's market depth.
- $300 at $25 per character is twelve units. A residual unit represents the remaining dollars.
- The arena renders the nearest four bid levels as facing front-line ranks; the book table shows eight bid and ask levels per side.
  Levels above 24 characters aggregate into 24 visible groups with the full equivalent unit count labeled.
- Resting liquidity stays at its price location. Probability moves smoothly, additions fade in,
  and removed liquidity shakes and retreats. Public L2 reductions do not prove a particular user's cancellation.
- Gold silhouettes identify local orders. Cancel buttons release reserved funds exactly once.
- Public trade events animate incoming balloons that drop falling bombs and impact bursts.
  Local taker balloons have gold silhouettes. Impact effects do not fabricate book removals.
- Open orders, held positions and history occupy a separate table below the arena.
- Balloons simulate taker purchases against available asks; closing a position uses available bids.
- Limit fills are a tutorial approximation driven by sell-side public trades at an executable price.
  They do not model queue priority or fees and are not guaranteed exchange fills.
- Filled positions from expired markets remain labeled awaiting settlement. Automatic settlement is
  not implemented. Unrealized PnL totals cover positions in the current market only.
- Realized PnL is recorded when a simulated position closes. No real orders or deposits are submitted.

## Verification

`npm test` covers probability, notional grouping, accounting, book deltas and market rollover.
`node scripts/verify-arena.mjs` checks the live feed and responsive layouts using installed Edge.
`node scripts/verify-orders.mjs` checks deterministic placement, refunds, taker fills,
position closing and repricing with isolated browser fixtures.
Browser screenshots are written to artifacts/.

The account login remains a local prototype and is not production authentication.
Hermes UI routing panels were removed from the playing surface.

The single-bridge map and distinct red/green troop atlas are documented with their generation prompts
in `public/assets/ARTWORK.md`. The bright game theme keeps the arena, deck, portfolio and value controls in separate layout regions.
