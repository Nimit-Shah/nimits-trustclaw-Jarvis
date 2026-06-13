import { createOllama } from "ai-sdk-ollama";
import { env } from "~/env";

export const ollamaProvider = createOllama({
  baseURL: env.OLLAMA_BASE_URL
    ? env.OLLAMA_BASE_URL.replace(/\/$/, "")
    : "http://localhost:11434",
});
