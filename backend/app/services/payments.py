import hashlib
import json

from sqlalchemy import select

from app.models.billing import Invoice, Payment
from app.models.user import UserRole
from app.schemas.billing import PaymentResponse
from app.services.common import conflict, flush_unique, get_record, missing, page


def fingerprint(data):
    body = data.model_dump(mode="json")
    body["amount"] = format(data.amount, ".2f")
    return hashlib.sha256(json.dumps(body, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def record_payment(session, data, key, identity):
    digest = fingerprint(data)
    with session.begin():
        invoice = get_record(session, Invoice, data.invoice_id, lock=True)
        existing = session.scalar(select(Payment).where(Payment.idempotency_key == key))
        if existing:
            if existing.request_fingerprint != digest:
                raise conflict("This idempotency key has already been used for a different payment.")
            return PaymentResponse.model_validate(existing)
        if invoice.status not in {"confirmed", "paid"}:
            raise conflict("Confirm the invoice before recording a payment.")
        if data.payment_date < invoice.issue_date:
            raise conflict("Payment cannot precede invoice issuance.")
        if data.amount > invoice.total - invoice.amount_paid:
            raise conflict("Payment exceeds the outstanding balance.")
        payment = Payment(**data.model_dump(), idempotency_key=key, request_fingerprint=digest,
                          recorded_by=identity.profile.id)
        session.add(payment)
        invoice.amount_paid += data.amount
        if invoice.amount_paid == invoice.total:
            invoice.status = "paid"
        flush_unique(session)
        return PaymentResponse.model_validate(payment)


def payment_detail(session, payment_id, identity):
    with session.begin():
        statement = select(Payment).join(Invoice).where(Payment.id == payment_id)
        if identity.profile.role == UserRole.CUSTOMER:
            statement = statement.where(Invoice.customer_id == identity.profile.id)
        record = session.scalar(statement)
        if record is None: raise missing()
        return PaymentResponse.model_validate(record)


def list_payments(session, query, identity, invoice_id=None, date_from=None, date_to=None):
    if date_from and date_to and date_to < date_from:
        from app.core.errors import PublicError
        raise PublicError(422, "validation_error", "The date range is reversed.")
    with session.begin():
        statement = select(Payment).join(Invoice)
        if identity.profile.role == UserRole.CUSTOMER:
            statement = statement.where(Invoice.customer_id == identity.profile.id)
        if invoice_id: statement = statement.where(Payment.invoice_id == invoice_id)
        if date_from: statement = statement.where(Payment.payment_date >= date_from)
        if date_to: statement = statement.where(Payment.payment_date <= date_to)
        return page(session, statement, Payment, query, PaymentResponse)
