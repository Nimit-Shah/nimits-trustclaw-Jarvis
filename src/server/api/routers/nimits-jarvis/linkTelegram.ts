import { randomBytes } from "crypto";
import { TRPCError } from "@trpc/server";
import { protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/clients/db";
import { env } from "~/env";
import { isTelegramConfigured } from "~/server/clients/telegram";
import { getInstanceForUser } from "./utils";
import { z } from "zod";

const LINK_TOKEN_TTL_MS = 15 * 60 * 1000;

export const linkTelegram = protectedProcedure
  .input(z.object({ instanceId: z.string().optional() }).optional())
  .mutation(async ({ ctx, input }) => {
  if (!isTelegramConfigured()) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Telegram is not configured on this deployment",
    });
  }

  const userId = ctx.session.user.id;
  const instance = await getInstanceForUser(userId, input?.instanceId);

  return db.$transaction(async (tx) => {
    const freshInstance = await tx.composioClawInstance.findUnique({
      where: { id: instance.id },
      select: {
        id: true,
        telegramLinkToken: true,
        telegramLinkTokenExpiresAt: true,
        telegramChatId: true,
      },
    });

    if (!freshInstance) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No Nimits-Jarvis by Composio instance found. Create one first.",
      });
    }

    if (freshInstance.telegramChatId) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Telegram is already linked",
      });
    }

    const hasValidToken =
      freshInstance.telegramLinkToken &&
      freshInstance.telegramLinkTokenExpiresAt &&
      freshInstance.telegramLinkTokenExpiresAt > new Date();

    if (hasValidToken) {
      return {
        token: freshInstance.telegramLinkToken,
        botUsername: env.TELEGRAM_BOT_USERNAME,
        expiresAt: freshInstance.telegramLinkTokenExpiresAt,
      };
    }

    const token = randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + LINK_TOKEN_TTL_MS);

    await tx.composioClawInstance.update({
      where: { id: freshInstance.id },
      data: {
        telegramLinkToken: token,
        telegramLinkTokenExpiresAt: expiresAt,
      },
    });

    return {
      token,
      botUsername: env.TELEGRAM_BOT_USERNAME,
      expiresAt,
    };
  });
});
