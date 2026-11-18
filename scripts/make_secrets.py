"""Generate login secrets locally. Prints values to paste into the server's .env.

Usage:  python scripts/make_secrets.py
Needs: pip install argon2-cffi pyotp cryptography
"""
import getpass
import secrets

import pyotp
from argon2 import PasswordHasher
from cryptography.fernet import Fernet

pw = getpass.getpass("Choose a strong app password (min 12 chars): ")
if len(pw) < 12 or pw != getpass.getpass("Repeat: "):
    raise SystemExit("Passwords do not match or are too short.")
totp = pyotp.random_base32()
print("\nCT_PASSWORD_HASH='" + PasswordHasher().hash(pw) + "'")
print("CT_TOTP_SECRET=" + totp)
print("CT_SESSION_SECRET=" + secrets.token_urlsafe(48))
print("CT_TOKEN_ENCRYPTION_KEY=" + Fernet.generate_key().decode())
print("\nAdd this to your authenticator app (Google Authenticator, 1Password, etc.):")
print(pyotp.TOTP(totp).provisioning_uri(name="owner", issuer_name="Chaitanya's Terminal"))
