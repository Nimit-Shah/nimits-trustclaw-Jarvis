import { TRPCError } from "@trpc/server";
import { protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/clients/db";
import { getInstanceForUser } from "./utils";
import { z } from "zod";

export const unlinkTelegram = protectedProcedure
  .input(z.object({ instanceId: z.string().optional() }).optional())
  .mutation(async ({ ctx, input }) => {
  const userId = ctx.session.user.id;
  const instance = await getInstanceForUser(userId, input?.instanceId);

  await db.composioClawInstance.update({
    where: { id: instance.id },
    data: {
      telegramChatId: null,
      telegramLinkToken: null,
      telegramLinkTokenExpiresAt: null,
    },
  });

  return { success: true };
});
