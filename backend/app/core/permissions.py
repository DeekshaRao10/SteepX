from collections.abc import Callable

from app.core.errors import PublicError
from app.dependencies.auth import CurrentUser
from app.models.user import UserRole
from app.services.auth import AuthenticatedUser


def require_roles(*roles: UserRole) -> Callable[..., AuthenticatedUser]:
    """An explicit allowlist; admin is not implicitly allowed on customer-only routes."""
    allowed = frozenset(roles)

    def authorize(identity: CurrentUser) -> AuthenticatedUser:
        if identity.profile.role not in allowed:
            raise PublicError(403, "forbidden", "You do not have permission to perform this action.")
        return identity

    authorize.allowed_roles = sorted(role.value for role in allowed)
    return authorize


require_admin = require_roles(UserRole.ADMIN)
require_operator = require_roles(UserRole.ADMIN, UserRole.STAFF)
require_customer = require_roles(UserRole.CUSTOMER)
