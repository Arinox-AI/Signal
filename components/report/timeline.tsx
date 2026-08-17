import { ArrowUpRight, CircleDot } from "lucide-react";

import { Panel } from "@/components/report/panel";
import { dateLabel } from "@/lib/format";
import type { IntelligenceReport } from "@/lib/types/company";

export function Timeline({ report }: { report: IntelligenceReport }) {
  const news =
    report.news.state === "success"
      ? report.news.data.slice(0, 4).map((item) => ({
          title: item.title,
          detail: item.source,
          date: item.publishedAt,
          url: item.url,
          type: "Coverage",
        }))
      : [];
  const repos =
    report.github.state === "success"
      ? report.github.data.topRepositories.slice(0, 3).map((repo) => ({
          title: `${repo.name} repository updated`,
          detail: repo.language ?? "GitHub",
          date: repo.updatedAt,
          url: repo.url,
          type: "Build",
        }))
      : [];
  const events = [...news, ...repos]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 6);
  return (
    <Panel label="Live signal timeline" className="dossier-timeline">
      <div className="p-5 sm:p-6">
        {events.length === 0 ? (
          <p className="py-14 text-center text-sm text-white/35">
            No recent public signals were available.
          </p>
        ) : (
          <ol className="relative space-y-1 before:absolute before:top-5 before:bottom-5 before:left-[6px] before:w-px before:bg-white/[0.08]">
            {events.map((event) => (
              <li
                key={`${event.type}-${event.title}`}
                className="relative grid grid-cols-[13px_1fr_auto] gap-4 py-3"
              >
                <CircleDot
                  className="relative z-10 mt-0.5 size-[13px] fill-[#0b0e14] text-blue-300/60"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-sm leading-5 text-white/68">
                    {event.title}
                  </p>
                  <p className="mt-1 text-[10px] tracking-wider text-white/28 uppercase">
                    {event.type} · {event.detail}
                  </p>
                </div>
                <a
                  href={event.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-start gap-2 text-[10px] text-white/28 hover:text-blue-200"
                >
                  <span className="hidden sm:inline">
                    {dateLabel(event.date)}
                  </span>
                  <ArrowUpRight className="size-3.5" />
                </a>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Panel>
  );
}
