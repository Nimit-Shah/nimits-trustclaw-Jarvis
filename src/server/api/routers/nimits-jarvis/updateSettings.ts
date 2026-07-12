import { TRPCError } from "@trpc/server";
import { protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/clients/db";
import { updateSettingsInput } from "./updateSettings.schema";

export const updateSettings = protectedProcedure
  .input(updateSettingsInput)
  .mutation(async ({ ctx, input }) => {
    const userId = ctx.session.user.id;

    const instance = await db.composioClawInstance.findUnique({
      where: { userId },
    });

    if (!instance) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "NimitsJarvis by Composio instance not found",
      });
    }

    const [updated] = await db.$transaction([
      db.composioClawInstance.update({
        where: { userId },
        data: {
          ...(input.anthropicModel && { anthropicModel: input.anthropicModel }),
          ...(input.piiRedactionEnabled !== undefined && {
            piiRedactionEnabled: input.piiRedactionEnabled,
          }),
          ...(input.vercelGatewayEnabled !== undefined && {
            vercelGatewayEnabled: input.vercelGatewayEnabled,
          }),
          ...(input.openRouterGatewayEnabled !== undefined && {
            openRouterGatewayEnabled: input.openRouterGatewayEnabled,
          }),
        },
        select: {
          id: true,
          anthropicModel: true,
          piiRedactionEnabled: true,
          vercelGatewayEnabled: true,
          openRouterGatewayEnabled: true,
          updatedAt: true,
        },
      }),
      ...(input.timezone
        ? [db.user.update({ where: { id: userId }, data: { timezone: input.timezone } })]
        : []),
    ]);

    return updated;
  });
