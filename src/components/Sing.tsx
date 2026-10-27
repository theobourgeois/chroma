"use client";

import clsx from "clsx";
import { Mic } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { play, stopAll } from "@/lib/audio";
import { trained } from "@/lib/ladder";
import { pcName, pcOf, pick } from "@/lib/music";
import { listen } from "@/lib/pitch";
import { get, record, update, useStore } from "@/lib/store";
import { Orb } from "./Orb";
import type { Result } from "./Quiz";
import { Button, SessionBar } from "./ui";

/** Held this long on one pitch counts as an answer. */
const HOLD_MS = 350;
const GIVE_UP_MS = 7000;

/** Producing a pitch from its name: the other half of absolute pitch. */
export function Sing({ count, onDone, onClose }: { count: number; onDone: (r: Result) => void; onClose: () => void }) {
  const naming = useStore((s) => s.settings.naming);
  const sound = useStore((s) => s.settings.sound);
  const [on, setOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [i, setI] = useState(0);
  const [target, setTarget] = useState(() => pickTarget());
  const [live, setLive] = useState<number | null>(null);
  const [verdict, setVerdict] = useState<{ right: boolean; sung: number | null } | null>(null);
  const stop = useRef<(() => void) | null>(null);
  const hold = useRef<{ pc: number; since: number } | null>(null);
  const verdictRef = useRef(verdict);
  const targetRef = useRef(target);
  const tally = useRef({ n: 0, c: 0 });

  useEffect(() => () => {
    stop.current?.();
    stopAll();
  }, []);

  const judge = (right: boolean, sung: number | null) => {
    if (verdictRef.current) return;
    const target = targetRef.current;
    verdictRef.current = { right, sung };
    setVerdict({ right, sung });
    tally.current.n++;
    if (right) tally.current.c++;
    update((s) => {
      record(s, right, target);
      const st = (s.games.sing ??= { unlocked: 0, recent: [], n: 0, c: 0 });
      st.n++;
      if (right) st.c++;
      st.recent = [...st.recent, right ? 1 : 0].slice(-40);
    });
    // Then hear the real thing, near where you sang.
    const octave = sung ? Math.round((sung - target) / 12) * 12 + target : 48 + target;
    void play([{ midi: Math.max(40, Math.min(76, octave)), dur: 1.4 }], sound);
  };

  const start = async () => {
    try {
      stop.current = await listen((midi) => {
        setLive(midi);
        if (verdictRef.current || midi === null) {
          hold.current = null;
          return;
        }
        const pc = pcOf(Math.round(midi));
        const now = performance.now();
        if (!hold.current || hold.current.pc !== pc) hold.current = { pc, since: now };
        else if (now - hold.current.since > HOLD_MS) judgeRef.current(pc === targetRef.current, midi);
      });
      setOn(true);
    } catch {
      setError("Microphone is off. Allow it in Settings to play.");
    }
  };
  const judgeRef = useRef(judge);
  // The mic callback outlives renders: it reads the latest of these.
  useEffect(() => {
    verdictRef.current = verdict;
    targetRef.current = target;
    judgeRef.current = judge;
  });

  useEffect(() => {
    if (!on || verdict) return;
    const t = window.setTimeout(() => judge(false, null), GIVE_UP_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, verdict, i]);

  const next = () => {
    if (i + 1 >= count) {
      stop.current?.();
      stop.current = null;
      onDone({ ...tally.current });
      return;
    }
    stopAll();
    hold.current = null;
    setTarget((prev) => pickTarget(prev));
    setVerdict(null);
    setI(i + 1);
  };

  const cents = live !== null ? Math.round((live - Math.round(live)) * 100) : 0;
  const livePc = live !== null ? pcOf(Math.round(live)) : null;

  if (!on) {
    return (
      <div className="flex flex-1 flex-col">
        <SessionBar onClose={onClose} progress={0} />
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-8 text-center">
          <div className="text-[15px] font-medium text-muted">Sing</div>
          <Orb disabled>
            <Mic size={44} strokeWidth={1.8} />
          </Orb>
          <p className="max-w-[260px] text-[15px] leading-snug text-muted">
            {error ?? "See a note, sing it. Any octave. No reference."}
          </p>
        </div>
        <div className="flex flex-col gap-1 px-5 pb-6">
          <Button className="w-full" onClick={() => void start()}>
            Start
          </Button>
          <Button kind="plain" onClick={() => onDone({ ...tally.current })}>
            Skip
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <SessionBar onClose={onClose} progress={(i + (verdict ? 1 : 0)) / count} right={`${i + 1}/${count}`} />
      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <div className="h-5 text-[15px] font-medium text-muted">Sing</div>
        <Orb disabled tone={verdict ? (verdict.right ? "right" : "wrong") : null}>
          <span className="text-[52px] font-bold tracking-tight">{pcName(target, naming)}</span>
        </Orb>
        <div className="flex h-16 flex-col items-center justify-center gap-2">
          <div className={clsx("text-[22px] font-semibold tabular-nums", livePc === null && "text-muted")}>
            {verdict && !verdict.right
              ? verdict.sung !== null
                ? `You sang ${pcName(pcOf(Math.round(verdict.sung)), naming)}`
                : "Nothing heard"
              : livePc !== null
                ? pcName(livePc, naming)
                : "—"}
          </div>
          {/* Tuner needle: ±50 cents. */}
          <div className="relative h-1 w-40 rounded-full bg-fill">
            <div className="absolute top-1/2 left-1/2 h-3 w-px -translate-y-1/2 bg-line" />
            {live !== null && !verdict && (
              <div
                className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent"
                style={{ left: `${50 + cents}%` }}
              />
            )}
          </div>
        </div>
      </div>
      <div className="px-5 pb-6">
        <div className="h-[52px]">
          {verdict && (
            <Button className="w-full" onClick={next}>
              Next
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function pickTarget(prev?: number): number {
  const set = trained(Math.max(3, get().ladder.stage));
  let pc: number;
  do pc = pick(set);
  while (set.length > 1 && pc === prev);
  return pc;
}
