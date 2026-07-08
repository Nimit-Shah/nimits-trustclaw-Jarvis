"use client";

import { useState, useEffect, useCallback } from "react";

export type MicPermissionState =
  | "unknown"   // haven't checked yet
  | "granted"   // confirmed by getUserMedia
  | "prompt"    // will show native browser dialog
  | "denied";   // getUserMedia actually failed — need manual re-enable

interface UseMicPermissionReturn {
  permissionState: MicPermissionState;
  /** Triggers getUserMedia — this is the ground truth for permission state. */
  requestPermission: () => Promise<boolean>;
}

/**
 * Reactive microphone permission hook.
 *
 * IMPORTANT: We use getUserMedia() as the *ground truth*, not permissions.query().
 * permissions.query() can return stale/incorrect values (e.g. "denied" when the user
 * has just granted access in OS settings, or on Safari which doesn't support it).
 *
 * Flow:
 *  - On mount: query permissions API (no dialog) to fast-path "granted" if already known
 *  - "denied" from permissions.query → treated as "prompt" (user gets a chance to try)
 *  - Only set "denied" when getUserMedia() actually throws → that's the real denial
 */
export function useMicPermission(): UseMicPermissionReturn {
  const [permissionState, setPermissionState] = useState<MicPermissionState>("unknown");

  useEffect(() => {
    let permStatus: PermissionStatus | null = null;

    void (async () => {
      try {
        permStatus = await navigator.permissions.query(
          { name: "microphone" as PermissionName },
        );

        // Only fast-path to "granted" — never set "denied" from permissions.query
        // because it can be stale. Let getUserMedia() confirm a real denial.
        if (permStatus.state === "granted") {
          setPermissionState("granted");
        } else {
          // Both "prompt" and "denied" from query → show the prompt screen
          // so the user always gets a chance to click Allow
          setPermissionState("prompt");
        }

        // Subscribe to real-time changes (e.g. user changes browser settings)
        permStatus.onchange = () => {
          if (!permStatus) return;
          if (permStatus.state === "granted") {
            setPermissionState("granted");
          } else {
            // On revoke, go back to prompt so they can re-grant via the dialog
            setPermissionState("prompt");
          }
        };
      } catch {
        // Safari doesn't support permissions.query for "microphone" — show prompt
        setPermissionState("prompt");
      }
    })();

    return () => {
      if (permStatus) permStatus.onchange = null;
    };
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      // This is the source of truth — if this succeeds, permission is definitely granted
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setPermissionState("granted");
      return true;
    } catch {
      // getUserMedia failed → now we know for sure it's denied
      setPermissionState("denied");
      return false;
    }
  }, []);

  return { permissionState, requestPermission };
}



