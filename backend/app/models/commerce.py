from datetime import date, datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, Uuid, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class QuotationTemplate(TimestampMixin, Base):
    __tablename__ = "quotation_templates"
    __table_args__ = (CheckConstraint("validity_days BETWEEN 1 AND 365", name="validity_days"),)
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(150), unique=True)
    notes: Mapped[str] = mapped_column(Text, default="", server_default="")
    selections: Mapped[list] = mapped_column(JSONB)
    validity_days: Mapped[int] = mapped_column(Integer, default=30, server_default="30")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default=text("true"))


class Quotation(TimestampMixin, Base):
    __tablename__ = "quotations"
    __table_args__ = (
        CheckConstraint("state IN ('draft','quotation','confirmed','active','closed')", name="state"),
        CheckConstraint("end_date IS NULL OR end_date > start_date", name="term_dates"),
        CheckConstraint("subtotal >= 0 AND discount >= 0 AND tax >= 0 AND total = subtotal - discount + tax AND discount <= subtotal", name="totals"),
    )
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    customer_id: Mapped[UUID] = mapped_column(ForeignKey("customers.id"), index=True)
    template_id: Mapped[UUID | None] = mapped_column(ForeignKey("quotation_templates.id"))
    discount_id: Mapped[UUID | None] = mapped_column(ForeignKey("discount_rules.id"))
    state: Mapped[str] = mapped_column(String(15), default="draft", server_default="draft", index=True)
    currency: Mapped[str] = mapped_column(String(3))
    billing_interval: Mapped[str] = mapped_column(String(10))
    end_behavior: Mapped[str] = mapped_column(String(10))
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    valid_until: Mapped[date] = mapped_column(Date, index=True)
    notes: Mapped[str] = mapped_column(Text, default="", server_default="")
    subtotal: Mapped[Decimal] = mapped_column(Numeric(20, 2))
    discount: Mapped[Decimal] = mapped_column(Numeric(20, 2), default=0, server_default="0")
    tax: Mapped[Decimal] = mapped_column(Numeric(20, 2), default=0, server_default="0")
    total: Mapped[Decimal] = mapped_column(Numeric(20, 2))
    lines: Mapped[list["QuotationLine"]] = relationship(back_populates="quotation", cascade="all, delete-orphan", lazy="raise", order_by="QuotationLine.position")


class LineSnapshot:
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    position: Mapped[int] = mapped_column(Integer)
    plan_id: Mapped[UUID] = mapped_column(ForeignKey("plans.id"))
    description: Mapped[str] = mapped_column(Text)
    quantity: Mapped[int] = mapped_column(Integer)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(20, 2))
    tax_rate: Mapped[Decimal] = mapped_column(Numeric(7, 4), default=0, server_default="0")
    selected_variants: Mapped[list] = mapped_column(JSONB, default=list)


class QuotationLine(LineSnapshot, Base):
    __tablename__ = "quotation_lines"
    __table_args__ = (CheckConstraint("quantity > 0 AND unit_price >= 0 AND tax_rate BETWEEN 0 AND 100", name="amounts"),)
    quotation_id: Mapped[UUID] = mapped_column(ForeignKey("quotations.id"), index=True)
    quotation: Mapped[Quotation] = relationship(back_populates="lines")


class Subscription(TimestampMixin, Base):
    __tablename__ = "subscriptions"
    __table_args__ = (
        CheckConstraint("state IN ('confirmed','active','paused','closed')", name="state"),
        CheckConstraint("term_end IS NULL OR term_end > start_date", name="term_dates"),
        CheckConstraint("next_period_index >= 0", name="period_index"),
    )
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    customer_id: Mapped[UUID] = mapped_column(ForeignKey("customers.id"), index=True)
    quotation_id: Mapped[UUID | None] = mapped_column(ForeignKey("quotations.id"), unique=True)
    discount_id: Mapped[UUID | None] = mapped_column(ForeignKey("discount_rules.id"))
    renewed_from_id: Mapped[UUID | None] = mapped_column(ForeignKey("subscriptions.id"), unique=True)
    state: Mapped[str] = mapped_column(String(15), default="confirmed", server_default="confirmed", index=True)
    currency: Mapped[str] = mapped_column(String(3))
    billing_interval: Mapped[str] = mapped_column(String(10))
    end_behavior: Mapped[str] = mapped_column(String(10))
    start_date: Mapped[date] = mapped_column(Date)
    term_end: Mapped[date | None] = mapped_column(Date)
    closed_on: Mapped[date | None] = mapped_column(Date)
    paused_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    next_period_index: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    next_billing_date: Mapped[date] = mapped_column(Date, index=True)
    lines: Mapped[list["SubscriptionLine"]] = relationship(cascade="all, delete-orphan", lazy="raise", order_by="SubscriptionLine.position")


class SubscriptionLine(LineSnapshot, Base):
    __tablename__ = "subscription_lines"
    __table_args__ = (CheckConstraint("quantity > 0 AND unit_price >= 0 AND tax_rate BETWEEN 0 AND 100", name="amounts"),)
    subscription_id: Mapped[UUID] = mapped_column(ForeignKey("subscriptions.id"), index=True)
