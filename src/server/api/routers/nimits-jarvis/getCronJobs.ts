import { protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/clients/db";
import { getCronJobsInput } from "./getCronJobs.schema";
import { getInstanceForUser } from "./utils";

export const getCronJobs = protectedProcedure
  .input(getCronJobsInput)
  .query(async ({ ctx, input }) => {
    const userId = ctx.session.user.id;

    // Resolve instance with ownership check
    const instance = await getInstanceForUser(userId, input.instanceId);

    const jobs = await db.cronJob.findMany({
      where: { instanceId: instance.id },
      select: {
        id: true,
        chatId: true,
        expression: true,
        prompt: true,
        timezone: true,
        enabled: true,
        lastRunAt: true,
        nextRunAt: true,
        lockedAt: true,
        lastError: true,
      },
      orderBy: { nextRunAt: "asc" },
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    });

    let nextCursor: string | undefined;
    if (jobs.length > input.limit) {
      const nextItem = jobs.pop();
      nextCursor = nextItem?.id;
    }

    return {
      items: jobs,
      nextCursor,
    };
  });
