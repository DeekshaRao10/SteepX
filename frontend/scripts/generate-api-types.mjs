import { readFileSync, writeFileSync } from "node:fs";
const document = JSON.parse(readFileSync(new URL("../../backend/docs/openapi.json", import.meta.url), "utf8"));
function type(schema) {
  if (schema.$ref) return schema.$ref.split("/").pop();
  if (schema.enum) return schema.enum.map(v => JSON.stringify(v)).join(" | ");
  if (schema.const !== undefined) return JSON.stringify(schema.const);
  if (schema.anyOf) return schema.anyOf.map(type).join(" | ");
  if (schema.type === "array") return `(${type(schema.items)})[]`;
  if (schema.type === "object") {
    if (!schema.properties) return `Record<string, ${schema.additionalProperties && typeof schema.additionalProperties === "object" ? type(schema.additionalProperties) : "unknown"}>`;
    return `{\n${Object.entries(schema.properties).map(([name, value]) => `  ${name}${schema.required?.includes(name) ? "" : "?"}: ${type(value)};`).join("\n")}\n}`;
  }
  return ({ string: "string", integer: "number", number: "number", boolean: "boolean", null: "null" })[schema.type] || "unknown";
}
writeFileSync(new URL("../src/types/api.ts", import.meta.url), "// Generated from the FastAPI OpenAPI contract. Run node scripts/generate-api-types.mjs.\n\n" +
  Object.entries(document.components.schemas).map(([name, schema]) => `export type ${name} = ${type(schema)};`).join("\n\n") + "\n");
