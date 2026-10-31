import logging
from copy import copy
from logging.config import dictConfig


class SafeFormatter(logging.Formatter):
    """Do not render exception values, traceback text, or stack information."""

    def format(self, record: logging.LogRecord) -> str:
        safe_record = copy(record)
        # ASGI lifespan failures may arrive as already-formatted traceback text.
        if (
            safe_record.exc_info
            or safe_record.exc_text
            or safe_record.stack_info
            or "Traceback (most recent call last)" in safe_record.getMessage()
        ):
            safe_record.msg = "Internal error; exception details omitted."
            safe_record.args = ()
            safe_record.exc_info = None
            safe_record.exc_text = None
            safe_record.stack_info = None
        return super().format(safe_record)


def configure_logging(level: str) -> None:
    """Application messages must never include request data or credentials."""
    dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {
                "safe": {
                    "()": SafeFormatter,
                    "format": "%(asctime)s %(levelname)s %(name)s %(message)s",
                }
            },
            "handlers": {
                "console": {
                    "class": "logging.StreamHandler",
                    "formatter": "safe",
                    "stream": "ext://sys.stderr",
                }
            },
            "root": {"handlers": ["console"], "level": level},
            "loggers": {
                "uvicorn": {
                    "handlers": ["console"], "level": level, "propagate": False
                },
                "uvicorn.error": {
                    "handlers": ["console"], "level": level, "propagate": False
                },
                # Access logs include query strings, which may contain tokens.
                "uvicorn.access": {
                    "handlers": [], "level": "CRITICAL", "propagate": False
                },
                "sqlalchemy.engine": {
                    "handlers": ["console"], "level": "WARNING", "propagate": False
                },
                "sqlalchemy.pool": {
                    "handlers": ["console"], "level": "WARNING", "propagate": False
                },
            },
        }
    )
