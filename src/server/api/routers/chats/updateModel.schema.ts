import { z } from "zod";

export const updateModelInput = z.object({
  chatId: z.string(),
  model: z.string(),
});

export type UpdateModelInput = z.infer<typeof updateModelInput>;