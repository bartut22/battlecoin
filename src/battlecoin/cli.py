from __future__ import annotations

import argparse
import json
from datetime import datetime
from decimal import Decimal

from .engine import PricingInput, ProbabilityEngine
from .kalshi import KalshiClient
from .kraken import KrakenClient
from .orderbook import Orderbook


def main() -> None:
    parser = argparse.ArgumentParser(description="Battlecoin binary probability engine")
    subparsers = parser.add_subparsers(dest="command", required=True)

    price_parser = subparsers.add_parser("price", help="Price from model inputs only")
    _add_pricing_args(price_parser)

    kalshi_parser = subparsers.add_parser("kalshi", help="Price with a Kalshi orderbook")
    _add_pricing_args(kalshi_parser)
    kalshi_parser.add_argument("--ticker", required=True)
    kalshi_parser.add_argument("--depth", type=int, default=20)

    kraken_parser = subparsers.add_parser("kraken", help="Price with a live Kraken spot price")
    kraken_parser.add_argument("--pair", default="XBTUSD")
    kraken_parser.add_argument("--target", required=True, help="Price to beat at expiry")
    kraken_parser.add_argument("--expiry", required=True, help="ISO timestamp, e.g. 2026-09-12T23:59:00Z")
    kraken_parser.add_argument("--vol", required=True, help="Annualized volatility, e.g. 0.65")
    kraken_parser.add_argument("--drift", default="0", help="Annualized drift, default 0")

    args = parser.parse_args()

    orderbook = None
    if args.command == "kalshi":
        client = KalshiClient.from_env()
        orderbook = Orderbook.from_kalshi(client.get_orderbook(args.ticker, depth=args.depth))
        spot = Decimal(args.spot)
    elif args.command == "kraken":
        ticker = KrakenClient.from_env().ticker(args.pair)
        spot = ticker.last
    else:
        spot = Decimal(args.spot)

    result = ProbabilityEngine().price(
        PricingInput(
            spot=spot,
            target=Decimal(args.target),
            expiry=_parse_datetime(args.expiry),
            volatility=Decimal(args.vol),
            drift=Decimal(args.drift),
            orderbook=orderbook,
        )
    )
    print(json.dumps(_result_to_json(result), indent=2))


def _add_pricing_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--spot", required=True, help="Current underlying price")
    parser.add_argument("--target", required=True, help="Price to beat at expiry")
    parser.add_argument("--expiry", required=True, help="ISO timestamp, e.g. 2026-09-12T23:59:00Z")
    parser.add_argument("--vol", required=True, help="Annualized volatility, e.g. 0.65")
    parser.add_argument("--drift", default="0", help="Annualized drift, default 0")


def _parse_datetime(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _result_to_json(result) -> dict:
    return {
        "probability": str(result.probability.quantize(Decimal("0.0001"))),
        "price_cents": result.price_cents,
        "model_probability": str(result.model_probability.quantize(Decimal("0.0001"))),
        "orderbook_probability": str(result.orderbook_probability.quantize(Decimal("0.0001")))
        if result.orderbook_probability is not None
        else None,
        "orderbook_weight": str(result.orderbook_weight.quantize(Decimal("0.0001"))),
        "time_to_expiry_years": str(result.time_to_expiry_years),
        "distance_to_target": str(result.distance_to_target.quantize(Decimal("0.0001"))),
        "diagnostics": {
            key: str(value.quantize(Decimal("0.0001"))) if isinstance(value, Decimal) else value
            for key, value in result.diagnostics.items()
        },
    }


if __name__ == "__main__":
    main()
