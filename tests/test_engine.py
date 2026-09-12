from datetime import datetime, timezone
from decimal import Decimal

from battlecoin import Orderbook, PricingInput, ProbabilityEngine


def test_price_is_clamped_between_one_and_ninety_nine_cents():
    result = ProbabilityEngine().price(
        PricingInput(
            spot=Decimal("100"),
            target=Decimal("1"),
            expiry=datetime(2026, 9, 13, tzinfo=timezone.utc),
            now=datetime(2026, 9, 12, tzinfo=timezone.utc),
            volatility=Decimal("0.10"),
        )
    )

    assert result.price_cents == 99
    assert result.probability == Decimal("0.99")


def test_orderbook_mid_uses_no_bid_as_implied_yes_ask():
    orderbook = Orderbook.from_kalshi(
        {
            "orderbook_fp": {
                "yes_dollars": [["0.4200", "13.00"]],
                "no_dollars": [["0.5600", "17.00"]],
            }
        }
    )

    assert orderbook.best_yes_bid == Decimal("0.4200")
    assert orderbook.implied_yes_ask == Decimal("0.4400")
    assert orderbook.yes_mid == Decimal("0.4300")


def test_tight_deep_orderbook_pulls_price_toward_market_mid():
    orderbook = Orderbook.from_kalshi(
        {
            "orderbook_fp": {
                "yes_dollars": [["0.6000", "600.00"], ["0.6200", "600.00"]],
                "no_dollars": [["0.3600", "600.00"], ["0.3700", "600.00"]],
            }
        }
    )
    result = ProbabilityEngine().price(
        PricingInput(
            spot=Decimal("100"),
            target=Decimal("100"),
            expiry=datetime(2026, 9, 13, tzinfo=timezone.utc),
            now=datetime(2026, 9, 12, tzinfo=timezone.utc),
            volatility=Decimal("0.50"),
            orderbook=orderbook,
        )
    )

    assert result.orderbook_probability == Decimal("0.6250")
    assert result.orderbook_weight > Decimal("0.30")
    assert result.price_cents > 50
