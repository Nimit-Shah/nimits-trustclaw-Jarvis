import { z } from "zod";

export const deleteChatInput = z.object({
  chatId: z.string(),
});

export type DeleteChatInput = z.infer<typeof deleteChatInput>;