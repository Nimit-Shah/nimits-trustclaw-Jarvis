import { protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/clients/db";
import { getStreamingMessage as getStreamingMessageFromRedis } from "~/server/clients/redis";

import { z } from "zod";

export const getStreamingMessage = protectedProcedure
  .input(z.object({ chatId: z.string().optional() }).optional())
  .query(async ({ ctx, input }) => {
  const userId = ctx.session.user.id;
  const chatId = input?.chatId;

  const instance = await db.composioClawInstance.findFirst({
    where: chatId ? { id: chatId, userId } : { userId },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });

  if (!instance) return null;

  const messageId = await getStreamingMessageFromRedis(instance.id);
  if (!messageId) return null;

  return { messageId };
});
