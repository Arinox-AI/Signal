import Link from "next/link";
import { cn } from "@/lib/utils";

export function Brand({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn("group inline-flex items-center gap-2.5", className)}
      aria-label="Signal home"
    >
      <span className="brand-mark relative grid size-8 place-items-center rounded-xl">
        <span className="absolute size-3.5 rounded-full blur-sm transition" />
        <span className="relative size-2 rounded-full" />
      </span>
      <span className="brand-name text-[15px] font-semibold tracking-[-0.02em]">
        Signal
      </span>
    </Link>
  );
}
