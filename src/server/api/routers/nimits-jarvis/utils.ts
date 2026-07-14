import { TRPCError } from "@trpc/server";
import { db } from "~/server/clients/db";
import type { ComposioClawInstance } from "~/generated/prisma/client";

// ─── Types ───────────────────────────────────────────────────────────────────

export type InstanceLite = Pick<
  ComposioClawInstance,
  "id" | "userId" | "name" | "composioApiKey" | "anthropicModel" | "createdAt" | "composioProjectId"
>;

// ─── Instance Resolution ─────────────────────────────────────────────────────

/**
 * Resolves a ComposioClawInstance for a given user, enforcing ownership.
 *
 * - If `instanceId` is provided: looks it up scoped to `userId` and throws
 *   FORBIDDEN if it doesn't exist or belongs to another user.
 * - If `instanceId` is omitted: falls back to the **earliest-created** instance
 *   for that user (deterministic). Creates a "Default" instance if none exist.
 *
 * Never silently falls back to another user's data.
 */
export async function getInstanceForUser(
  userId: string,
  instanceId?: string,
): Promise<InstanceLite> {
  const select = {
    id: true,
    userId: true,
    name: true,
    composioApiKey: true,
    anthropicModel: true,
    createdAt: true,
    composioProjectId: true,
  } as const;

  if (instanceId) {
    const instance = await db.composioClawInstance.findFirst({
      where: { id: instanceId, userId },
      select,
    });
    if (!instance) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Instance not found or does not belong to you",
      });
    }
    return instance;
  }

  // Deterministic fallback — earliest-created instance
  const fallback = await db.composioClawInstance.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select,
  });

  if (fallback) return fallback;

  // No instances exist yet — auto-create a "Default" instance
  return db.composioClawInstance.create({
    data: { userId, name: "Default" },
    select,
  });
}

/**
 * Returns all instances for a user (for the project switcher dropdown).
 * Always scoped to `userId` — never leaks other users' projects.
 */
export async function listInstancesForUser(
  userId: string,
): Promise<Pick<ComposioClawInstance, "id" | "name" | "createdAt" | "composioProjectId">[]> {
  return db.composioClawInstance.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, createdAt: true, composioProjectId: true },
  });
}
