/**
 * Composio Tool Schema Optimizer
 *
 * Composio's `session.tools()` returns 20+ tools with verbose JSON Schema
 * descriptions that can consume 15-30K tokens when serialised. This module
 * trims the schemas to reduce token usage by ~40-60% without losing the
 * structural information models need to invoke tools correctly.
 *
 * Applied in `prepareAgentRun` after `session.tools()` and before the
 * tools are passed to the agent.
 */

import type { ToolSet } from "ai";

/** Maximum character length for a tool-level description. */
const MAX_TOOL_DESCRIPTION_LENGTH = 200;

/** Maximum character length for a parameter description. */
const MAX_PARAM_DESCRIPTION_LENGTH = 100;

/**
 * Fields in JSON Schema objects that add context for humans but inflate
 * token counts for LLMs without improving tool invocation accuracy.
 */
const SCHEMA_NOISE_FIELDS = [
  "examples",
  "externalDocs",
  "$comment",
  "x-composio-description",
  "x-composio-name",
  "markdownDescription",
  "deprecated",
  "default",
] as const;

/**
 * Recursively trims a JSON Schema object:
 * 1. Truncates `description` fields.
 * 2. Removes noise fields that inflate token counts.
 * 3. Recurses into `properties`, `items`, `allOf`, `oneOf`, `anyOf`.
 */
function trimSchemaObject(
  schema: Record<string, unknown> | undefined,
  depth = 0,
): Record<string, unknown> | undefined {
  if (!schema || typeof schema !== "object") return schema;

  // Safety: don't recurse infinitely into deeply nested schemas
  if (depth > 6) return schema;

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(schema)) {
    // Skip noise fields
    if ((SCHEMA_NOISE_FIELDS as readonly string[]).includes(key)) {
      continue;
    }

    if (key === "description" && typeof value === "string") {
      // Truncate long descriptions
      result[key] =
        value.length > MAX_PARAM_DESCRIPTION_LENGTH
          ? value.slice(0, MAX_PARAM_DESCRIPTION_LENGTH - 3) + "..."
          : value;
      continue;
    }

    // Recurse into nested schema structures
    if (key === "properties" && typeof value === "object" && value !== null) {
      const props: Record<string, unknown> = {};
      for (const [propKey, propValue] of Object.entries(
        value as Record<string, unknown>,
      )) {
        if (typeof propValue === "object" && propValue !== null) {
          props[propKey] = trimSchemaObject(
            propValue as Record<string, unknown>,
            depth + 1,
          );
        } else {
          props[propKey] = propValue;
        }
      }
      result[key] = props;
      continue;
    }

    if (key === "items" && typeof value === "object" && value !== null) {
      result[key] = trimSchemaObject(
        value as Record<string, unknown>,
        depth + 1,
      );
      continue;
    }

    // Handle allOf/oneOf/anyOf arrays
    if (
      (key === "allOf" || key === "oneOf" || key === "anyOf") &&
      Array.isArray(value)
    ) {
      result[key] = value.map((item) =>
        typeof item === "object" && item !== null
          ? trimSchemaObject(item as Record<string, unknown>, depth + 1)
          : item,
      );
      continue;
    }

    result[key] = value;
  }

  return result;
}

/**
 * Optimises a Composio ToolSet by trimming verbose descriptions and removing
 * noise fields from each tool's JSON Schema. Returns a new ToolSet with the
 * same tools but leaner schemas.
 *
 * The original ToolSet is not mutated.
 */
export function optimizeToolSchemas(tools: ToolSet): ToolSet {
  const optimized: ToolSet = {};

  for (const [name, tool] of Object.entries(tools)) {
    // Work with a plain record to avoid fighting the AI SDK's complex
    // union type for tool definitions. We only read/write `description`
    // and `parameters.jsonSchema` — both optional, both safe to touch.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const clone: Record<string, any> = { ...tool };

    // Trim the top-level tool description
    if (
      typeof clone.description === "string" &&
      clone.description.length > MAX_TOOL_DESCRIPTION_LENGTH
    ) {
      clone.description =
        clone.description.slice(0, MAX_TOOL_DESCRIPTION_LENGTH - 3) + "...";
    }

    // Trim the parameters schema
    if (
      clone.parameters &&
      typeof clone.parameters === "object" &&
      "jsonSchema" in clone.parameters
    ) {
      const schema = clone.parameters as { jsonSchema?: Record<string, unknown> };
      if (schema.jsonSchema) {
        clone.parameters = {
          ...clone.parameters,
          jsonSchema: trimSchemaObject(schema.jsonSchema) ?? schema.jsonSchema,
        };
      }
    }

    optimized[name] = clone as ToolSet[string];
  }

  return optimized;
}
