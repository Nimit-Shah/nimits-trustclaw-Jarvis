/**
 * Model provider classification and context window utilities.
 *
 * Centralises the "which provider does this model ID belong to?" logic
 * so every call-site (agent setup, compaction, memory-flush) can use a
 * clean switch instead of ad-hoc string checks.
 */

export type ModelProvider = "ollama" | "anthropic" | "openrouter";

const ANTHROPIC_MODEL_PREFIXES = [
  "claude-",
  "anthropic/",
];

/**
 * Determines the provider category for a given model ID.
 *
 * - `"ollama"` — local Ollama models (e.g. `qwen3:8b`)
 * - `"anthropic"` — Anthropic models, either bare (`claude-sonnet-4-5-…`)
 *   or namespaced (`anthropic/claude-…`)
 * - `"openrouter"` — anything else with a `/` prefix (e.g. `openrouter/deepseek/…`,
 *   `openai/gpt-4o-mini`) routed through OpenRouter
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
    return "openrouter";
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
 * Resolves a model ID string into the format expected by the AI SDK.
 *
 * - Ollama models → handled separately via `ollamaProvider()`
 * - OpenRouter models → strip `openrouter/` prefix
 * - Bare Anthropic model names → prefixed with `anthropic/`
 * - Other `/` models → used as-is (OpenRouter compatible)
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