"use client";

import clsx from "clsx";
import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import { Volume2 } from "lucide-react";
import { play, preload, shepard, soundOn, stopAll, toPerf, unlock } from "@/lib/audio";
import {
  advance,
  COLD_PASS,
  COLD_STREAK,
  deck,
  FINAL_WAIT,
  finalCheck,
  held,
  isFinal,
  LEVELS,
  MASK_SECS,
  OCTAVES,
  outOfBounds,
  RECALL_WINDOW,
  stepBack,
  trained,
  type Trial,
  windowMs,
} from "@/lib/ladder";
import { midiOf, pcName, shuffle } from "@/lib/music";
import { get, record, update, useStore } from "@/lib/store";
import { Orb } from "./Orb";
import { type Mark, Pad } from "./Pad";
import type { Result } from "./Quiz";
import { Button, SessionBar } from "./ui";

type Phase = "brief" | "wash" | "run" | "result";
type Outcome = { acc: number; rt: number; pass: boolean; newPitch?: number; jumped?: boolean; held?: boolean };

const WASH_SECS = 20;

export function LadderRun({
  levels,
  onDone,
  onClose,
}: {
  /** Level attempts before handing back (daily session); Infinity for free practice. */
  levels: number;
  onDone: (r: Result) => void;
  onClose: () => void;
}) {
  const ladder = useStore((s) => s.ladder);
  const naming = useStore((s) => s.settings.naming);
  const sound = useStore((s) => s.settings.sound);
  const [phase, setPhase] = useState<Phase>("brief");
  const [attempts, setAttempts] = useState(0);
  const [heard, setHeard] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const totals = useRef({ n: 0, c: 0 });

  useEffect(() => {
    void preload(sound);
    return () => stopAll();
  }, [sound]);

  const recall = held(ladder);
  const level = recall ? { ...LEVELS[LEVELS.length - 1], feedback: true } : LEVELS[ladder.level];
  const set = trained(ladder.stage);
  const sorted = [...set].sort((a, b) => a - b);
  const window_ = recall ? RECALL_WINDOW : windowMs(ladder.stage, ladder.level);
  const check = finalCheck(ladder);
  const [now] = useState(() => Date.now());
  const waitLeft = check && ladder.finalAt ? ladder.finalAt + FINAL_WAIT - now : 0;

  const begin = () => {
    if (heard && !level.feedback) setPhase("wash");
    else setPhase("run");
  };

  const finish = (acc: number, rt: number, n: number, c: number) => {
    totals.current.n += n;
    totals.current.c += c;
    let res: ReturnType<typeof advance> = { pass: false };
    update((s) => {
      res = advance(s.ladder, acc, rt);
    });
    setOutcome({ acc, rt, ...res });
    setAttempts((a) => a + 1);
    setHeard(false);
    setPhase("result");
  };

  const done = attempts >= levels;

  return (
    <div className="flex flex-1 flex-col">
      {phase === "brief" && (
        <>
          <SessionBar onClose={onClose} progress={levels === Infinity ? 0 : attempts / levels} right={levels === Infinity ? null : `${attempts}/${levels}`} />
          <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 text-center">
            <div>
              <div className="text-[15px] font-medium text-muted">
                {ladder.mastered
                  ? "Mastered"
                  : check
                    ? "One-take check"
                    : `${set.length} ${set.length === 1 ? "pitch" : "pitches"} · ${recall ? "All levels passed" : `Level ${ladder.level + 1} of ${LEVELS.length}`}`}
              </div>
              <div className="mt-2 text-[34px] font-bold tracking-tight">
                {recall ? "Recall" : level.feedback ? "With feedback" : "No feedback"}
              </div>
              <div className="mt-1 text-[17px] text-muted tabular-nums">
                {recall ? `Ear cleared before every note · ${(window_ / 1000).toFixed(1)} s` : `${Math.round(level.pass * 100)}% in ${(window_ / 1000).toFixed(1)} s`}
              </div>
            </div>
            <div className="flex max-w-[320px] flex-wrap justify-center gap-2">
              {sorted.map((pc) => (
                <button
                  key={pc}
                  type="button"
                  onClick={() => {
                    setHeard(true);
                    stopAll();
                    void play(
                      shuffle(OCTAVES.slice()).map((o, k) => ({ midi: midiOf(pc, o), at: k * 0.9 })),
                      sound,
                    );
                  }}
                  className="h-11 min-w-11 rounded-full bg-fill px-4 text-[16px] font-semibold active:bg-line"
                >
                  {pcName(pc, naming)}
                </button>
              ))}
            </div>
            <p className="max-w-[290px] text-[15px] leading-snug text-muted">
              Tap {set.length === 1 ? pcName(set[0], naming) : "each"} to hear {set.length === 1 ? "it" : "them"} first. Then
              name every note you hear. Not {set.length === 1 ? pcName(set[0], naming) : "one of these"}? Tap{" "}
              <span className="font-semibold text-fg">Other</span>.
            </p>
          </div>
          <div className="flex flex-col gap-1 px-5 pb-6">
            {waitLeft > 0 && (
              <div className="pb-2 text-center text-[14px] text-muted">
                Check opens in {Math.ceil(waitLeft / 3600_000)} h. Practice until then.
              </div>
            )}
            <Button className="w-full" onClick={begin}>
              Start
            </Button>
            {recall && (
              <div className="pb-2 text-center text-[14px] text-muted">
                The next note opens after {COLD_STREAK} memory checks in a row at {Math.round(COLD_PASS * 100)}%
              </div>
            )}
            {!recall && ladder.fails >= 5 && ladder.level > 0 && (
              <Button kind="plain" onClick={() => update((s) => stepBack(s.ladder))}>
                Step back a level
              </Button>
            )}
          </div>
        </>
      )}
      {phase === "wash" && <Wash onDone={() => setPhase("run")} onClose={onClose} />}
      {phase === "run" && (
        <Trials
          stage={ladder.stage}
          windowMs={window_}
          feedback={level.feedback}
          mask={recall}
          onClose={onClose}
          onFinish={finish}
          sound={sound}
        />
      )}
      {phase === "result" && outcome && (
        <>
          <SessionBar onClose={onClose} progress={levels === Infinity ? 1 : attempts / levels} right={levels === Infinity ? null : `${attempts}/${levels}`} />
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <div className={clsx("text-[64px] font-bold tracking-tight tabular-nums", outcome.pass ? "text-good" : "text-fg")}>
              {Math.round(outcome.acc * 100)}%
            </div>
            <div className="text-[17px] text-muted tabular-nums">
              {outcome.rt ? `${(outcome.rt / 1000).toFixed(2)} s average` : "—"}
            </div>
            <div className="mt-6 text-[22px] font-semibold">
              {get().ladder.mastered && isFinal(get().ladder)
                ? "Perfect pitch, all twelve."
                : outcome.newPitch !== undefined
                  ? `New pitch: ${pcName(outcome.newPitch, naming)}`
                  : outcome.held && !outcome.pass
                    ? "Recall"
                    : outcome.pass
                      ? outcome.jumped
                        ? "Skipping ahead"
                        : "Passed"
                      : "Again"}
            </div>
            {outcome.held && (
              <div className="max-w-[260px] text-[15px] text-muted">
                The next note opens after {COLD_STREAK} memory checks in a row at {Math.round(COLD_PASS * 100)}%
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1 px-5 pb-6">
            {!done ? (
              <Button className="w-full" onClick={() => setPhase("brief")}>
                Next
              </Button>
            ) : (
              <Button className="w-full" onClick={() => onDone({ ...totals.current })}>
                Continue
              </Button>
            )}
            {levels === Infinity && (
              <Button kind="plain" onClick={() => onDone({ ...totals.current })}>
                Done
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export type Answer = { trial: Trial; choice: number | "other" | "late"; right: boolean };

/** One level: tones, a shrinking answer window, the keyboard plus "Other". */
export function Trials({
  stage,
  count,
  windowMs: limit,
  feedback,
  mask = false,
  sound,
  onClose,
  onFinish,
}: {
  stage: number;
  count?: number;
  windowMs: number;
  feedback: boolean;
  /** A short wash before every note, so the last one can't serve as a reference. */
  mask?: boolean;
  sound: Parameters<typeof play>[1];
  onClose: () => void;
  onFinish: (acc: number, rt: number, n: number, c: number, answers: Answer[]) => void;
}) {
  const naming = useStore((s) => s.settings.naming);
  const [trials] = useState<Trial[]>(() => deck(stage, count));
  const [i, setI] = useState(-1);
  const [picked, setPicked] = useState<number | "other" | "late" | null>(null);
  const bar = useRef<HTMLDivElement>(null);
  const onset = useRef(0);
  const [startedAt, setStartedAt] = useState(0);
  // Never run a level in silence: answering blind still scores.
  const [muted, setMuted] = useState(() => !soundOn());
  const raf = useRef(0);
  const score = useRef({ c: 0, rts: [] as number[], answers: [] as Answer[] });
  const set = trained(stage);
  const hasOut = outOfBounds(stage).length > 0;
  const trial = trials[i];
  const washing = mask && !muted && !!trial && !startedAt && picked === null;

  const resolve = useCallback(
    (choice: number | "other" | "late") => {
      if (!trial || picked !== null || !onset.current) return;
      const rt = performance.now() - onset.current;
      cancelAnimationFrame(raf.current);
      const right = choice !== "late" && rt <= limit && (trial.outside ? choice === "other" : choice === trial.pc);
      if (right) {
        score.current.c++;
        score.current.rts.push(rt);
      }
      score.current.answers.push({ trial, choice, right });
      setPicked(choice);
      update((s) => record(s, right, trial.outside ? undefined : trial.pc, rt));
      if (!right && feedback) {
        stopAll();
        void play([{ midi: trial.midi }], sound);
      }
      const wait = !feedback ? 450 : right ? 500 : 1500;
      window.setTimeout(() => {
        setPicked(null);
        setStartedAt(0);
        setI((x) => x + 1);
      }, wait);
    },
    [trial, picked, limit, feedback, sound],
  );

  // Starts each trial: play, then run the clock from the tone's onset.
  useEffect(() => {
    if (i < 0) {
      if (muted) return;
      const t = window.setTimeout(() => setI(0), 500);
      return () => window.clearTimeout(t);
    }
    if (i >= trials.length) {
      const rts = score.current.rts;
      const avg = rts.length ? rts.reduce((a, b) => a + b, 0) / rts.length : 0;
      onFinish(score.current.c / trials.length, avg, trials.length, score.current.c, score.current.answers);
      return;
    }
    onset.current = 0;
    let alive = true;
    const tone = () =>
      void play([{ midi: trials[i].midi }], sound).then((t) => {
        if (!alive) return;
        onset.current = toPerf(t);
        setStartedAt(onset.current);
        const tick = () => {
          const left = 1 - (performance.now() - onset.current) / limit;
          if (bar.current) bar.current.style.transform = `scaleX(${Math.max(0, Math.min(1, left))})`;
          if (left > 0) raf.current = requestAnimationFrame(tick);
        };
        tick();
      });
    let wash: ReturnType<typeof shepard> | null = null;
    if (mask) {
      if (bar.current) bar.current.style.transform = "scaleX(1)";
      wash = shepard(MASK_SECS);
      void wash.done.then(() => alive && tone());
    } else tone();
    return () => {
      alive = false;
      wash?.stop();
      cancelAnimationFrame(raf.current);
    };
    // Runs per trial; everything else it reads is fixed for the level.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, muted]);

  // Too slow counts as wrong.
  const late = useEffectEvent(() => resolve("late"));
  useEffect(() => {
    if (!startedAt || picked !== null) return;
    const t = window.setTimeout(late, startedAt + limit + 30 - performance.now());
    return () => window.clearTimeout(t);
  }, [startedAt, picked, limit]);

  const right =
    trial && picked !== null && picked !== "late" && (trial.outside ? picked === "other" : picked === trial.pc);
  const tone = picked !== null && feedback ? (right ? "right" : "wrong") : null;
  const marks: Partial<Record<number, Mark>> = {};
  if (trial && picked !== null && feedback) {
    if (!trial.outside) marks[trial.pc] = right ? "right" : "answer";
    if (!right && typeof picked === "number") marks[picked] = "wrong";
  }
  const otherMark = trial && picked !== null && feedback ? (trial.outside ? (right ? "right" : "answer") : picked === "other" ? "wrong" : null) : null;

  return (
    <>
      <SessionBar onClose={onClose} progress={Math.max(0, i + (picked !== null ? 1 : 0)) / trials.length} right={`${Math.min(trials.length, Math.max(1, i + 1))}/${trials.length}`} />
      <div className="flex flex-1 flex-col items-center justify-center gap-5 py-6">
        <div className="h-5 text-[15px] font-medium text-muted">{washing ? "Clearing your ear" : feedback ? "" : "No feedback"}</div>
        {muted ? (
          <Orb
            onClick={() => {
              unlock();
              setMuted(false);
            }}
          >
            <span className="flex flex-col items-center gap-2">
              <Volume2 size={36} strokeWidth={2} />
              <span className="text-[15px] font-semibold">Tap for sound</span>
            </span>
          </Orb>
        ) : (
          <Orb tone={tone} playing={startedAt > 0 && picked === null} disabled>
            <span className="text-[40px] font-semibold tracking-tight">
              {picked !== null && feedback && !right && trial ? (trial.outside ? pcName(trial.pc, naming) : picked === "late" ? "Late" : "") : ""}
            </span>
          </Orb>
        )}
        <div className="h-1 w-[168px] overflow-hidden rounded-full bg-fill">
          <div ref={bar} className="h-full origin-left bg-accent" style={{ transform: "scaleX(1)" }} />
        </div>
      </div>
      <div className="flex flex-col gap-2 px-4 pb-5">
        <Pad enabled={set} naming={naming} marks={marks} locked={picked !== null || i < 0} onPick={(pc) => resolve(pc)} />
        {hasOut && (
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              if (i >= 0) resolve("other");
            }}
            className={clsx(
              "h-[56px] rounded-[14px] text-[17px] font-semibold transition-colors duration-150",
              otherMark === "right" ? "bg-good text-white" : otherMark === "wrong" ? "bg-bad text-white" : otherMark === "answer" ? "bg-accent text-white" : "bg-fill active:bg-line",
            )}
          >
            Other
          </button>
        )}
      </div>
    </>
  );
}

/** Twenty seconds of endlessly falling tone between listening and an unaided level. */
function Wash({ onDone, onClose }: { onDone: () => void; onClose: () => void }) {
  const [left, setLeft] = useState(WASH_SECS);
  useEffect(() => {
    const s = shepard(WASH_SECS);
    const started = Date.now();
    const iv = window.setInterval(() => setLeft(Math.max(0, WASH_SECS - Math.floor((Date.now() - started) / 1000))), 250);
    void s.done.then(onDone);
    return () => {
      window.clearInterval(iv);
      s.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <>
      <SessionBar onClose={onClose} progress={1 - left / WASH_SECS} />
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <div className="wash relative size-[168px] overflow-hidden rounded-full bg-fill" />
        <div className="text-[17px] font-semibold">Clearing your ear</div>
        <div className="text-[15px] text-muted tabular-nums">{left} s</div>
      </div>
    </>
  );
}
