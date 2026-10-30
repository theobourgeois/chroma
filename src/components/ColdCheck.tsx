"use client";

import clsx from "clsx";
import { useEffect, useState } from "react";
import { preload, stopAll } from "@/lib/audio";
import { COLD_PASS, COLD_STREAK, COLD_WINDOW, coldPasses, logCold } from "@/lib/ladder";
import { dayKey, update, useStore } from "@/lib/store";
import { Trials } from "./LadderRun";
import type { Result } from "./Quiz";
import { Button, SessionBar } from "./ui";

/** The day's first notes, from memory: nothing to listen to first, no feedback. */
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
  const [running, setRunning] = useState(false);
  const [score, setScore] = useState<Result | null>(null);

  useEffect(() => {
    void preload(sound);
    return () => stopAll();
  }, [sound]);

  if (score) {
    const acc = score.c / score.n;
    const passes = coldPasses(ladder);
    const left = COLD_STREAK - passes;
    return (
      <>
        <SessionBar onClose={onClose} progress={1} />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <div className={clsx("text-[64px] font-bold tracking-tight tabular-nums", acc >= COLD_PASS && "text-good")}>
            {Math.round(acc * 100)}%
          </div>
          <div className="text-[17px] text-muted tabular-nums">
            {score.c} of {score.n} from memory
          </div>
          {ladder.stage < 12 && (
            <div className="mt-6 max-w-[280px] text-[22px] font-semibold">
              {left <= 0
                ? "Next note unlocked"
                : passes
                  ? "Once more to unlock the next note"
                  : `${Math.round(COLD_PASS * 100)}% twice in a row unlocks the next note`}
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
        onFinish={(_acc, _rt, n, c) => {
          update((s) => logCold(s.ladder, dayKey(), c, n));
          setScore({ n, c });
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
          No notes to hear first. Name each one, or tap Other if it isn&apos;t one of yours.
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
