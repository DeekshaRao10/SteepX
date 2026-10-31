from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Response

from app.core.permissions import require_operator
from app.dependencies.auth import CurrentUser, DatabaseSession
from app.models.commerce import QuotationTemplate
from app.schemas.common import ListQuery, Page
from app.schemas.commerce import (QuotationResponse, QuotationWrite, QuoteState, RenewalRequest,
    SubscriptionCreate, SubscriptionResponse, SubscriptionState, TemplateResponse, TemplateWrite)
from app.services import commerce as service
from app.services.auth import AuthenticatedUser
from app.services.catalog import archive

router = APIRouter(tags=["agreements"])
Operator = Annotated[AuthenticatedUser, Depends(require_operator)]
Listing = Annotated[ListQuery, Depends()]


@router.get("/quotation-templates", response_model=Page[TemplateResponse])
def templates(query: Listing, session: DatabaseSession, identity: CurrentUser):
    return service.list_templates(session, query, identity)


@router.post("/quotation-templates", response_model=TemplateResponse, status_code=201)
def create_template(data: TemplateWrite, session: DatabaseSession, _operator: Operator):
    return service.write_template(session, data)


@router.get("/quotation-templates/{template_id}", response_model=TemplateResponse)
def template(template_id: UUID, session: DatabaseSession, identity: CurrentUser):
    return service.template_detail(session, template_id, identity)


@router.put("/quotation-templates/{template_id}", response_model=TemplateResponse)
def update_template(template_id: UUID, data: TemplateWrite, session: DatabaseSession, _operator: Operator):
    return service.write_template(session, data, template_id)


@router.delete("/quotation-templates/{template_id}", status_code=204)
def archive_template(template_id: UUID, session: DatabaseSession, _operator: Operator):
    archive(session, QuotationTemplate, template_id)
    return Response(status_code=204)


@router.get("/quotations", response_model=Page[QuotationResponse])
def quotations(query: Listing, session: DatabaseSession, identity: CurrentUser,
               state: QuoteState | None = None, customer_id: UUID | None = None):
    return service.list_quotes(session, query, identity, state, customer_id)


@router.post("/quotations", response_model=QuotationResponse, status_code=201)
def create_quote(data: QuotationWrite, session: DatabaseSession, identity: CurrentUser):
    return service.write_quote(session, data, identity)


@router.get("/quotations/{quotation_id}", response_model=QuotationResponse)
def quotation(quotation_id: UUID, session: DatabaseSession, identity: CurrentUser):
    return service.quote_detail(session, quotation_id, identity)


@router.put("/quotations/{quotation_id}", response_model=QuotationResponse)
def update_quote(quotation_id: UUID, data: QuotationWrite, session: DatabaseSession, identity: CurrentUser):
    return service.write_quote(session, data, identity, quotation_id)


@router.post("/quotations/{quotation_id}/actions/{action}", response_model=QuotationResponse)
def quote_action(quotation_id: UUID, action: Literal["issue", "confirm", "close"], session: DatabaseSession, identity: CurrentUser):
    return service.quote_action(session, quotation_id, identity, action)


@router.get("/subscriptions", response_model=Page[SubscriptionResponse])
def subscriptions(query: Listing, session: DatabaseSession, identity: CurrentUser,
                  state: SubscriptionState | None = None, customer_id: UUID | None = None):
    return service.list_subscriptions(session, query, identity, state, customer_id)


@router.post("/subscriptions", response_model=SubscriptionResponse, status_code=201)
def create_subscription(data: SubscriptionCreate, session: DatabaseSession, identity: CurrentUser):
    return service.create_subscription(session, data.quotation_id, identity)


@router.get("/subscriptions/{subscription_id}", response_model=SubscriptionResponse)
def subscription(subscription_id: UUID, session: DatabaseSession, identity: CurrentUser):
    return service.subscription_detail(session, subscription_id, identity)


@router.post("/subscriptions/{subscription_id}/actions/{action}", response_model=SubscriptionResponse)
def subscription_action(subscription_id: UUID, action: Literal["activate", "pause", "resume", "close"], session: DatabaseSession, identity: CurrentUser):
    return service.subscription_action(session, subscription_id, identity, action)


@router.post("/subscriptions/{subscription_id}/renew", response_model=SubscriptionResponse, status_code=201)
def renew(subscription_id: UUID, data: RenewalRequest, session: DatabaseSession, identity: CurrentUser):
    return service.renew_subscription(session, subscription_id, data, identity)
