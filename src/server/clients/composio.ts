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
 * Uses the instance's decrypted per-project API key.
 * Each project must have its own API key for connection isolation.
 */
export function createComposioClientForInstance(decryptedApiKey?: string | null) {
  if (!decryptedApiKey) {
    throw new Error(
      "No Composio API key configured for this project. " +
      "Each project requires its own API key for isolated connections. " +
      "Set a per-project API key in Settings."
    );
  }
  return new Composio({
    apiKey: decryptedApiKey,
    provider: new VercelProvider(),
  });
}
