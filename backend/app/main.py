"""Production entry point; the factory is separate to isolate test configuration."""

from app.application import create_app

app = create_app()
