import { z } from "zod";

export const getInstanceInput = z
  .object({
    instanceId: z.string().optional(),
  })
  .optional();

export type GetInstanceInput = z.infer<typeof getInstanceInput>;
