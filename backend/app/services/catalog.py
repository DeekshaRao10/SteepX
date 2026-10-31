from sqlalchemy import or_, select
from sqlalchemy.orm import joinedload

from app.core.errors import PublicError
from app.models.catalog import CustomerProfile, Product, ProductVariant, SubscriptionPlan
from app.models.user import User, UserRole
from app.models.billing import TaxRate
from app.schemas.catalog import CustomerResponse, PlanResponse, ProductResponse, VariantResponse
from app.services.common import conflict, flush_unique, get_record, missing, page, today


def customer_profile(session, identity, customer_id=None, data=None):
    target = customer_id or identity.profile.id
    if identity.profile.role == UserRole.CUSTOMER and target != identity.profile.id:
        raise missing()
    with session.begin():
        record = get_record(session, CustomerProfile, target, lock=data is not None)
        if data is not None:
            for key, value in data.model_dump(exclude_unset=True).items():
                setattr(record, key, value)
            session.flush()
        return CustomerResponse.model_validate(record)


def create_customer_profile(session, data):
    with session.begin():
        user = get_record(session, User, data.user_id)
        if user.role != UserRole.CUSTOMER:
            raise conflict("Only customer accounts may have a customer profile.")
        if session.get(CustomerProfile, user.id):
            raise conflict("The customer profile already exists.")
        record = CustomerProfile(id=user.id, **data.model_dump(exclude={"user_id"}))
        session.add(record)
        flush_unique(session)
        return CustomerResponse.model_validate(record)


def list_customers(session, query):
    with session.begin():
        return page(session, select(CustomerProfile), CustomerProfile, query, CustomerResponse,
                    name_column=CustomerProfile.display_name)


def write_product(session, data, product_id=None):
    with session.begin():
        record = get_record(session, Product, product_id, lock=True) if product_id else Product()
        if product_id and record.currency != data.currency:
            raise conflict("Product currency is immutable; create a new product for another currency.")
        for key, value in data.model_dump().items():
            setattr(record, key, value)
        session.add(record)
        flush_unique(session)
        return ProductResponse.model_validate(record)


def list_products(session, query):
    with session.begin():
        return page(session, select(Product), Product, query, ProductResponse, name_column=Product.name)


def product_detail(session, product_id):
    with session.begin():
        return ProductResponse.model_validate(get_record(session, Product, product_id))


def archive(session, model, record_id):
    with session.begin():
        get_record(session, model, record_id, lock=True).is_active = False


def write_variant(session, product_id, data, variant_id=None):
    with session.begin():
        get_record(session, Product, product_id)
        record = get_record(session, ProductVariant, variant_id, lock=True) if variant_id else ProductVariant(product_id=product_id)
        if record.product_id != product_id:
            raise missing()
        for key, value in data.model_dump().items():
            setattr(record, key, value)
        session.add(record)
        flush_unique(session)
        return VariantResponse.model_validate(record)


def list_variants(session, product_id, query, identity):
    with session.begin():
        product = get_record(session, Product, product_id)
        statement = select(ProductVariant).where(ProductVariant.product_id == product_id)
        if identity.profile.role == UserRole.CUSTOMER:
            if not product.is_active:
                raise missing()
            statement = statement.where(ProductVariant.is_active.is_(True))
        return page(session, statement, ProductVariant, query, VariantResponse, name_column=ProductVariant.name)


def plan_response(record):
    return PlanResponse(**{name: getattr(record, name) for name in PlanResponse.model_fields if name not in {"currency", "product_name"}},
                        currency=record.product.currency, product_name=record.product.name)


def available_plans(statement):
    return statement.where(SubscriptionPlan.is_active.is_(True), Product.is_active.is_(True),
        or_(SubscriptionPlan.available_from.is_(None), SubscriptionPlan.available_from <= today()),
        or_(SubscriptionPlan.available_until.is_(None), SubscriptionPlan.available_until >= today()))


def write_plan(session, data, plan_id=None):
    with session.begin():
        product = get_record(session, Product, data.product_id)
        if data.tax_rate_id and not get_record(session, TaxRate, data.tax_rate_id).is_active:
            raise conflict("The selected tax rate is inactive.")
        record = get_record(session, SubscriptionPlan, plan_id, lock=True) if plan_id else SubscriptionPlan()
        if plan_id and (record.product_id != data.product_id or record.billing_interval != data.billing_interval):
            raise conflict("A plan's product and billing interval are immutable.")
        for key, value in data.model_dump().items():
            setattr(record, key, value)
        record.product = product
        session.add(record)
        flush_unique(session)
        return plan_response(record)


def list_plans(session, query, identity, interval=None):
    with session.begin():
        statement = select(SubscriptionPlan).join(Product).options(joinedload(SubscriptionPlan.product))
        if identity.profile.role == UserRole.CUSTOMER:
            statement = available_plans(statement)
        if interval:
            statement = statement.where(SubscriptionPlan.billing_interval == interval)
        return page(session, statement, SubscriptionPlan, query, PlanResponse,
                    name_column=SubscriptionPlan.name, convert=plan_response)


def plan_detail(session, plan_id, identity):
    with session.begin():
        statement = select(SubscriptionPlan).join(Product).options(joinedload(SubscriptionPlan.product)).where(SubscriptionPlan.id == plan_id)
        if identity.profile.role == UserRole.CUSTOMER:
            statement = available_plans(statement)
        record = session.scalar(statement)
        if record is None:
            raise missing()
        return plan_response(record)
