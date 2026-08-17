"use client";

import { RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";

export function RetryButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.refresh()}
      className="mt-4 inline-flex items-center gap-2 text-xs font-medium text-blue-200/70 transition hover:text-blue-100"
    >
      <RotateCcw className="size-3.5" aria-hidden="true" />
      Retry report
    </button>
  );
}
