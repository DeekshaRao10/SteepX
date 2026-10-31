import logging
import secrets
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import jwt
import pytest
from pydantic import ValidationError

from app.core.config import Settings, get_settings
from app.core.errors import PublicError
from app.core.logging import SafeFormatter
from app.core.security import decode_access_token, hash_password, issue_access_token, verify_password
from app.schemas.auth import RegisterRequest


@pytest.mark.parametrize("candidate", ["Aa!12345", "aaaaaaaaa!", "AAAAAAAAA!", "Abcdefghi1", "Abcdefghi ", "A!" + "a" * 127])
def test_password_policy_rejects(candidate):
    with pytest.raises(ValidationError):
        RegisterRequest(email="unit@example.com", password=candidate)


@pytest.mark.parametrize("candidate", ["Aa!123456", "A!" + "a" * 126])
def test_password_policy_accepts_boundaries(candidate):
    assert RegisterRequest(email="unit@example.com", password=candidate)


def test_idna_email_normalization(password):
    data = RegisterRequest(email=" Person@bücher.de ", password=password)
    assert data.email == "person@xn--bcher-kva.de"


def test_international_local_part_refused(password):
    with pytest.raises(ValidationError):
        RegisterRequest(email="pérson@example.com", password=password)


def test_argon2_salts_and_verifies(password):
    first, second = hash_password(password), hash_password(password)
    assert first.startswith("$argon2id$")
    assert first != second
    assert verify_password(password, first)
    assert not verify_password(secrets.token_urlsafe(20), first)
    assert not verify_password(password, "unrecognized")


@pytest.mark.parametrize("value", ["", "short", "x" * 64, "replace-this-secret-before-production-123456"])
def test_bad_secret_refused(settings, value):
    values = settings.model_dump()
    values["jwt_secret_key"] = value
    with pytest.raises(ValidationError):
        Settings(_env_file=None, **values)


def test_missing_jwt_secret_refused(settings, monkeypatch):
    monkeypatch.delenv("JWT_SECRET_KEY", raising=False)
    values = settings.model_dump(exclude={"jwt_secret_key"})
    with pytest.raises(ValidationError):
        Settings(_env_file=None, **values)


@pytest.mark.parametrize("algorithm", ["none", "HS384", "RS256"])
def test_algorithm_configuration_refused(settings, algorithm):
    with pytest.raises(ValidationError):
        Settings(_env_file=None, **(settings.model_dump() | {"jwt_algorithm": algorithm}))


def test_safe_configuration_failure(monkeypatch):
    monkeypatch.setenv("JWT_SECRET_KEY", "invalid")
    get_settings.cache_clear()
    try:
        with pytest.raises(RuntimeError) as error:
            get_settings()
        assert "values are intentionally omitted" in str(error.value)
        assert "input_value" not in str(error.value)
    finally:
        get_settings.cache_clear()


def test_token_round_trip(settings):
    user_id, session_id = uuid4(), uuid4()
    token, expiry = issue_access_token(user_id, session_id, settings)
    decoded = decode_access_token(token, settings)
    assert decoded.user_id == user_id and decoded.session_id == session_id
    assert decoded.expires_at == expiry


@pytest.mark.parametrize("mutation", ["expired", "signature", "audience", "issuer", "future", "missing", "type", "subject", "jti", "algorithm", "boolean_time", "too_long"])
def test_invalid_claims(settings, mutation):
    now = int(datetime.now(UTC).timestamp())
    claims = {"sub": str(uuid4()), "jti": str(uuid4()), "iat": now, "nbf": now, "exp": now + 60,
              "iss": settings.jwt_issuer, "aud": settings.jwt_audience, "token_type": "access"}
    key = settings.jwt_secret_key.get_secret_value()
    algorithm = "HS256"
    if mutation == "expired":
        claims.update(iat=now - 120, nbf=now - 120, exp=now - 60)
    elif mutation == "signature": key = secrets.token_urlsafe(48)
    elif mutation == "audience": claims["aud"] = "wrong"
    elif mutation == "issuer": claims["iss"] = "wrong"
    elif mutation == "future": claims.update(iat=now + 60, nbf=now + 60, exp=now + 120)
    elif mutation == "missing": del claims["jti"]
    elif mutation == "type": claims["token_type"] = "refresh"
    elif mutation == "subject": claims["sub"] = "not-a-uuid"
    elif mutation == "jti": claims["jti"] = "not-a-uuid"
    elif mutation == "algorithm": algorithm = "HS384"
    elif mutation == "boolean_time": claims["iat"] = True
    elif mutation == "too_long": claims["exp"] = now + 7200
    token = jwt.encode(claims, key, algorithm=algorithm)
    with pytest.raises(PublicError) as error:
        decode_access_token(token, settings)
    assert error.value.status_code == 401


@pytest.mark.parametrize("token", ["", "malformed", "a.b.c", "x" * 4097])
def test_malformed_tokens(settings, token):
    with pytest.raises(PublicError):
        decode_access_token(token, settings)


def test_unsigned_token_refused(settings):
    token = jwt.encode({"sub": str(uuid4())}, key=None, algorithm="none")
    with pytest.raises(PublicError):
        decode_access_token(token, settings)


def test_bootstrap_cli_refuses_noninteractive(monkeypatch, capsys):
    from scripts.bootstrap_admin import main
    import sys
    monkeypatch.setattr(sys.stdin, "isatty", lambda: False)
    assert main() == 1
    assert "interactive terminal" in capsys.readouterr().out


def test_logging_omits_exception_details():
    record = logging.LogRecord("uvicorn.error", logging.ERROR, "", 0,
                               "Traceback (most recent call last): sensitive-placeholder", (), None)
    rendered = SafeFormatter("%(message)s").format(record)
    assert "sensitive-placeholder" not in rendered


def test_process_environment_overrides_files(tmp_path, monkeypatch, settings):
    first, second = tmp_path / "root.env", tmp_path / "backend.env"
    first.write_text("LOG_LEVEL=WARNING\n", encoding="utf-8")
    second.write_text("LOG_LEVEL=ERROR\n", encoding="utf-8")
    values = settings.model_dump(exclude={"log_level"})
    monkeypatch.delenv("LOG_LEVEL", raising=False)
    assert Settings(_env_file=(first, second), **values).log_level == "ERROR"
    monkeypatch.setenv("LOG_LEVEL", "CRITICAL")
    assert Settings(_env_file=(first, second), **values).log_level == "CRITICAL"
