from collections.abc import Iterator

from fastapi import Request
from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import DatabaseSettings


def create_database_engine(settings: DatabaseSettings) -> Engine:
    """Create an engine without opening a connection or issuing SQL."""
    return create_engine(
        settings.database_url.get_secret_value(),
        echo=False,
        hide_parameters=True,
        pool_pre_ping=True,
        pool_size=settings.db_pool_size,
        max_overflow=settings.db_max_overflow,
        pool_timeout=settings.db_pool_timeout_seconds,
        connect_args={"connect_timeout": settings.db_connect_timeout_seconds},
    )


def create_session_factory(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(
        bind=engine,
        class_=Session,
        autoflush=False,
        expire_on_commit=False,
        autobegin=False,
    )


def get_db_session(request: Request) -> Iterator[Session]:
    """Yield one session; close and roll back unfinished work when the request ends.

    Services must use ``with session.begin():`` for reads and writes. This
    dependency never commits. Repositories must not commit independently.
    """
    factory: sessionmaker[Session] = request.app.state.session_factory
    with factory() as session:
        yield session
