import json
from decimal import Decimal
from typing import Literal

import bcrypt
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from db import get_pool

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class SignupBody(BaseModel):
    username: str
    password: str
    publicKey: str
    secretKey: list[int]


class LoginBody(BaseModel):
    username: str
    password: str


class TradeBody(BaseModel):
    user_id: int
    market_slug: str
    side: Literal["UP", "DOWN"]
    price_cents: float
    notional_usd: float
    kind: Literal["open", "close", "cancel"]


def wallet_response(row) -> dict:
    return {
        "id": row["id"],
        "username": row["username"],
        "wallet": {
            "publicKey": row["public_key"],
            "secretKey": json.loads(row["secret_key"]),
        },
    }


@app.post("/signup")
async def signup(body: SignupBody):
    username = body.username.strip()
    if not username or not body.password:
        raise HTTPException(400, "Username and password are required.")

    password_hash = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode()

    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            existing = await conn.fetchrow("select id from users where username = $1", username)
            if existing:
                raise HTTPException(409, "Username already exists.")

            user_id = await conn.fetchval(
                "insert into users (username, password_hash) values ($1, $2) returning id",
                username,
                password_hash,
            )
            await conn.execute(
                "insert into wallets (user_id, public_key, secret_key) values ($1, $2, $3)",
                user_id,
                body.publicKey,
                json.dumps(body.secretKey),
            )

    return {
        "id": user_id,
        "username": username,
        "wallet": {"publicKey": body.publicKey, "secretKey": body.secretKey},
    }


@app.post("/login")
async def login(body: LoginBody):
    username = body.username.strip()

    pool = await get_pool()
    row = await pool.fetchrow(
        """
        select u.id, u.username, u.password_hash, w.public_key, w.secret_key
        from users u
        join wallets w on w.user_id = u.id
        where u.username = $1
        """,
        username,
    )

    if not row or not bcrypt.checkpw(body.password.encode(), row["password_hash"].encode()):
        raise HTTPException(401, "Invalid username or password.")

    return wallet_response(row)


@app.post("/trades")
async def record_trade(body: TradeBody):
    pool = await get_pool()
    await pool.execute(
        """
        insert into trades (user_id, market_slug, side, price_cents, notional_usd, kind)
        values ($1, $2, $3, $4, $5, $6)
        """,
        body.user_id,
        body.market_slug,
        body.side,
        Decimal(str(round(body.price_cents, 4))),
        Decimal(str(round(body.notional_usd, 4))),
        body.kind,
    )
    return {"ok": True}


@app.get("/trades")
async def list_trades(user_id: int, limit: int = 100):
    pool = await get_pool()
    rows = await pool.fetch(
        """
        select id, time, market_slug, side, price_cents, notional_usd, kind
        from trades
        where user_id = $1
        order by time desc
        limit $2
        """,
        user_id,
        min(max(limit, 1), 200),
    )
    return [
        {
            "id": row["id"],
            "time": row["time"],
            "market_slug": row["market_slug"],
            "side": row["side"],
            "price_cents": float(row["price_cents"]),
            "notional_usd": float(row["notional_usd"]),
            "kind": row["kind"],
        }
        for row in rows
    ]
