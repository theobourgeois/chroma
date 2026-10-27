"use client";

import { useEffect, useRef } from "react";

const BUILD = process.env.NEXT_PUBLIC_BUILD;
/** Away at least this long before checking: a home-screen app resumes old code instead of reloading. */
const AWAY_MS = 30_000;

/** Reloads into a newer deploy when the app comes back to the foreground, unless a session is open. */
export function useReloadOnDeploy(busy: boolean) {
  const busyRef = useRef(busy);
  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);
  useEffect(() => {
    let hiddenAt = Date.now();
    const onChange = async () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      if (!BUILD || Date.now() - hiddenAt < AWAY_MS) return;
      const res = await fetch("/version", { cache: "no-store" }).catch(() => null);
      const live = res?.ok ? ((await res.json().catch(() => null)) as { build?: string } | null)?.build : undefined;
      if (live && live !== BUILD && !busyRef.current) location.reload();
    };
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);
}
