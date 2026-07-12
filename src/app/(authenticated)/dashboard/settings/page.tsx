import { trpcServer, HydrateClient } from "~/clients/trpc/server";
import { SettingsPageClient } from "./_components/settings-page-client";

export default async function Page() {

  await trpcServer.api.nimitsJarvis.getInstance.prefetch();
  void trpcServer.api.nimitsJarvis.getCronJobs.prefetchInfinite({
    limit: 20,
  });
  void trpcServer.api.nimitsJarvis.getMemories.prefetch({ limit: 50 });

  return (
    <HydrateClient>
      <SettingsPageClient />
    </HydrateClient>
  );
}
