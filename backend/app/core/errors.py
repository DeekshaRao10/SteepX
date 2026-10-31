import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel, Field
from starlette.datastructures import Headers
from starlette.exceptions import HTTPException
from starlette.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse, Response

logger = logging.getLogger(__name__)


class ErrorDetail(BaseModel):
    location: list[str | int]
    code: str
    message: str


class ErrorBody(BaseModel):
    code: str
    message: str
    details: list[ErrorDetail] = Field(default_factory=list)


class ErrorResponse(BaseModel):
    error: ErrorBody


HTTP_ERRORS: dict[int, tuple[str, str]] = {
    400: ("bad_request", "The request could not be accepted."),
    401: ("unauthenticated", "Authentication is required."),
    403: ("forbidden", "You do not have permission to perform this action."),
    404: ("not_found", "The requested resource was not found."),
    405: ("method_not_allowed", "This HTTP method is not allowed for this resource."),
    409: ("conflict", "The request conflicts with the current resource state."),
    422: ("validation_error", "The request contains invalid data."),
    429: ("rate_limited", "Too many requests. Please try again later."),
    500: ("internal_server_error", "An unexpected error occurred."),
    503: ("service_unavailable", "The service is temporarily unavailable."),
}

VALIDATION_MESSAGES = {
    "missing": "This field is required.",
    "extra_forbidden": "This field is not allowed.",
    "json_invalid": "The request body must contain valid JSON.",
    "string_type": "A text value is required.",
    "int_type": "An integer is required.",
    "int_parsing": "An integer is required.",
    "bool_type": "A boolean is required.",
    "bool_parsing": "A boolean is required.",
}


def error_response(
    status_code: int,
    code: str,
    message: str,
    *,
    details: list[ErrorDetail] | None = None,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    body = ErrorResponse(
        error=ErrorBody(code=code, message=message, details=details or [])
    )
    return JSONResponse(
        status_code=status_code, content=body.model_dump(mode="json"), headers=headers
    )


async def http_error_handler(_request: Request, exc: HTTPException) -> JSONResponse:
    code, message = HTTP_ERRORS.get(
        exc.status_code,
        ("internal_server_error", "An unexpected error occurred.")
        if exc.status_code >= 500
        else ("http_error", "The request could not be completed."),
    )
    # HTTPException.detail is deliberately not reflected: it can contain internals.
    return error_response(exc.status_code, code, message, headers=exc.headers)


async def validation_error_handler(
    _request: Request, exc: RequestValidationError
) -> JSONResponse:
    details = [
        ErrorDetail(
            location=list(error.get("loc", ())),
            code=error["type"],
            message=VALIDATION_MESSAGES.get(error["type"], "Invalid value."),
        )
        for error in exc.errors()
    ]
    # Never return input, ctx, or raw validation messages containing submitted values.
    return error_response(422, *HTTP_ERRORS[422], details=details)


async def unexpected_error_handler(_request: Request, _exc: Exception) -> JSONResponse:
    logger.error("Unhandled application error; returning a generic HTTP 500 response.")
    return error_response(500, *HTTP_ERRORS[500])


def register_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(HTTPException, http_error_handler)
    app.add_exception_handler(RequestValidationError, validation_error_handler)
    app.add_exception_handler(Exception, unexpected_error_handler)


class ErrorAwareCORSMiddleware(CORSMiddleware):
    """Preserve standard CORS behavior while giving rejected preflights JSON errors."""

    def preflight_response(self, request_headers: Headers) -> Response:
        response = super().preflight_response(request_headers)
        if response.status_code != 400:
            return response
        headers = {
            key: value
            for key, value in response.headers.items()
            if key.lower() not in {"content-length", "content-type"}
        }
        return error_response(
            400,
            "cors_not_allowed",
            "The cross-origin request is not permitted.",
            headers=headers,
        )
