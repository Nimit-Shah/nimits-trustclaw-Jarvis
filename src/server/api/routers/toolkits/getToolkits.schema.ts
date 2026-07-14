import { z } from "zod";

export const getToolkitsInput = z.object({
  // Which project instance to scope connections to
  instanceId: z.string().optional(),
  search: z.string().optional(),
  isConnected: z.boolean().optional(),
  cursor: z.string().optional(),
  limit: z.number().min(1).max(50).default(20),
});

export type GetToolkitsInput = z.infer<typeof getToolkitsInput>;

export const toolkitItem = z.object({
  slug: z.string(),
  name: z.string(),
  logo: z.string(),
  noAuth: z.boolean(),
  connected: z.boolean(),
  // Connection ID returned only when connected — used by disconnectToolkit
  connectionId: z.string().nullable(),
});

export type ToolkitItem = z.infer<typeof toolkitItem>;
