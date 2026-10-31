from typing import Annotated

from fastapi import APIRouter, Depends, Response

from app.core.errors import ErrorResponse
from app.core.permissions import require_admin
from app.dependencies.auth import DatabaseSession
from app.models.user import UserRole
from app.schemas.auth import RegisterRequest, UserResponse
from app.services.auth import AuthenticatedUser, create_account

router = APIRouter(prefix="/staff", tags=["staff"])


@router.post("", status_code=201, response_model=UserResponse,
             responses={code: {"model": ErrorResponse} for code in (401, 403, 409)})
def create_staff(data: RegisterRequest, session: DatabaseSession, response: Response,
                 _admin: Annotated[AuthenticatedUser, Depends(require_admin)]) -> UserResponse:
    response.headers["Cache-Control"] = "no-store"
    return create_account(session, data, role=UserRole.STAFF)
