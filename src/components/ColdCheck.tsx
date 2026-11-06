"use client";

import clsx from "clsx";
import { Volume2 } from "lucide-react";
import { useEffect, useState } from "react";
import { play, preload, stopAll } from "@/lib/audio";
import { COLD_PASS, COLD_STREAK, COLD_WINDOW, logCold } from "@/lib/ladder";
import { pcName } from "@/lib/music";
import { dayKey, update, useStore } from "@/lib/store";
import { type Answer, Trials } from "./LadderRun";
import type { Result } from "./Quiz";
import { Button, SessionBar } from "./ui";

/** The day's first notes, from memory: nothing to listen to first, no feedback until the end. */
export function ColdCheck({
  count,
  onDone,
  onClose,
}: {
  count: number;
  onDone: (r: Result) => void;
  onClose: () => void;
}) {
  const ladder = useStore((s) => s.ladder);
  const sound = useStore((s) => s.settings.sound);
  const naming = useStore((s) => s.settings.naming);
  const [running, setRunning] = useState(false);
  const [score, setScore] = useState<(Result & { misses: Answer[]; passes: number; opened?: number }) | null>(null);

  useEffect(() => {
    void preload(sound);
    return () => stopAll();
  }, [sound]);

  if (score) {
    const acc = score.c / score.n;
    const left = COLD_STREAK - score.passes;
    const replay = (midi: number) => {
      stopAll();
      void play([{ midi, dur: 1.4 }], sound);
    };
    return (
      <>
        <SessionBar onClose={onClose} progress={1} />
        <div className="flex flex-1 flex-col items-center gap-3 overflow-y-auto px-6 pt-[12vh] pb-4 text-center">
          <div className={clsx("text-[64px] font-bold tracking-tight tabular-nums", acc >= COLD_PASS && "text-good")}>
            {Math.round(acc * 100)}%
          </div>
          <div className="text-[17px] text-muted tabular-nums">
            {score.c} of {score.n} from memory
          </div>
          {ladder.stage < 12 && (
            <div className="mt-4 max-w-[280px] text-[22px] font-semibold">
              {score.opened !== undefined
                ? `New pitch: ${pcName(score.opened, naming)}`
                : left <= 0
                  ? "Memory's there. Finish the ladder to open the next note"
                  : score.passes
                    ? "Once more to unlock the next note"
                    : `${Math.round(COLD_PASS * 100)}% twice in a row unlocks the next note`}
            </div>
          )}
          {score.misses.length > 0 && (
            <div className="mt-6 w-full max-w-[340px] text-left">
              <div className="mb-2 px-1 text-[13px] font-semibold tracking-wide text-muted uppercase">Missed · tap to hear</div>
              <div className="overflow-hidden rounded-[18px] bg-fill">
                {score.misses.map((m, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => replay(m.trial.midi)}
                    className={clsx(
                      "flex h-[50px] w-full items-center gap-3 px-4 text-left active:bg-line",
                      i > 0 && "border-t-[0.5px] border-line",
                    )}
                  >
                    <span className="flex-1 text-[17px] font-semibold">
                      {m.trial.outside ? `Other · ${pcName(m.trial.pc, naming)}` : pcName(m.trial.pc, naming)}
                    </span>
                    <span className="text-[15px] text-muted">
                      {m.choice === "late" ? "too slow" : `you: ${m.choice === "other" ? "Other" : pcName(m.choice, naming)}`}
                    </span>
                    <Volume2 size={18} className="text-muted" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="px-5 pb-6">
          <Button className="w-full" onClick={() => onDone(score)}>
            Continue
          </Button>
        </div>
      </>
    );
  }

  if (running) {
    return (
      <Trials
        stage={ladder.stage}
        count={count}
        windowMs={COLD_WINDOW}
        feedback={false}
        sound={sound}
        onClose={onClose}
        onFinish={(_acc, _rt, n, c, answers) => {
          let logged: ReturnType<typeof logCold> = { passes: 0 };
          update((s) => {
            logged = logCold(s.ladder, dayKey(), c, n);
          });
          setScore({ n, c, misses: answers.filter((a) => !a.right), ...logged });
        }}
      />
    );
  }

  return (
    <>
      <SessionBar onClose={onClose} progress={0} />
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="text-[34px] font-bold tracking-tight">From memory</div>
        <p className="max-w-[290px] text-[17px] leading-snug text-muted">
          No notes to hear first. Name each one, or tap Other if it isn&apos;t one of yours. You&apos;ll hear the ones you missed at the end.
        </p>
      </div>
      <div className="px-5 pb-6">
        <Button className="w-full" onClick={() => setRunning(true)}>
          Start
        </Button>
      </div>
    </>
  );
}
