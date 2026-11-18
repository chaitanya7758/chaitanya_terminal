from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

from app.config import get_settings


class Base(DeclarativeBase):
    pass


class KiteSession(Base):
    """One row per successful Zerodha login. Only the newest unexpired row is used."""

    __tablename__ = "kite_session"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    access_token_enc: Mapped[str] = mapped_column(Text)
    user_id_masked: Mapped[str] = mapped_column(String(32))  # e.g. "AB****"
    login_time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked: Mapped[int] = mapped_column(Integer, default=0)


class AuditLog(Base):
    __tablename__ = "audit_log"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    event: Mapped[str] = mapped_column(String(64))
    detail: Mapped[str] = mapped_column(Text, default="")
    ip: Mapped[str] = mapped_column(String(64), default="")


_engine = None
_Session = None


def get_sessionmaker():
    global _engine, _Session
    if _Session is None:
        url = get_settings().database_url
        _engine = create_engine(url, connect_args={"check_same_thread": False} if url.startswith("sqlite") else {})
        Base.metadata.create_all(_engine)  # replaced by Alembic migrations before deployment
        _Session = sessionmaker(_engine, expire_on_commit=False)
    return _Session


def reset_engine():
    global _engine, _Session
    _engine = _Session = None
