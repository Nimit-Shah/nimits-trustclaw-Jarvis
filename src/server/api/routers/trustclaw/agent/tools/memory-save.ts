import { zodSchema, embed } from "ai";
import type { Tool } from "ai";
import { db } from "~/server/clients/db";
import { memorySaveSchema, type MemorySaveInput } from "./memory-save.schema";
import { ollamaProvider } from "~/server/clients/ollama";

export function createMemorySaveTool(
  instanceId: string,
): Tool<MemorySaveInput, { saved: boolean; content: string }> {
  return {
    description: "Save an important fact or observation for future reference",
    inputSchema: zodSchema(memorySaveSchema),
    execute: async ({ content }) => {
      const { embedding } = await embed({
        model: ollamaProvider.embedding("qllama/bge-small-en-v1.5"),
        value: content,
      });
      const embeddingString = `[${embedding.join(",")}]`;
      const id = crypto.randomUUID();

      await db.$queryRaw`
        INSERT INTO composio_claw_memory (id, "instanceId", content, embedding, "createdAt")
        VALUES (${id}, ${instanceId}, ${content}, ${embeddingString}::vector, NOW())
      `;

      return { saved: true, content };
    },
  };
}
