import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { RetryButton } from "@/components/retry-button";
import { cn } from "@/lib/utils";

export function Panel({
  children,
  className,
  label,
  action,
}: {
  children: ReactNode;
  className?: string;
  label?: string;
  action?: ReactNode;
}) {
  return (
    <section
      className={cn("dossier-panel relative overflow-hidden", className)}
    >
      {(label || action) && (
        <div className="dossier-panel-heading flex min-h-12 items-center justify-between px-5">
          <p className="font-mono text-[10px] tracking-[0.16em] uppercase">
            {label}
          </p>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function SourceUnavailable({ message }: { message: string }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center px-6 text-center">
      <span className="grid size-9 place-items-center rounded-full bg-white/[0.05]">
        <AlertCircle className="size-4 text-white/35" aria-hidden="true" />
      </span>
      <p className="mt-3 max-w-xs text-sm leading-6 text-white/42">{message}</p>
      <RetryButton />
    </div>
  );
}
