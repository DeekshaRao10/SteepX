from fastapi import APIRouter

from app.schemas.health import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse, summary="Application liveness")
def health_check() -> HealthResponse:
    """Report application liveness only; no database connection or query is made."""
    return HealthResponse(status="ok", service="Brightloop Subscription API")
