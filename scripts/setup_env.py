"""Create backend/.env as a plain-text file. Run from the backend folder:

    .venv/bin/python ../scripts/setup_env.py

Asks for your app password, Zerodha API key and API secret (secret/password hidden), generates the
other secrets, and writes backend/.env. Nothing is printed except the authenticator setup key.
"""
import getpass
import os
import secrets
import sys

import pyotp
from argon2 import PasswordHasher
from cryptography.fernet import Fernet

if not os.path.isdir("app"):
    sys.exit("Run this from the backend folder: cd ~/chaitanya_terminal/backend")
if os.path.exists(".env") and input(".env already exists. Replace it? (y/N): ").strip().lower() != "y":
    sys.exit("Left .env unchanged.")

pw = getpass.getpass("Choose your app password (12+ characters, hidden): ")
if len(pw) < 12 or pw != getpass.getpass("Repeat it: "):
    sys.exit("Passwords did not match or were shorter than 12 characters. Nothing written.")
key = input("Zerodha API key: ").strip()
secret = getpass.getpass("Zerodha API secret (hidden): ").strip()
if not key or not secret:
    sys.exit("API key and secret are both required. Nothing written.")

totp = pyotp.random_base32()
lines = [
    "CT_ENV=development",
    "CT_PUBLIC_BASE_URL=http://127.0.0.1:3000",
    f"CT_PASSWORD_HASH='{PasswordHasher().hash(pw)}'",
    f"CT_TOTP_SECRET={totp}",
    f"CT_SESSION_SECRET={secrets.token_urlsafe(48)}",
    f"CT_TOKEN_ENCRYPTION_KEY={Fernet.generate_key().decode()}",
    f"CT_KITE_API_KEY={key}",
    f"CT_KITE_API_SECRET={secret}",
]
fd = os.open(".env", os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
with os.fdopen(fd, "w") as f:
    f.write("\n".join(lines) + "\n")

print("\nWrote backend/.env (plain text, readable only by you).")
print("\nIn your authenticator app: delete any old 'Chaitanya's Terminal' entry, then")
print("add a new one with 'Enter a setup key', account name 'Terminal', key:\n")
print("   " + " ".join(totp[i:i + 4] for i in range(0, len(totp), 4)))
print("\nThen restart the backend:  .venv/bin/uvicorn app.main:app --port 8000")
