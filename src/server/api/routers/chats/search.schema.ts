import { z } from "zod";

export const searchInput = z.object({
  instanceId: z.string().optional(),
  query: z.string().min(1),
  limit: z.number().min(1).max(50).default(10),
});

export type SearchInput = z.infer<typeof searchInput>;