from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.core.errors import PublicError
from app.models.user import UserRole
from app.schemas.common import Page


def today():
    return datetime.now(UTC).date()


def missing():
    return PublicError(404, "not_found", "The requested resource was not found.")


def conflict(message="The operation conflicts with the current resource state."):
    return PublicError(409, "conflict", message)


def customer_scope(statement, model, identity):
    if identity.profile.role == UserRole.CUSTOMER:
        statement = statement.where(model.customer_id == identity.profile.id)
    return statement


def owned(session, model, resource_id, identity, *, lock=False):
    statement = customer_scope(select(model).where(model.id == resource_id), model, identity)
    if hasattr(model, "lines"):
        statement = statement.options(selectinload(model.lines))
    if lock:
        statement = statement.with_for_update()
    record = session.scalar(statement)
    if record is None:
        raise missing()
    return record


def get_record(session, model, resource_id, *, lock=False):
    statement = select(model).where(model.id == resource_id)
    if lock:
        statement = statement.with_for_update()
    record = session.scalar(statement)
    if record is None:
        raise missing()
    return record


def page(session, statement, model, query, schema, *, name_column=None, convert=None):
    if query.q and name_column is not None:
        statement = statement.where(name_column.ilike("%" + query.q.replace("%", r"\%").replace("_", r"\_") + "%"))
    if query.is_active is not None and hasattr(model, "is_active"):
        statement = statement.where(model.is_active == query.is_active)
    total = session.scalar(select(func.count()).select_from(statement.order_by(None).subquery()))
    column = name_column if query.sort.lstrip("-") == "name" and name_column is not None else model.created_at
    statement = statement.order_by(column.desc() if query.sort.startswith("-") else column.asc(), model.id)
    rows = session.scalars(statement.limit(query.limit).offset(query.offset)).all()
    return Page(items=[convert(row) if convert else schema.model_validate(row) for row in rows],
                total=total, limit=query.limit, offset=query.offset)


def flush_unique(session):
    try:
        session.flush()
    except IntegrityError as error:
        if getattr(error.orig, "sqlstate", None) == "23505":
            raise conflict("A record with these unique details already exists.") from None
        raise
