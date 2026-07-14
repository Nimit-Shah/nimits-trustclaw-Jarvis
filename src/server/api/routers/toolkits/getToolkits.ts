import { protectedProcedure } from "~/server/api/trpc";
import { createComposioClientForInstance } from "~/server/clients/composio";
import { decrypt } from "~/lib/crypto";
import { getInstanceForUser } from "~/server/api/routers/nimits-jarvis/utils";
import { getToolkitsInput } from "./getToolkits.schema";

export const getToolkits = protectedProcedure
  .input(getToolkitsInput)
  .query(async ({ ctx, input }) => {
    const userId = ctx.session.user.id;

    // Ownership-checked resolution — falls back to earliest-created instance
    const instance = await getInstanceForUser(userId, input.instanceId);

    // Decrypt per-project API key if present; fall back to global env key
    const decryptedApiKey = instance.composioApiKey
      ? await decrypt(instance.composioApiKey)
      : null;

    const composio = createComposioClientForInstance(decryptedApiKey);
    // Use the project's own instance ID as Composio entityId to isolate connections
    const session = await composio.create(instance.id, {});

    // 1. Fetch toolkit listing
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

    // 2. Merge and return — include connectionId for disconnect functionality
    const items = toolkitsResult.items.map((toolkit) => ({
      slug: toolkit.slug,
      name: toolkit.name,
      logo: toolkit.logo ?? `https://logos.composio.dev/api/${toolkit.slug}`,
      noAuth: toolkit.isNoAuth,
      connected: !!toolkit.connection?.isActive,
      // The connected account ID required by disconnectToolkit
      connectionId: toolkit.connection?.connectedAccount?.id ?? null,
    }));

    return {
      items,
      nextCursor: toolkitsResult.cursor ?? null,
    };
  });
