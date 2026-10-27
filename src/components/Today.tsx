"use client";

import clsx from "clsx";
import { Check } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { unlock } from "@/lib/audio";
import { plan, type Step } from "@/lib/daily";
import { LEVELS, trained } from "@/lib/ladder";
import { currentPushState, type PushState } from "@/lib/push";
import { setReminders } from "@/lib/reminder";
import { dayKey, streak, useStore } from "@/lib/store";
import { Button, Switch } from "./ui";
import { Wheel } from "./Wheel";

export function Today({ onStart }: { onStart: (steps: Step[], daily: boolean) => void }) {
  const s = useStore((x) => x);
  const steps = useMemo(() => plan(s), [s]);
  const day = s.days[dayKey()];
  const done = day?.done ?? false;
  const at = day?.step ?? 0;
  const n = streak(s.days);
  const set = trained(s.ladder.stage);
  // The newest pitch only counts as learned once its first level is behind you.
  const lit = s.ladder.level > 0 || s.ladder.stage === 1 ? set : set.slice(0, -1);

  return (
    <div className="flex flex-col gap-8 px-5 pt-2 pb-8">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[64px] leading-none font-bold tracking-tight tabular-nums">{n}</div>
          <div className="mt-1 text-[15px] font-medium text-muted">day streak</div>
        </div>
        <div className="pb-1 text-right text-[15px] font-medium text-muted">
          {new Date().toLocaleDateString(undefined, { weekday: "long" })}
        </div>
      </div>

      <div className="overflow-hidden rounded-[18px] bg-fill">
        {steps.map((step, i) => (
          <div
            key={i}
            className={clsx("flex h-[54px] items-center gap-3 px-4", i > 0 && "border-t-[0.5px] border-line")}
          >
            <div
              className={clsx(
                "grid size-6 place-items-center rounded-full text-[12px] font-bold tabular-nums",
                done || i < at ? "bg-accent text-white" : i === at ? "bg-fg text-bg" : "bg-line text-muted",
              )}
            >
              {done || i < at ? <Check size={14} strokeWidth={3} /> : i + 1}
            </div>
            <div className={clsx("flex-1 text-[17px] font-medium", (done || i < at) && "text-muted")}>{step.name}</div>
            <div className="text-[15px] text-muted tabular-nums">
              {step.game === "ladder" ? `${step.count} levels` : `${step.count}`}
            </div>
          </div>
        ))}
      </div>

      {done ? (
        <div className="-mt-2 text-center text-[17px] font-semibold text-muted">Done for today</div>
      ) : (
        <Button
          className="-mt-2 w-full"
          onClick={() => {
            unlock();
            onStart(steps, true);
          }}
        >
          {at > 0 ? "Continue" : "Start"}
        </Button>
      )}

      <div className="flex flex-col items-center gap-3 pt-2">
        <Wheel lit={lit} current={set[set.length - 1]} naming={s.settings.naming} />
        <div className="text-[15px] text-muted tabular-nums">
          {s.ladder.mastered
            ? "All twelve"
            : `${lit.length} of 12 · level ${s.ladder.level + 1} of ${LEVELS.length}`}
        </div>
      </div>

      {!s.settings.remind && <ReminderNudge at={s.settings.remindAt} />}
    </div>
  );
}

function ReminderNudge({ at }: { at: string }) {
  const [push, setPush] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void currentPushState().then((r) => setPush(r.state));
  }, []);
  if (!push || push === "unsupported" || push === "denied") return null;
  return (
    <div className="flex items-center gap-3 rounded-[18px] bg-fill px-4 py-3.5">
      <div className="flex-1">
        <div className="text-[17px] font-medium">Daily reminder</div>
        <div className="text-[14px] text-muted">
          {push === "needs-install" ? "Add to Home Screen first" : `Every day at ${formatTime(at)}`}
        </div>
      </div>
      <Switch
        on={false}
        disabled={push === "needs-install" || busy}
        onChange={async () => {
          setBusy(true);
          await setReminders(true).catch(() => false);
          setBusy(false);
        }}
      />
    </div>
  );
}

export function formatTime(at: string) {
  const [h, m] = at.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
