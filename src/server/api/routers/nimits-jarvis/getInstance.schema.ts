import { z } from "zod";

export const getInstanceInput = z.object({
  chatId: z.string().optional(),
}).optional();

export type GetInstanceInput = z.infer<typeof getInstanceInput>;
