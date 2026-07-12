import { protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/clients/db";
import { isTelegramConfigured } from "~/server/clients/telegram";
import { getInstanceInput } from "./getInstance.schema";

export const getInstance = protectedProcedure
  .input(getInstanceInput)
  .query(async ({ ctx, input }) => {
  const userId = ctx.session.user.id;
  const chatId = input?.chatId;

  const [instance, onboardingState, user] = await db.$transaction([
    db.composioClawInstance.findFirst({
      where: chatId ? { id: chatId, userId } : { userId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        userId: true,
        anthropicModel: true,
        piiRedactionEnabled: true,
        vercelGatewayEnabled: true,
        openRouterGatewayEnabled: true,
        telegramChatId: true,
        telegramLinkToken: true,
        telegramLinkTokenExpiresAt: true,
        soulPrompt: true,
        identityPrompt: true,
        userPrompt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    db.onboardingState.findUnique({
      where: { userId },
      select: {
        currentStep: true,
        name: true,
        writingStyle: true,
        personality: true,
        emoji: true,
        lore: true,
        anthropicModel: true,
      },
    }),
    db.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    }),
  ]);

  return {
    instance: instance ?? null,
    onboardingState: onboardingState ?? null,
    timezone: user?.timezone ?? "UTC",
    telegramConfigured: isTelegramConfigured(),
  };
});
