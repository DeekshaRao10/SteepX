from typing import Annotated

from fastapi import APIRouter, Depends, Response, status

from app.core.config import Settings
from app.core.errors import ErrorResponse
from app.dependencies.auth import CurrentUser, DatabaseSession, request_settings
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserResponse
from app.services import auth as service

router = APIRouter(prefix="/auth", tags=["authentication"])


@router.post("/register", response_model=UserResponse, status_code=201,
             responses={409: {"model": ErrorResponse}})
def register(data: RegisterRequest, session: DatabaseSession, response: Response) -> UserResponse:
    response.headers["Cache-Control"] = "no-store"
    return service.create_account(session, data)


@router.post("/login", response_model=TokenResponse, responses={401: {"model": ErrorResponse}})
def login(data: LoginRequest, session: DatabaseSession, response: Response,
          settings: Annotated[Settings, Depends(request_settings)]) -> TokenResponse:
    response.headers["Cache-Control"] = "no-store"
    response.headers["Pragma"] = "no-cache"
    return service.login(session, data, settings)


@router.get("/me", response_model=UserResponse, responses={401: {"model": ErrorResponse}})
def me(identity: CurrentUser, response: Response) -> UserResponse:
    response.headers["Cache-Control"] = "no-store"
    return identity.profile


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT,
             responses={401: {"model": ErrorResponse}})
def logout(identity: CurrentUser, session: DatabaseSession) -> Response:
    service.logout(session, identity)
    return Response(status_code=204, headers={"Cache-Control": "no-store"})
