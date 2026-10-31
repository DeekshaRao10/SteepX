from datetime import date
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Response

from app.core.config import Settings
from app.core.permissions import require_admin, require_operator
from app.dependencies.auth import CurrentUser, DatabaseSession, request_settings
from app.models.billing import DiscountRule, TaxRate
from app.schemas.billing import (DiscountResponse, DiscountWrite, InvoiceGenerate, InvoiceResponse,
    PaymentCreate, PaymentResponse, TaxResponse, TaxWrite)
from app.schemas.common import CalendarDate, Currency, ListQuery, Page
from app.schemas.finance import DashboardResponse, RevenueReport
from app.services import billing, discounts, finance, payments
from app.services.auth import AuthenticatedUser
from app.services.catalog import archive

router = APIRouter(tags=["billing"])
Operator = Annotated[AuthenticatedUser, Depends(require_operator)]
Admin = Annotated[AuthenticatedUser, Depends(require_admin)]
Listing = Annotated[ListQuery, Depends()]
Configuration = Annotated[Settings, Depends(request_settings)]


@router.get("/tax-rates", response_model=Page[TaxResponse])
def tax_rates(query: Listing, session: DatabaseSession, _operator: Operator):
    return discounts.list_taxes(session, query)


@router.post("/tax-rates", response_model=TaxResponse, status_code=201)
def create_tax(data: TaxWrite, session: DatabaseSession, _admin: Admin):
    return discounts.write_tax(session, data)


@router.get("/tax-rates/{rate_id}", response_model=TaxResponse)
def tax_rate(rate_id: UUID, session: DatabaseSession, _operator: Operator):
    return discounts.rule_detail(session, TaxRate, rate_id, TaxResponse)


@router.put("/tax-rates/{rate_id}", response_model=TaxResponse)
def update_tax(rate_id: UUID, data: TaxWrite, session: DatabaseSession, _admin: Admin):
    return discounts.write_tax(session, data, rate_id)


@router.delete("/tax-rates/{rate_id}", status_code=204)
def archive_tax(rate_id: UUID, session: DatabaseSession, _admin: Admin):
    archive(session, TaxRate, rate_id)
    return Response(status_code=204)


@router.get("/discounts", response_model=Page[DiscountResponse])
def discount_rules(query: Listing, session: DatabaseSession, _operator: Operator):
    return discounts.list_discounts(session, query)


@router.post("/discounts", response_model=DiscountResponse, status_code=201)
def create_discount(data: DiscountWrite, session: DatabaseSession, _admin: Admin):
    return discounts.write_discount(session, data)


@router.get("/discounts/{discount_id}", response_model=DiscountResponse)
def discount_rule(discount_id: UUID, session: DatabaseSession, _operator: Operator):
    return discounts.rule_detail(session, DiscountRule, discount_id, DiscountResponse)


@router.put("/discounts/{discount_id}", response_model=DiscountResponse)
def update_discount(discount_id: UUID, data: DiscountWrite, session: DatabaseSession, _admin: Admin):
    return discounts.write_discount(session, data, discount_id)


@router.delete("/discounts/{discount_id}", status_code=204)
def archive_discount(discount_id: UUID, session: DatabaseSession, _admin: Admin):
    archive(session, DiscountRule, discount_id)
    return Response(status_code=204)


@router.post("/subscriptions/{subscription_id}/invoices", response_model=InvoiceResponse, status_code=201)
def generate_invoice(subscription_id: UUID, data: InvoiceGenerate, session: DatabaseSession,
                     operator: Operator, settings: Configuration):
    return billing.generate_invoice(session, subscription_id, data, operator, settings)


@router.get("/invoices", response_model=Page[InvoiceResponse])
def invoices(query: Listing, session: DatabaseSession, identity: CurrentUser,
             status: Literal["draft", "confirmed", "paid", "overdue"] | None = None,
             customer_id: UUID | None = None, subscription_id: UUID | None = None,
             date_from: CalendarDate | None = None, date_to: CalendarDate | None = None):
    return billing.list_invoices(session, query, identity, status, customer_id, subscription_id, date_from, date_to)


@router.get("/invoices/{invoice_id}", response_model=InvoiceResponse)
def invoice(invoice_id: UUID, session: DatabaseSession, identity: CurrentUser):
    return billing.invoice_detail(session, invoice_id, identity)


@router.post("/invoices/{invoice_id}/confirm", response_model=InvoiceResponse)
def confirm_invoice(invoice_id: UUID, session: DatabaseSession, operator: Operator):
    return billing.confirm_invoice(session, invoice_id, operator)


@router.post("/payments", response_model=PaymentResponse, status_code=201)
def create_payment(data: PaymentCreate, session: DatabaseSession, operator: Operator,
                   idempotency_key: Annotated[UUID, Header(alias="Idempotency-Key")]):
    return payments.record_payment(session, data, idempotency_key, operator)


@router.get("/payments", response_model=Page[PaymentResponse])
def payment_records(query: Listing, session: DatabaseSession, identity: CurrentUser,
                    invoice_id: UUID | None = None, date_from: CalendarDate | None = None, date_to: CalendarDate | None = None):
    return payments.list_payments(session, query, identity, invoice_id, date_from, date_to)


@router.get("/payments/{payment_id}", response_model=PaymentResponse)
def payment(payment_id: UUID, session: DatabaseSession, identity: CurrentUser):
    return payments.payment_detail(session, payment_id, identity)


@router.get("/dashboard", response_model=DashboardResponse)
def dashboard(session: DatabaseSession, _operator: Operator, settings: Configuration,
              currency: Currency | None = None, date_from: CalendarDate | None = None, date_to: CalendarDate | None = None,
              customer_id: UUID | None = None):
    return finance.dashboard(session, currency or settings.billing_currency, date_from, date_to, customer_id)


@router.get("/reports/revenue", response_model=RevenueReport)
def revenue(session: DatabaseSession, _operator: Operator, settings: Configuration,
            currency: Currency | None = None, date_from: CalendarDate | None = None, date_to: CalendarDate | None = None,
            granularity: Literal["day", "month"] = "month", customer_id: UUID | None = None):
    return finance.revenue_report(session, currency or settings.billing_currency, date_from, date_to, granularity, customer_id)
