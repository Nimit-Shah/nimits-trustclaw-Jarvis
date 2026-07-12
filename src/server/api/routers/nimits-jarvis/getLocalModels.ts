import { protectedProcedure } from "~/server/api/trpc";
import { env } from "~/env";

export interface LocalModelInfo {
  id: string;
  name: string;
}

export const getLocalModels = protectedProcedure.query(async () => {
  try {
    const baseURL = env.OLLAMA_BASE_URL
      ? env.OLLAMA_BASE_URL.replace(/\/$/, "")
      : "http://localhost:11434";

    const res = await fetch(`${baseURL}/api/tags`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch models from Ollama: ${res.statusText}`);
    }
    const data = (await res.json()) as {
      models: Array<{ name: string }>;
    };

    return data.models.map((model) => ({
      id: model.name,
      name: `Ollama ${model.name} (Local)`,
    }));
  } catch (error) {
    console.error("Error fetching local Ollama models:", error);
    return [];
  }
});
