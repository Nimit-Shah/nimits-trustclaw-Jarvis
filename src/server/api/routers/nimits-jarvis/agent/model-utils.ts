/**
 * Model provider classification and context window utilities.
 *
 * Centralises the "which provider does this model ID belong to?" logic
 * so every call-site (agent setup, compaction, memory-flush) can use a
 * clean switch instead of ad-hoc string checks.
 */

export type ModelProvider = "ollama" | "anthropic" | "vercel-gateway" | "openrouter";

const ANTHROPIC_MODEL_PREFIXES = [
  "claude-",
  "anthropic/",
];

/**
 * Determines the provider category for a given model ID.
 *
 * - `"ollama"` — local Ollama models (currently only `qwen3:8b`)
 * - `"anthropic"` — Anthropic models, either bare (`claude-sonnet-4-5-…`)
 *   or namespaced (`anthropic/claude-…`)
 * - `"vercel-gateway"` — anything else routed through the Vercel AI Gateway
 *   (identified by a `/` in the ID, e.g. `openai/gpt-4o-mini`)
 */
export function getModelProvider(modelId: string): ModelProvider {
  if (modelId.startsWith("openrouter/")) {
    return "openrouter";
  }

  for (const prefix of ANTHROPIC_MODEL_PREFIXES) {
    if (modelId.startsWith(prefix)) {
      return "anthropic";
    }
  }

  if (modelId.includes("/")) {
    return "vercel-gateway";
  }

  return "ollama";
}

/**
 * Returns true if the model is an Anthropic model that supports
 * provider-specific options like `cacheControl`.
 */
export function isAnthropicModel(modelId: string): boolean {
  return getModelProvider(modelId) === "anthropic";
}

/**
 * Resolves a model ID string into the format expected by the Vercel AI SDK.
 *
 * - Ollama models → handled separately via `ollamaProvider()`
 * - Vercel Gateway models (contain `/`) → used as-is
 * - Bare Anthropic model names → prefixed with `anthropic/`
 */
export function resolveModelId(modelId: string): string {
  if (modelId.startsWith("openrouter/")) {
    return modelId.replace("openrouter/", "");
  }
  if (modelId.includes("/")) {
    return modelId;
  }
  return `anthropic/${modelId}`;
}
