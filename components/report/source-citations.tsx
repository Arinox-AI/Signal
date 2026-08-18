import { ArrowUpRight } from "lucide-react";

import type { SignalCitation, SourceReference } from "@/lib/types/company";

function shortLabel(label: string): string {
  return label
    .replace(" company profile", "")
    .replace(" structured record", "")
    .replace(" legal entity record", "")
    .replace(" profile", "")
    .replace(" organization", " org");
}

export function SourceCitations({
  citations,
  sources,
}: {
  citations: SignalCitation[];
  sources: SourceReference[];
}) {
  const sourcesById = new Map(sources.map((source) => [source.id, source]));
  const links = citations.flatMap((citation) => {
    const source = sourcesById.get(citation.sourceId);
    const url = citation.url ?? source?.url;
    if (!url) return [];
    return [
      {
        key: `${citation.sourceId}-${url}`,
        label: shortLabel(source?.label ?? citation.sourceId),
        url,
      },
    ];
  });

  if (!links.length) return null;

  return (
    <span className="mt-3 flex flex-wrap items-center gap-1.5 text-[10px]">
      <span className="font-mono tracking-[0.12em] text-white/25 uppercase">
        Sources
      </span>
      {links.map((link) => (
        <a
          key={link.key}
          href={link.url}
          target="_blank"
          rel="noreferrer"
          title={`Open ${link.label}`}
          className="inline-flex items-center gap-1 rounded-full border border-blue-200/10 bg-blue-200/[0.04] px-2 py-1 text-blue-100/60 transition hover:border-blue-200/25 hover:bg-blue-200/[0.09] hover:text-blue-100"
        >
          {link.label}
          <ArrowUpRight className="size-2.5" aria-hidden="true" />
        </a>
      ))}
    </span>
  );
}
