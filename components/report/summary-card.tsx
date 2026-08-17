import { ArrowUpRight, Eye, Sparkles } from "lucide-react";

import { Panel } from "@/components/report/panel";
import type { IntelligenceReport } from "@/lib/types/company";

export function SummaryCard({ report }: { report: IntelligenceReport }) {
  const brief = report.brief.state === "success" ? report.brief.data : null;
  const connectedSources = [
    report.website,
    report.github,
    report.news,
    report.country,
  ].filter((source) => source.state === "success").length;

  return (
    <Panel
      label="Executive analysis"
      action={
        <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-300/10 bg-blue-300/[0.04] px-2.5 py-1 text-[10px] text-blue-200/60">
          <Sparkles className="size-3" aria-hidden="true" />
          {brief?.generated ? "AI · evidence grounded" : "Evidence synthesis"}
        </span>
      }
      className="dossier-summary"
    >
      <div className="dossier-summary-content relative p-6 sm:p-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-blue-500/[0.08] blur-3xl"
        />
        <div className="relative flex flex-wrap items-center gap-2 font-mono text-[9px] tracking-[0.14em] text-white/30 uppercase">
          <span>Decision brief</span>
          <span aria-hidden="true">·</span>
          <span>{connectedSources}/4 live evidence paths</span>
        </div>
        <h2 className="relative mt-4 max-w-3xl text-2xl leading-[1.12] font-medium tracking-[-0.04em] text-balance text-white sm:text-[2rem]">
          {brief?.headline ?? report.identity.description}
        </h2>
        <p className="relative mt-5 max-w-3xl text-sm leading-7 text-white/55 sm:text-[15px]">
          {brief?.summary ?? report.identity.overview}
        </p>
        {brief && (
          <>
            <ol className="dossier-signal-grid relative mt-7 grid gap-2.5 pt-6 sm:grid-cols-2 xl:grid-cols-3">
              {brief.signals.map((signal, index) => (
                <li
                  key={`${signal.title}-${signal.detail}`}
                  className="dossier-signal-card group p-4 transition duration-300 hover:-translate-y-0.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="dossier-signal-index font-mono text-[9px] tracking-[0.14em] uppercase">
                      Signal 0{index + 1}
                    </span>
                    <ArrowUpRight
                      className="dossier-signal-arrow size-3 transition"
                      aria-hidden="true"
                    />
                  </div>
                  <h3 className="dossier-signal-title mt-3 text-sm font-medium">
                    {signal.title}
                  </h3>
                  <p className="dossier-signal-detail mt-2 text-xs leading-5">
                    {signal.detail}
                  </p>
                </li>
              ))}
            </ol>
            <div className="dossier-watch relative mt-3 flex gap-3 p-4">
              <span className="dossier-watch-icon grid size-7 shrink-0 place-items-center rounded-full">
                <Eye className="size-3.5" aria-hidden="true" />
              </span>
              <div>
                <p className="dossier-watch-label font-mono text-[9px] tracking-[0.14em] uppercase">
                  Watch next
                </p>
                <p className="dossier-watch-copy mt-1.5 text-xs leading-5">
                  {brief.watchItem}
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </Panel>
  );
}
