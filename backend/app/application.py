"""Application factory, importable without loading real settings during unit tests."""

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.routing import APIRoute

from app.api.v1.api import api_router
from app.core.config import Settings, get_settings
from app.core.errors import ErrorAwareCORSMiddleware, ErrorResponse, register_error_handlers
from app.core.logging import configure_logging
from app.core.security import dummy_password_hash
from app.db.session import create_database_engine, create_session_factory

logger = logging.getLogger(__name__)


def create_app(settings: Settings | None = None) -> ErrorAwareCORSMiddleware:
    settings = settings or get_settings()
    configure_logging(settings.log_level)

    @asynccontextmanager
    async def lifespan(api: FastAPI) -> AsyncIterator[None]:
        engine = create_database_engine(settings)
        api.state.session_factory = create_session_factory(engine)
        dummy_password_hash()
        logger.info("Backend started; database connectivity has not been checked.")
        try:
            yield
        finally:
            engine.dispose()
            logger.info("Backend stopped.")

    api = FastAPI(
        title="Brightloop Subscription API", version="1.0.0", debug=False,
        lifespan=lifespan,
        responses={
            401: {"model": ErrorResponse, "description": "Missing or invalid authentication"},
            403: {"model": ErrorResponse, "description": "Role not permitted"},
            404: {"model": ErrorResponse, "description": "Resource missing or inaccessible"},
            409: {"model": ErrorResponse, "description": "State or uniqueness conflict"},
            422: {"model": ErrorResponse, "description": "Invalid request data"},
            500: {"model": ErrorResponse, "description": "Unexpected server error"},
        },
    )
    api.state.settings = settings
    register_error_handlers(api)
    def roles(dependency):
        declared = getattr(dependency.call, "allowed_roles", None)
        if declared is not None:
            return declared
        for child in dependency.dependencies:
            found = roles(child)
            if found is not None:
                return found
        return None

    def annotate_routes(router):
        for route in router.routes:
            if isinstance(route, APIRoute):
                allowed = roles(route.dependant)
                if allowed is not None:
                    route.openapi_extra = {"x-roles": allowed}
            elif hasattr(route, "original_router"):
                annotate_routes(route.original_router)

    annotate_routes(api_router)
    api.include_router(api_router)
    return ErrorAwareCORSMiddleware(
        api, allow_origins=settings.cors_origins,
        allow_credentials=settings.cors_allow_credentials,
        allow_methods=["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "Accept", "Idempotency-Key"],
    )
