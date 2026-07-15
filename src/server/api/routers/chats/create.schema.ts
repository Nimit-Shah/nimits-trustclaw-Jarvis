import { z } from "zod";

export const createChatInput = z.object({
  instanceId: z.string().optional(),
  model: z.string().optional(),
  name: z.string().optional(),
});

export type CreateChatInput = z.infer<typeof createChatInput>;