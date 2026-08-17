"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-5 text-center">
      <span className="grid size-14 place-items-center rounded-[20px] border border-red-300/10 bg-red-300/[0.04]">
        <AlertTriangle className="size-5 text-red-200/60" aria-hidden="true" />
      </span>
      <p className="mt-6 font-mono text-[10px] tracking-[0.18em] text-red-200/45 uppercase">
        Signal interrupted
      </p>
      <h1 className="mt-3 text-4xl font-medium tracking-[-0.05em] text-white">
        The brief could not finish.
      </h1>
      <p className="mt-4 text-sm leading-6 text-white/42">
        A source may be temporarily unavailable. Your search is safe to retry.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-7 inline-flex items-center gap-2 rounded-full bg-blue-300 px-5 py-2.5 text-sm font-medium text-[#071226] hover:bg-blue-200"
      >
        <RotateCcw className="size-4" aria-hidden="true" />
        Try again
      </button>
    </main>
  );
}
