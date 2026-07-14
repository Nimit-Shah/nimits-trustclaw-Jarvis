"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { trpc } from "~/clients/trpc";
import {
  trpcToastOnError,
  showSuccessToast,
} from "~/components/core/toast-notifications";
import type { RouterOutputs } from "~/clients/trpc";

type ToolkitItem = RouterOutputs["toolkits"]["getToolkits"]["items"][number];

interface ToolkitCardProps {
  toolkit: ToolkitItem;
  instanceId?: string;
}

export function ToolkitCard({ toolkit, instanceId }: ToolkitCardProps) {
  const [logoLoaded, setLogoLoaded] = useState(false);
  const router = useRouter();

  const utils = trpc.useUtils();
  const getAuthLink = trpc.toolkits.getAuthLink.useMutation({
    onError: trpcToastOnError,
    onSuccess: () => void utils.toolkits.getToolkits.invalidate(),
  });

  const disconnectToolkit = trpc.toolkits.disconnectToolkit.useMutation({
    onSuccess: () => {
      showSuccessToast(`Disconnected ${toolkit.name}`);
      void utils.toolkits.getToolkits.invalidate();
    },
    onError: trpcToastOnError,
  });

  const isConnected = toolkit.connected || toolkit.noAuth;
  const statusLabel = toolkit.connected
    ? "Connected"
    : toolkit.noAuth
      ? "Active"
      : null;

  const handleConnect = async (e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      const { redirectUrl } = await getAuthLink.mutateAsync({
        instanceId,
        toolkit: toolkit.slug,
      });
      router.push(redirectUrl);
    } catch {
      // trpcToastOnError already handles the toast
    }
  };

  const handleDisconnect = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!toolkit.connectionId) return;
    void disconnectToolkit.mutateAsync({
      instanceId,
      connectionId: toolkit.connectionId,
    });
  };

  return (
    <article
      className="toolkit-card group relative cursor-pointer rounded-xl border-[2px] border-transparent outline outline-1 outline-border bg-card transition-[translate,scale] duration-100 ease-[cubic-bezier(.645,.045,.355,1)] active:translate-y-px active:scale-[0.99]"
      style={{ containerType: "size", aspectRatio: "1" }}
    >
      {/* Inner container with clip for glow containment */}
      <div className="absolute inset-0 overflow-hidden rounded-xl [clip-path:inset(0_round_12px)]">
        {/* Blurred glow copy of logo */}
        <div
          className="pointer-events-none absolute inset-0 grid place-items-center will-change-transform"
          style={{
            filter: "url(#toolkit-blur) saturate(5) brightness(1.3)",
            translate:
              "calc(var(--pointer-x, -10) * 50cqi) calc(var(--pointer-y, -10) * 50cqh)",
            scale: "3.4",
            opacity: 0.25,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- external SVG from logos.composio.dev */}
          <img
            src={toolkit.logo}
            alt=""
            className="h-16 w-16"
            draggable={false}
          />
        </div>

        {/* Card content */}
        <div className="relative z-[2] flex h-full flex-col items-center justify-center gap-1.5 p-4 pt-10">
          {/* Top-right: status badge/connect button + disconnect X */}
          <div className="absolute right-3 top-3 z-[1] flex items-center gap-1">
            {isConnected ? (
              <>
                <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
                  {statusLabel}
                </span>
                {/* Disconnect button — only shown for real connections (not noAuth) */}
                {toolkit.connected && toolkit.connectionId && (
                  <button
                    onClick={handleDisconnect}
                    disabled={disconnectToolkit.isPending}
                    title={`Disconnect ${toolkit.name}`}
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive/10 text-destructive opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive/20 disabled:opacity-50"
                  >
                    {disconnectToolkit.isPending ? (
                      <Loader2 className="h-2.5 w-2.5 animate-spin" />
                    ) : (
                      <X className="h-2.5 w-2.5" />
                    )}
                  </button>
                )}
              </>
            ) : (
              <Button
                size="sm"
                className="h-7 px-2.5 text-xs transition-all duration-200 group-hover:scale-105 group-hover:shadow-md"
                onClick={handleConnect}
                disabled={getAuthLink.isPending}
              >
                {getAuthLink.isPending ? "Connecting..." : "Connect"}
              </Button>
            )}
          </div>

          {/* Sharp logo */}
          {/* eslint-disable-next-line @next/next/no-img-element -- external SVG from logos.composio.dev */}
          <img
            src={toolkit.logo}
            alt={`${toolkit.name} logo`}
            className="h-12 w-12 select-none transition-opacity duration-300 ease-in"
            style={{ opacity: logoLoaded ? 1 : 0 }}
            onLoad={() => setLogoLoaded(true)}
            draggable={false}
          />

          {/* Name */}
          <h3 className="select-none text-sm font-semibold text-foreground">
            {toolkit.name}
          </h3>


        </div>
      </div>

      {/* Frosted glass border effect - uses longhands to prevent mask shorthand from resetting maskComposite */}
      <div
        className="pointer-events-none absolute inset-0 z-[3] rounded-xl [clip-path:inset(0_round_12px)]"
        style={{
          border: "2px solid transparent",
          backdropFilter: "saturate(4.2) brightness(2.5) contrast(2.5)",
          maskImage:
            "linear-gradient(#fff 0 100%), linear-gradient(#fff 0 100%)",
          maskOrigin: "border-box, padding-box",
          maskClip: "border-box, padding-box",
          maskComposite: "exclude",
          WebkitMaskImage:
            "linear-gradient(#fff 0 100%), linear-gradient(#fff 0 100%)",
          WebkitMaskOrigin: "border-box, padding-box",
          WebkitMaskClip: "border-box, padding-box",
          WebkitMaskComposite: "xor",
        }}
      />
    </article>
  );
}
