from sqlalchemy import String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class DemoRun(TimestampMixin, Base):
    """Explicit seed receipt, never populated by application startup; no credentials."""
    __tablename__ = "demo_runs"
    key: Mapped[str] = mapped_column(String(50), primary_key=True)
    records: Mapped[dict] = mapped_column(JSONB)
