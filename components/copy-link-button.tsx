"use client";

import { Check, Share2 } from "lucide-react";
import { useState } from "react";

export function CopyLinkButton() {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setStatus("copied");
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = window.location.href;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      textarea.remove();
      setStatus(copied ? "copied" : "failed");
    }
    window.setTimeout(() => setStatus("idle"), 1800);
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] px-3 py-2 transition hover:bg-white/[0.05] hover:text-white"
      aria-live="polite"
    >
      {status === "copied" ? (
        <Check className="size-3.5" aria-hidden="true" />
      ) : (
        <Share2 className="size-3.5" aria-hidden="true" />
      )}
      {status === "copied"
        ? "Copied"
        : status === "failed"
          ? "Copy failed"
          : "Share"}
    </button>
  );
}
