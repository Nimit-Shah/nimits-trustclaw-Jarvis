"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useEffect } from "react";

const STORAGE_KEY = "nimits-jarvis-active-chat";

export function useChatId(): [
  string | undefined,
  (id: string) => void,
] {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const paramId = searchParams.get("chat") ?? undefined;

  // Restore from localStorage on mount (mirrors useInstanceId pattern)
  useEffect(() => {
    if (!paramId && typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY) ?? undefined;
      if (stored) {
        const params = new URLSearchParams(window.location.search);
        params.set("chat", stored);
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      }
    }
  }, [paramId, pathname, router]);

  const setChatId = useCallback(
    (id: string) => {
      try {
        localStorage.setItem(STORAGE_KEY, id);
      } catch {
        // Ignore quota/private-mode errors
      }

      const params = new URLSearchParams(searchParams.toString());
      params.set("chat", id);
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  return [paramId, setChatId];
}