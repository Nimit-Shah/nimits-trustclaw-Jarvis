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
export function useMicPermission(): UseMicPermissionReturn & { errorMessage: string | null } {
  const [permissionState, setPermissionState] = useState<MicPermissionState>("unknown");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let permStatus: PermissionStatus | null = null;

    void (async () => {
      try {
        permStatus = await navigator.permissions.query(
          { name: "microphone" as PermissionName },
        );

        if (permStatus.state === "granted") {
          setPermissionState("granted");
        } else {
          setPermissionState("prompt");
        }

        permStatus.onchange = () => {
          if (!permStatus) return;
          if (permStatus.state === "granted") {
            setPermissionState("granted");
            setErrorMessage(null);
          } else {
            setPermissionState("prompt");
          }
        };
      } catch {
        setPermissionState("prompt");
      }
    })();

    return () => {
      if (permStatus) permStatus.onchange = null;
    };
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      setErrorMessage(null);
      if (typeof navigator === "undefined" || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("navigator.mediaDevices is undefined. This usually means you are not using HTTPS (secure context).");
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setPermissionState("granted");
      return true;
    } catch (err: any) {
      console.error("Mic permission error:", err);
      let msg = err.message || "Unknown error";
      if (err.name === "NotAllowedError") msg = "Permission was denied by the user or OS.";
      else if (err.name === "NotFoundError") msg = "No microphone found on this device.";
      else if (err.name === "NotReadableError") msg = "Microphone is in use by another application.";
      
      setErrorMessage(`${err.name ? err.name + ": " : ""}${msg}`);
      setPermissionState("denied");
      return false;
    }
  }, []);

  return { permissionState, requestPermission, errorMessage };
}



