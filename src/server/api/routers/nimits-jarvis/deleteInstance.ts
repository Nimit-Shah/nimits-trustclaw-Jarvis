import { TRPCError } from "@trpc/server";
import { protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/clients/db";
import { deleteInstanceInput } from "./deleteInstance.schema";
import { getInstanceForUser } from "./utils";

export const deleteInstance = protectedProcedure
  .input(deleteInstanceInput)
  .mutation(async ({ ctx, input }) => {
    const userId = ctx.session.user.id;

    // Resolve instance with ownership check
    const instance = await getInstanceForUser(userId, input?.instanceId);

    return db.$transaction(async (tx) => {
      await tx.message.deleteMany({
        where: { instanceId: instance.id },
      });
      await tx.cronJob.deleteMany({
        where: { instanceId: instance.id },
      });
      await tx.$queryRaw`DELETE FROM composio_claw_memory WHERE "instanceId" = ${instance.id}`;
      await tx.composioClawInstance.delete({
        where: { id: instance.id },
      });

      return { success: true };
    });
  });
