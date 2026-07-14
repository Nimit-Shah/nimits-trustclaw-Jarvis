import { protectedProcedure } from "~/server/api/trpc";
import { getStreamingMessage as getStreamingMessageFromRedis } from "~/server/clients/redis";
import { getInstanceForUser } from "./utils";
import { z } from "zod";

export const getStreamingMessage = protectedProcedure
  .input(z.object({ instanceId: z.string().optional() }).optional())
  .query(async ({ ctx, input }) => {
    const userId = ctx.session.user.id;

    // Ownership-checked instance resolution
    const instance = await getInstanceForUser(userId, input?.instanceId);

    const messageId = await getStreamingMessageFromRedis(instance.id);
    if (!messageId) return null;

    return { messageId };
  });
