"use client";

import { useEffect, useRef, useState } from "react";

const STAGES = [
  "Resolving entity identity",
  "Gathering primary sources",
  "Collecting news & signals",
  "Synthesizing the brief",
] as const;

/** Cumulative ms at which each stage is expected to have completed. */
const STAGE_AT_MS = [2_500, 9_000, 16_000, 26_000] as const;

const WIDTH = [22, 46, 78, 96] as const;

export function ProgressStages() {
  const [stage, setStage] = useState(0);
  const [announcedStage, setAnnouncedStage] = useState(0);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const timers = STAGE_AT_MS.map((ms, index) =>
      setTimeout(() => setStage(index), ms),
    );
    return () => timers.forEach((timer) => clearTimeout(timer));
  }, []);

  useEffect(() => {
    if (stage <= announcedStage) return;
    const timer = setTimeout(() => setAnnouncedStage(stage), 60);
    return () => clearTimeout(timer);
  }, [stage, announcedStage]);

  const label = STAGES[announcedStage] ?? STAGES[0];
  const progress = WIDTH[announcedStage] ?? 0;

  return (
    <div className="w-full max-w-md">
      <div
        className="h-px overflow-hidden rounded-full bg-white/[0.06]"
        aria-hidden="true"
      >
        <div
          className="h-full rounded-full bg-blue-200/70 transition-[width] duration-1000 ease-out motion-reduce:transition-none"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div
        className="mt-3 flex items-center justify-between gap-4 font-mono text-[10px] tracking-[0.14em] uppercase"
        role="status"
        aria-live="polite"
      >
        <span className="text-white/45">Assembling evidence</span>
        <span className="text-blue-100/70">{label}</span>
      </div>
    </div>
  );
}
