import { trpcServer, HydrateClient } from "~/clients/trpc/server";
import { ToolkitsClient } from "./_components/toolkits-client";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ instance?: string }>;
}) {
  const { instance } = await searchParams;

  void trpcServer.api.toolkits.getToolkits.prefetchInfinite({
    instanceId: instance,
    limit: 20,
  });

  return (
    <HydrateClient>
      <ToolkitsClient />
    </HydrateClient>
  );
}
