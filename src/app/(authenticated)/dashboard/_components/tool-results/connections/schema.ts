import { z } from "zod";
import { toolExecuteResponseSchema } from "../envelope";

// ─── MANAGE_CONNECTIONS ─────────────────────────────────────────────────────

const connectionResultSchema = z
  .object({
    toolkit: z.string(),
    status: z.string(),
    redirect_url: z.string().optional(),
  })
  .passthrough();

const manageConnectionsArgsSchema = z.object({
  toolkits: z.array(z.string()).optional(),
});

const manageConnectionsResultSchema = z.object({
  results: z.record(z.string(), connectionResultSchema),
});

export type ConnectionToolResultData = {
  results: Record<string, { status: string; redirect_url?: string }>;
};

export function parseManageConnectionsArgs(
  args: Record<string, unknown>,
): { toolkits: string[] } | null {
  const parsed = manageConnectionsArgsSchema.safeParse(args);
  if (!parsed.success || !parsed.data.toolkits?.length) return null;
  return { toolkits: parsed.data.toolkits };
}

export function parseManageConnectionsResult(
  output: unknown,
  args: Record<string, unknown>,
): ConnectionToolResultData | null {
  const parsed = toolExecuteResponseSchema.safeParse(output);
  if (!parsed.success) return null;

  const result = parsed.data;
  if (!result.successful || !result.data) return null;

  const data = manageConnectionsResultSchema.safeParse(result.data);
  if (!data.success) return null;

  return { results: data.data.results };
}
