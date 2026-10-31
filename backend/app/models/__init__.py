"""Import concrete models so Alembic discovers their metadata."""

from app.models.auth_session import AuthSession
from app.models.user import User, UserRole
from app.models.catalog import CustomerProfile, Product, ProductVariant, SubscriptionPlan
from app.models.commerce import Quotation, QuotationLine, QuotationTemplate, Subscription, SubscriptionLine
from app.models.billing import TaxRate, DiscountRule, Invoice, InvoiceLine, DiscountUsage, Payment
from app.models.demo import DemoRun

__all__ = ["AuthSession", "User", "UserRole"]
