from functools import lru_cache
from pathlib import Path
from typing import Literal
from urllib.parse import urlsplit

from pydantic import Field, SecretStr, ValidationError, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict, SettingsError
from sqlalchemy.engine import make_url
from sqlalchemy.exc import ArgumentError

BACKEND_DIR = Path(__file__).resolve().parents[2]
PROJECT_DIR = BACKEND_DIR.parent


class DatabaseSettings(BaseSettings):
    """Process environment > backend/.env > project .env > field defaults."""

    model_config = SettingsConfigDict(
        env_file=(PROJECT_DIR / ".env", BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
        hide_input_in_errors=True,
    )

    database_url: SecretStr = Field(repr=False)
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:3000"])
    cors_allow_credentials: bool = True
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"
    db_pool_size: int = Field(default=5, ge=1, le=50)
    db_max_overflow: int = Field(default=10, ge=0, le=50)
    db_pool_timeout_seconds: int = Field(default=30, ge=1, le=120)
    db_connect_timeout_seconds: int = Field(default=5, ge=1, le=60)

    @field_validator("database_url")
    @classmethod
    def validate_database_url(cls, value: SecretStr) -> SecretStr:
        try:
            url = make_url(value.get_secret_value())
        except (ArgumentError, ValueError):
            raise ValueError("DATABASE_URL must be a valid PostgreSQL URL.") from None
        if url.drivername != "postgresql+psycopg" or not url.database:
            raise ValueError(
                "DATABASE_URL must use postgresql+psycopg and specify a database."
            )
        return value

    @field_validator("cors_origins")
    @classmethod
    def validate_cors_origins(cls, values: list[str]) -> list[str]:
        origins: list[str] = []
        for value in values:
            try:
                parsed = urlsplit(value)
                # Accessing port also rejects malformed and out-of-range ports.
                parsed.port
                valid = (
                    parsed.scheme in {"http", "https"}
                    and bool(parsed.hostname)
                    and parsed.username is None
                    and parsed.password is None
                    and not parsed.path
                    and not parsed.query
                    and not parsed.fragment
                    and value == f"{parsed.scheme}://{parsed.netloc}"
                    and "*" not in value
                    and not any(character.isspace() for character in value)
                )
            except ValueError:
                valid = False
            if not valid:
                raise ValueError(
                    "CORS_ORIGINS must contain explicit HTTP(S) origins without "
                    "credentials, paths, trailing slashes, queries, or wildcards."
                )
            if value not in origins:
                origins.append(value)
        return origins


class Settings(DatabaseSettings):
    billing_due_days: int = Field(default=14, ge=0, le=365)
    billing_currency: str = Field(default="USD", pattern=r"^[A-Z]{3}$")
    jwt_secret_key: SecretStr = Field(repr=False)
    jwt_algorithm: Literal["HS256"] = "HS256"
    jwt_issuer: str = Field(default="steepx", min_length=1, max_length=100)
    jwt_audience: str = Field(default="steepx-api", min_length=1, max_length=100)
    access_token_expire_minutes: int = Field(default=30, ge=1, le=60)

    @field_validator("jwt_secret_key")
    @classmethod
    def validate_jwt_secret(cls, value: SecretStr) -> SecretStr:
        secret = value.get_secret_value()
        if (
            len(secret.encode("utf-8")) < 32
            or len(set(secret)) < 12
            or any(word in secret.lower() for word in (
                "changeme", "change-me", "change_me", "replace", "placeholder",
                "your-secret", "your_secret", "<", ">",
            ))
        ):
            raise ValueError("JWT_SECRET_KEY must be a strong generated secret.")
        return value


@lru_cache(maxsize=1)
def get_database_settings() -> DatabaseSettings:
    try:
        return DatabaseSettings()
    except (ValidationError, SettingsError):
        raise RuntimeError("Invalid database configuration; values omitted.") from None


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    try:
        return Settings()
    except (ValidationError, SettingsError):
        # Settings exceptions can contain environment values, including secrets.
        raise RuntimeError(
            "Invalid backend configuration. Check DATABASE_URL, CORS_ORIGINS, "
            "CORS_ALLOW_CREDENTIALS, LOG_LEVEL, DB pool settings, and JWT settings against "
            "backend/.env.example. "
            "Configuration values are intentionally omitted."
        ) from None
