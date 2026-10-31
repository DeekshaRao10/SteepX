"""Export the API contract without starting the application or connecting to a DB."""
import json

from app.application import create_app
from app.core.config import BACKEND_DIR


def main():
    schema = create_app().app.openapi()
    (BACKEND_DIR / "docs" / "openapi.json").write_text(json.dumps(schema, indent=2) + "\n", encoding="utf-8")
    def model_name(value):
        if "$ref" in value:
            return value["$ref"].rsplit("/", 1)[-1]
        return "—"
    rows = ["| Method | Path | Authorization | Request model | Success / response model |",
            "| --- | --- | --- | --- | --- |"]
    for path, methods in schema["paths"].items():
        for method, operation in methods.items():
            roles = operation.get("x-roles")
            access = ", ".join(roles) if roles else "Authenticated; ownership applies" if operation.get("security") else "Public"
            body = operation.get("requestBody", {}).get("content", {}).get("application/json", {}).get("schema", {})
            responses = []
            for code, response in operation["responses"].items():
                if code.startswith("2"):
                    value = response.get("content", {}).get("application/json", {}).get("schema", {})
                    responses.append(code + " / " + model_name(value))
            rows.append(f"| {method.upper()} | {path} | {access} | {model_name(body)} | {', '.join(responses)} |")
    guide_path = BACKEND_DIR / "docs" / "api.md"
    guide = guide_path.read_text(encoding="utf-8")
    start, end = "<!-- endpoint-catalog:start -->", "<!-- endpoint-catalog:end -->"
    before, remainder = guide.split(start, 1)
    _, after = remainder.split(end, 1)
    guide_path.write_text(before + start + "\n\n" + "\n".join(rows) + "\n\n" + end + after, encoding="utf-8")
    print("Exported OpenAPI and API endpoint catalog; no startup or database access.")


if __name__ == "__main__":
    main()
