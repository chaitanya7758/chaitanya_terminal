# Chaitanya's Terminal

Market Intelligence. Options Analytics. Risk Control.

A private, single-user, mobile-first web app (installable PWA) for NIFTY and SENSEX options
intelligence. It reads your Zerodha account through the official Kite Connect API and **never
places, modifies or cancels orders**. It uses **no OpenAI or Anthropic API**: AI analysis works by
copying a structured snapshot into Claude or ChatGPT yourself.

## Status (Phase 1, in progress)

| Module | State |
|---|---|
| Fibonacci engine + calculator (retracements, extensions, 3-point projection, NIFTY historical preset, copy/export) | Done, tested |
| AI Analysis Centre (snapshot ID, 7 modes, redaction, copy + open Claude/ChatGPT) | Done, tested |
| Claude vs ChatGPT comparison + locked thesis | Done, tested (stored per browser until DB stage) |
| Private login (password + authenticator code) | Done, tested |
| Zerodha connect (official login, encrypted token, daily expiry, read-only guard) | Done, tested with a mocked Zerodha; **not yet tested against a real account** |
| Market Pulse | UI shell only; every value shows *Unavailable* until feeds are wired |
| Instruments/expiry service, live NIFTY/SENSEX feed, option chain | Next |
| Portfolio P&L, 10-point brief, deployment | Planned |

## Layout

```
backend/   FastAPI app (auth, Zerodha read-only client, engines) + pytest suite
frontend/  Next.js 15 + TypeScript + Tailwind PWA + vitest suite
shared/    Hand-calculated test vectors used by both test suites
deploy/    docker-compose + Caddy (automatic HTTPS) for a single server
docs/      Setup, operating guide, formulas, limitations, acceptance checklist
scripts/   make_secrets.py (generates login secrets locally)
```

## Quick start (local)

See [docs/SETUP.md](docs/SETUP.md). Tests:

```
cd backend && python -m venv .venv && .venv/bin/pip install -r requirements.txt && .venv/bin/pytest -q
cd frontend && npm ci && npm test
```

## Safety rules built into the code

- Zerodha calls go through an allowlist of read-only endpoints (`backend/app/integrations/kite.py`).
- `backend/tests/test_readonly_guard.py` fails the build if order-placement code appears anywhere.
- No value is shown without a status: Live, Delayed, Previous Close, Estimated, Calculated, Manual or Unavailable.
