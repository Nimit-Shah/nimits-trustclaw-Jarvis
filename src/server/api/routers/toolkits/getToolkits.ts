import { protectedProcedure } from "~/server/api/trpc";
import { createComposioClientForInstance } from "~/server/clients/composio";
import { decrypt } from "~/lib/crypto";
import { getInstanceForUser } from "../nimits-jarvis/utils";
import { getToolkitsInput } from "./getToolkits.schema";

export const getToolkits = protectedProcedure
  .input(getToolkitsInput)
  .query(async ({ ctx, input }) => {
    const userId = ctx.session.user.id;

    const instance = await getInstanceForUser(userId, input.instanceId);

    const decryptedApiKey = instance.composioApiKey
      ? await decrypt(instance.composioApiKey)
      : null;

    const composio = createComposioClientForInstance(decryptedApiKey);
    const session = await composio.create(instance.id, {});

    const toolkitsResult = await session.toolkits({
      ...(input.search && input.search.length >= 3
        ? { search: input.search }
        : {}),
      ...(input.isConnected !== undefined
        ? { isConnected: input.isConnected }
        : {}),
      limit: input.limit,
      cursor: input.cursor,
    });

    if (toolkitsResult.items.length === 0) {
      return { items: [], nextCursor: null };
    }

    const items = toolkitsResult.items.map((toolkit) => ({
      slug: toolkit.slug,
      name: toolkit.name,
      logo: toolkit.logo ?? `https://logos.composio.dev/api/${toolkit.slug}`,
      noAuth: toolkit.isNoAuth,
      connected: !!toolkit.connection?.isActive,
      connectionId: toolkit.connection?.connectedAccount?.id ?? null,
    }));

    const connectedCount = items.filter((t) => t.connected).length;

    return {
      items,
      connectedCount,
      nextCursor: toolkitsResult.cursor ?? null,
    };
  });