import { trpcServer, HydrateClient } from "~/clients/trpc/server";
import { SettingsPageClient } from "./_components/settings-page-client";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ instance?: string }>;
}) {
  const { instance } = await searchParams;

  await trpcServer.api.nimitsJarvis.getInstance.prefetch({
    instanceId: instance,
  });
  void trpcServer.api.nimitsJarvis.getCronJobs.prefetchInfinite({
    instanceId: instance,
    limit: 20,
  });
  void trpcServer.api.nimitsJarvis.getMemories.prefetch({
    instanceId: instance,
    limit: 50,
  });

  return (
    <HydrateClient>
      <SettingsPageClient />
    </HydrateClient>
  );
}
