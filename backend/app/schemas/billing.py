from datetime import date
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import ConfigDict, Field, model_validator

from app.schemas.common import CalendarDate, Amount, Currency, InputModel, Name, Record
from app.schemas.commerce import LineResponse
from app.services.common import today


class TaxWrite(InputModel):
    name: Name
    rate: Decimal = Field(ge=0, le=100, max_digits=7, decimal_places=4)
    description: str = Field(default="", max_length=2000)
    is_active: bool = True


class TaxResponse(TaxWrite, Record):
    model_config = ConfigDict(from_attributes=True)


class DiscountWrite(InputModel):
    code: str = Field(pattern=r"^[A-Z0-9_-]{3,40}$")
    kind: Literal["fixed", "percentage"]
    value: Decimal = Field(ge=0, max_digits=20, decimal_places=4)
    currency: Currency = "USD"
    minimum_purchase: Amount = Decimal(0)
    minimum_quantity: int = Field(default=1, ge=1, le=1000000)
    starts_on: CalendarDate | None = None
    ends_on: CalendarDate | None = None
    usage_limit: int | None = Field(default=None, ge=1)
    is_active: bool = True

    @model_validator(mode="after")
    def rules(self):
        if self.kind == "percentage" and self.value > 100:
            raise ValueError("Percentage exceeds 100.")
        if self.kind == "fixed" and self.value != self.value.quantize(Decimal("0.01")):
            raise ValueError("Fixed discounts use two decimal places.")
        if self.starts_on and self.ends_on and self.ends_on < self.starts_on:
            raise ValueError("Discount dates are reversed.")
        return self


class DiscountResponse(DiscountWrite, Record):
    model_config = ConfigDict(from_attributes=True)
    used_count: int


class InvoiceGenerate(InputModel):
    period_start: CalendarDate
    issue_date: CalendarDate = Field(default_factory=today)
    due_date: CalendarDate | None = None

    @model_validator(mode="after")
    def dates(self):
        if self.issue_date < self.period_start or self.issue_date > today():
            raise ValueError("Issue date must be between the period start and today.")
        if self.due_date and self.due_date < self.issue_date:
            raise ValueError("Due date cannot precede issue date.")
        return self


class InvoiceLineResponse(LineResponse):
    subtotal: Amount
    discount: Amount
    tax: Amount
    total: Amount


class CustomerSnapshot(InputModel):
    display_name: str
    company: str
    billing_address: str
    email: str


class DiscountSnapshot(InputModel):
    code: str | None = None
    kind: Literal["fixed", "percentage"] | None = None
    value: Decimal | None = None
    eligibility: str | None = None


class InvoiceResponse(Record):
    invoice_number: str
    customer_id: UUID
    subscription_id: UUID
    period_index: int
    period_start: CalendarDate
    period_end: CalendarDate
    issue_date: CalendarDate
    due_date: CalendarDate
    status: Literal["draft", "confirmed", "paid", "overdue"]
    currency: Currency
    subtotal: Amount
    discount: Amount
    tax: Amount
    total: Amount
    amount_paid: Amount
    outstanding_balance: Amount
    customer_snapshot: CustomerSnapshot
    discount_snapshot: DiscountSnapshot
    lines: list[InvoiceLineResponse]


class PaymentCreate(InputModel):
    invoice_id: UUID
    amount: Decimal = Field(gt=0, max_digits=20, decimal_places=2)
    method: Literal["cash", "bank_transfer", "check", "other"]
    payment_date: CalendarDate
    notes: str = Field(default="", max_length=2000)
    reference: str | None = Field(default=None, min_length=1, max_length=100)

    @model_validator(mode="after")
    def dates(self):
        if self.payment_date > today():
            raise ValueError("Payment date cannot be in the future.")
        return self


class PaymentResponse(Record):
    invoice_id: UUID
    recorded_by: UUID
    amount: Amount
    method: str
    payment_date: CalendarDate
    notes: str
    reference: str | None
