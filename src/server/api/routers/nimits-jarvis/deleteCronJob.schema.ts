import { z } from "zod";

export const deleteCronJobInput = z.object({
  instanceId: z.string().optional(),
  jobId: z.string().min(1),
});

export type DeleteCronJobInput = z.infer<typeof deleteCronJobInput>;
