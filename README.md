# Battlecoin

A gamified prediction market built at HackRice 16. Live Polymarket BTC "Up or Down" order
book data drives a Clash-Royale-style PixiJS battle arena — you drag troop cards onto the
field to place simulated trades against the real live market, funded by devnet SOL converted
into trading capital through a real Solana wallet.

## Stack

- **Frontend:** React 18 + Vite + PixiJS v8 (`src/`)
- **Backend:** FastAPI + asyncpg + bcrypt (`api/`)
- **Database:** Tiger Data (TimescaleDB) — plain tables for users/wallets, a hypertable for trades (`db/schema.sql`)
- **Wallet:** `@solana/web3.js`, devnet only

## Setup

### 1. Environment

Copy `.env.example` to `.env` and fill in `DATABASE_URL` with your Tiger Data (or any
Postgres/TimescaleDB) connection string. This single `.env` is read by both the Vite
frontend (`VITE_`-prefixed vars only) and the FastAPI backend (via `python-dotenv`).

Apply the schema once against a fresh database:

```bash
psql "$DATABASE_URL" -f db/schema.sql
```

### 2. Frontend

```bash
npm install
npm run dev
```

Runs on `http://localhost:5173`. `vite.config.js` proxies `/gamma` and `/clob` to Polymarket
(avoiding CORS for public market data), `/poly` to `polymarket.com` (for the BTC opening-price
reference lookup), and `/api` to the local backend. Pixel fonts are self-hosted via
`@fontsource` (no external font request at runtime): `Pixelify Sans` for dashboard headings,
`VT323` for numeric readouts and arena labels, `Press Start 2P` for the login screen.
The dashboard and canvas share a scalable pixel-art cent image instead of a letter C.

### Ambient scenery and training

Palm sway, intermittent wind, looping river ripples, and a short-side tumbleweed are
restricted to peripheral scenery zones. They do not receive pointer events or change
orders. Effects are suppressed within 40 arena pixels of actor bounds, and reduced-motion
preferences leave the scenery still. Both towers have matching offsets from their walls.

The tutorial contains a separate animated paper-order example with pause/replay controls.
It never calls the ledger, wallet, or order APIs; reduced motion shows a static example.

With the dev server on port 5174, verify these changes using:

```bash
npm test
node scripts/verify-microstructure-arena.mjs
node scripts/verify-ambience.mjs
node scripts/verify-arena-load.mjs
npm run build
```

### 3. Backend

```bash
cd api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd ..
uvicorn main:app --app-dir api --host 127.0.0.1 --port 8001
```

Exposes `/signup`, `/login`, `POST /trades`, and `GET /trades` against the database
configured by `DATABASE_URL`.

### 4. Solana wallet

Each account gets a real devnet keypair generated at signup. By default `solana.js` points at
a local validator (`http://127.0.0.1:8899`) to avoid the public devnet faucet's rate limit:

```bash
solana-test-validator
```

Set `VITE_SOLANA_RPC_URL=https://api.devnet.solana.com` in `.env` to use the real Solana
devnet instead (needed for a build judges/other machines will actually hit).

## How it plays

- **Login / signup** is username + password (bcrypt-hashed, stored in the real database), not
  wallet-based auth — each account owns one generated Solana devnet keypair.
- The collapsible **sidebar** shows the account, wallet address and balance, and deposit/
  withdraw controls for moving real devnet SOL in and out of that wallet.
- **Elixir capital** is simulated trading capital, separate from the wallet's real SOL. Convert
  real devnet SOL into more capital at a fixed demo rate (`SOL_USD_RATE` in `solana.js`) — this
  is a real on-chain transfer to a house vault address, not just a UI number.
- The arena tracks the currently active Polymarket BTC 5-minute "Up/Down" market (falling back
  to 15-minute), discovered via the Gamma API and streamed live over Polymarket's public
  WebSocket. A second WebSocket (Polymarket's RTDS feed) tracks live BTC spot price against the
  round's opening reference ("price to beat" / "distance").
- Drag a troop card onto the UP or DOWN side of the field to trade:
  - **Sand Bomber**, **Caravan Bomber**, and **Siege Bomber** are small, medium, and large taker cards,
    grouped to the right of the limit deck. Each simulates taking available asks.
  - The three troop cards place resting limit orders at the dropped price rank; they fill when
    a matching public trade crosses that price, or expire uncancelled when the round rolls over.
- Troops on the field represent aggregated order-book depth, not individual traders — card
  denominations (Settings tab) control how a given notional is broken into troops. A hit that
  fully consumes a troop's depth triggers a pixel-shatter effect (`trade-impact.js` matches
  incoming trades to the units they consume); a partial hit just tints the unit.
- Prices display the complete 0-100c range — 100c buys and 0c exits are supported. A dismissible
  banner announces each new market as it opens.
- Open orders, held positions, and trade **history** live in the portfolio panel below the
  arena. History is read from the database (`GET /trades`), so it survives page reloads;
  open orders/positions are current in-memory state (nothing rests across a reload).
- Every executed trade (fill, cancel, close, and round-rollover expiry) is written to the
  `trades` hypertable via `POST /trades` — best-effort, so a failed write never blocks local
  gameplay.

## Testing

```bash
npm test
```

Runs the Node test-runner suite in `scripts/*.test.mjs` — probability/coverage math, order
book grouping and depth-to-troop conversion, ledger accounting (fills, cancels, closes),
Polymarket feed normalization and market rollover, zero/100c price edge cases, and arena
placement geometry.

`node scripts/verify-microstructure-arena.mjs` checks the current UI against the dev server at
port 5174 with isolated mocked market data: shared fair value, moving-target bombs, partial/full
hits, editable taker cards and public thresholds, tutorial persistence, and responsive layouts.

### Fair Value and Executions

The dashboard and arena boundary use the same best-quote size-weighted estimate:
`microprice = (ask * bidQuantity + bid * askQuantity) / (bidQuantity + askQuantity)`.
This is the queue-imbalance weighted mid described in
[Limit Order Book by Imanol Perez](https://www.quantstart.com/articles/high-frequency-trading-ii-limit-order-book/).
It is a short-horizon reference estimate, not a calibrated probability of the final market result.
Compatible UP and complementary DOWN estimates are pooled by displayed contract depth; DOWN
fair value is always `100 - UP`. An inconsistent pair uses the available UP estimate. Missing
quote sizes fall back to the labeled midpoint or last trade. The engine supports 0-100c.
Actual quotes and deployment prices retain their executable book levels, and P&L retains bid marks.

Bombs target exact matched price-level liquidity and follow moving troops. A trade matching several
visible units drops a bomb per target. Unmatched trades beyond the rendered depth produce no arbitrary
ground explosion. Full consumption collapses the sprite into sand fragments; partial hits recoil,
and removed depth retreats. These are visualizations of aggregated public data, not trader identities.
My cards controls your six simulated order sizes; Settings controls the public balloon size thresholds
independently. New green/red balloon sprites are shared by the deck, settings, and arena.

Available capital stays above the right-hand book; SOL conversion/refill is in the left account
menu. The full-width deck groups limit troops and taker balloons. Game, book, card, menu, and
tutorial typography use Pixelify Sans, matching the fair-value headings.

The renderer caches rank calculations and labels, skips unchanged geometry, and ignores effects
whose targets were already removed. Run `node scripts/verify-arena-load.mjs` against port 5174 for
an isolated dense-book/trade-burst check, including cleanup and animation responsiveness.

## Known limitations

This is a hackathon prototype, not a production trading system:

- No automatic round settlement — positions left open past a round's expiry are labeled
  "awaiting settlement" and never resolve on their own.
- No replay mode for offline/degraded-network demos.
- Trades are simulated capital only; nothing settles on-chain beyond the real SOL transfers
  for wallet deposit/withdraw and the SOL→capital conversion.
- Wallet secret keys are stored server-side once signed up (devnet only — see `db/schema.sql`
  for the custody tradeoff this accepts).

## Project layout

```
api/            FastAPI backend — auth, trade recording/history, Tiger Data access
db/schema.sql   TimescaleDB schema (drop-and-recreate, no migrations tool)
src/            React app — LoginScreen, Sidebar, App (exchange UI), battle.js (PixiJS arena),
                trade-impact.js (matches trades to hit units for shatter/tint effects),
                auth.js/solana.js (backend + wallet clients), polymarket-feed.js/usePolymarket.js
                (live market data), market-engine.js/frontline.js (pricing and layout math)
scripts/        Node test suite (*.test.mjs) plus asset-generation and Playwright smoke scripts
public/assets/  Sprites, backgrounds, and generation notes (ARTWORK.md)
```
