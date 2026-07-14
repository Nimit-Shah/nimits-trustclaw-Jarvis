import { Composio } from "@composio/core";
import { VercelProvider } from "@composio/vercel";
import { env } from "~/env";

export function createComposioClient() {
  return new Composio({
    apiKey: env.COMPOSIO_API_KEY,
    provider: new VercelProvider(),
  });
}

/**
 * Creates a Composio client for a specific project instance.
 * Uses the instance's decrypted per-project API key if provided;
 * falls back to the global COMPOSIO_API_KEY env var.
 */
export function createComposioClientForInstance(decryptedApiKey?: string | null) {
  return new Composio({
    apiKey: decryptedApiKey ?? env.COMPOSIO_API_KEY,
    provider: new VercelProvider(),
  });
}
