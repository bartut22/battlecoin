from datetime import datetime, timezone
from decimal import Decimal

from battlecoin.polymarket import PolymarketClient


def test_next_btc_market_chooses_active_updown_market(monkeypatch):
    payload = {
        "events": [
            {
                "id": "evt",
                "title": "Bitcoin Up or Down - September 12, 1:15AM-1:20AM ET",
                "slug": "btc-updown-5m-1789190100",
                "startTime": datetime(2099, 9, 12, 15, 15, tzinfo=timezone.utc).isoformat(),
                "eventMetadata": {"priceToBeat": "77214.61"},
                "markets": [
                    _market("1", "Bitcoin Up or Down - September 12, 1:15AM-1:20AM ET"),
                ],
            }
        ]
    }

    monkeypatch.setattr(PolymarketClient, "_events_by_series", lambda self, series_slug: payload["events"])
    market = PolymarketClient().next_btc_market(Decimal("77200"))

    assert market.id == "1"
    assert market.target == Decimal("77214.61")
    assert market.target_source == "Polymarket priceToBeat"
    assert market.yes_label == "Up"
    assert market.no_label == "Down"
    assert market.yes_token_id == "yes-1"


def test_order_book_uses_last_bid_and_ask_as_top_of_book(monkeypatch):
    payload = {
        "bids": [{"price": "0.04", "size": "10"}, {"price": "0.05", "size": "20"}],
        "asks": [{"price": "0.08", "size": "9"}, {"price": "0.06", "size": "11"}],
        "last_trade_price": "0.055",
        "hash": "abc",
    }

    monkeypatch.setattr(PolymarketClient, "_get_clob", lambda self, path, params: payload)
    book = PolymarketClient().order_book("token")

    assert book.best_bid == Decimal("0.05")
    assert book.best_ask == Decimal("0.06")
    assert book.mid == Decimal("0.055")
    assert [level.price for level in book.bids] == [Decimal("0.04"), Decimal("0.05")]
    assert [level.size for level in book.bids] == [Decimal("10"), Decimal("20")]
    assert [level.price for level in book.asks] == [Decimal("0.06"), Decimal("0.08")]
    assert [level.size for level in book.asks] == [Decimal("11"), Decimal("9")]


def _market(market_id: str, question: str) -> dict:
    return {
        "id": market_id,
        "question": question,
        "slug": f"market-{market_id}",
        "active": True,
        "closed": False,
        "enableOrderBook": True,
        "acceptingOrders": True,
        "eventStartTime": datetime(2099, 9, 12, 15, 15, tzinfo=timezone.utc).isoformat(),
        "endDate": datetime(2099, 9, 12, 16, tzinfo=timezone.utc).isoformat(),
        "outcomes": '["Up", "Down"]',
        "clobTokenIds": f'["yes-{market_id}", "no-{market_id}"]',
        "bestBid": "0.4",
        "bestAsk": "0.5",
    }
