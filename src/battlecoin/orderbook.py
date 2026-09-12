from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Iterable


@dataclass(frozen=True)
class BookLevel:
    price: Decimal
    quantity: Decimal


@dataclass(frozen=True)
class Orderbook:
    yes: tuple[BookLevel, ...]
    no: tuple[BookLevel, ...]

    @classmethod
    def from_kalshi(cls, payload: dict) -> "Orderbook":
        raw = payload.get("orderbook_fp") or payload.get("orderbook") or {}
        return cls(
            yes=_parse_levels(raw.get("yes_dollars") or raw.get("yes") or []),
            no=_parse_levels(raw.get("no_dollars") or raw.get("no") or []),
        )

    @property
    def best_yes_bid(self) -> Decimal | None:
        return self.yes[-1].price if self.yes else None

    @property
    def best_no_bid(self) -> Decimal | None:
        return self.no[-1].price if self.no else None

    @property
    def implied_yes_ask(self) -> Decimal | None:
        if self.best_no_bid is None:
            return None
        return Decimal("1") - self.best_no_bid

    @property
    def yes_mid(self) -> Decimal | None:
        if self.best_yes_bid is None or self.implied_yes_ask is None:
            return None
        return (self.best_yes_bid + self.implied_yes_ask) / Decimal("2")

    @property
    def yes_spread(self) -> Decimal | None:
        if self.best_yes_bid is None or self.implied_yes_ask is None:
            return None
        return max(Decimal("0"), self.implied_yes_ask - self.best_yes_bid)

    def depth(self, side: str, width: Decimal = Decimal("0.05")) -> Decimal:
        levels = self.yes if side == "yes" else self.no
        if not levels:
            return Decimal("0")
        best = levels[-1].price
        total = Decimal("0")
        for level in reversed(levels):
            if best - level.price <= width:
                total += level.quantity
            else:
                break
        return total

    def liquidity_imbalance(self, width: Decimal = Decimal("0.05")) -> Decimal:
        yes_depth = self.depth("yes", width)
        no_depth = self.depth("no", width)
        total = yes_depth + no_depth
        if total <= 0:
            return Decimal("0")
        return (yes_depth - no_depth) / total


def _parse_levels(levels: Iterable[Iterable[str | int | float | Decimal]]) -> tuple[BookLevel, ...]:
    parsed = [BookLevel(Decimal(str(price)), Decimal(str(quantity))) for price, quantity in levels]
    return tuple(sorted(parsed, key=lambda level: level.price))
