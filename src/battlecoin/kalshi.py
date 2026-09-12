from __future__ import annotations

import json
import os
import time
from base64 import b64decode, b64encode
from dataclasses import dataclass
from typing import Any
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


PROD_BASE_URL = "https://external-api.kalshi.com/trade-api/v2"
DEMO_BASE_URL = "https://external-api.demo.kalshi.co/trade-api/v2"


@dataclass(frozen=True)
class KalshiClient:
    base_url: str = PROD_BASE_URL
    api_key: str | None = None
    private_key: str | None = None
    timeout: float = 10.0

    @classmethod
    def from_env(cls) -> "KalshiClient":
        env = os.getenv("KALSHI_ENV", "prod").lower()
        base_url = DEMO_BASE_URL if env in {"demo", "sandbox"} else PROD_BASE_URL
        return cls(
            base_url=os.getenv("KALSHI_BASE_URL", base_url).rstrip("/"),
            api_key=os.getenv("KALSHI_API_KEY"),
            private_key=os.getenv("KALSHI_PRIVATE_KEY"),
        )

    def get_market(self, ticker: str) -> dict[str, Any]:
        return self._get(f"/markets/{ticker}")

    def get_orderbook(self, ticker: str, depth: int = 20) -> dict[str, Any]:
        query = f"?{urlencode({'depth': depth})}" if depth else ""
        return self._get(f"/markets/{ticker}/orderbook{query}")

    def _get(self, path: str) -> dict[str, Any]:
        url = f"{self.base_url}{path}"
        headers = {"accept": "application/json"}
        signed = self._signed_headers("GET", path.split("?", 1)[0])
        headers.update(signed)
        request = Request(url, method="GET", headers=headers)
        try:
            with urlopen(request, timeout=self.timeout) as response:
                return json.loads(response.read().decode("utf-8"))
        except HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"Kalshi request failed: HTTP {exc.code} {body}") from exc

    def _signed_headers(self, method: str, path_without_query: str) -> dict[str, str]:
        if not self.api_key or not self.private_key:
            return {}

        try:
            from cryptography.hazmat.primitives import hashes, serialization
            from cryptography.hazmat.primitives.asymmetric import padding
        except ImportError:
            return {}

        timestamp_ms = str(int(time.time() * 1000))
        message = f"{timestamp_ms}{method.upper()}{path_without_query}".encode("utf-8")
        key_text = self.private_key.strip()
        if "BEGIN" in key_text:
            private_key = serialization.load_pem_private_key(key_text.encode("utf-8"), password=None)
        else:
            private_key = serialization.load_der_private_key(b64decode(key_text), password=None)
        signature = private_key.sign(
            message,
            padding.PSS(mgf=padding.MGF1(hashes.SHA256()), salt_length=padding.PSS.DIGEST_LENGTH),
            hashes.SHA256(),
        )
        return {
            "KALSHI-ACCESS-KEY": self.api_key,
            "KALSHI-ACCESS-TIMESTAMP": timestamp_ms,
            "KALSHI-ACCESS-SIGNATURE": b64encode(signature).decode("ascii"),
        }
