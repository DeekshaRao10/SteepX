from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response

from app.core.permissions import require_operator
from app.dependencies.auth import CurrentUser, DatabaseSession
from app.models.catalog import CustomerProfile, Product, ProductVariant, SubscriptionPlan
from app.schemas.catalog import (CustomerAdminUpdate, CustomerCreate, CustomerResponse, CustomerUpdate,
    Interval, PlanResponse, PlanWrite, ProductResponse, ProductWrite, VariantResponse, VariantWrite)
from app.schemas.common import ListQuery, Page
from app.services import catalog as service
from app.services.auth import AuthenticatedUser

router = APIRouter(tags=["catalog"])
Operator = Annotated[AuthenticatedUser, Depends(require_operator)]
Listing = Annotated[ListQuery, Depends()]


@router.get("/customers/me", response_model=CustomerResponse)
def my_profile(session: DatabaseSession, identity: CurrentUser):
    return service.customer_profile(session, identity)


@router.patch("/customers/me", response_model=CustomerResponse)
def update_my_profile(data: CustomerUpdate, session: DatabaseSession, identity: CurrentUser):
    return service.customer_profile(session, identity, data=data)


@router.get("/customers", response_model=Page[CustomerResponse])
def customers(query: Listing, session: DatabaseSession, _operator: Operator):
    return service.list_customers(session, query)


@router.post("/customers", response_model=CustomerResponse, status_code=201)
def create_customer(data: CustomerCreate, session: DatabaseSession, _operator: Operator):
    return service.create_customer_profile(session, data)


@router.get("/customers/{customer_id}", response_model=CustomerResponse)
def customer(customer_id: UUID, session: DatabaseSession, identity: CurrentUser):
    return service.customer_profile(session, identity, customer_id)


@router.patch("/customers/{customer_id}", response_model=CustomerResponse)
def update_customer(customer_id: UUID, data: CustomerAdminUpdate, session: DatabaseSession, operator: Operator):
    return service.customer_profile(session, operator, customer_id, data)


@router.delete("/customers/{customer_id}", status_code=204)
def archive_customer(customer_id: UUID, session: DatabaseSession, _operator: Operator):
    service.archive(session, CustomerProfile, customer_id)
    return Response(status_code=204)


@router.get("/products", response_model=Page[ProductResponse])
def products(query: Listing, session: DatabaseSession, _operator: Operator):
    return service.list_products(session, query)


@router.post("/products", response_model=ProductResponse, status_code=201)
def create_product(data: ProductWrite, session: DatabaseSession, _operator: Operator):
    return service.write_product(session, data)


@router.get("/products/{product_id}", response_model=ProductResponse)
def product(product_id: UUID, session: DatabaseSession, _operator: Operator):
    return service.product_detail(session, product_id)


@router.put("/products/{product_id}", response_model=ProductResponse)
def update_product(product_id: UUID, data: ProductWrite, session: DatabaseSession, _operator: Operator):
    return service.write_product(session, data, product_id)


@router.delete("/products/{product_id}", status_code=204)
def archive_product(product_id: UUID, session: DatabaseSession, _operator: Operator):
    service.archive(session, Product, product_id)
    return Response(status_code=204)


@router.get("/products/{product_id}/variants", response_model=Page[VariantResponse])
def variants(product_id: UUID, query: Listing, session: DatabaseSession, identity: CurrentUser):
    return service.list_variants(session, product_id, query, identity)


@router.post("/products/{product_id}/variants", response_model=VariantResponse, status_code=201)
def create_variant(product_id: UUID, data: VariantWrite, session: DatabaseSession, _operator: Operator):
    return service.write_variant(session, product_id, data)


@router.put("/products/{product_id}/variants/{variant_id}", response_model=VariantResponse)
def update_variant(product_id: UUID, variant_id: UUID, data: VariantWrite, session: DatabaseSession, _operator: Operator):
    return service.write_variant(session, product_id, data, variant_id)


@router.delete("/variants/{variant_id}", status_code=204)
def archive_variant(variant_id: UUID, session: DatabaseSession, _operator: Operator):
    service.archive(session, ProductVariant, variant_id)
    return Response(status_code=204)


@router.get("/plans", response_model=Page[PlanResponse])
def plans(query: Listing, session: DatabaseSession, identity: CurrentUser, billing_interval: Interval | None = None):
    return service.list_plans(session, query, identity, billing_interval)


@router.post("/plans", response_model=PlanResponse, status_code=201)
def create_plan(data: PlanWrite, session: DatabaseSession, _operator: Operator):
    return service.write_plan(session, data)


@router.get("/plans/{plan_id}", response_model=PlanResponse)
def plan(plan_id: UUID, session: DatabaseSession, identity: CurrentUser):
    return service.plan_detail(session, plan_id, identity)


@router.put("/plans/{plan_id}", response_model=PlanResponse)
def update_plan(plan_id: UUID, data: PlanWrite, session: DatabaseSession, _operator: Operator):
    return service.write_plan(session, data, plan_id)


@router.delete("/plans/{plan_id}", status_code=204)
def archive_plan(plan_id: UUID, session: DatabaseSession, _operator: Operator):
    service.archive(session, SubscriptionPlan, plan_id)
    return Response(status_code=204)
