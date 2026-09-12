# Battlecoin Probability Engine

Battlecoin prices binary option style contracts from:

- time until expiry
- current price versus price to beat
- volatility
- live orderbook bid/ask information

The engine outputs a bounded probability and price from **1c to 99c**.

## Quick Start

```powershell
python -m battlecoin.cli price --spot 64250 --target 65000 --expiry 2026-09-12T23:59:00Z --vol 0.65
```

Run the local dashboard:

```powershell
python -m battlecoin.dashboard --port 8765
```

Then open `http://127.0.0.1:8765`.

Use Kraken live spot prices:

```powershell
python -m battlecoin.cli kraken --pair XBTUSD --target 65000 --expiry 2026-09-12T23:59:00Z --vol 0.65
```

With a Kalshi orderbook:

```powershell
python -m battlecoin.cli kalshi --ticker KXBTC-EXAMPLE-T65000 --spot 64250 --target 65000 --expiry 2026-09-12T23:59:00Z --vol 0.65
```

Kalshi public market data does not require authentication for orderbooks. If you need signed read-only requests later, load credentials from environment variables rather than source files:

```powershell
$env:KRAKEN_API_KEY = "..."
$env:KRAKEN_API_SECRET = "..."
$env:KALSHI_API_KEY = "..."
$env:KALSHI_PRIVATE_KEY = "..."
$env:POLYMARKET_API_KEY = "..."
$env:POLYMARKET_API_SECRET = "..."
$env:POLYMARKET_API_PASSPHRASE = "..."
```

For Polymarket public market discovery and books, the default endpoints are:

```text
POLYMARKET_GAMMA_URL=https://gamma-api.polymarket.com
POLYMARKET_CLOB_URL=https://clob.polymarket.com
POLYMARKET_CHAIN_ID=137
```

For authenticated CLOB actions later, add `POLYMARKET_PRIVATE_KEY`, `POLYMARKET_FUNDER_ADDRESS`, `POLYMARKET_SIGNATURE_TYPE`, and the L2 `POLYMARKET_API_*` values.

## How It Works

The model probability uses a lognormal terminal-price framework:

```text
P(spot at expiry > target) = N((ln(spot / target) + drift * T - 0.5 * vol^2 * T) / (vol * sqrt(T)))
```

The orderbook probability is derived from the YES bid and implied YES ask:

```text
yes_ask = 1 - best_no_bid
orderbook_mid = (best_yes_bid + yes_ask) / 2
```

The final probability blends the model and orderbook using a confidence score based on spread, depth, and time-to-expiry. Tight, deep markets pull the output toward the market-implied probability; thin or wide markets leave more weight on the model.
