from datetime import date, datetime
import re
from decimal import Decimal
from typing import Annotated, Generic, Literal, TypeVar
from uuid import UUID

from pydantic import AfterValidator, BaseModel, BeforeValidator, ConfigDict, Field, model_validator
from pydantic_core import PydanticCustomError


def calendar_date(value):
    if type(value) is date or (isinstance(value, str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}", value)):
        return value
    raise PydanticCustomError("calendar_date", "Use a YYYY-MM-DD calendar date.")


CalendarDate = Annotated[date, BeforeValidator(calendar_date)]

Price = Annotated[Decimal, Field(ge=0, le=Decimal("999999999.99"), max_digits=20, decimal_places=2)]
Amount = Annotated[Decimal, Field(ge=0, max_digits=20, decimal_places=2), AfterValidator(lambda value: value.quantize(Decimal("0.01")))]
Currency = Annotated[str, Field(pattern=r"^[A-Z]{3}$")]
Name = Annotated[str, Field(min_length=1, max_length=150)]


class InputModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True, hide_input_in_errors=True)


class PatchModel(InputModel):
    @model_validator(mode="after")
    def nonempty(self):
        if not self.model_fields_set:
            raise ValueError("Provide at least one field.")
        return self


class Record(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    created_at: datetime
    updated_at: datetime


class ListQuery(InputModel):
    limit: int = Field(default=20, ge=1, le=100)
    offset: int = Field(default=0, ge=0, le=1000000)
    q: str | None = Field(default=None, max_length=100)
    sort: Literal["created_at", "-created_at", "name", "-name"] = "-created_at"
    is_active: bool | None = None


T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    limit: int
    offset: int
