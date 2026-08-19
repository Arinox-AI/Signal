import { ArrowUpRight, Cpu } from "lucide-react";

import { Panel, SourceUnavailable } from "@/components/report/panel";
import { dateLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { NewsItem, SourceResult } from "@/lib/types/company";

function KindBadge({ kind }: { kind: NewsItem["kind"] }) {
  if (!kind) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-1.5 py-0.5 font-mono text-[8px] tracking-wider uppercase",
        kind === "ai"
          ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200/90"
          : "border-blue-300/25 bg-blue-300/10 text-blue-200/80",
      )}
    >
      {kind}
    </span>
  );
}

export function TechNewsPanel({
  result,
}: {
  result: SourceResult<NewsItem[]>;
}) {
  return (
    <Panel label="AI & technical signals" className="dossier-tech-news">
      {result.state !== "success" ? (
        <SourceUnavailable message={result.message} />
      ) : (
        <div className="divide-y divide-white/[0.06]">
          {result.data.slice(0, 8).map((item) => (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="group grid grid-cols-[2rem_1fr_auto] gap-3 p-5 transition hover:bg-white/[0.025] sm:grid-cols-[3rem_1fr_auto]"
            >
              <Cpu
                className="mt-0.5 size-3.5 text-blue-200/50"
                aria-hidden="true"
              />
              <span>
                <span className="flex flex-wrap items-center gap-2">
                  <span className="block text-sm leading-5 font-medium text-white/74 transition group-hover:text-white">
                    {item.title}
                  </span>
                  <KindBadge kind={item.kind} />
                </span>
                <span className="mt-2 block text-[11px] text-white/32">
                  {item.source} · {dateLabel(item.publishedAt)}
                </span>
              </span>
              <ArrowUpRight
                className="size-4 text-white/20 transition group-hover:text-blue-200"
                aria-hidden="true"
              />
            </a>
          ))}
          <p className="px-5 py-3 text-[10px] leading-4 text-white/25">
            Dedicated AI + technology coverage from Google News; items filtered
            to real AI/tech signals and de-duplicated. Showing{" "}
            {result.data.length} recent items.
          </p>
        </div>
      )}
    </Panel>
  );
}
