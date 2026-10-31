from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.catalog import EndBehavior, Interval
from app.schemas.common import CalendarDate, Amount, Currency, InputModel, Name, Price, Record
from app.services.common import today

QuoteState = Literal["draft", "quotation", "confirmed", "active", "closed"]
SubscriptionState = Literal["confirmed", "active", "paused", "closed"]


class LineSelection(InputModel):
    plan_id: UUID
    quantity: int = Field(default=1, ge=1, le=10000)
    variant_ids: list[UUID] = Field(default_factory=list, max_length=20)

    @model_validator(mode="after")
    def distinct_variants(self):
        if len(self.variant_ids) != len(set(self.variant_ids)):
            raise ValueError("Duplicate variant selections are not permitted.")
        return self


class TemplateWrite(InputModel):
    name: Name
    notes: str = Field(default="", max_length=4000)
    selections: list[LineSelection] = Field(min_length=1, max_length=50)
    validity_days: int = Field(default=30, ge=1, le=365)
    is_active: bool = True


class TemplateResponse(TemplateWrite, Record):
    model_config = ConfigDict(from_attributes=True)


class QuotationWrite(InputModel):
    customer_id: UUID | None = None
    template_id: UUID | None = None
    lines: list[LineSelection] = Field(default_factory=list, max_length=50)
    start_date: CalendarDate = Field(default_factory=today)
    end_date: CalendarDate | None = None
    valid_until: CalendarDate | None = None
    notes: str = Field(default="", max_length=4000)
    discount_code: str | None = Field(default=None, pattern=r"^[A-Z0-9_-]{3,40}$")

    @model_validator(mode="after")
    def validate_choice(self):
        if bool(self.lines) == bool(self.template_id):
            raise ValueError("Choose either lines or a template.")
        if self.end_date and self.end_date <= self.start_date:
            raise ValueError("The end date must follow the start date.")
        return self


class VariantSnapshot(BaseModel):
    id: UUID
    name: str
    kind: str
    additional_price: Price


class LineResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    position: int
    plan_id: UUID
    description: str
    quantity: int
    unit_price: Amount
    tax_rate: Decimal
    selected_variants: list[VariantSnapshot]


class QuotationResponse(Record):
    customer_id: UUID
    discount_id: UUID | None
    template_id: UUID | None
    state: QuoteState
    is_expired: bool
    currency: Currency
    billing_interval: Interval
    end_behavior: EndBehavior
    start_date: CalendarDate
    end_date: CalendarDate | None
    valid_until: CalendarDate
    notes: str
    subtotal: Amount
    discount: Amount
    tax: Amount
    total: Amount
    lines: list[LineResponse]


class SubscriptionCreate(InputModel):
    quotation_id: UUID


class RenewalRequest(InputModel):
    start_date: CalendarDate = Field(default_factory=today)
    end_date: CalendarDate | None = None

    @model_validator(mode="after")
    def dates(self):
        if self.end_date and self.end_date <= self.start_date:
            raise ValueError("The end date must follow the start date.")
        return self


class SubscriptionResponse(Record):
    customer_id: UUID
    discount_id: UUID | None
    quotation_id: UUID | None
    renewed_from_id: UUID | None
    state: SubscriptionState
    currency: Currency
    billing_interval: Interval
    end_behavior: EndBehavior
    start_date: CalendarDate
    term_end: CalendarDate | None
    closed_on: CalendarDate | None
    paused_at: datetime | None
    next_period_index: int
    next_billing_date: CalendarDate
    lines: list[LineResponse]
