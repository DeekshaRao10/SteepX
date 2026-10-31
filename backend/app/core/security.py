import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from functools import lru_cache
from uuid import UUID

import jwt
from pwdlib import PasswordHash
from pwdlib.exceptions import UnknownHashError

from app.core.config import Settings
from app.core.errors import PublicError

password_hasher = PasswordHash.recommended()


def unauthorized() -> PublicError:
    return PublicError(401, "unauthenticated", "Invalid credentials or access token.")


def hash_password(password: str) -> str:
    return password_hasher.hash(password)


@lru_cache(maxsize=1)
def dummy_password_hash() -> str:
    return hash_password(secrets.token_urlsafe(32))


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return password_hasher.verify(password, password_hash)
    except UnknownHashError:
        password_hasher.verify(password, dummy_password_hash())
        return False


@dataclass(frozen=True)
class AccessClaims:
    user_id: UUID
    session_id: UUID
    expires_at: datetime


def issue_access_token(user_id: UUID, session_id: UUID, settings: Settings) -> tuple[str, datetime]:
    now = datetime.now(UTC).replace(microsecond=0)
    expiry = now + timedelta(minutes=settings.access_token_expire_minutes)
    token = jwt.encode(
        {
            "sub": str(user_id), "jti": str(session_id),
            "iat": int(now.timestamp()), "nbf": int(now.timestamp()),
            "exp": int(expiry.timestamp()), "iss": settings.jwt_issuer,
            "aud": settings.jwt_audience, "token_type": "access",
        },
        settings.jwt_secret_key.get_secret_value(), algorithm=settings.jwt_algorithm,
    )
    return token, expiry


def decode_access_token(token: str, settings: Settings) -> AccessClaims:
    if len(token) > 4096:
        raise unauthorized()
    try:
        claims = jwt.decode(
            token, settings.jwt_secret_key.get_secret_value(),
            algorithms=[settings.jwt_algorithm], issuer=settings.jwt_issuer,
            audience=settings.jwt_audience,
            options={"require": ["sub", "jti", "iat", "nbf", "exp", "iss", "aud", "token_type"]},
        )
        if (
            claims["token_type"] != "access"
            or any(type(claims[key]) is not int for key in ("iat", "nbf", "exp"))
            or claims["nbf"] != claims["iat"]
            or not 0 < claims["exp"] - claims["iat"] <= settings.access_token_expire_minutes * 60
        ):
            raise ValueError
        user_id, session_id = UUID(claims["sub"]), UUID(claims["jti"])
        return AccessClaims(user_id, session_id, datetime.fromtimestamp(claims["exp"], UTC))
    except (jwt.InvalidTokenError, ValueError, TypeError, KeyError, OverflowError):
        raise unauthorized() from None
