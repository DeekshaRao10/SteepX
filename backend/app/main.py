import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.v1.api import api_router
from app.core.config import get_settings
from app.core.errors import (
    ErrorAwareCORSMiddleware,
    ErrorResponse,
    register_error_handlers,
)
from app.core.logging import configure_logging
from app.db.session import create_database_engine, create_session_factory

logger = logging.getLogger(__name__)


def create_app() -> ErrorAwareCORSMiddleware:
    settings = get_settings()
    configure_logging(settings.log_level)

    @asynccontextmanager
    async def lifespan(api: FastAPI) -> AsyncIterator[None]:
        engine = create_database_engine(settings)
        api.state.session_factory = create_session_factory(engine)
        logger.info("Backend started; database connectivity has not been checked.")
        try:
            yield
        finally:
            engine.dispose()
            logger.info("Backend stopped.")

    api = FastAPI(
        title="Brightloop Subscription API",
        version="1.0.0",
        debug=False,
        lifespan=lifespan,
        responses={
            422: {"model": ErrorResponse, "description": "Invalid request data"},
            500: {"model": ErrorResponse, "description": "Unexpected server error"},
        },
    )
    register_error_handlers(api)
    api.include_router(api_router)

    # Wrap the entire application so even generic 500 responses receive CORS headers.
    return ErrorAwareCORSMiddleware(
        api,
        allow_origins=settings.cors_origins,
        allow_credentials=settings.cors_allow_credentials,
        allow_methods=["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "Accept", "Idempotency-Key"],
    )


app = create_app()
