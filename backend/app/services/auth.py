from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import select, text, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.errors import PublicError
from app.core.security import (
    decode_access_token, dummy_password_hash, hash_password,
    issue_access_token, unauthorized, verify_password,
)
from app.models import AuthSession, User, UserRole
from app.models.catalog import CustomerProfile
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserResponse


def registration_conflict() -> PublicError:
    return PublicError(409, "registration_conflict", "An account could not be created with these details.")


def _insert_user(session: Session, data: RegisterRequest, role: UserRole, password_hash: str) -> UserResponse:
    user = User(email=str(data.email), password_hash=password_hash, role=role, is_active=True)
    session.add(user)
    session.flush()
    if role == UserRole.CUSTOMER:
        session.add(CustomerProfile(id=user.id))
        session.flush()
    return UserResponse.model_validate(user)


def create_account(session: Session, data: RegisterRequest, *, role: UserRole = UserRole.CUSTOMER) -> UserResponse:
    # Hash before the transaction; uniqueness is ultimately enforced by PostgreSQL.
    password_hash = hash_password(data.password.get_secret_value())
    try:
        with session.begin():
            return _insert_user(session, data, role, password_hash)
    except IntegrityError as exc:
        if getattr(getattr(exc.orig, "diag", None), "constraint_name", None) == "uq_users_email":
            raise registration_conflict() from None
        raise


def login(session: Session, data: LoginRequest, settings: Settings) -> TokenResponse:
    with session.begin():
        user = session.scalar(select(User).where(User.email == str(data.email)).with_for_update())
        candidate_hash = user.password_hash if user is not None else dummy_password_hash()
        valid = verify_password(data.password.get_secret_value(), candidate_hash)
        if user is None or not valid or not user.is_active:
            raise unauthorized()
        session_id = uuid4()
        token, expires_at = issue_access_token(user.id, session_id, settings)
        session.add(AuthSession(id=session_id, user_id=user.id, expires_at=expires_at))
        session.flush()
        return TokenResponse(access_token=token, expires_in=settings.access_token_expire_minutes * 60)


@dataclass(frozen=True)
class AuthenticatedUser:
    profile: UserResponse
    session_id: UUID


def authenticate(session: Session, token: str, settings: Settings) -> AuthenticatedUser:
    claims = decode_access_token(token, settings)
    with session.begin():
        result = session.execute(
            select(User, AuthSession)
            .join(AuthSession, AuthSession.user_id == User.id)
            .where(User.id == claims.user_id, AuthSession.id == claims.session_id)
        ).first()
        if result is None:
            raise unauthorized()
        user, login_session = result
        if (
            not user.is_active or login_session.revoked_at is not None
            or login_session.expires_at <= datetime.now(UTC)
            or login_session.expires_at != claims.expires_at
        ):
            raise unauthorized()
        return AuthenticatedUser(UserResponse.model_validate(user), login_session.id)


def logout(session: Session, identity: AuthenticatedUser) -> None:
    with session.begin():
        session.execute(
            update(AuthSession)
            .where(AuthSession.id == identity.session_id, AuthSession.user_id == identity.profile.id,
                   AuthSession.revoked_at.is_(None))
            .values(revoked_at=datetime.now(UTC))
        )


def bootstrap_admin(session: Session, data: RegisterRequest) -> UserResponse:
    password_hash = hash_password(data.password.get_secret_value())
    try:
        with session.begin():
            # Serialize concurrent invocations without locking unrelated user operations.
            session.execute(text("SELECT pg_advisory_xact_lock(731902210)"))
            if session.scalar(select(User.id).where(User.role == UserRole.ADMIN).limit(1)):
                raise PublicError(409, "admin_exists", "An administrator already exists; bootstrap refused.")
            return _insert_user(session, data, UserRole.ADMIN, password_hash)
    except IntegrityError as exc:
        if getattr(getattr(exc.orig, "diag", None), "constraint_name", None) == "uq_users_email":
            raise registration_conflict() from None
        raise
