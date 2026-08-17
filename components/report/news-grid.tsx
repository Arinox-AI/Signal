import { ArrowUpRight } from "lucide-react";

import { Panel, SourceUnavailable } from "@/components/report/panel";
import { dateLabel } from "@/lib/format";
import type { SourceResult, NewsItem } from "@/lib/types/company";

export function NewsGrid({ result }: { result: SourceResult<NewsItem[]> }) {
  return (
    <Panel label="In the news" className="dossier-news">
      {result.state !== "success" ? (
        <SourceUnavailable message={result.message} />
      ) : (
        <div className="divide-y divide-white/[0.06]">
          {result.data.slice(0, 5).map((item, index) => (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="group grid grid-cols-[2rem_1fr_auto] gap-3 p-5 transition hover:bg-white/[0.025] sm:grid-cols-[3rem_1fr_auto]"
            >
              <span className="font-mono text-[10px] text-white/20">
                0{index + 1}
              </span>
              <span>
                <span className="block text-sm leading-5 font-medium text-white/74 transition group-hover:text-white">
                  {item.title}
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
        </div>
      )}
    </Panel>
  );
}
