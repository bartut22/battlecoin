from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from .config import load_dotenv
from .engine import PricingInput, ProbabilityEngine
from .kraken import KrakenClient
from .polymarket import PolymarketClient, PolymarketLevel


class DashboardHandler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/":
            self._send_html(_dashboard_html())
            return
        if parsed.path == "/api/spot":
            self._handle_spot(parsed.query)
            return
        if parsed.path == "/api/price":
            self._handle_price(parsed.query)
            return
        if parsed.path == "/api/polymarket/next-btc":
            self._handle_polymarket_next_btc(parsed.query)
            return
        self.send_error(404, "Not found")

    def log_message(self, format: str, *args) -> None:
        return

    def _handle_spot(self, query: str) -> None:
        params = parse_qs(query)
        pair = _one(params, "pair", os.getenv("BATTLECOIN_DEFAULT_PAIR", "XBTUSD"))
        ticker = KrakenClient.from_env().ticker(pair)
        self._send_json(
            {
                "pair": ticker.pair,
                "raw_symbol": ticker.raw_symbol,
                "last": str(ticker.last),
                "bid": str(ticker.bid),
                "ask": str(ticker.ask),
                "volume_today": str(ticker.volume_today),
            }
        )

    def _handle_polymarket_next_btc(self, query: str) -> None:
        params = parse_qs(query)
        try:
            pair = _one(params, "pair", os.getenv("BATTLECOIN_DEFAULT_PAIR", "XBTUSD"))
            volatility = Decimal(_one(params, "vol", os.getenv("BATTLECOIN_DEFAULT_VOL", "0.65")))
            ticker = KrakenClient.from_env().ticker(pair)
            client = PolymarketClient.from_env()
            market = client.next_btc_market(ticker.last)
            yes_book = client.order_book(market.yes_token_id)
            no_book = client.order_book(market.no_token_id)
        except (InvalidOperation, ValueError, RuntimeError) as exc:
            self._send_json({"error": str(exc)}, status=500)
            return

        market_probability = yes_book.mid or market.best_ask or market.best_bid or market.last_trade_price
        result = ProbabilityEngine().price(
            PricingInput(
                spot=ticker.last,
                target=market.target,
                expiry=market.end_date,
                volatility=volatility,
            )
        )
        market_cents = _to_cents(market_probability)
        self._send_json(
            {
                "event_id": market.event_id,
                "event_title": market.event_title,
                "event_slug": market.event_slug,
                "market_id": market.id,
                "question": market.question,
                "market_slug": market.slug,
                "source_url": market.source_url,
                "expiry": market.end_date.isoformat().replace("+00:00", "Z"),
                "target": str(market.target),
                "target_source": market.target_source,
                "yes_label": market.yes_label,
                "no_label": market.no_label,
                "yes_token_id": market.yes_token_id,
                "no_token_id": market.no_token_id,
                "ws_url": "wss://ws-subscriptions-clob.polymarket.com/ws/market",
                "rtds_ws_url": "wss://ws-live-data.polymarket.com",
                "spot": str(ticker.last),
                "spot_source": "Kraken BTC/USD",
                "best_bid": str(yes_book.best_bid or market.best_bid or ""),
                "best_ask": str(yes_book.best_ask or market.best_ask or ""),
                "yes_best_bid": str(yes_book.best_bid or market.best_bid or ""),
                "yes_best_ask": str(yes_book.best_ask or market.best_ask or ""),
                "yes_bid_size": str(yes_book.bid_size or ""),
                "yes_ask_size": str(yes_book.ask_size or ""),
                "yes_bids": _book_levels(yes_book.bids, reverse=True),
                "yes_asks": _book_levels(yes_book.asks),
                "yes_mid": str(market_probability or ""),
                "no_best_bid": str(no_book.best_bid or ""),
                "no_best_ask": str(no_book.best_ask or ""),
                "no_bid_size": str(no_book.bid_size or ""),
                "no_ask_size": str(no_book.ask_size or ""),
                "no_bids": _book_levels(no_book.bids, reverse=True),
                "no_asks": _book_levels(no_book.asks),
                "no_mid": str(no_book.mid or ""),
                "mid": str(market_probability or ""),
                "market_price_cents": market_cents,
                "last_trade_price": str(yes_book.last_trade_price or market.last_trade_price or ""),
                "spread": str((yes_book.best_ask - yes_book.best_bid) if yes_book.best_ask is not None and yes_book.best_bid is not None else ""),
                "yes_spread": str((yes_book.best_ask - yes_book.best_bid) if yes_book.best_ask is not None and yes_book.best_bid is not None else ""),
                "no_spread": str((no_book.best_ask - no_book.best_bid) if no_book.best_ask is not None and no_book.best_bid is not None else ""),
                "engine_model_probability": str(result.model_probability.quantize(Decimal("0.0001"))),
                "engine_model_price_cents": result.price_cents,
                "time_to_expiry_years": str(result.time_to_expiry_years.quantize(Decimal("0.000001"))),
                "volume": str(market.volume or ""),
                "liquidity": str(market.liquidity or ""),
            }
        )

    def _handle_price(self, query: str) -> None:
        params = parse_qs(query)
        try:
            pair = _one(params, "pair", os.getenv("BATTLECOIN_DEFAULT_PAIR", "XBTUSD"))
            target = Decimal(_one(params, "target", os.getenv("BATTLECOIN_DEFAULT_TARGET", "65000")))
            volatility = Decimal(_one(params, "vol", os.getenv("BATTLECOIN_DEFAULT_VOL", "0.65")))
            drift = Decimal(_one(params, "drift", "0"))
            expiry = datetime.fromisoformat(_one(params, "expiry", _default_expiry()).replace("Z", "+00:00"))
            spot_arg = _one(params, "spot", "")
            live = _one(params, "live", "true").lower() != "false"
            ticker = KrakenClient.from_env().ticker(pair) if live or not spot_arg else None
            spot = ticker.last if ticker else Decimal(spot_arg)
        except (InvalidOperation, ValueError) as exc:
            self._send_json({"error": f"Invalid pricing input: {exc}"}, status=400)
            return

        result = ProbabilityEngine().price(
            PricingInput(
                spot=spot,
                target=target,
                expiry=expiry,
                volatility=volatility,
                drift=drift,
            )
        )
        self._send_json(
            {
                "pair": pair,
                "spot": str(spot),
                "target": str(target),
                "probability": str(result.probability.quantize(Decimal("0.0001"))),
                "price_cents": result.price_cents,
                "model_probability": str(result.model_probability.quantize(Decimal("0.0001"))),
                "time_to_expiry_years": str(result.time_to_expiry_years.quantize(Decimal("0.000001"))),
                "ticker": {
                    "bid": str(ticker.bid),
                    "ask": str(ticker.ask),
                    "volume_today": str(ticker.volume_today),
                }
                if ticker
                else None,
            }
        )

    def _send_html(self, html: str, status: int = 200) -> None:
        body = html.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Cache-Control", "no-store, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_json(self, payload: dict, status: int = 200) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the Battlecoin dashboard")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    load_dotenv()

    server = ThreadingHTTPServer((args.host, args.port), DashboardHandler)
    print(f"Battlecoin dashboard running at http://{args.host}:{args.port}")
    server.serve_forever()


def _one(params: dict[str, list[str]], key: str, default: str) -> str:
    values = params.get(key)
    return values[0] if values and values[0] != "" else default


def _default_expiry() -> str:
    return (datetime.now(timezone.utc) + timedelta(days=1)).replace(microsecond=0).isoformat()


def _to_cents(value: Decimal | None) -> int | None:
    if value is None:
        return None
    cents = int((value * Decimal("100")).quantize(Decimal("1")))
    return cents


def _book_levels(levels: tuple[PolymarketLevel, ...], reverse: bool = False, limit: int = 8) -> list[dict[str, str]]:
    ordered = sorted(levels, key=lambda level: level.price, reverse=reverse)
    return [
        {"price": str(level.price), "size": str(level.size), "notional": str(level.price * level.size)}
        for level in ordered[:limit]
    ]


def _dashboard_html() -> str:
    default_pair = os.getenv("BATTLECOIN_DEFAULT_PAIR", "XBTUSD")
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Battlecoin Probability Engine</title>
  <style>
    :root {{
      --ink: #161514;
      --muted: #6b6259;
      --paper: #f7f4ef;
      --panel: #ffffff;
      --line: #ddd5cb;
      --accent: #0a7f62;
      --accent-strong: #075d49;
      --gold: #d59b25;
      --danger: #b6463b;
      --shadow: 0 16px 40px rgba(29, 25, 21, 0.10);
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: var(--ink);
      background: var(--paper);
    }}
    main {{
      min-height: 100vh;
      display: grid;
      grid-template-columns: minmax(320px, 420px) 1fr;
      gap: 24px;
      padding: 24px;
    }}
    .sidebar, .stage {{
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      box-shadow: var(--shadow);
    }}
    .sidebar {{
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }}
    .brand {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding-bottom: 14px;
      border-bottom: 1px solid var(--line);
    }}
    h1 {{
      margin: 0;
      font-size: 22px;
      line-height: 1.1;
      letter-spacing: 0;
    }}
    .status {{
      min-width: 86px;
      padding: 6px 10px;
      border-radius: 999px;
      background: #e8f4f0;
      color: var(--accent-strong);
      text-align: center;
      font-size: 12px;
      font-weight: 700;
    }}
    label {{
      display: grid;
      gap: 7px;
      color: var(--muted);
      font-size: 13px;
      font-weight: 650;
    }}
    input, select {{
      width: 100%;
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 11px 12px;
      color: var(--ink);
      background: #fffdfa;
      font: inherit;
    }}
    .row {{
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }}
    .toggle {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: #fffdfa;
      color: var(--ink);
      font-size: 14px;
      font-weight: 700;
    }}
    .toggle input {{
      width: 20px;
      height: 20px;
      accent-color: var(--accent);
    }}
    button {{
      min-height: 44px;
      border: 0;
      border-radius: 6px;
      padding: 0 16px;
      color: white;
      background: var(--accent);
      font: inherit;
      font-weight: 800;
      cursor: pointer;
    }}
    button:hover {{ background: var(--accent-strong); }}
    .stage {{
      padding: 22px;
      display: grid;
      grid-template-rows: auto 1fr auto;
      gap: 18px;
    }}
    .topline {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 12px;
    }}
    .metric {{
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 14px;
      min-height: 92px;
      background: #fffdfa;
    }}
    .metric span {{
      display: block;
      color: var(--muted);
      font-size: 12px;
      font-weight: 750;
      text-transform: uppercase;
    }}
    .metric strong {{
      display: block;
      margin-top: 10px;
      font-size: 26px;
      line-height: 1;
    }}
    .price strong {{ color: var(--accent-strong); }}
    .probability {{
      display: grid;
      grid-template-columns: minmax(220px, 360px) 1fr;
      gap: 24px;
      align-items: center;
      min-height: 360px;
    }}
    .gauge {{
      position: relative;
      aspect-ratio: 1;
      display: grid;
      place-items: center;
    }}
    .gauge svg {{
      width: 100%;
      height: 100%;
      transform: rotate(-90deg);
    }}
    .gauge .center {{
      position: absolute;
      text-align: center;
    }}
    .center .cents {{
      font-size: clamp(56px, 9vw, 104px);
      line-height: 0.9;
      font-weight: 900;
      color: var(--accent-strong);
    }}
    .center .caption {{
      margin-top: 8px;
      color: var(--muted);
      font-weight: 750;
    }}
    .explain {{
      display: grid;
      gap: 12px;
    }}
    .bar {{
      height: 16px;
      overflow: hidden;
      border-radius: 999px;
      background: #ece5dc;
      border: 1px solid var(--line);
    }}
    .fill {{
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, var(--gold), var(--accent));
      transition: width 180ms ease;
    }}
    .notes {{
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    }}
    .market-title {{
      display: grid;
      gap: 6px;
      padding: 6px 0 2px;
    }}
    .market-title h2 {{
      margin: 0;
      font-size: 20px;
      line-height: 1.25;
      letter-spacing: 0;
    }}
    .market-title a {{
      color: var(--accent-strong);
      font-weight: 750;
      text-decoration: none;
    }}
    .note {{
      border-top: 1px solid var(--line);
      padding-top: 12px;
      color: var(--muted);
      line-height: 1.45;
    }}
    .note b {{
      display: block;
      color: var(--ink);
      margin-bottom: 4px;
    }}
    .depth-grid {{
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      align-items: start;
    }}
    .depth-panel {{
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #fffdfa;
      overflow: hidden;
    }}
    .depth-panel h3 {{
      margin: 0;
      padding: 12px 14px;
      border-bottom: 1px solid var(--line);
      font-size: 14px;
      line-height: 1.2;
    }}
    .depth-sides {{
      display: grid;
      grid-template-columns: 1fr 1fr;
    }}
    .depth-side + .depth-side {{
      border-left: 1px solid var(--line);
    }}
    .depth-head, .depth-row {{
      display: grid;
      grid-template-columns: 0.8fr 1fr 1fr;
      gap: 8px;
      padding: 7px 10px;
      font-variant-numeric: tabular-nums;
    }}
    .depth-head {{
      color: var(--muted);
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      background: #f5efe6;
    }}
    .depth-row {{
      min-height: 30px;
      border-top: 1px solid #f0e8dd;
      font-size: 13px;
    }}
    .depth-row span:nth-child(n+2), .depth-head span:nth-child(n+2) {{
      text-align: right;
    }}
    .error {{
      display: none;
      color: var(--danger);
      font-weight: 700;
    }}
    @media (max-width: 980px) {{
      main, .probability, .depth-grid {{ grid-template-columns: 1fr; }}
      .topline, .notes {{ grid-template-columns: 1fr 1fr; }}
    }}
    @media (max-width: 620px) {{
      main {{ padding: 12px; }}
      .row, .topline, .notes {{ grid-template-columns: 1fr; }}
      .center .cents {{ font-size: 68px; }}
    }}
  </style>
</head>
<body>
  <main>
    <section class="sidebar">
      <div class="brand">
        <h1>Battlecoin</h1>
        <div class="status" id="status">Ready</div>
      </div>
      <label>Underlying
        <select id="pair">
          <option value="XBTUSD" {"selected" if default_pair == "XBTUSD" else ""}>BTC/USD</option>
        </select>
      </label>
      <button id="price">Load Next BTC Market</button>
      <div class="error" id="error"></div>
    </section>
    <section class="stage">
      <div class="market-title">
        <h2 id="marketQuestion">Loading next Polymarket BTC market</h2>
        <a id="marketLink" href="#" target="_blank" rel="noreferrer">Polymarket market</a>
      </div>
      <div class="topline">
        <div class="metric price"><span id="mainPriceLabel">UP midpoint</span><strong id="priceCents">--c</strong></div>
        <div class="metric"><span id="yesBidLabel">UP bid</span><strong id="yesBid">--</strong></div>
        <div class="metric"><span id="yesAskLabel">UP ask</span><strong id="yesAsk">--</strong></div>
        <div class="metric"><span id="noBidLabel">DOWN bid</span><strong id="noBid">--</strong></div>
        <div class="metric"><span id="noAskLabel">DOWN ask</span><strong id="noAsk">--</strong></div>
        <div class="metric"><span>BTC spot</span><strong id="spotOut">--</strong></div>
        <div class="metric"><span>Price to beat</span><strong id="targetOut">--</strong></div>
      </div>
      <div class="probability">
        <div class="gauge">
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle cx="60" cy="60" r="52" fill="none" stroke="#ece5dc" stroke-width="12"></circle>
            <circle id="arc" cx="60" cy="60" r="52" fill="none" stroke="#007c72" stroke-width="12" stroke-linecap="round" stroke-dasharray="326.73" stroke-dashoffset="326.73"></circle>
          </svg>
          <div class="center">
            <div class="cents" id="bigCents">--c</div>
            <div class="caption" id="mainPriceCaption">Polymarket UP midpoint</div>
          </div>
        </div>
        <div class="explain">
          <div>
            <div class="bar"><div class="fill" id="fill"></div></div>
          </div>
          <div class="notes">
            <div class="note"><b>Time left</b><span id="timeLeft">--</span></div>
            <div class="note"><b id="yesSpreadLabel">UP spread</b><span id="yesSpread">--</span></div>
            <div class="note"><b id="noSpreadLabel">DOWN spread</b><span id="noSpread">--</span></div>
            <div class="note"><b>Polymarket stream</b><span id="book">--</span></div>
            <div class="note"><b>Gamma refresh</b><span id="gammaRefresh">--</span></div>
            <div class="note"><b>Last update</b><span id="lastUpdate">--</span></div>
            <div class="note"><b>Target source</b><span id="targetSource">--</span></div>
          </div>
          <div class="note">
            <b>Model</b>
            <span id="model">Polymarket UP and DOWN bid/ask are the represented probability prices for this market.</span>
          </div>
        </div>
      </div>
      <div class="depth-grid">
        <div class="depth-panel">
          <h3 id="yesDepthTitle">YES L2 Depth</h3>
          <div class="depth-sides">
            <div class="depth-side">
              <div class="depth-head"><span>Bid</span><span>Qty</span><span>Notional</span></div>
              <div id="yesBidDepth"></div>
            </div>
            <div class="depth-side">
              <div class="depth-head"><span>Ask</span><span>Qty</span><span>Notional</span></div>
              <div id="yesAskDepth"></div>
            </div>
          </div>
        </div>
        <div class="depth-panel">
          <h3 id="noDepthTitle">NO L2 Depth</h3>
          <div class="depth-sides">
            <div class="depth-side">
              <div class="depth-head"><span>Bid</span><span>Qty</span><span>Notional</span></div>
              <div id="noBidDepth"></div>
            </div>
            <div class="depth-side">
              <div class="depth-head"><span>Ask</span><span>Qty</span><span>Notional</span></div>
              <div id="noAskDepth"></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </main>
  <script>
    const $ = (id) => document.getElementById(id);

    function money(value) {{
      const n = Number(value);
      return Number.isFinite(n) ? n.toLocaleString(undefined, {{ maximumFractionDigits: 2 }}) : "--";
    }}

    let marketSocket = null;
    let heartbeat = null;
    let rtdsSocket = null;
    let rtdsHeartbeat = null;
    let countdown = null;
    let gammaPoll = null;
    let yesTokenId = null;
    let noTokenId = null;
    let state = {{}};
    let refreshingMarket = false;

    async function price() {{
      $("status").textContent = "Gamma";
      $("error").style.display = "none";
      try {{
        const data = await fetchGammaMarket();
        applyGammaMarket(data, true);
        startGammaPolling();
        $("status").textContent = "Live";
      }} catch (error) {{
        $("status").textContent = "Error";
        $("error").textContent = error.message;
        $("error").style.display = "block";
      }}
    }}

    async function fetchGammaMarket() {{
      const params = new URLSearchParams({{
        pair: $("pair").value
      }});
      const response = await fetch(`/api/polymarket/next-btc?${{params}}`, {{ cache: "no-store" }});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gamma market fetch failed");
      data.gamma_refreshed_at = new Date().toISOString();
      return data;
    }}

    function applyGammaMarket(data, forceReconnect = false) {{
      const changed = forceReconnect || data.market_id !== state.market_id || data.yes_token_id !== yesTokenId || data.no_token_id !== noTokenId;
      const keepLiveTarget = !changed && (
        state.target_source === "Polymarket RTDS Chainlink 60s TWAP" ||
        state.target_source === "Polymarket RTDS disconnected; showing last TWAP"
      );
      const liveTarget = keepLiveTarget ? {{
        target: state.target,
        target_source: state.target_source,
        reference_observed_at: state.reference_observed_at
      }} : null;

      state = {{ ...state, ...data }};
      if (liveTarget?.target) Object.assign(state, liveTarget);
      if (changed || !state.last_update_at) state.last_update_at = new Date().toISOString();
      render(state);

      if (changed) {{
        connectPolymarket(state);
        connectReferencePrice(state);
      }}
    }}

    function startGammaPolling() {{
      if (gammaPoll) return;
      gammaPoll = setInterval(() => refreshCurrentMarket(false), 10000);
    }}

    async function refreshCurrentMarket(forceReconnect = false) {{
      if (refreshingMarket) return;
      refreshingMarket = true;
      const previousStatus = $("status").textContent;
      $("status").textContent = "Gamma";
      try {{
        const data = await fetchGammaMarket();
        applyGammaMarket(data, forceReconnect);
        $("status").textContent = "WS Live";
      }} catch (error) {{
        console.warn(error);
        $("status").textContent = previousStatus || "Live";
      }} finally {{
        refreshingMarket = false;
      }}
    }}

    function render(data) {{
      const yesLabel = data.yes_label || "Up";
      const noLabel = data.no_label || "Down";
      const probability = clampProbability(data.yes_mid || data.mid || data.yes_best_ask || data.yes_best_bid || 0);
      const percent = Math.round(probability * 1000) / 10;
      const cents = centsText(data.yes_mid || data.mid);
      $("marketQuestion").textContent = data.question || "Next Polymarket BTC market";
      $("marketLink").href = data.source_url || "#";
      $("mainPriceLabel").textContent = `${{yesLabel}} midpoint`;
      $("mainPriceCaption").textContent = `Polymarket ${{yesLabel}} midpoint`;
      $("yesBidLabel").textContent = `${{yesLabel}} bid`;
      $("yesAskLabel").textContent = `${{yesLabel}} ask`;
      $("noBidLabel").textContent = `${{noLabel}} bid`;
      $("noAskLabel").textContent = `${{noLabel}} ask`;
      $("yesSpreadLabel").textContent = `${{yesLabel}} spread`;
      $("noSpreadLabel").textContent = `${{noLabel}} spread`;
      $("yesDepthTitle").textContent = `${{yesLabel}} L2 Depth`;
      $("noDepthTitle").textContent = `${{noLabel}} L2 Depth`;
      $("priceCents").textContent = cents;
      $("bigCents").textContent = cents;
      $("yesBid").textContent = centsText(data.yes_best_bid || data.best_bid);
      $("yesAsk").textContent = centsText(data.yes_best_ask || data.best_ask);
      $("noBid").textContent = centsText(data.no_best_bid);
      $("noAsk").textContent = centsText(data.no_best_ask);
      $("spotOut").textContent = `$${{money(data.spot)}}`;
      $("targetOut").textContent = `$${{money(data.target)}}`;
      updateTimeLeft();
      $("yesSpread").textContent = spreadText(data.yes_spread || data.spread);
      $("noSpread").textContent = spreadText(data.no_spread);
      $("book").textContent = data.stream_status || (data.yes_best_bid && data.yes_best_ask ? "REST snapshot loaded" : "Waiting for top of book");
      $("gammaRefresh").textContent = formatUpdateTime(data.gamma_refreshed_at);
      $("lastUpdate").textContent = formatUpdateTime(data.last_update_at);
      $("targetSource").textContent = data.target_source || "Polymarket";
      $("model").textContent = `For the demo, the represented probability is Polymarket: ${{yesLabel}} bid/ask ${{centsText(data.yes_best_bid)}} / ${{centsText(data.yes_best_ask)}} and ${{noLabel}} bid/ask ${{centsText(data.no_best_bid)}} / ${{centsText(data.no_best_ask)}}.`;
      renderDepth("yesBidDepth", data.yes_bids);
      renderDepth("yesAskDepth", data.yes_asks);
      renderDepth("noBidDepth", data.no_bids);
      renderDepth("noAskDepth", data.no_asks);
      $("fill").style.width = `${{percent}}%`;
      const circumference = 326.73;
      $("arc").style.strokeDashoffset = String(circumference * (1 - probability));
      startCountdown();
    }}

    function clampProbability(value) {{
      const n = Number(value);
      if (!Number.isFinite(n)) return 0.01;
      return Math.min(0.99, Math.max(0.01, n));
    }}

    function centsText(value) {{
      const n = Number(value);
      return Number.isFinite(n) ? `${{Math.round(clampProbability(n) * 1000) / 10}}c` : "--";
    }}

    function spreadText(value) {{
      const n = Number(value);
      return Number.isFinite(n) ? `${{(n * 100).toFixed(1)}}c wide` : "--";
    }}

    function renderDepth(id, levels) {{
      const container = $(id);
      const rows = Array.isArray(levels) && levels.length ? levels.slice(0, 8) : [];
      if (!rows.length) {{
        container.innerHTML = `<div class="depth-row"><span>--</span><span>--</span><span>--</span></div>`;
        return;
      }}
      container.innerHTML = rows.map((level) => `
        <div class="depth-row">
          <span>${{centsText(level.price)}}</span>
          <span>${{sizeText(level.size)}}</span>
          <span>${{notionalText(level.notional ?? Number(level.price) * Number(level.size))}}</span>
        </div>
      `).join("");
    }}

    function sizeText(value) {{
      const n = Number(value);
      if (!Number.isFinite(n)) return "--";
      return n.toLocaleString(undefined, {{ maximumFractionDigits: 2 }});
    }}

    function notionalText(value) {{
      const n = Number(value);
      if (!Number.isFinite(n)) return "--";
      return `$${{n.toLocaleString(undefined, {{ maximumFractionDigits: 2 }})}}`;
    }}

    function startCountdown() {{
      if (countdown) return;
      countdown = setInterval(updateTimeLeft, 1000);
    }}

    function updateTimeLeft() {{
      if (!state.expiry) {{
        $("timeLeft").textContent = "--";
        return;
      }}
      const ms = new Date(state.expiry).getTime() - Date.now();
      if (!Number.isFinite(ms) || ms <= 0) {{
        $("timeLeft").textContent = "expired";
        rollToNextMarket();
        return;
      }}
      const totalSeconds = Math.floor(ms / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      $("timeLeft").textContent = `${{minutes}}m ${{String(seconds).padStart(2, "0")}}s`;
    }}

    function rollToNextMarket() {{
      if (refreshingMarket) return;
      $("status").textContent = "Gamma next";
      setTimeout(() => refreshCurrentMarket(true), 750);
    }}

    function formatUpdateTime(value) {{
      if (!value) return "--";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "--";
      return date.toLocaleTimeString(undefined, {{ hour: "numeric", minute: "2-digit", second: "2-digit" }});
    }}

    function connectPolymarket(data) {{
      yesTokenId = data.yes_token_id;
      noTokenId = data.no_token_id;
      if (marketSocket) marketSocket.close();
      if (heartbeat) clearInterval(heartbeat);
      marketSocket = new WebSocket(data.ws_url);
      marketSocket.addEventListener("open", () => {{
        $("status").textContent = "WS Live";
        state.stream_status = "WebSocket connected";
        state.last_update_at = new Date().toISOString();
        render(state);
        marketSocket.send(JSON.stringify({{
          assets_ids: [data.yes_token_id, data.no_token_id],
          type: "market",
          custom_feature_enabled: true,
          initial_dump: true
        }}));
        heartbeat = setInterval(() => {{
          if (marketSocket && marketSocket.readyState === WebSocket.OPEN) marketSocket.send("PING");
        }}, 10000);
      }});
      marketSocket.addEventListener("message", (event) => {{
        if (event.data === "PONG") return;
        let payload;
        try {{ payload = JSON.parse(event.data); }} catch {{ return; }}
        const messages = Array.isArray(payload) ? payload : [payload];
        for (const message of messages) applyMarketMessage(message);
      }});
      marketSocket.addEventListener("close", () => {{
        if (heartbeat) clearInterval(heartbeat);
        $("status").textContent = "REST";
        state.stream_status = "WebSocket closed; showing last snapshot";
        state.last_update_at = new Date().toISOString();
        render(state);
      }});
    }}

    function connectReferencePrice(data) {{
      if (rtdsSocket) rtdsSocket.close();
      if (rtdsHeartbeat) clearInterval(rtdsHeartbeat);
      rtdsSocket = new WebSocket(data.rtds_ws_url);
      rtdsSocket.addEventListener("open", () => {{
        state.target_source = "Polymarket RTDS Chainlink 60s TWAP";
        render(state);
        rtdsSocket.send(JSON.stringify({{
          action: "subscribe",
          subscriptions: [
            {{
              topic: "crypto_prices_twap_sixty",
              type: "update",
              filters: "{{\\"symbol\\":\\"btc/usd\\"}}"
            }}
          ]
        }}));
        rtdsHeartbeat = setInterval(() => {{
          if (rtdsSocket && rtdsSocket.readyState === WebSocket.OPEN) rtdsSocket.send("PING");
        }}, 5000);
      }});
      rtdsSocket.addEventListener("message", (event) => {{
        if (event.data === "PONG") return;
        let payload;
        try {{ payload = JSON.parse(event.data); }} catch {{ return; }}
        const messages = Array.isArray(payload) ? payload : [payload];
        for (const message of messages) applyReferenceMessage(message);
      }});
      rtdsSocket.addEventListener("close", () => {{
        if (rtdsHeartbeat) clearInterval(rtdsHeartbeat);
        if (state.target_source === "Polymarket RTDS Chainlink 60s TWAP") {{
          state.target_source = "Polymarket RTDS disconnected; showing last TWAP";
          render(state);
        }}
      }});
    }}

    function applyReferenceMessage(message) {{
      const topic = message.topic || message.payload?.topic;
      const payload = message.payload || message;
      if (topic !== "crypto_prices_twap_sixty" && topic !== "prices.crypto.chainlink.twap") return;
      if (String(payload.symbol || "").toLowerCase() !== "btc/usd") return;
      const value = payload.value || fixedE18ToDecimal(payload.full_accuracy_value);
      if (!value) return;
      state.target = String(value);
      state.target_source = "Polymarket RTDS Chainlink 60s TWAP";
      state.reference_observed_at = payload.timestamp ? new Date(Number(payload.timestamp)).toISOString() : new Date().toISOString();
      state.last_update_at = new Date().toISOString();
      render(state);
    }}

    function fixedE18ToDecimal(value) {{
      if (!value) return "";
      const text = String(value);
      const negative = text.startsWith("-");
      const digits = negative ? text.slice(1) : text;
      if (!/^\\d+$/.test(digits)) return "";
      const padded = digits.padStart(19, "0");
      const whole = padded.slice(0, -18).replace(/^0+(?=\\d)/, "") || "0";
      const fraction = padded.slice(-18).replace(/0+$/, "");
      return `${{negative ? "-" : ""}}${{whole}}${{fraction ? "." + fraction : ""}}`;
    }}

    function applyMarketMessage(message) {{
      const type = message.event_type || message.type;
      if (type === "book" && trackedSide(tokenIdOf(message))) {{
        const book = message.payload || message;
        const bid = bestLevel(book.bids, "bid");
        const ask = bestLevel(book.asks, "ask");
        updateDepth(tokenIdOf(message), book.bids, book.asks);
        updateTopOfBook(tokenIdOf(message), bid?.price, ask?.price);
      }}
      if (type === "best_bid_ask") {{
        const book = message.payload || message;
        if (trackedSide(tokenIdOf(book))) updateTopOfBook(tokenIdOf(book), bestBidOf(book), bestAskOf(book));
      }}
      if (type === "price_change") {{
        const changes = message.price_changes || message.priceChanges || message.payload?.price_changes || message.payload?.priceChanges || [];
        for (const change of changes) {{
          if (trackedSide(tokenIdOf(change))) updateTopOfBook(tokenIdOf(change), bestBidOf(change), bestAskOf(change));
        }}
      }}
    }}

    function trackedSide(tokenId) {{
      if (tokenId === yesTokenId) return "yes";
      if (tokenId === noTokenId) return "no";
      return "";
    }}

    function tokenIdOf(message) {{
      return message.asset_id || message.assetId || message.token_id || message.tokenId || message.payload?.asset_id || message.payload?.assetId || message.payload?.token_id || message.payload?.tokenId;
    }}

    function bestBidOf(message) {{
      return message.best_bid || message.bestBid || message.bid || message.payload?.best_bid || message.payload?.bestBid || message.payload?.bid;
    }}

    function bestAskOf(message) {{
      return message.best_ask || message.bestAsk || message.ask || message.payload?.best_ask || message.payload?.bestAsk || message.payload?.ask;
    }}

    function bestLevel(levels, side = "bid") {{
      if (!Array.isArray(levels) || levels.length === 0) return null;
      const sorted = [...levels].sort((a, b) => Number(a.price) - Number(b.price));
      return side === "ask" ? sorted[0] : sorted.at(-1);
    }}

    function normalizeLevels(levels, side = "bid") {{
      if (!Array.isArray(levels)) return [];
      const normalized = levels
        .map((level) => ({{
          price: String(level.price ?? level.p ?? ""),
          size: String(level.size ?? level.quantity ?? level.q ?? "")
        }}))
        .filter((level) => Number.isFinite(Number(level.price)) && Number.isFinite(Number(level.size)) && Number(level.size) > 0)
        .map((level) => ({{
          ...level,
          notional: String(Number(level.price) * Number(level.size))
        }}))
        .sort((a, b) => Number(a.price) - Number(b.price));
      return side === "ask" ? normalized.slice(0, 8) : normalized.reverse().slice(0, 8);
    }}

    function updateDepth(tokenId, bids, asks) {{
      const side = trackedSide(tokenId);
      if (!side) return;
      state[`${{side}}_bids`] = normalizeLevels(bids, "bid");
      state[`${{side}}_asks`] = normalizeLevels(asks, "ask");
    }}

    function syncTopLevel(side, bestBid, bestAsk) {{
      if (bestBid) {{
        const bids = Array.isArray(state[`${{side}}_bids`]) ? [...state[`${{side}}_bids`]] : [];
        const size = bids[0]?.size || state[`${{side}}_bid_size`] || "";
        state[`${{side}}_bids`] = [levelWithNotional(bestBid, size), ...bids.filter((level) => String(level.price) !== String(bestBid))]
          .sort((a, b) => Number(b.price) - Number(a.price))
          .slice(0, 8);
      }}
      if (bestAsk) {{
        const asks = Array.isArray(state[`${{side}}_asks`]) ? [...state[`${{side}}_asks`]] : [];
        const size = asks[0]?.size || state[`${{side}}_ask_size`] || "";
        state[`${{side}}_asks`] = [levelWithNotional(bestAsk, size), ...asks.filter((level) => String(level.price) !== String(bestAsk))]
          .sort((a, b) => Number(a.price) - Number(b.price))
          .slice(0, 8);
      }}
    }}

    function levelWithNotional(price, size) {{
      const priceNumber = Number(price);
      const sizeNumber = Number(size);
      return {{
        price: String(price),
        size: String(size),
        notional: Number.isFinite(priceNumber) && Number.isFinite(sizeNumber) ? String(priceNumber * sizeNumber) : ""
      }};
    }}

    function updateTopOfBook(tokenId, bestBid, bestAsk) {{
      const side = trackedSide(tokenId);
      if (!side) return;
      if (bestBid) state[`${{side}}_best_bid`] = String(bestBid);
      if (bestAsk) state[`${{side}}_best_ask`] = String(bestAsk);
      syncTopLevel(side, bestBid, bestAsk);
      if (side === "yes") {{
        state.best_bid = state.yes_best_bid;
        state.best_ask = state.yes_best_ask;
      }}
      const bid = Number(state[`${{side}}_best_bid`]);
      const ask = Number(state[`${{side}}_best_ask`]);
      if (Number.isFinite(bid) && Number.isFinite(ask)) {{
        state[`${{side}}_mid`] = String((bid + ask) / 2);
        state[`${{side}}_spread`] = String(ask - bid);
        if (side === "yes") {{
          state.mid = state.yes_mid;
          state.spread = state.yes_spread;
          state.market_price_cents = Math.round(Number(state.mid) * 100);
        }}
        state.stream_status = "WebSocket top-of-book";
        state.last_update_at = new Date().toISOString();
      }}
      render(state);
    }}

    $("price").addEventListener("click", price);
    price();
  </script>
</body>
</html>"""


if __name__ == "__main__":
    main()
