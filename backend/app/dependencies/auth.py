from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.security import unauthorized
from app.db.session import get_db_session
from app.services.auth import AuthenticatedUser, authenticate

bearer_scheme = HTTPBearer(auto_error=False)
DatabaseSession = Annotated[Session, Depends(get_db_session)]


def request_settings(request: Request) -> Settings:
    return request.app.state.settings


def get_current_user(
    session: DatabaseSession,
    settings: Annotated[Settings, Depends(request_settings)],
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> AuthenticatedUser:
    if credentials is None:
        raise unauthorized()
    return authenticate(session, credentials.credentials, settings)


CurrentUser = Annotated[AuthenticatedUser, Depends(get_current_user)]
