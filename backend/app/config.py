from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All secrets come from environment variables (or a server-side .env). Never committed."""

    model_config = SettingsConfigDict(env_file=".env", env_prefix="CT_", extra="ignore")

    env: str = "development"
    database_url: str = "sqlite:///./dev.db"
    public_base_url: str = "http://localhost:3000"

    # Private login: Argon2 hash of your password + base32 TOTP secret for an authenticator app.
    password_hash: str = ""
    totp_secret: str = ""
    session_secret: str = Field(default="", description="random 64+ chars")
    session_hours: int = 12

    # Zerodha Kite Connect (you create the app at developers.kite.trade).
    kite_api_key: str = ""
    kite_api_secret: str = ""
    # Fernet key used to encrypt the daily Kite access token at rest.
    token_encryption_key: str = ""

    @property
    def secure_cookies(self) -> bool:
        return self.env != "development"


@lru_cache
def get_settings() -> Settings:
    return Settings()
