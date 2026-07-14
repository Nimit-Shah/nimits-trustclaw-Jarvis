import { z } from "zod";

export const ALLOWED_ANTHROPIC_MODELS = [
  "claude-sonnet-4-5-20250929",
  "claude-opus-4-6",
  "claude-haiku-4-5-20251001",
  "qwen3:8b",
] as const;

export const allowedAnthropicModelSchema = z.string();

export const createInstanceInput = z.object({
  name: z.string().min(1).max(80).default("Default"),
  anthropicModel: allowedAnthropicModelSchema.default(
    "qwen3:8b",
  ),
  // Per-project Composio API key (plaintext — server encrypts before write)
  composioApiKey: z.string().optional(),
});

export type CreateInstanceInput = z.infer<typeof createInstanceInput>;
