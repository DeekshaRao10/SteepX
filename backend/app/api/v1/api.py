from fastapi import APIRouter

from app.api.v1.endpoints.health import router as health_router
from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.staff import router as staff_router
from app.api.v1.endpoints.catalog import router as catalog_router
from app.api.v1.endpoints.commerce import router as commerce_router
from app.api.v1.endpoints.billing import router as billing_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health_router)
api_router.include_router(auth_router)
api_router.include_router(staff_router)
api_router.include_router(catalog_router)
api_router.include_router(commerce_router)
api_router.include_router(billing_router)
