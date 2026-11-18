# Setup guide

## 1. Run it on your laptop (for testing)

Requirements: Python 3.12+, Node 22+.

```bash
# backend
cd backend
python -m venv .venv
.venv/bin/pip install -r requirements.txt
cd .. && backend/.venv/bin/python scripts/make_secrets.py   # choose a password, scan the QR link into your authenticator app
```

Create `backend/.env` with the printed values plus:

```
CT_ENV=development
CT_PUBLIC_BASE_URL=http://localhost:3000
CT_KITE_API_KEY=your_key
CT_KITE_API_SECRET=your_secret
```

```bash
cd backend && .venv/bin/uvicorn app.main:app --port 8000      # terminal 1
cd frontend && npm ci && npm run dev                           # terminal 2
```

Open http://localhost:3000, sign in with your password and the 6-digit code.

## 2. Zerodha Kite Connect app

1. Go to https://developers.kite.trade and sign in with your Zerodha account.
2. Subscribe to the **Connect** plan (₹500/month, needed for live quotes and candles).
3. Create an app. Set the **Redirect URL** to `https://YOUR-DOMAIN/api/kite/callback`
   (for local testing: `http://127.0.0.1:3000/api/kite/callback`).
4. Copy the API key and secret into the server's `.env`. Never paste them into chat, email or the code.

## 3. Deploy to a server (summary; full guide comes with the deployment stage)

1. Rent a small Linux server in India (2 vCPU / 4 GB) and point your domain's DNS A-record at it.
2. Install Docker. Copy the repo, create `.env` from `.env.example` on the server.
3. `cd deploy && docker compose --env-file ../.env up -d --build`
4. Caddy obtains the HTTPS certificate automatically.
