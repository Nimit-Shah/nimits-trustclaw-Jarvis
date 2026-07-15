import { protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/clients/db";
import { getInstanceForUser } from "../nimits-jarvis/utils";
import { createChatInput } from "./create.schema";

export const create = protectedProcedure
  .input(createChatInput)
  .mutation(async ({ ctx, input }) => {
    const userId = ctx.session.user.id;

    const instance = await getInstanceForUser(userId, input.instanceId);

    const chat = await db.chat.create({
      data: {
        instanceId: instance.id,
        name: input.name ?? "New Chat",
        model: input.model ?? instance.anthropicModel,
      },
      select: {
        id: true,
        name: true,
        model: true,
        updatedAt: true,
        createdAt: true,
      },
    });

    return chat;
  });