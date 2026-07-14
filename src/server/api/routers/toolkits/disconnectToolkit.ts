import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure } from "~/server/api/trpc";
import { createComposioClientForInstance } from "~/server/clients/composio";
import { decrypt } from "~/lib/crypto";
import { getInstanceForUser } from "~/server/api/routers/nimits-jarvis/utils";

export const disconnectToolkit = protectedProcedure
  .input(
    z.object({
      instanceId: z.string().optional(),
      connectionId: z.string(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const userId = ctx.session.user.id;

    // Ownership-checked instance resolution
    const instance = await getInstanceForUser(userId, input.instanceId);

    // Decrypt per-project API key if present
    const decryptedApiKey = instance.composioApiKey
      ? await decrypt(instance.composioApiKey)
      : null;

    const composio = createComposioClientForInstance(decryptedApiKey);
    const session = await composio.create(instance.id, {});

    // Verify the connectionId actually belongs to this instance before deleting.
    // This prevents a user from passing an arbitrary connectionId belonging to
    // another user or project.
    const toolkitsResult = await session.toolkits({ limit: 100 });
    const isOwned = toolkitsResult.items.some(
      (toolkit) =>
        toolkit.connection?.connectedAccount?.id === input.connectionId,
    );

    if (!isOwned) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message:
          "Connection does not belong to this project instance",
      });
    }

    await composio.connectedAccounts.delete(input.connectionId);

    return { success: true };
  });
