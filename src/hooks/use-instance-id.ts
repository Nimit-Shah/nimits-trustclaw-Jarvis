"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useEffect } from "react";

const STORAGE_KEY = "nimits-jarvis-active-instance";

/**
 * Client-side project instance selector.
 *
 * The selected instanceId lives in two places:
 * 1. URL query param `?instance=<id>` — authoritative for the current tab.
 * 2. localStorage `nimits-jarvis-active-instance` — the default when the user
 *    opens a new tab or navigates to the app without an explicit param.
 *
 * Rules:
 * - URL param beats localStorage on every render.
 * - Switching via `setInstanceId` updates both the URL and localStorage.
 * - When no param is present, localStorage is read as the initial default.
 * - When neither is set, `undefined` is returned — the server falls back
 *   to the earliest-created instance for that user.
 */
export function useInstanceId(): [
  string | undefined,
  (id: string) => void,
] {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  // Prefer URL param, then localStorage
  const paramId = searchParams.get("instance") ?? undefined;

  // Initialise from localStorage on mount (inside useEffect to avoid render-time side effects)
  useEffect(() => {
    if (!paramId && typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY) ?? undefined;
      if (stored) {
        const params = new URLSearchParams(window.location.search);
        params.set("instance", stored);
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      }
    }
  }, [paramId, pathname, router]);

  const instanceId = paramId;

  const setInstanceId = useCallback(
    (id: string) => {
      // Update localStorage default
      try {
        localStorage.setItem(STORAGE_KEY, id);
      } catch {
        // Ignore quota/private-mode errors
      }

      // Update URL param — this triggers React Query to refetch all queries
      // whose keys include instanceId
      const params = new URLSearchParams(searchParams.toString());
      params.set("instance", id);
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  return [instanceId, setInstanceId];
}
