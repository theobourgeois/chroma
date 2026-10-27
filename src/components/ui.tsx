"use client";

import clsx from "clsx";
import { X } from "lucide-react";
import { type ReactNode, useEffect } from "react";

export function Button({
  children,
  onClick,
  kind = "primary",
  className,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  kind?: "primary" | "secondary" | "plain";
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        "h-[52px] rounded-full px-6 text-[17px] font-semibold transition active:scale-[0.97] disabled:opacity-40",
        kind === "primary" && "bg-fg text-bg",
        kind === "secondary" && "bg-fill text-fg",
        kind === "plain" && "text-muted",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** The session's top bar: close, progress, count. */
export function SessionBar({
  onClose,
  progress,
  right,
}: {
  onClose: () => void;
  progress: number;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 px-5 pt-3">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="-ml-2 grid size-10 place-items-center rounded-full text-muted active:bg-fill"
      >
        <X size={22} strokeWidth={2.2} />
      </button>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-fill">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-300"
          style={{ width: `${Math.max(0, Math.min(1, progress)) * 100}%` }}
        />
      </div>
      <div className="min-w-10 text-right text-[15px] tabular-nums text-muted">{right}</div>
    </div>
  );
}

export function Switch({ on, onChange, disabled }: { on: boolean; onChange: (on: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={clsx(
        "relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors disabled:opacity-40",
        on ? "bg-good" : "bg-line",
      )}
    >
      <span
        className="absolute top-[2px] left-[2px] size-[27px] rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.2)] transition-transform"
        style={{ transform: on ? "translateX(20px)" : "translateX(0)" }}
      />
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { id: T; name: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-[10px] bg-fill p-[2px]">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={clsx(
            "h-8 flex-1 rounded-[8px] text-[14px] font-medium transition",
            value === o.id ? "bg-bg shadow-[0_1px_4px_rgba(0,0,0,0.12)] dark:bg-[#636366]" : "text-muted",
          )}
        >
          {o.name}
        </button>
      ))}
    </div>
  );
}

/** A full-screen layer for sessions and settings. */
export function Layer({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", key);
    };
  }, [onClose]);
  return (
    <div className="layer-in fixed inset-0 z-40 flex flex-col overflow-y-auto bg-bg pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      {children}
    </div>
  );
}

/** Thin ring for progress. */
export function Ring({ value, size = 22, stroke = 2.5, className }: { value: number; size?: number; stroke?: number; className?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} className={clsx("-rotate-90", className)} aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - Math.max(0, Math.min(1, value)))}
        className="transition-[stroke-dashoffset] duration-500"
      />
    </svg>
  );
}
