from fastapi.routing import APIRoute


def test_all_business_routes_require_authentication(public_client):
    schema = public_client.get("/openapi.json").json()
    public = {"/api/v1/health", "/api/v1/auth/login", "/api/v1/auth/register"}
    for path, operations in schema["paths"].items():
        for operation in operations.values():
            if path not in public:
                assert operation.get("security"), path
            for status in ("401", "403", "404", "409", "422", "500"):
                assert operation["responses"][status]["content"]["application/json"]["schema"]["$ref"].endswith("/ErrorResponse")
    assert schema["paths"]["/api/v1/payments"]["post"]["x-roles"] == ["admin", "staff"]
    assert schema["paths"]["/api/v1/tax-rates"]["post"]["x-roles"] == ["admin"]
    assert "password_hash" not in schema["components"]["schemas"]["UserResponse"]["properties"]
    assert schema["components"]["schemas"]["InvoiceResponse"]["properties"]["customer_snapshot"]["$ref"].endswith("/CustomerSnapshot")
