"""Diagnose app sign-in problems locally. Prints only yes/no results, never secrets.

Run from the backend folder (with the server stopped):
    .venv/bin/python ../scripts/check_login.py
"""
import getpass
import os
import sys

sys.path.insert(0, os.getcwd())
import pyotp  # noqa: E402
from argon2 import PasswordHasher  # noqa: E402
from argon2.exceptions import InvalidHashError, VerificationError  # noqa: E402

from app.config import Settings  # noqa: E402

print(".env file found here:", os.path.exists(".env"))
s = Settings()
print("Password hash loaded:", s.password_hash.startswith("$argon2"))
print("Authenticator secret loaded:", len(s.totp_secret) >= 16)
print("Session secret loaded:", len(s.session_secret) >= 32)
print("Zerodha key + secret loaded:", bool(s.kite_api_key and s.kite_api_secret))
try:
    PasswordHasher().verify(s.password_hash, getpass.getpass("Type your app password (hidden): "))
    print("Password: OK")
except (VerificationError, InvalidHashError):
    print("Password: does NOT match the hash in .env")
code = input("Type the current 6-digit code: ").strip()
print("Code: OK" if s.totp_secret and pyotp.TOTP(s.totp_secret).verify(code, valid_window=1)
      else "Code: does NOT match (check the setup key in your authenticator app and your Mac's clock)")
