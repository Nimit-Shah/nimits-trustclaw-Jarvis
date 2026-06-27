/**
 * Model-aware context window sizes.
 *
 * Maps known model IDs to their maximum context window in tokens.
 * Unknown models fall back to a conservative 128K default — large
 * enough for useful conversations but small enough to avoid sending
 * oversized payloads to models with smaller windows.
 */

const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  // Local / Ollama
  "qwen3:8b": 16_000,

  // Anthropic (direct)
  "claude-sonnet-4-5-20250929": 200_000,
  "claude-opus-4-6": 200_000,
  "claude-haiku-4-5-20251001": 200_000,

  // Anthropic (via Vercel Gateway)
  "anthropic/claude-sonnet-4-5-20250929": 200_000,
  "anthropic/claude-opus-4-6": 200_000,
  "anthropic/claude-haiku-4-5-20251001": 200_000,

  // OpenAI (via Vercel Gateway)
  "openai/gpt-4o": 128_000,
  "openai/gpt-4o-mini": 128_000,
  "openai/gpt-4.1": 1_047_576,
  "openai/gpt-4.1-mini": 1_047_576,
  "openai/gpt-4.1-nano": 1_047_576,
  "openai/o3": 200_000,
  "openai/o3-mini": 200_000,
  "openai/o4-mini": 200_000,

  // DeepSeek (via Vercel Gateway)
  "deepseek/deepseek-chat": 64_000,
  "deepseek/deepseek-reasoner": 64_000,
  "deepseek/deepseek-v4-flash": 64_000,

  // Google (via Vercel Gateway)
  "google/gemini-2.5-flash": 1_048_576,
  "google/gemini-2.5-pro": 1_048_576,
  "google/gemini-2.0-flash": 1_048_576,

  // Meta / Llama (via Vercel Gateway — typically hosted on Together/Groq)
  "meta/llama-4-scout": 512_000,
  "meta/llama-4-maverick": 256_000,

  // Mistral (via Vercel Gateway)
  "mistral/mistral-large-latest": 128_000,
  "mistral/mistral-small-latest": 128_000,
};

/** Safe fallback for models we don't have a mapping for. */
const DEFAULT_CONTEXT_WINDOW = 128_000;

export function getContextWindow(modelId: string): number {
  return MODEL_CONTEXT_WINDOWS[modelId] ?? DEFAULT_CONTEXT_WINDOW;
}
