import { PrismaClient } from "~/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "~/env";

function ensureDefaultSsl(url: string): string {
  const parsed = new URL(url);
  // Only set secure default when the URL doesn't already specify sslmode.
  // This allows local dev to use ?sslmode=disable while cloud URLs (Neon, etc.)
  // that have no sslmode get the safe production default of verify-full.
  if (!parsed.searchParams.has("sslmode")) {
    parsed.searchParams.set("sslmode", "verify-full");
  }
  return parsed.toString();
}

const createPrismaClient = () => {
  const adapter = new PrismaPg({
    connectionString: ensureDefaultSsl(env.DATABASE_URL),
  });

  return new PrismaClient({
    adapter,
    log:
      env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
};

const globalForPrisma = globalThis as typeof globalThis & {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") globalForPrisma.prisma = db;
