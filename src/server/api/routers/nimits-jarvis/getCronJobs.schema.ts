import { z } from "zod";

export const getCronJobsInput = z.object({
  instanceId: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.number().min(1).max(100).default(20),
});

export type GetCronJobsInput = z.infer<typeof getCronJobsInput>;
