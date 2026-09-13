import json

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


def wallet_response(row) -> dict:
    return {
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
        "username": username,
        "wallet": {"publicKey": body.publicKey, "secretKey": body.secretKey},
    }


@app.post("/login")
async def login(body: LoginBody):
    username = body.username.strip()

    pool = await get_pool()
    row = await pool.fetchrow(
        """
        select u.username, u.password_hash, w.public_key, w.secret_key
        from users u
        join wallets w on w.user_id = u.id
        where u.username = $1
        """,
        username,
    )

    if not row or not bcrypt.checkpw(body.password.encode(), row["password_hash"].encode()):
        raise HTTPException(401, "Invalid username or password.")

    return wallet_response(row)
