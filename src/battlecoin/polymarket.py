from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from .config import load_dotenv


@dataclass(frozen=True)
class PolymarketLevel:
    price: Decimal
    size: Decimal


@dataclass(frozen=True)
class PolymarketBook:
    token_id: str
    best_bid: Decimal | None
    best_ask: Decimal | None
    bid_size: Decimal | None
    ask_size: Decimal | None
    bids: tuple[PolymarketLevel, ...]
    asks: tuple[PolymarketLevel, ...]
    last_trade_price: Decimal | None
    hash: str | None

    @property
    def mid(self) -> Decimal | None:
        if self.best_bid is None and self.best_ask is None:
            return None
        if self.best_bid is None:
            return self.best_ask
        if self.best_ask is None:
            return self.best_bid
        return (self.best_bid + self.best_ask) / Decimal("2")


@dataclass(frozen=True)
class PolymarketMarket:
    event_id: str
    event_title: str
    event_slug: str
    id: str
    question: str
    slug: str
    start_date: datetime | None
    end_date: datetime
    target: Decimal
    target_source: str
    yes_label: str
    no_label: str
    yes_token_id: str
    no_token_id: str
    best_bid: Decimal | None
    best_ask: Decimal | None
    last_trade_price: Decimal | None
    volume: Decimal | None
    liquidity: Decimal | None
    source_url: str


class PolymarketClient:
    def __init__(
        self,
        gamma_url: str = "https://gamma-api.polymarket.com",
        clob_url: str = "https://clob.polymarket.com",
        timeout: float = 10.0,
    ) -> None:
        self.gamma_url = gamma_url.rstrip("/")
        self.clob_url = clob_url.rstrip("/")
        self.timeout = timeout

    @classmethod
    def from_env(cls) -> "PolymarketClient":
        load_dotenv()
        return cls(
            gamma_url=os.getenv("POLYMARKET_GAMMA_URL", "https://gamma-api.polymarket.com"),
            clob_url=os.getenv("POLYMARKET_CLOB_URL", "https://clob.polymarket.com"),
        )

    def next_btc_market(self, spot: Decimal | None = None) -> PolymarketMarket:
        events = self._events_by_series("btc-up-or-down-5m")
        candidates: list[PolymarketMarket] = []
        for event in events:
            candidates.extend(self._markets_from_event(event, fallback_target=spot, updown=True))

        now = datetime.now(timezone.utc)
        candidates = [
            market
            for market in candidates
            if market.end_date > now and market.yes_token_id and _is_tradeable_btc_updown(market.question)
        ]
        if not candidates:
            raise RuntimeError("No active future Polymarket BTC Up/Down market found")

        active_now = [
            market
            for market in candidates
            if market.start_date is not None and market.start_date <= now < market.end_date
        ]
        if active_now:
            return min(active_now, key=lambda market: market.end_date)
        return min(candidates, key=lambda market: market.end_date)

    def order_book(self, token_id: str) -> PolymarketBook:
        payload = self._get_clob("/book", {"token_id": token_id})
        bids = _levels(payload.get("bids") or [])
        asks = _levels(payload.get("asks") or [])
        best_bid = bids[-1] if bids else None
        best_ask = asks[0] if asks else None
        return PolymarketBook(
            token_id=token_id,
            best_bid=best_bid.price if best_bid else None,
            best_ask=best_ask.price if best_ask else None,
            bid_size=best_bid.size if best_bid else None,
            ask_size=best_ask.size if best_ask else None,
            bids=tuple(bids),
            asks=tuple(asks),
            last_trade_price=_decimal_or_none(payload.get("last_trade_price")),
            hash=payload.get("hash"),
        )

    def _search_events(self, query: str) -> list[dict[str, Any]]:
        payload = self._get_gamma("/public-search", {"q": query})
        return payload.get("events", [])

    def _events_by_series(self, series_slug: str) -> list[dict[str, Any]]:
        payload = self._get_gamma(
            "/events",
            {
                "closed": "false",
                "active": "true",
                "limit": "100",
                "series_slug": series_slug,
            },
        )
        return payload if isinstance(payload, list) else []

    def _markets_from_event(
        self,
        event: dict[str, Any],
        fallback_target: Decimal | None = None,
        updown: bool = False,
    ) -> list[PolymarketMarket]:
        markets = event.get("markets") or []
        out: list[PolymarketMarket] = []
        for market in markets:
            if (
                not market.get("active")
                or market.get("closed")
                or not market.get("enableOrderBook")
                or not market.get("acceptingOrders", True)
            ):
                continue
            token_ids = _json_list(market.get("clobTokenIds"))
            target = _extract_price_to_beat(event) if updown else _extract_target(market)
            target_source = "Polymarket priceToBeat"
            if target is None and fallback_target is not None:
                target = fallback_target
                target_source = "Live BTC fallback until Polymarket publishes priceToBeat"
            outcomes = [str(outcome) for outcome in _json_list(market.get("outcomes"))]
            end_date = _parse_date(market.get("endDate") or event.get("endDate"))
            start_date = _parse_date(market.get("eventStartTime") or event.get("startTime") or market.get("startDate"))
            if len(token_ids) < 2 or target is None or end_date is None:
                continue
            out.append(
                PolymarketMarket(
                    event_id=str(event.get("id", "")),
                    event_title=str(event.get("title") or ""),
                    event_slug=str(event.get("slug") or ""),
                    id=str(market.get("id") or ""),
                    question=str(market.get("question") or ""),
                    slug=str(market.get("slug") or ""),
                    start_date=start_date,
                    end_date=end_date,
                    target=target,
                    target_source=target_source,
                    yes_label=outcomes[0] if len(outcomes) > 0 else "Yes",
                    no_label=outcomes[1] if len(outcomes) > 1 else "No",
                    yes_token_id=str(token_ids[0]),
                    no_token_id=str(token_ids[1]),
                    best_bid=_decimal_or_none(market.get("bestBid")),
                    best_ask=_decimal_or_none(market.get("bestAsk")),
                    last_trade_price=_decimal_or_none(market.get("lastTradePrice")),
                    volume=_decimal_or_none(market.get("volumeNum") or market.get("volume")),
                    liquidity=_decimal_or_none(market.get("liquidityNum") or market.get("liquidity")),
                    source_url=f"https://polymarket.com/event/{event.get('slug', '')}",
                )
            )
        return out

    def _get_gamma(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        return self._request(f"{self.gamma_url}{path}", params)

    def _get_clob(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        return self._request(f"{self.clob_url}{path}", params)

    def _request(self, url: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        query = f"?{urlencode(params)}" if params else ""
        request = Request(
            f"{url}{query}",
            method="GET",
            headers={
                "Accept": "application/json",
                "User-Agent": "BattlecoinHackathon/0.1 (+https://localhost)",
            },
        )
        try:
            with urlopen(request, timeout=self.timeout) as response:
                return json.loads(response.read().decode("utf-8"))
        except HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"Polymarket request failed: HTTP {exc.code} {body}") from exc


def _is_tradeable_btc_above(question: str) -> bool:
    normalized = question.lower()
    return "bitcoin" in normalized and "above" in normalized and "$" in normalized


def _is_tradeable_btc_updown(question: str) -> bool:
    normalized = question.lower()
    return "bitcoin" in normalized and "up or down" in normalized


def _extract_price_to_beat(event: dict[str, Any]) -> Decimal | None:
    metadata = event.get("eventMetadata")
    if not isinstance(metadata, dict):
        return None
    return _decimal_or_none(metadata.get("priceToBeat"))


def _extract_target(market: dict[str, Any]) -> Decimal | None:
    raw = str(market.get("groupItemTitle") or market.get("question") or "")
    match = re.search(r"\$?\s*([0-9][0-9,]*(?:\.[0-9]+)?)\s*k\b", raw, re.IGNORECASE)
    if match:
        return Decimal(match.group(1).replace(",", "")) * Decimal("1000")
    match = re.search(r"\$?\s*([0-9][0-9,]*(?:\.[0-9]+)?)", raw)
    if not match:
        return None
    return Decimal(match.group(1).replace(",", ""))


def _json_list(value: Any) -> list[Any]:
    if isinstance(value, list):
        return value
    if not value:
        return []
    try:
        parsed = json.loads(value)
    except (TypeError, json.JSONDecodeError):
        return []
    return parsed if isinstance(parsed, list) else []


def _levels(levels: list[dict[str, Any]]) -> list[PolymarketLevel]:
    parsed = [
        PolymarketLevel(Decimal(str(level["price"])), Decimal(str(level["size"])))
        for level in levels
        if "price" in level and "size" in level
    ]
    return sorted(parsed, key=lambda level: level.price)


def _decimal_or_none(value: Any) -> Decimal | None:
    if value in (None, ""):
        return None
    return Decimal(str(value))


def _parse_date(value: Any) -> datetime | None:
    if not value:
        return None
    text = str(value).replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)
