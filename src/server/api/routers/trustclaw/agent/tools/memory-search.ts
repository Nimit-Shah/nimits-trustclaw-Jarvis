import { z } from "zod";
import { zodSchema, embed } from "ai";
import type { Tool } from "ai";
import { db } from "~/server/clients/db";
import {
  memorySearchSchema,
  type MemorySearchInput,
} from "./memory-search.schema";
import { ollamaProvider } from "~/server/clients/ollama";

const memorySearchResultRow = z.object({
  id: z.string(),
  content: z.string(),
  similarity: z.number(),
});

const memoryContextRow = z.object({
  content: z.string(),
  similarity: z.number(),
});

export function createMemorySearchTool(instanceId: string): Tool<
  MemorySearchInput,
  {
    found: boolean;
    memories: Array<{ content: string; relevance: number }>;
  }
> {
  return {
    description: "Search your memory for relevant past information",
    inputSchema: zodSchema(memorySearchSchema),
    execute: async ({ query, maxResults }) => {
      const limit = maxResults ?? 5;
      const { embedding: queryEmbedding } = await embed({
        model: ollamaProvider.embedding("qllama/bge-small-en-v1.5"),
        value: query,
      });
      const embeddingString = `[${queryEmbedding.join(",")}]`;

      const results = z.array(memorySearchResultRow).parse(
        await db.$queryRaw`
          SELECT id, content, 1 - (embedding <=> ${embeddingString}::vector) AS similarity
          FROM composio_claw_memory
          WHERE "instanceId" = ${instanceId}
          ORDER BY embedding <=> ${embeddingString}::vector
          LIMIT ${limit}
        `,
      );

      const filtered = results.filter((r) => r.similarity > 0.5);

      return {
        found: filtered.length > 0,
        memories: filtered.map((r) => ({
          content: r.content,
          relevance: Math.round(r.similarity * 100) / 100,
        })),
      };
    },
  };
}

export async function searchMemoriesForContext(
  instanceId: string,
  query: string,
  maxResults = 5,
): Promise<string[]> {
  try {
    const { embedding: queryEmbedding } = await embed({
      model: ollamaProvider.embedding("qllama/bge-small-en-v1.5"),
      value: query,
    });
    const embeddingString = `[${queryEmbedding.join(",")}]`;

    const results = z.array(memoryContextRow).parse(
      await db.$queryRaw`
        SELECT content, 1 - (embedding <=> ${embeddingString}::vector) AS similarity
        FROM composio_claw_memory
        WHERE "instanceId" = ${instanceId}
        ORDER BY embedding <=> ${embeddingString}::vector
        LIMIT ${maxResults}
      `,
    );

    return results.filter((r) => r.similarity > 0.5).map((r) => r.content);
  } catch {
    return [];
  }
}
