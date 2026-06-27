import { z } from "zod";

export const ALLOWED_ANTHROPIC_MODELS = [
  "claude-sonnet-4-5-20250929",
  "claude-opus-4-6",
  "claude-haiku-4-5-20251001",
  "qwen3:8b",
] as const;

export const allowedAnthropicModelSchema = z.string();

export const createInstanceInput = z.object({
  anthropicModel: allowedAnthropicModelSchema.default(
    "qwen3:8b",
  ),
});

export type CreateInstanceInput = z.infer<typeof createInstanceInput>;
