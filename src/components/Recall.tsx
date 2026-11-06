"use client";

import { useEffect } from "react";
import { preload, stopAll } from "@/lib/audio";
import { RECALL_WINDOW } from "@/lib/ladder";
import { useStore } from "@/lib/store";
import { Trials } from "./LadderRun";
import type { Result } from "./Quiz";

/** Your pitches with the ear cleared before each one, and feedback: a check-in between sessions. */
export function Recall({ count, onDone, onClose }: { count: number; onDone: (r: Result) => void; onClose: () => void }) {
  const stage = useStore((s) => s.ladder.stage);
  const sound = useStore((s) => s.settings.sound);

  useEffect(() => {
    void preload(sound);
    return () => stopAll();
  }, [sound]);

  return (
    <Trials
      stage={stage}
      count={count}
      windowMs={RECALL_WINDOW}
      feedback
      mask
      sound={sound}
      onClose={onClose}
      onFinish={(_acc, _rt, n, c) => onDone({ n, c })}
    />
  );
}
