"use client";

import clsx from "clsx";
import { Play } from "lucide-react";
import type { ReactNode } from "react";

/** The big replay button in the middle of every game. */
export function Orb({
  onClick,
  playing,
  tone,
  children,
  disabled,
}: {
  onClick?: () => void;
  playing?: boolean;
  tone?: "right" | "wrong" | null;
  children?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label="Play again"
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        "relative grid size-[168px] place-items-center rounded-full transition-[background-color,transform] duration-200 active:scale-95",
        tone === "right" ? "bg-good text-white" : tone === "wrong" ? "bg-bad text-white" : "bg-fill text-fg",
      )}
    >
      {playing && !tone && <span className="orb-pulse absolute inset-0 rounded-full border-2 border-accent" />}
      {children ?? <Play size={40} strokeWidth={0} fill="currentColor" className="translate-x-[3px]" />}
    </button>
  );
}
