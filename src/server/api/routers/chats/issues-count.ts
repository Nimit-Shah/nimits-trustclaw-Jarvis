import { protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/clients/db";
import { getInstanceForUser } from "../nimits-jarvis/utils";
import { issuesCountInput } from "./issues-count.schema";

export const issuesCount = protectedProcedure
  .input(issuesCountInput.optional())
  .query(async ({ ctx, input }) => {
    const userId = ctx.session.user.id;
    const instance = await getInstanceForUser(userId, input?.instanceId);

    const result = await db.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count
      FROM composio_claw_message m
      JOIN composio_claw_chat c ON m."chatId" = c.id
      WHERE c."instanceId" = ${instance.id}
        AND m.role = 'assistant'
        AND m.content::text LIKE '%output-error%'
    `;

    return { count: Number(result[0]?.count ?? 0) };
  });