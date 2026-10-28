"use client";

import clsx from "clsx";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { unlock } from "@/lib/audio";
import { pcName, pcOf } from "@/lib/music";
import { listen } from "@/lib/pitch";
import { useStore } from "@/lib/store";
import { Button, Layer } from "./ui";

/** Hum or sing anything; it names the note. Not a game, nothing is recorded. */
export function Tuner({ onClose }: { onClose: () => void }) {
  const naming = useStore((s) => s.settings.naming);
  const [live, setLive] = useState<number | null>(null);
  const [last, setLast] = useState<number | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const stop = useRef<(() => void) | null>(null);

  useEffect(() => {
    let alive = true;
    const start = async () => {
      if (stop.current) return;
      try {
        const off = await listen((midi) => {
          setLive(midi);
          if (midi !== null) setLast(midi);
        });
        if (!alive) return off();
        stop.current = off;
        setError(false);
      } catch {
        if (alive) setError(true);
      }
    };
    const halt = () => {
      stop.current?.();
      stop.current = null;
      setLive(null);
    };
    // iOS cuts the mic in the background: let go, and pick it back up on return.
    const onVisible = () => (document.visibilityState === "visible" ? void start() : halt());
    void start();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVisible);
      halt();
    };
  }, [attempt]);

  const shown = live ?? last;
  const near = shown !== null ? Math.round(shown) : null;
  const cents = shown !== null ? Math.round((shown - near!) * 100) : 0;
  const tuned = Math.abs(cents) <= 10;

  return (
    <Layer onClose={onClose}>
      <div className="flex items-center justify-between px-5 pt-3 pb-2">
        <h1 className="text-[28px] font-bold tracking-tight">Tuner</h1>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="-mr-2 grid size-10 place-items-center rounded-full bg-fill text-muted"
        >
          <X size={20} strokeWidth={2.4} />
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 pb-16 text-center">
        {error ? (
          <>
            <p className="max-w-[260px] text-[17px] text-muted">Chroma needs the microphone to hear you.</p>
            <Button
              onClick={() => {
                unlock();
                setError(false);
                setAttempt((a) => a + 1);
              }}
            >
              Allow microphone
            </Button>
          </>
        ) : (
          <>
            <div className={clsx("flex items-start transition-opacity duration-300", live === null && "opacity-30")}>
              <span className="text-[120px] leading-none font-bold tracking-tight">
                {near !== null ? pcName(pcOf(near), naming) : "—"}
              </span>
              {near !== null && (
                <span className="mt-3 ml-1 text-[34px] font-semibold text-muted tabular-nums">{Math.floor(near / 12) - 1}</span>
              )}
            </div>

            {/* ±50 cents. */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative h-1.5 w-64 rounded-full bg-fill">
                <div className="absolute top-1/2 left-1/2 h-5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-line" />
                {live !== null && (
                  <div
                    className={clsx(
                      "absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full transition-[left] duration-75",
                      tuned ? "bg-good" : "bg-accent",
                    )}
                    style={{ left: `${50 + cents}%` }}
                  />
                )}
              </div>
              <div className="h-5 text-[15px] font-medium text-muted tabular-nums">
                {live === null ? (last === null ? "Hum or sing a note" : "") : tuned ? "In tune" : `${cents > 0 ? "+" : "−"}${Math.abs(cents)} cents`}
              </div>
            </div>
          </>
        )}
      </div>
    </Layer>
  );
}
