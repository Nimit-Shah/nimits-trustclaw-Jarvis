import { z } from "zod";

export const chatsListInput = z.object({
  instanceId: z.string().optional(),
});

export type ChatsListInput = z.infer<typeof chatsListInput>;