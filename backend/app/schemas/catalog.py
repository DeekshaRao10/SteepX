from datetime import date
from typing import Literal
from uuid import UUID

from pydantic import Field, model_validator

from app.schemas.common import CalendarDate, Currency, InputModel, Name, Price, Record

Interval = Literal["daily", "weekly", "monthly", "yearly"]
EndBehavior = Literal["renew", "close"]


class CustomerUpdate(InputModel):
    display_name: Name = ""
    company: str = Field(default="", max_length=150)
    phone: str = Field(default="", max_length=40)
    billing_address: str = Field(default="", max_length=2000)


class CustomerAdminUpdate(CustomerUpdate):
    is_active: bool = True


class CustomerCreate(CustomerAdminUpdate):
    user_id: UUID


class CustomerResponse(Record):
    email: str
    display_name: str
    company: str
    phone: str
    billing_address: str
    is_active: bool


class ProductWrite(InputModel):
    name: Name
    type: str = Field(min_length=1, max_length=50)
    sales_price: Price
    cost: Price
    currency: Currency = "USD"
    notes: str = Field(default="", max_length=4000)
    is_active: bool = True


class ProductResponse(ProductWrite, Record):
    model_config = {"from_attributes": True}


class VariantWrite(InputModel):
    name: Name
    kind: Literal["variant", "addon"]
    additional_price: Price
    is_active: bool = True


class VariantResponse(VariantWrite, Record):
    model_config = {"from_attributes": True}
    product_id: UUID


class PlanWrite(InputModel):
    product_id: UUID
    tax_rate_id: UUID | None = None
    name: Name
    description: str = Field(default="", max_length=4000)
    price: Price
    billing_interval: Interval
    minimum_quantity: int = Field(default=1, ge=1, le=10000)
    available_from: CalendarDate | None = None
    available_until: CalendarDate | None = None
    end_behavior: EndBehavior = "renew"
    is_active: bool = True

    @model_validator(mode="after")
    def dates(self):
        if self.available_from and self.available_until and self.available_until < self.available_from:
            raise ValueError("Availability dates are reversed.")
        return self


class PlanResponse(PlanWrite, Record):
    model_config = {"from_attributes": True}
    currency: Currency
    product_name: str
