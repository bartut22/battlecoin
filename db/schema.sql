-- Battlecoin schema (Tiger Data / TimescaleDB). Drop-and-recreate, no migrations tool.

drop table if exists trades cascade;
drop table if exists wallets cascade;
drop table if exists users cascade;

create table users (
  id bigserial primary key,
  username text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table wallets (
  user_id bigint primary key references users(id) on delete cascade,
  public_key text not null unique,
  secret_key text not null, -- devnet only; see CLAUDE.md for the custody tradeoff this accepts
  created_at timestamptz not null default now()
);

-- Trading activity. Hypertable: this is the actual time-series data in the
-- schema, partitioned by time for fast recent-activity queries.
create table trades (
  id bigserial,
  time timestamptz not null default now(),
  user_id bigint not null references users(id) on delete cascade,
  market_slug text not null,
  side text not null check (side in ('UP', 'DOWN')),
  price_cents numeric not null,
  notional_usd numeric not null,
  kind text not null check (kind in ('open', 'close', 'cancel')),
  primary key (id, time)
);

select create_hypertable('trades', 'time');

create index on trades (user_id, time desc);
create index on trades (market_slug, time desc);
