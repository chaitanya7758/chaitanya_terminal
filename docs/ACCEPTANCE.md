# Acceptance checklist

| # | Criterion | Status |
|---|---|---|
| 1 | Opens on iPhone and laptop | Built and checked in iPhone/desktop emulation; not yet deployed |
| 2 | Secure authentication | Password + TOTP, rate-limited, signed cookie, CSRF header; tested |
| 3 | Zerodha connects via official flow | Built; mocked tests pass; real-account test pending |
| 4 | Actual positions and margins displayed | Backend endpoint built; UI pending (stage 6) |
| 5 | Market quotations update reliably | Pending (stage 5) |
| 6 | Expiry schedules current | Pending (stage 4: from Zerodha instrument file) |
| 7 | Fibonacci calculations correct | Tested against hand-calculated vectors (both engines) |
| 8 | Sources and timestamps visible | Status badges in place; live values pending |
| 9 | Risk calculations validated | Phase 2 |
| 10 | Claude and ChatGPT export works | Built and tested |
| 11 | Both responses importable for comparison | Built and tested |
| 12 | No OpenAI/Anthropic API | True; no AI SDKs in dependencies |
| 13 | No live orders possible | Allowlist + build-failing guard test |
| 14 | Deployed securely | Pending your domain/server decision |
