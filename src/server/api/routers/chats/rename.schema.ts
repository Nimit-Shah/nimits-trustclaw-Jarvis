import { z } from "zod";

export const renameChatInput = z.object({
  chatId: z.string(),
  name: z.string().min(1).max(200),
});

export type RenameChatInput = z.infer<typeof renameChatInput>;