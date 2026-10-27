"use client";

import clsx from "clsx";
import { Check, X } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { play, preload, type Sound, SOUNDS, unlock } from "@/lib/audio";
import type { Naming } from "@/lib/music";
import { currentPushState, type PushState } from "@/lib/push";
import { setReminders, syncReminder } from "@/lib/reminder";
import { reset, update, useStore } from "@/lib/store";
import { Layer, Segmented, Switch } from "./ui";

const NAMINGS: { id: Naming; name: string }[] = [
  { id: "sharp", name: "C♯" },
  { id: "flat", name: "D♭" },
  { id: "solfege", name: "Do" },
];

export function Settings({ onClose }: { onClose: () => void }) {
  const settings = useStore((s) => s.settings);
  const [push, setPush] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    void currentPushState().then((r) => setPush(r.state));
  }, []);

  const remindOn = settings.remind && push === "on";
  const toggle = async (on: boolean) => {
    setBusy(true);
    try {
      await setReminders(on);
    } catch {}
    setPush((await currentPushState()).state);
    setBusy(false);
  };

  const pickSound = (sound: Sound) => {
    unlock();
    update((s) => void (s.settings.sound = sound));
    preload(sound);
    void play([{ midi: 60 }, { midi: 64, at: 0.35 }, { midi: 67, at: 0.7, dur: 1 }], sound);
  };

  return (
    <Layer onClose={onClose}>
      <div className="flex items-center justify-between px-5 pt-3 pb-2">
        <h1 className="text-[28px] font-bold tracking-tight">Settings</h1>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="-mr-2 grid size-10 place-items-center rounded-full bg-fill text-muted"
        >
          <X size={20} strokeWidth={2.4} />
        </button>
      </div>

      <div className="flex flex-col gap-7 px-5 pt-3 pb-10">
        <Group title="Reminder">
          <Row label="Daily reminder">
            <Switch
              on={remindOn}
              disabled={busy || !push || push === "unsupported" || push === "needs-install" || push === "denied"}
              onChange={(on) => void toggle(on)}
            />
          </Row>
          {remindOn && (
            <Row label="Time">
              <input
                type="time"
                value={settings.remindAt}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) return;
                  update((s) => void (s.settings.remindAt = v));
                  void syncReminder().catch(() => {});
                }}
                className="rounded-[8px] bg-line/60 px-2 py-1 text-[17px] tabular-nums"
              />
            </Row>
          )}
          {(push === "needs-install" || push === "denied" || push === "unsupported") && (
            <div className="border-t-[0.5px] border-line px-4 py-3 text-[14px] text-muted">
              {push === "needs-install"
                ? "Share → Add to Home Screen, then open Chroma from there."
                : push === "denied"
                  ? "Notifications are blocked for this site."
                  : "This browser can't send notifications."}
            </div>
          )}
        </Group>

        <Group title="Note names">
          <div className="p-3">
            <Segmented value={settings.naming} options={NAMINGS} onChange={(v) => update((s) => void (s.settings.naming = v))} />
          </div>
        </Group>

        <Group title="Sound">
          {SOUNDS.map((o, i) => (
            <button
              key={o.id}
              type="button"
              onClick={() => pickSound(o.id)}
              className={clsx(
                "flex h-[50px] w-full items-center px-4 text-left text-[17px] active:bg-line",
                i > 0 && "border-t-[0.5px] border-line",
              )}
            >
              <span className="flex-1">{o.name}</span>
              {settings.sound === o.id && <Check size={20} strokeWidth={2.6} className="text-accent" />}
            </button>
          ))}
        </Group>

        <Group title="Games">
          <Row label="Unlock everything">
            <Switch on={settings.everything} onChange={(on) => update((s) => void (s.settings.everything = on))} />
          </Row>
        </Group>

        <Group>
          <button
            type="button"
            onClick={() => {
              if (!confirm) return setConfirm(true);
              reset();
              setConfirm(false);
            }}
            className="h-[50px] w-full px-4 text-left text-[17px] text-bad"
          >
            {confirm ? "Tap again to erase all progress" : "Reset progress"}
          </button>
        </Group>

        <p className="px-1 text-[12px] leading-relaxed text-muted">
          Piano: Salamander Grand Piano by Alexander Holm. Other instruments: nbrosowsky/tonejs-instruments. Both CC BY
          3.0. Training method after Wong et al. (2025).
        </p>
      </div>
    </Layer>
  );
}

function Group({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section>
      {title && <h2 className="mb-2 px-1 text-[13px] font-semibold tracking-wide text-muted uppercase">{title}</h2>}
      <div className="overflow-hidden rounded-[18px] bg-fill">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex h-[54px] items-center gap-3 border-t-[0.5px] border-line px-4 first:border-t-0">
      <span className="flex-1 text-[17px]">{label}</span>
      {children}
    </div>
  );
}
