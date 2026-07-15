import { protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/clients/db";
import { getInstanceForUser } from "../nimits-jarvis/utils";
import { chatsListInput } from "./list.schema";

export const list = protectedProcedure
  .input(chatsListInput.optional())
  .query(async ({ ctx, input }) => {
    const userId = ctx.session.user.id;
    const instance = await getInstanceForUser(userId, input?.instanceId);

    const chats = await db.chat.findMany({
      where: { instanceId: instance.id },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        model: true,
        updatedAt: true,
        createdAt: true,
      },
    });

    return chats;
  });