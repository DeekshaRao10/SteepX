"""Alembic entry point, executed only by an explicitly invoked Alembic command."""

from alembic import context
from sqlalchemy import create_engine, pool

from app import models  # noqa: F401 -- registers models added in future phases
from app.core.config import get_database_settings
from app.core.logging import configure_logging
from app.db.base import Base

settings = get_database_settings()
configure_logging(settings.log_level)
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=settings.database_url.get_secret_value(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    provided_connection = context.config.attributes.get("connection")
    if provided_connection is not None:
        context.configure(connection=provided_connection, target_metadata=target_metadata, compare_type=True)
        with context.begin_transaction():
            context.run_migrations()
        return
    engine = create_engine(
        settings.database_url.get_secret_value(),
        poolclass=pool.NullPool,
        echo=False,
        hide_parameters=True,
        connect_args={"connect_timeout": settings.db_connect_timeout_seconds},
    )
    try:
        with engine.connect() as connection:
            context.configure(
                connection=connection,
                target_metadata=target_metadata,
                compare_type=True,
            )
            with context.begin_transaction():
                context.run_migrations()
    finally:
        engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
