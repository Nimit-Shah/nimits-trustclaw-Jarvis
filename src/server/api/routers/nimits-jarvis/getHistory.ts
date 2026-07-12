import { protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/clients/db";
import { getHistoryInput } from "./getHistory.schema";

export const getHistory = protectedProcedure
  .input(getHistoryInput)
  .query(async ({ input, ctx }) => {
    const userId = ctx.session.user.id;

    const chatId = input.chatId;
    const instance = await db.composioClawInstance.findFirst({
      where: chatId ? { id: chatId, userId } : { userId },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });

    if (!instance) {
      return { messages: [], nextCursor: undefined };
    }

    const messages = await db.message.findMany({
      where: {
        instanceId: instance.id,
        messageType: "regular",
        ...(input.cursor ? { createdAt: { lt: new Date(input.cursor) } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: input.limit + 1,
      select: {
        id: true,
        role: true,
        content: true,
        source: true,
        inputTokens: true,
        outputTokens: true,
        createdAt: true,
      },
    });

    let nextCursor: string | undefined;
    if (messages.length > input.limit) {
      const lastItem = messages.pop()!;
      nextCursor = lastItem.createdAt.toISOString();
    }

    return {
      messages: messages.reverse(),
      nextCursor,
    };
  });
