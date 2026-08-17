import {
  Braces,
  Calendar,
  CircleCheck,
  GitFork,
  Globe2,
  Newspaper,
  Sparkles,
  Star,
} from "lucide-react";

import { compactNumber } from "@/lib/format";
import type { IntelligenceReport } from "@/lib/types/company";

export function Metrics({ report }: { report: IntelligenceReport }) {
  const github = report.github.state === "success" ? report.github.data : null;
  const newsCount =
    report.news.state === "success" ? report.news.data.length : 0;
  const sources = [
    report.website,
    report.github,
    report.news,
    report.country,
    report.brief,
  ];
  const liveSources =
    sources.filter((source) => source.state === "success").length + 1;
  const items = github
    ? [
        {
          label: "Public repos",
          value: compactNumber(github.publicRepos),
          icon: Braces,
        },
        {
          label: "Repository stars",
          value: compactNumber(github.stars),
          icon: Star,
        },
        {
          label: "Repository forks",
          value: compactNumber(github.forks),
          icon: GitFork,
        },
        { label: "Recent stories", value: String(newsCount), icon: Newspaper },
        {
          label: "Founded",
          value: report.identity.foundedYear?.toString() ?? "—",
          icon: Calendar,
        },
      ]
    : [
        { label: "Recent stories", value: String(newsCount), icon: Newspaper },
        {
          label: "Founded",
          value: report.identity.foundedYear?.toString() ?? "—",
          icon: Calendar,
        },
        {
          label: "Headquarters",
          value: report.identity.countryName ?? "Unknown",
          icon: Globe2,
        },
        { label: "Sources live", value: `${liveSources}/6`, icon: CircleCheck },
        {
          label: "Synthesis",
          value:
            report.brief.state === "success" && report.brief.data.generated
              ? "Gemini"
              : "Source-led",
          icon: Sparkles,
        },
      ];
  return (
    <section
      aria-label="Company metrics"
      className="report-metric-rail grid overflow-hidden sm:grid-cols-2 lg:grid-cols-5"
    >
      {items.map(({ label, value, icon: Icon }) => (
        <div key={label} className="report-metric p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs">{label}</p>
            <Icon className="size-3.5" aria-hidden="true" />
          </div>
          <p className="mt-5 text-2xl font-medium tracking-[-0.04em]">
            {value}
          </p>
        </div>
      ))}
    </section>
  );
}
