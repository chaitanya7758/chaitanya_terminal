from fastapi import FastAPI

from app.api import auth, brief, fibonacci, kite, market, portfolio

app = FastAPI(title="Chaitanya's Terminal API", version="0.1.0", docs_url=None, redoc_url=None)
app.include_router(auth.router)
app.include_router(fibonacci.router)
app.include_router(kite.router)
app.include_router(market.router)
app.include_router(portfolio.router)
app.include_router(brief.router)


@app.middleware("http")
async def security_headers(request, call_next):
    resp = await call_next(request)
    resp.headers.setdefault("X-Content-Type-Options", "nosniff")
    resp.headers.setdefault("X-Frame-Options", "DENY")
    resp.headers.setdefault("Referrer-Policy", "same-origin")
    resp.headers.setdefault("Cache-Control", "no-store")
    return resp


@app.get("/api/health")
def health():
    # Reports only this process. Zerodha / data-feed status is reported separately and never assumed.
    return {"status": "ok", "trading": "read-only", "order_execution": "disabled"}
