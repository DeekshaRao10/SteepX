from datetime import date
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import Boolean, CheckConstraint, Date, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint, Uuid, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class CustomerProfile(TimestampMixin, Base):
    __tablename__ = "customers"
    id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), primary_key=True)
    display_name: Mapped[str] = mapped_column(String(150), default="", server_default="")
    company: Mapped[str] = mapped_column(String(150), default="", server_default="")
    phone: Mapped[str] = mapped_column(String(40), default="", server_default="")
    billing_address: Mapped[str] = mapped_column(Text, default="", server_default="")
    is_active: Mapped[bool] = mapped_column(Boolean, server_default=text("true"), default=True)
    user = relationship("User", lazy="selectin", viewonly=True)

    @property
    def email(self) -> str:
        return self.user.email


class Product(TimestampMixin, Base):
    __tablename__ = "products"
    __table_args__ = (
        CheckConstraint("sales_price >= 0 AND cost >= 0", name="nonnegative_prices"),
        CheckConstraint("currency ~ '^[A-Z]{3}$'", name="currency"),
    )
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(150), unique=True)
    type: Mapped[str] = mapped_column(String(50))
    sales_price: Mapped[Decimal] = mapped_column(Numeric(20, 2))
    cost: Mapped[Decimal] = mapped_column(Numeric(20, 2))
    currency: Mapped[str] = mapped_column(String(3))
    notes: Mapped[str] = mapped_column(Text, default="", server_default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default=text("true"))


class ProductVariant(TimestampMixin, Base):
    __tablename__ = "product_variants"
    __table_args__ = (
        UniqueConstraint("product_id", "name", name="uq_product_variants_product_name"),
        CheckConstraint("additional_price >= 0", name="nonnegative_price"),
        CheckConstraint("kind IN ('variant','addon')", name="kind"),
    )
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    product_id: Mapped[UUID] = mapped_column(ForeignKey("products.id"), index=True)
    name: Mapped[str] = mapped_column(String(150))
    kind: Mapped[str] = mapped_column(String(10))
    additional_price: Mapped[Decimal] = mapped_column(Numeric(20, 2))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default=text("true"))


class SubscriptionPlan(TimestampMixin, Base):
    __tablename__ = "plans"
    __table_args__ = (
        CheckConstraint("price >= 0 AND minimum_quantity >= 1", name="price_quantity"),
        CheckConstraint("billing_interval IN ('daily','weekly','monthly','yearly')", name="interval"),
        CheckConstraint("end_behavior IN ('renew','close')", name="end_behavior"),
        CheckConstraint("available_until IS NULL OR available_from IS NULL OR available_until >= available_from", name="availability"),
    )
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    product_id: Mapped[UUID] = mapped_column(ForeignKey("products.id"), index=True)
    name: Mapped[str] = mapped_column(String(150), unique=True)
    tax_rate_id: Mapped[UUID | None] = mapped_column(ForeignKey("tax_rates.id"))
    description: Mapped[str] = mapped_column(Text, default="", server_default="")
    price: Mapped[Decimal] = mapped_column(Numeric(20, 2))
    billing_interval: Mapped[str] = mapped_column(String(10))
    minimum_quantity: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    available_from: Mapped[date | None] = mapped_column(Date)
    available_until: Mapped[date | None] = mapped_column(Date)
    end_behavior: Mapped[str] = mapped_column(String(10), default="renew", server_default="renew")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default=text("true"))
    product: Mapped[Product] = relationship(lazy="raise")
