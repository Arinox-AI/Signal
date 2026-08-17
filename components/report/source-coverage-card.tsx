import { Check, CircleMinus, Gauge, TriangleAlert } from "lucide-react";

import { Panel } from "@/components/report/panel";
import type { IntelligenceReport, SourceState } from "@/lib/types/company";

const stateMeta: Record<SourceState, { label: string; className: string }> = {
  success: { label: "Connected", className: "bg-emerald-300" },
  empty: { label: "No signal", className: "bg-white/30" },
  unavailable: { label: "Unavailable", className: "bg-amber-300" },
  rate_limited: { label: "Rate limited", className: "bg-red-300" },
};

export function SourceCoverageCard({ report }: { report: IntelligenceReport }) {
  const sources = [
    { label: "Company record", state: "success" as const },
    { label: "Official website", state: report.website.state },
    { label: "GitHub organization", state: report.github.state },
    { label: "Recent coverage", state: report.news.state },
    { label: "Country context", state: report.country.state },
    { label: "Executive synthesis", state: report.brief.state },
  ];
  const connected = sources.filter(
    (source) => source.state === "success",
  ).length;

  return (
    <Panel label="Source coverage" className="dossier-coverage">
      <div className="p-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-3xl font-medium tracking-[-0.05em] text-white">
              {connected}/{sources.length}
            </p>
            <p className="mt-1 text-xs text-white/45">
              public sources connected
            </p>
          </div>
          <Gauge className="size-5 text-blue-200/55" aria-hidden="true" />
        </div>
        <ul className="mt-7 space-y-1">
          {sources.map((source) => {
            const meta = stateMeta[source.state];
            return (
              <li
                key={source.label}
                className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-xs hover:bg-white/[0.035]"
              >
                <span className="flex items-center gap-2.5 text-white/65">
                  <span className={`size-1.5 rounded-full ${meta.className}`} />
                  {source.label}
                </span>
                <span className="text-white/35">{meta.label}</span>
              </li>
            );
          })}
        </ul>
        <p className="mt-5 flex items-start gap-2 border-t border-white/[0.06] pt-4 text-[11px] leading-5 text-white/35">
          {connected === sources.length ? (
            <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-300/70" />
          ) : connected >= 3 ? (
            <CircleMinus className="mt-0.5 size-3.5 shrink-0 text-amber-200/70" />
          ) : (
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-red-200/70" />
          )}
          Signal preserves the useful evidence even when a source has no
          verified match.
        </p>
      </div>
    </Panel>
  );
}
