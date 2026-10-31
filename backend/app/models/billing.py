from datetime import date
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import BigInteger, Boolean, CheckConstraint, Date, ForeignKey, Identity, Integer, Numeric, String, Text, UniqueConstraint, Uuid, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.commerce import LineSnapshot


class TaxRate(TimestampMixin, Base):
    __tablename__ = "tax_rates"
    __table_args__ = (CheckConstraint("rate BETWEEN 0 AND 100", name="rate"),)
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(150), unique=True)
    rate: Mapped[Decimal] = mapped_column(Numeric(7, 4))
    description: Mapped[str] = mapped_column(Text, default="", server_default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default=text("true"))


class DiscountRule(TimestampMixin, Base):
    __tablename__ = "discount_rules"
    __table_args__ = (
        CheckConstraint("kind IN ('fixed','percentage') AND value >= 0 AND (kind != 'percentage' OR value <= 100)", name="value_kind"),
        CheckConstraint("minimum_purchase >= 0 AND minimum_quantity >= 1 AND used_count >= 0 AND (usage_limit IS NULL OR usage_limit >= used_count)", name="limits"),
        CheckConstraint("ends_on IS NULL OR starts_on IS NULL OR ends_on >= starts_on", name="dates"),
        CheckConstraint("code = upper(code) AND currency ~ '^[A-Z]{3}$'", name="code_currency"),
    )
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    code: Mapped[str] = mapped_column(String(40), unique=True)
    kind: Mapped[str] = mapped_column(String(12))
    value: Mapped[Decimal] = mapped_column(Numeric(20, 4))
    currency: Mapped[str] = mapped_column(String(3))
    minimum_purchase: Mapped[Decimal] = mapped_column(Numeric(20, 2), default=0, server_default="0")
    minimum_quantity: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    starts_on: Mapped[date | None] = mapped_column(Date)
    ends_on: Mapped[date | None] = mapped_column(Date)
    usage_limit: Mapped[int | None] = mapped_column(Integer)
    used_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default=text("true"))


class Invoice(TimestampMixin, Base):
    __tablename__ = "invoices"
    __table_args__ = (
        UniqueConstraint("subscription_id", "period_index", name="uq_invoices_subscription_period"),
        UniqueConstraint("subscription_id", "period_start", name="uq_invoices_subscription_start"),
        CheckConstraint("period_end > period_start AND due_date >= issue_date AND period_index >= 0", name="dates"),
        CheckConstraint("status IN ('draft','confirmed','paid')", name="status"),
        CheckConstraint("subtotal >= 0 AND discount BETWEEN 0 AND subtotal AND tax >= 0 AND total = subtotal - discount + tax AND amount_paid BETWEEN 0 AND total", name="totals"),
    )
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    number: Mapped[int] = mapped_column(BigInteger, Identity(), unique=True)
    customer_id: Mapped[UUID] = mapped_column(ForeignKey("customers.id"), index=True)
    subscription_id: Mapped[UUID] = mapped_column(ForeignKey("subscriptions.id"), index=True)
    period_index: Mapped[int] = mapped_column(Integer)
    period_start: Mapped[date] = mapped_column(Date)
    period_end: Mapped[date] = mapped_column(Date)
    issue_date: Mapped[date] = mapped_column(Date, index=True)
    due_date: Mapped[date] = mapped_column(Date, index=True)
    status: Mapped[str] = mapped_column(String(15), default="draft", server_default="draft", index=True)
    currency: Mapped[str] = mapped_column(String(3))
    subtotal: Mapped[Decimal] = mapped_column(Numeric(20, 2))
    discount: Mapped[Decimal] = mapped_column(Numeric(20, 2))
    tax: Mapped[Decimal] = mapped_column(Numeric(20, 2))
    total: Mapped[Decimal] = mapped_column(Numeric(20, 2))
    amount_paid: Mapped[Decimal] = mapped_column(Numeric(20, 2), default=0, server_default="0")
    customer_snapshot: Mapped[dict] = mapped_column(JSONB)
    discount_snapshot: Mapped[dict] = mapped_column(JSONB, default=dict)
    lines: Mapped[list["InvoiceLine"]] = relationship(cascade="all, delete-orphan", lazy="raise", order_by="InvoiceLine.position")

    @property
    def invoice_number(self):
        return f"INV-{self.number:08d}"


class InvoiceLine(LineSnapshot, Base):
    __tablename__ = "invoice_lines"
    __table_args__ = (
        CheckConstraint("quantity > 0 AND unit_price >= 0 AND tax_rate BETWEEN 0 AND 100", name="quantity_price"),
        CheckConstraint("subtotal >= 0 AND discount BETWEEN 0 AND subtotal AND tax >= 0 AND total = subtotal - discount + tax", name="totals"),
    )
    invoice_id: Mapped[UUID] = mapped_column(ForeignKey("invoices.id"), index=True)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(20, 2))
    discount: Mapped[Decimal] = mapped_column(Numeric(20, 2))
    tax: Mapped[Decimal] = mapped_column(Numeric(20, 2))
    total: Mapped[Decimal] = mapped_column(Numeric(20, 2))


class DiscountUsage(Base):
    __tablename__ = "discount_usage"
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    discount_id: Mapped[UUID] = mapped_column(ForeignKey("discount_rules.id"), index=True)
    invoice_id: Mapped[UUID] = mapped_column(ForeignKey("invoices.id"), unique=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(20, 2))


class Payment(TimestampMixin, Base):
    __tablename__ = "payments"
    __table_args__ = (
        CheckConstraint("amount > 0", name="positive_amount"),
        CheckConstraint("method IN ('cash','bank_transfer','check','other')", name="method"),
        UniqueConstraint("invoice_id", "reference", name="uq_payments_invoice_reference"),
    )
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    invoice_id: Mapped[UUID] = mapped_column(ForeignKey("invoices.id"), index=True)
    recorded_by: Mapped[UUID] = mapped_column(ForeignKey("users.id"))
    amount: Mapped[Decimal] = mapped_column(Numeric(20, 2))
    method: Mapped[str] = mapped_column(String(20))
    payment_date: Mapped[date] = mapped_column(Date, index=True)
    notes: Mapped[str] = mapped_column(Text, default="", server_default="")
    reference: Mapped[str | None] = mapped_column(String(100))
    idempotency_key: Mapped[UUID] = mapped_column(Uuid, unique=True)
    request_fingerprint: Mapped[str] = mapped_column(String(64))
