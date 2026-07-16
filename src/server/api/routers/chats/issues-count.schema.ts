import { z } from "zod";

export const issuesCountInput = z.object({
  instanceId: z.string().optional(),
});

export type IssuesCountInput = z.infer<typeof issuesCountInput>;