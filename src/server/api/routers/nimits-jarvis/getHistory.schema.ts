import { z } from "zod";

export const getHistoryInput = z.object({
  limit: z.number().min(1).max(100).default(50),
  cursor: z.string().datetime().optional(),
  // The project instance to scope history to (ownership-checked server side)
  instanceId: z.string().optional(),
});

export type GetHistoryInput = z.infer<typeof getHistoryInput>;
