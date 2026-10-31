from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from email_validator import EmailNotValidError, validate_email
from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, SecretStr, field_validator
from pydantic_core import PydanticCustomError

from app.models.user import UserRole


def normalize_email(value: object) -> str:
    if not isinstance(value, str):
        raise PydanticCustomError("email_invalid", "Invalid email address.")
    try:
        result = validate_email(value.strip(), check_deliverability=False, allow_smtputf8=False)
    except EmailNotValidError:
        raise PydanticCustomError("email_invalid", "Invalid email address.") from None
    return result.ascii_email.lower()


NormalizedEmail = Annotated[
    str, BeforeValidator(normalize_email), Field(max_length=254, json_schema_extra={"format": "email"})
]


class Credentials(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)
    email: NormalizedEmail
    password: SecretStr = Field(min_length=1, max_length=128, repr=False)


class RegisterRequest(Credentials):
    @field_validator("password")
    @classmethod
    def check_password(cls, password: SecretStr) -> SecretStr:
        value = password.get_secret_value()
        if not (
            9 <= len(value) <= 128
            and any(c.isupper() for c in value)
            and any(c.islower() for c in value)
            and any(not c.isalnum() and not c.isspace() for c in value)
        ):
            raise PydanticCustomError("password_policy", "Password does not meet policy.")
        return password


class LoginRequest(Credentials):
    pass


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    email: NormalizedEmail
    role: UserRole
    is_active: bool
    created_at: datetime
    updated_at: datetime


class TokenResponse(BaseModel):
    access_token: str = Field(repr=False)
    token_type: Literal["bearer"] = "bearer"
    expires_in: int
