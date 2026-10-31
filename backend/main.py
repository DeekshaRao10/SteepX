"""Compatibility entry point: run ``uvicorn main:app`` from backend/."""

from app.main import app

__all__ = ["app"]
