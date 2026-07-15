import { protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/clients/db";
import { getInstanceForUser } from "../nimits-jarvis/utils";
import { searchInput } from "./search.schema";

export const search = protectedProcedure
  .input(searchInput)
  .query(async ({ ctx, input }) => {
    const userId = ctx.session.user.id;

    const instance = await getInstanceForUser(userId, input.instanceId);

    const messages = await db.message.findMany({
      where: {
        instanceId: instance.id,
        messageType: "regular",
        content: {
          path: ["$[*].text"],
          string_contains: input.query,
        },
      },
      select: {
        id: true,
        chatId: true,
        content: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: input.limit,
    });

    const results = messages.map((msg) => {
      const textParts = (msg.content as Array<{ type: string; text?: string }>)
        .filter((p) => p.type === "text" && p.text)
        .map((p) => p.text)
        .join(" ");

      const queryLower = input.query.toLowerCase();
      const textLower = textParts.toLowerCase();
      const matchIndex = textLower.indexOf(queryLower);

      const previewStart = Math.max(0, matchIndex - 40);
      const previewEnd = Math.min(textParts.length, matchIndex + input.query.length + 40);
      const preview =
        (previewStart > 0 ? "..." : "") +
        textParts.slice(previewStart, previewEnd) +
        (previewEnd < textParts.length ? "..." : "");

      return {
        messageId: msg.id,
        chatId: msg.chatId,
        preview,
        createdAt: msg.createdAt.toISOString(),
      };
    });

    return results;
  });