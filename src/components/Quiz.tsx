"use client";

import clsx from "clsx";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { play, preload, stopAll, toPerf } from "@/lib/audio";
import { type Game, GAMES, label, padKeys, pool, type Question, UNLOCK_AFTER, UNLOCK_AT, weakest } from "@/lib/games";
import { midiOf, pcName } from "@/lib/music";
import { accuracy, get, record, update, useStore } from "@/lib/store";
import { Orb } from "./Orb";
import { type Mark, Pad } from "./Pad";
import { Button, SessionBar } from "./ui";

export type Result = { n: number; c: number };

/** Spotlight: the first 12 with feedback, the next 22 without, as in the study. */
const SPOT_FEEDBACK = 12;

export function Quiz({
  gameId,
  count,
  onDone,
  onClose,
}: {
  gameId: keyof typeof GAMES;
  count: number;
  onDone: (r: Result) => void;
  onClose: () => void;
}) {
  const game: Game = GAMES[gameId];
  const naming = useStore((s) => s.settings.naming);
  const sound = useStore((s) => game.sound ?? s.settings.sound);
  const [i, setI] = useState(0);
  const [q, setQ] = useState<Question | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [intro, setIntro] = useState(gameId === "spotlight");
  const tally = useRef({ n: 0, c: 0 });
  const onset = useRef(0);
  // Pinned for the drill: answers move the stats that pick it.
  const [target] = useState(() => (gameId === "spotlight" ? weakest(get()) : 0));
  useEffect(() => {
    if (gameId === "spotlight") update((s) => void (s.ladder.spot = target));
  }, [gameId, target]);

  const state = useStore((s) => s);
  const items = useMemo(() => pool(game, state), [game, state]);
  const feedback = gameId !== "spotlight" || i < SPOT_FEEDBACK;

  const sound$ = useCallback(
    async (tones: Question["tones"]) => {
      stopAll();
      setPlaying(true);
      const t = await play(tones, sound);
      onset.current = toPerf(t);
      const end = Math.max(...tones.map((n) => (n.at ?? 0) + (n.dur ?? 0.8)));
      window.setTimeout(() => setPlaying(false), end * 1000 + 40);
    },
    [sound],
  );

  const ask = useCallback(
    (prev?: Question) => {
      const s = get();
      const next = game.make(pool(game, s), s, prev);
      setQ(next);
      setPicked(null);
      void sound$(next.tones);
    },
    [game, sound$],
  );

  useEffect(() => {
    void preload(sound);
    // Mount starts the first question.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!intro) ask();
    return () => stopAll();
    // Only on mount: questions after the first come from answers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const answer = (id: string, at: number) => {
    if (!q || picked) return;
    const rt = at - onset.current;
    const right = id === q.answer;
    setPicked(id);
    tally.current.n++;
    if (right) tally.current.c++;
    let unlocked: string | null = null;
    update((s) => {
      const named = gameId === "spotlight" ? (q.answer === "yes" ? q.pc : undefined) : q.pc;
      record(s, right, named, rt);
      const st = (s.games[gameId] ??= { unlocked: 0, recent: [], n: 0, c: 0 });
      st.n++;
      if (right) st.c++;
      st.recent = [...st.recent, right ? 1 : 0].slice(-UNLOCK_AFTER);
      const all = game.items(s);
      const now = pool(game, s).length;
      if (!s.settings.everything && st.recent.length >= UNLOCK_AFTER && accuracy(st.recent) >= UNLOCK_AT && now < all.length) {
        st.unlocked = now + 1;
        st.recent = [];
        unlocked = all[now].name || pcName(Number(all[now].id), s.settings.naming);
      }
    });
    if (unlocked) {
      setToast(`New · ${unlocked}`);
      window.setTimeout(() => setToast(null), 2400);
    }
    // Wrong on a naming game: hear it again with the right key lit.
    if (!right && feedback && game.layout === "pad") void sound$(q.tones);
    if (right || !feedback) window.setTimeout(next, feedback ? 650 : 450);
  };

  const next = () => {
    const done = i + 1 >= count;
    if (done) {
      stopAll();
      if (gameId === "spotlight") update((s) => void (s.ladder.sinceSpot = 0));
      onDone({ ...tally.current });
      return;
    }
    setI(i + 1);
    ask(q ?? undefined);
  };

  const right = picked != null && q != null && picked === q.answer;
  const tone = picked && feedback ? (right ? "right" : "wrong") : null;

  const marks: Partial<Record<number, Mark>> = {};
  if (picked && q && feedback && game.layout === "pad") {
    marks[Number(q.answer)] = right ? "right" : "answer";
    if (!right) marks[Number(picked)] = "wrong";
  }

  if (intro) {
    return (
      <div className="flex flex-1 flex-col">
        <SessionBar onClose={onClose} progress={0} />
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-8 text-center">
          <div className="text-[15px] font-medium text-muted">Spotlight</div>
          <Orb onClick={() => void sound$([3, 4, 5].map((o, k) => ({ midi: midiOf(target, o), at: k * 0.9 })))}>
            <span className="text-[44px] font-semibold tracking-tight">{pcName(target, naming)}</span>
          </Orb>
          <p className="max-w-[260px] text-[15px] leading-snug text-muted">
            Your weakest pitch. Is it {pcName(target, naming)}, or something else?
          </p>
        </div>
        <div className="px-5 pb-6">
          <Button
            className="w-full"
            onClick={() => {
              setIntro(false);
              ask();
            }}
          >
            Start
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <SessionBar onClose={onClose} progress={(i + (picked ? 1 : 0)) / count} right={`${i + 1}/${count}`} />
      <div className="relative flex flex-1 flex-col items-center justify-center gap-5 py-6">
        <div className="h-5 text-[15px] font-medium text-muted">
          {gameId === "spotlight" && !feedback ? "No feedback" : game.name}
        </div>
        <Orb onClick={() => q && void sound$(q.tones)} playing={playing} tone={tone} />
        <div className="h-6 text-[17px] font-semibold">
          {picked && feedback && !right && q && label(game, q.answer, naming, get())}
        </div>
        {toast && (
          <div className="toast-in absolute top-2 rounded-full bg-fg px-4 py-2 text-[14px] font-semibold text-bg">{toast}</div>
        )}
      </div>
      <div className="px-4 pb-5">
        {game.layout === "pad" && (
          <Pad
            enabled={padKeys(game, get(), items)}
            naming={naming}
            marks={marks}
            locked={!!picked}
            onPick={(pc, at) => answer(String(pc), at)}
          />
        )}
        {game.layout === "grid" && (
          <div className={clsx("grid gap-2", gameId === "intervals" || gameId === "chords" ? "grid-cols-3" : "grid-cols-2")}>
            {items.map((it) => {
              const mark = picked && feedback ? (it.id === q?.answer ? "right" : it.id === picked ? "wrong" : null) : null;
              return (
                <button
                  key={it.id}
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    answer(it.id, e.timeStamp);
                  }}
                  className={clsx(
                    "h-[52px] rounded-[14px] px-2 text-[15px] leading-tight font-semibold transition-colors duration-150",
                    mark === "right" ? "bg-good text-white" : mark === "wrong" ? "bg-bad text-white" : "bg-fill active:bg-line",
                  )}
                >
                  {it.name}
                </button>
              );
            })}
          </div>
        )}
        {game.layout === "binary" && (
          <div className="grid grid-cols-2 gap-2">
            {["yes", "no"].map((id) => {
              const mark = picked && feedback ? (id === q?.answer ? "right" : id === picked ? "wrong" : null) : null;
              return (
                <button
                  key={id}
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    answer(id, e.timeStamp);
                  }}
                  className={clsx(
                    "h-[120px] rounded-[18px] text-[24px] font-semibold transition-colors duration-150",
                    mark === "right" ? "bg-good text-white" : mark === "wrong" ? "bg-bad text-white" : "bg-fill active:bg-line",
                    picked && !feedback && id === picked && "bg-line",
                  )}
                >
                  {label(game, id, naming, get())}
                </button>
              );
            })}
          </div>
        )}
        <div className="mt-3 h-[52px]">
          {picked && feedback && !right && (
            <Button className="w-full" onClick={next}>
              Continue
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
