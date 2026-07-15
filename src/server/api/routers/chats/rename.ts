import { TRPCError } from "@trpc/server";
import { protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/clients/db";
import { renameChatInput } from "./rename.schema";

export const rename = protectedProcedure
  .input(renameChatInput)
  .mutation(async ({ ctx, input }) => {
    const userId = ctx.session.user.id;

    const chat = await db.chat.findFirst({
      where: {
        id: input.chatId,
        instance: { userId },
      },
      select: { id: true },
    });

    if (!chat) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Chat not found or does not belong to you",
      });
    }

    await db.chat.update({
      where: { id: chat.id },
      data: { name: input.name },
    });

    return { success: true };
  });