import { ArrowUpRight, Eye, Signal, Sparkles } from "lucide-react";

import { Panel, SourceUnavailable } from "@/components/report/panel";
import { SourceCitations } from "@/components/report/source-citations";
import type {
  PrioritiesTheme,
  PrioritiesSignal,
  SourceReference,
  SourceResult,
} from "@/lib/types/company";

function WeightBadge({ weight }: { weight: PrioritiesTheme["weight"] }) {
  const label = { high: "High", medium: "Medium", low: "Low" }[weight];
  const className = {
    high: "border-amber-200/20 bg-amber-200/[0.08] text-amber-100/80",
    medium: "border-blue-200/15 bg-blue-200/[0.06] text-blue-100/70",
    low: "border-white/10 bg-white/[0.04] text-white/40",
  }[weight];
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 font-mono text-[9px] tracking-[0.12em] uppercase ${className}`}
    >
      {label}
    </span>
  );
}

export function PrioritiesSignalPanel({
  result,
  sources,
}: {
  result: SourceResult<PrioritiesSignal>;
  sources: SourceReference[];
}) {
  return (
    <Panel
      label="Priorities signal"
      action={
        result.state === "success" ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-300/10 bg-blue-300/[0.04] px-2.5 py-1 text-[10px] text-blue-200/60">
            <Sparkles className="size-3" aria-hidden="true" />
            {result.data.generated
              ? "AI · evidence grounded"
              : "Evidence synthesis"}
          </span>
        ) : undefined
      }
      className="dossier-priorities"
    >
      {result.state !== "success" ? (
        <SourceUnavailable message={result.message} />
      ) : (
        <div className="dossier-summary-content relative p-6 sm:p-8">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-emerald-500/[0.06] blur-3xl"
          />
          <div className="relative flex items-center gap-2 font-mono text-[9px] tracking-[0.14em] text-white/30 uppercase">
            <Signal className="size-3" aria-hidden="true" />
            <span>What they are prioritizing right now</span>
          </div>
          <h2 className="relative mt-4 max-w-3xl text-xl leading-[1.15] font-medium tracking-[-0.03em] text-balance text-white sm:text-2xl">
            {result.data.headline}
          </h2>

          {result.data.themes.length > 0 && (
            <ol className="dossier-signal-grid relative mt-7 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
              {result.data.themes.map((theme, index) => (
                <li
                  key={`${theme.theme}-${index}`}
                  className="dossier-signal-card group p-4 transition duration-300 hover:-translate-y-0.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="dossier-signal-index font-mono text-[9px] tracking-[0.14em] uppercase">
                      Theme 0{index + 1}
                    </span>
                    <WeightBadge weight={theme.weight} />
                  </div>
                  <h3 className="dossier-signal-title mt-3 text-sm font-medium">
                    {theme.theme}
                  </h3>
                  <p className="dossier-signal-detail mt-2 text-xs leading-5">
                    {theme.detail}
                  </p>
                  <SourceCitations
                    citations={theme.sources}
                    sources={sources}
                  />
                </li>
              ))}
            </ol>
          )}

          {result.data.watchItem && (
            <div className="dossier-watch relative mt-3 flex gap-3 p-4">
              <span className="dossier-watch-icon grid size-7 shrink-0 place-items-center rounded-full">
                <Eye className="size-3.5" aria-hidden="true" />
              </span>
              <div>
                <p className="dossier-watch-label font-mono text-[9px] tracking-[0.14em] uppercase">
                  Watch next
                </p>
                <p className="dossier-watch-copy mt-1.5 text-xs leading-5">
                  {result.data.watchItem}
                </p>
              </div>
            </div>
          )}

          <p className="relative mt-5 flex items-center gap-1.5 text-[10px] leading-4 text-white/25">
            <ArrowUpRight className="size-3" aria-hidden="true" />
            {result.data.generated
              ? "Synthesized by Gemini solely from the fetched evidence — earnings-call text, blog/newsroom posts, hiring skill emphasis, and public records of internal announcements."
              : "Assembled from the fetched evidence only — earnings-call text, blog/newsroom posts, hiring skill emphasis, and public records of internal announcements."}
          </p>
        </div>
      )}
    </Panel>
  );
}
