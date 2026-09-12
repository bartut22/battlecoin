from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
from math import erf, exp, log, sqrt

from .orderbook import Orderbook

SECONDS_PER_YEAR = Decimal("31557600")


@dataclass(frozen=True)
class PricingInput:
    spot: Decimal
    target: Decimal
    expiry: datetime
    volatility: Decimal
    now: datetime | None = None
    drift: Decimal = Decimal("0")
    orderbook: Orderbook | None = None


@dataclass(frozen=True)
class PricingResult:
    probability: Decimal
    price_cents: int
    model_probability: Decimal
    orderbook_probability: Decimal | None
    orderbook_weight: Decimal
    time_to_expiry_years: Decimal
    distance_to_target: Decimal
    diagnostics: dict[str, Decimal | None]


class ProbabilityEngine:
    def __init__(
        self,
        min_price: Decimal = Decimal("0.01"),
        max_price: Decimal = Decimal("0.99"),
        base_orderbook_weight: Decimal = Decimal("0.65"),
    ) -> None:
        self.min_price = min_price
        self.max_price = max_price
        self.base_orderbook_weight = base_orderbook_weight

    def price(self, inputs: PricingInput) -> PricingResult:
        now = _as_utc(inputs.now or datetime.now(timezone.utc))
        expiry = _as_utc(inputs.expiry)
        years = max(Decimal("0"), Decimal(str((expiry - now).total_seconds())) / SECONDS_PER_YEAR)

        model_probability = self._model_probability(
            spot=inputs.spot,
            target=inputs.target,
            years=years,
            volatility=inputs.volatility,
            drift=inputs.drift,
        )

        orderbook_probability = inputs.orderbook.yes_mid if inputs.orderbook else None
        orderbook_weight = self._orderbook_weight(inputs.orderbook, years)

        if orderbook_probability is None:
            blended = model_probability
            orderbook_weight = Decimal("0")
        else:
            blended = (Decimal("1") - orderbook_weight) * model_probability + orderbook_weight * orderbook_probability
            imbalance = inputs.orderbook.liquidity_imbalance()
            blended += Decimal("0.03") * imbalance * orderbook_weight

        probability = _clamp(blended, self.min_price, self.max_price)
        price_cents = int((probability * Decimal("100")).quantize(Decimal("1")))
        price_cents = max(1, min(99, price_cents))

        return PricingResult(
            probability=probability,
            price_cents=price_cents,
            model_probability=model_probability,
            orderbook_probability=orderbook_probability,
            orderbook_weight=orderbook_weight,
            time_to_expiry_years=years,
            distance_to_target=(inputs.spot - inputs.target) / inputs.target,
            diagnostics={
                "yes_bid": inputs.orderbook.best_yes_bid if inputs.orderbook else None,
                "yes_ask": inputs.orderbook.implied_yes_ask if inputs.orderbook else None,
                "spread": inputs.orderbook.yes_spread if inputs.orderbook else None,
                "yes_depth_5c": inputs.orderbook.depth("yes") if inputs.orderbook else None,
                "no_depth_5c": inputs.orderbook.depth("no") if inputs.orderbook else None,
                "liquidity_imbalance": inputs.orderbook.liquidity_imbalance() if inputs.orderbook else None,
            },
        )

    def _model_probability(
        self,
        spot: Decimal,
        target: Decimal,
        years: Decimal,
        volatility: Decimal,
        drift: Decimal,
    ) -> Decimal:
        if spot <= 0 or target <= 0:
            raise ValueError("spot and target must be positive")
        if volatility < 0:
            raise ValueError("volatility must be non-negative")
        if years <= 0:
            return Decimal("0.99") if spot > target else Decimal("0.01")
        if volatility == 0:
            forward = spot * Decimal(str(exp(float(drift * years))))
            return Decimal("0.99") if forward > target else Decimal("0.01")

        sigma = float(volatility)
        t = float(years)
        numerator = log(float(spot / target)) + (float(drift) - 0.5 * sigma * sigma) * t
        denominator = sigma * sqrt(t)
        return Decimal(str(_normal_cdf(numerator / denominator)))

    def _orderbook_weight(self, orderbook: Orderbook | None, years: Decimal) -> Decimal:
        if orderbook is None or orderbook.yes_mid is None:
            return Decimal("0")

        spread = orderbook.yes_spread or Decimal("1")
        yes_depth = orderbook.depth("yes")
        no_depth = orderbook.depth("no")
        paired_depth = min(yes_depth, no_depth)

        spread_score = _clamp(Decimal("1") - (spread / Decimal("0.12")), Decimal("0"), Decimal("1"))
        depth_score = _clamp(paired_depth / Decimal("500"), Decimal("0"), Decimal("1"))
        time_score = _clamp(Decimal("1") - years / Decimal("0.03"), Decimal("0.2"), Decimal("1"))

        confidence = Decimal("0.55") * spread_score + Decimal("0.30") * depth_score + Decimal("0.15") * time_score
        return _clamp(self.base_orderbook_weight * confidence, Decimal("0"), Decimal("0.85"))


def _normal_cdf(value: float) -> float:
    return 0.5 * (1.0 + erf(value / sqrt(2.0)))


def _clamp(value: Decimal, low: Decimal, high: Decimal) -> Decimal:
    return max(low, min(high, value))


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)
