import { trpcServer, HydrateClient } from "~/clients/trpc/server";
import { ErrorBoundary } from "~/components/core/error-boundary";
import { NimitsJarvisChat } from "./_components/chat/nimits-jarvis-chat";
import { OnboardingClient } from "./_components/onboarding/onboarding-client";

export default async function Page() {
  void trpcServer.api.nimitsJarvis.getHistory.prefetchInfinite({ limit: 10 });
  void trpcServer.api.nimitsJarvis.getStreamingMessage.prefetch();

  const status = await trpcServer.api.nimitsJarvis.getStatus();

  if (!status.hasInstance) {
    void trpcServer.api.nimitsJarvis.getInstance.prefetch();

    return (
      <HydrateClient>
        <ErrorBoundary>
          <OnboardingClient
            hasExistingInstance={status.hasInstance}
            hasOnboardingState={status.hasOnboardingState}
          />
        </ErrorBoundary>
      </HydrateClient>
    );
  }

  return (
    <HydrateClient>
      <ErrorBoundary>
        <NimitsJarvisChat />
      </ErrorBoundary>
    </HydrateClient>
  );
}
