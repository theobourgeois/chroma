"use client";

import clsx from "clsx";
import { BarChart3, Dumbbell, Settings as Gear, Sun } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { preload, unlock } from "@/lib/audio";
import { plan, type Step } from "@/lib/daily";
import { useReloadOnDeploy } from "@/lib/freshness";
import { registerServiceWorker } from "@/lib/push";
import { syncReminder } from "@/lib/reminder";
import { dayKey, get, useHydrated, useStore } from "@/lib/store";
import { Progress } from "./Progress";
import { Runner } from "./Runner";
import { Settings } from "./Settings";
import { Today } from "./Today";
import { Train } from "./Train";

type Tab = "today" | "train" | "progress";

const TABS: { id: Tab; name: string; icon: typeof Sun }[] = [
  { id: "today", name: "Today", icon: Sun },
  { id: "train", name: "Train", icon: Dumbbell },
  { id: "progress", name: "Progress", icon: BarChart3 },
];

export function App() {
  const hydrated = useHydrated();
  const sound = useStore((s) => s.settings.sound);
  const [tab, setTab] = useState<Tab>("today");
  const [session, setSession] = useState<{ steps: Step[]; daily: boolean; id: number } | null>(null);
  const [settings, setSettings] = useState(false);
  const busy = session !== null;

  useReloadOnDeploy(busy);

  const start = useCallback((steps: Step[], daily: boolean) => setSession({ steps, daily, id: Date.now() }), []);
  const close = useCallback(() => {
    setSession(null);
    void syncReminder().catch(() => {});
  }, []);

  // Open today's session when launched from the reminder.
  const openToday = useCallback(() => {
    if (get().days[dayKey()]?.done) return setTab("today");
    setTab("today");
    setSession((cur) => cur ?? { steps: plan(get()), daily: true, id: Date.now() });
  }, []);

  useEffect(() => {
    void registerServiceWorker()?.catch(() => {});
    void syncReminder().catch(() => {});
    const url = new URL(location.href);
    if (url.searchParams.has("start")) {
      history.replaceState(null, "", "/");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      openToday();
    }
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "open" && String(e.data.url).includes("start=1")) openToday();
    };
    navigator.serviceWorker?.addEventListener("message", onMessage);
    // iOS keeps audio suspended until a tap, and re-suspends it after backgrounding.
    window.addEventListener("pointerdown", unlock, { passive: true });
    return () => {
      navigator.serviceWorker?.removeEventListener("message", onMessage);
      window.removeEventListener("pointerdown", unlock);
    };
  }, [openToday]);

  useEffect(() => {
    void preload(sound);
  }, [sound]);

  // A day rolls over while the app stays open: re-schedule tomorrow's reminder.
  useEffect(() => {
    const onShow = () => document.visibilityState === "visible" && void syncReminder().catch(() => {});
    document.addEventListener("visibilitychange", onShow);
    return () => document.removeEventListener("visibilitychange", onShow);
  }, []);

  return (
    <div className="mx-auto flex min-h-dvh max-w-[520px] flex-col pt-[env(safe-area-inset-top)]">
      <header className="flex h-14 items-center justify-between px-5">
        <h1 className="text-[28px] font-bold tracking-tight">{TABS.find((t) => t.id === tab)!.name}</h1>
        <button
          type="button"
          aria-label="Settings"
          onClick={() => setSettings(true)}
          className="-mr-2 grid size-10 place-items-center rounded-full text-muted active:bg-fill"
        >
          <Gear size={22} strokeWidth={2} />
        </button>
      </header>

      <main className={clsx("flex-1 pb-[calc(76px+env(safe-area-inset-bottom))]", !hydrated && "opacity-0")}>
        {tab === "today" && <Today onStart={start} />}
        {tab === "train" && <Train onStart={start} />}
        {tab === "progress" && <Progress />}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t-[0.5px] border-line bg-bg/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
        <div className="mx-auto flex h-[60px] max-w-[520px]">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={clsx(
                "flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors",
                tab === t.id ? "text-accent" : "text-muted",
              )}
            >
              <t.icon size={24} strokeWidth={tab === t.id ? 2.3 : 1.9} />
              {t.name}
            </button>
          ))}
        </div>
      </nav>

      {session && <Runner key={session.id} steps={session.steps} daily={session.daily} onClose={close} />}
      {settings && <Settings onClose={() => setSettings(false)} />}
    </div>
  );
}
