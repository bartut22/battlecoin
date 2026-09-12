from __future__ import annotations

import hashlib
import hmac
import json
import os
import time
from base64 import b64decode, b64encode
from dataclasses import dataclass
from decimal import Decimal
from typing import Any
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from .config import load_dotenv


@dataclass(frozen=True)
class KrakenTicker:
    pair: str
    last: Decimal
    bid: Decimal
    ask: Decimal
    volume_today: Decimal
    raw_symbol: str


@dataclass(frozen=True)
class KrakenClient:
    base_url: str = "https://api.kraken.com"
    api_key: str | None = None
    api_secret: str | None = None
    timeout: float = 10.0

    @classmethod
    def from_env(cls) -> "KrakenClient":
        load_dotenv()
        return cls(
            base_url=os.getenv("KRAKEN_BASE_URL", "https://api.kraken.com").rstrip("/"),
            api_key=os.getenv("KRAKEN_API_KEY"),
            api_secret=os.getenv("KRAKEN_API_SECRET"),
        )

    def ticker(self, pair: str = "XBTUSD") -> KrakenTicker:
        payload = self._public("Ticker", {"pair": pair})
        result = payload["result"]
        raw_symbol, data = next(iter(result.items()))
        return KrakenTicker(
            pair=pair,
            raw_symbol=raw_symbol,
            last=Decimal(data["c"][0]),
            bid=Decimal(data["b"][0]),
            ask=Decimal(data["a"][0]),
            volume_today=Decimal(data["v"][1]),
        )

    def _public(self, endpoint: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        query = f"?{urlencode(params)}" if params else ""
        return self._request("GET", f"/0/public/{endpoint}{query}")

    def _private(self, endpoint: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        if not self.api_key or not self.api_secret:
            raise RuntimeError("Kraken private request needs KRAKEN_API_KEY and KRAKEN_API_SECRET")
        body = dict(params or {})
        body["nonce"] = str(int(time.time() * 1000))
        encoded = urlencode(body).encode("utf-8")
        path = f"/0/private/{endpoint}"
        headers = {
            "API-Key": self.api_key,
            "API-Sign": self._sign(path, encoded, body["nonce"]),
            "Content-Type": "application/x-www-form-urlencoded",
        }
        return self._request("POST", path, data=encoded, headers=headers)

    def _request(
        self,
        method: str,
        path: str,
        data: bytes | None = None,
        headers: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        request = Request(
            f"{self.base_url}{path}",
            data=data,
            method=method,
            headers={"Accept": "application/json", **(headers or {})},
        )
        try:
            with urlopen(request, timeout=self.timeout) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"Kraken request failed: HTTP {exc.code} {body}") from exc

        errors = payload.get("error") or []
        if errors:
            raise RuntimeError(f"Kraken API error: {', '.join(errors)}")
        return payload

    def _sign(self, path: str, encoded_body: bytes, nonce: str) -> str:
        digest = hashlib.sha256(nonce.encode("utf-8") + encoded_body).digest()
        signature = hmac.new(b64decode(self.api_secret or ""), path.encode("utf-8") + digest, hashlib.sha512)
        return b64encode(signature.digest()).decode("ascii")
