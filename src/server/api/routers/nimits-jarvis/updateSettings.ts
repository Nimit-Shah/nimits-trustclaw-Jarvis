import { protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/clients/db";
import { encrypt } from "~/lib/crypto";
import { updateSettingsInput } from "./updateSettings.schema";
import { getInstanceForUser } from "./utils";

export const updateSettings = protectedProcedure
  .input(updateSettingsInput)
  .mutation(async ({ ctx, input }) => {
    const userId = ctx.session.user.id;

    // Ownership-checked instance resolution
    const instance = await getInstanceForUser(userId, input.instanceId);

    // Encrypt per-project API key before storing
    const encryptedApiKey = input.composioApiKey
      ? await encrypt(input.composioApiKey)
      : undefined;

    const [updated] = await db.$transaction([
      db.composioClawInstance.update({
        where: { id: instance.id },
        data: {
          ...(input.name && { name: input.name }),
          ...(encryptedApiKey !== undefined && {
            composioApiKey: encryptedApiKey,
            composioProjectId: null, // Reset project ID on API key update to trigger re-fetch
          }),
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
          name: true,
          anthropicModel: true,
          piiRedactionEnabled: true,
          vercelGatewayEnabled: true,
          openRouterGatewayEnabled: true,
          updatedAt: true,
        },
      }),
      ...(input.timezone
        ? [
            db.user.update({
              where: { id: userId },
              data: { timezone: input.timezone },
            }),
          ]
        : []),
    ]);

    return updated;
  });
