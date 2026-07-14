import { z } from "zod";

export const deleteInstanceInput = z
  .object({
    instanceId: z.string().optional(),
  })
  .optional();

export type DeleteInstanceInput = z.infer<typeof deleteInstanceInput>;
