from decimal import Decimal

from battlecoin.kraken import KrakenClient


def test_kraken_ticker_parser(monkeypatch):
    payload = {
        "result": {
            "XXBTZUSD": {
                "c": ["64250.10000", "0.001"],
                "b": ["64249.90000", "1", "1.000"],
                "a": ["64250.30000", "1", "1.000"],
                "v": ["12.3", "45.6"],
            }
        }
    }

    monkeypatch.setattr(KrakenClient, "_public", lambda self, endpoint, params: payload)
    ticker = KrakenClient().ticker("XBTUSD")

    assert ticker.last == Decimal("64250.10000")
    assert ticker.bid == Decimal("64249.90000")
    assert ticker.ask == Decimal("64250.30000")
    assert ticker.volume_today == Decimal("45.6")
