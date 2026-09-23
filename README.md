# Cari Takip

Accounts-receivable tracking for small businesses: keep track of customers (companies), their debit/credit transactions and running balances, from the web or from a phone.

Built for our own family business and self-hosted on a Raspberry Pi 5.

## Components

| Folder | What it is | Stack |
|---|---|---|
| `backend/` | REST API: auth, users, companies, transactions, balances, file attachments | NestJS · TypeORM · PostgreSQL |
| `frontend/` | Web panel (dashboard, login) | Next.js · React · TypeScript |
| `mobile/` | Android client | Flutter |

File attachments (e.g. receipts) are stored in MinIO (S3-compatible).

## Highlights

- JWT access + refresh tokens, bcrypt password hashing
- Registration can be switched off in production (`REGISTER_ENABLED`)
- CORS locked to the web panel's origin
- Whole stack runs with a single `docker compose up`

## Running locally

```bash
cp .env.example .env      # fill in DB, JWT and MinIO values
docker compose up -d --build
```

## Status

In active use and development.
