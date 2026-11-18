# Known limitations (current)

- Live market data needs the paid Kite Connect plan; the free Personal plan has no quotes or candles.
- Zerodha's access token expires daily (~6 AM IST); a manual Zerodha login is needed every trading day.
- Kite terms allow a private personal interface only. The site must stay single-user and login-protected.
- GIFT NIFTY, Brent, USD/INR spot, US indices, FII/DII flows, news and economic calendar are not from
  Zerodha. They show *Unavailable* until a source is chosen.
- Change in OI needs our own previous-day snapshot, so it is unavailable on the first day.
- IV Rank / Percentile need about a year of stored IV history.
- Index VWAP is not possible (indices have no volume); VWAP will use the current-month future and say so.
- Greeks and IV are model estimates (Black-76) and will be labelled Estimated.
- AI snapshots and comparisons are stored in the browser until the database stage; clearing site data deletes them.
- The Zerodha connection flow is tested against a mocked Zerodha only; it still needs a real-account test.
