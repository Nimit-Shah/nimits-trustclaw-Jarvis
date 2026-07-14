import { z } from "zod";

export const toggleCronJobInput = z.object({
  instanceId: z.string().optional(),
  jobId: z.string().min(1),
  enabled: z.boolean(),
});

export type ToggleCronJobInput = z.infer<typeof toggleCronJobInput>;
