import { ArrowUpRight } from "lucide-react";

import type {
  CompanyIdentity,
  CompanyIdentityField,
  SourceReference,
} from "@/lib/types/company";

const FIELD_LABELS: Record<CompanyIdentityField, string> = {
  name: "Name",
  description: "Description",
  overview: "Overview",
  website: "Official website",
  countryName: "Headquarters",
  industry: "Industry",
  foundedYear: "Founded",
  lei: "Legal identifier",
};

const VISIBLE_FIELDS: CompanyIdentityField[] = [
  "foundedYear",
  "countryName",
  "industry",
  "lei",
];

function fieldValue(identity: CompanyIdentity, field: CompanyIdentityField) {
  const value = identity[field];
  if (field === "lei") return value ? `LEI ${value}` : "Not listed";
  if (field === "foundedYear") return value?.toString() ?? "Not listed";
  return typeof value === "string" && value ? value : "Not listed";
}

function confidenceClass(level: string): string {
  if (level === "high") return "text-emerald-200/70";
  if (level === "medium") return "text-amber-200/70";
  return "text-white/35";
}

export function IdentityProvenance({
  identity,
  sources,
}: {
  identity: CompanyIdentity;
  sources: SourceReference[];
}) {
  const sourceById = new Map(sources.map((source) => [source.id, source]));

  return (
    <section
      aria-labelledby="identity-provenance-heading"
      className="report-evidence-map mt-8 border-t border-white/[0.08] pt-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p
            id="identity-provenance-heading"
            className="font-mono text-[10px] tracking-[0.16em] text-blue-200/60 uppercase"
          >
            Evidence map
          </p>
          <p className="mt-1 text-xs text-white/35">
            Field origins remain attached to the resolved identity.
          </p>
        </div>
        <a
          href={identity.primarySource.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-white/45 transition hover:text-white/80"
        >
          {identity.primarySource.label}
          <ArrowUpRight className="size-3" aria-hidden="true" />
        </a>
      </div>
      <dl className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {VISIBLE_FIELDS.map((field) => {
          const provenance = identity.provenance[field];
          const fieldSources = provenance.sourceIds.flatMap((sourceId) => {
            const source = sourceById.get(sourceId);
            return source ? [source] : [];
          });
          return (
            <div
              key={field}
              className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-3"
            >
              <dt className="text-[10px] tracking-wider text-white/30 uppercase">
                {FIELD_LABELS[field]}
              </dt>
              <dd className="mt-2 truncate text-sm text-white/75">
                {fieldValue(identity, field)}
              </dd>
              <dd className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
                <span className={confidenceClass(provenance.confidence)}>
                  {provenance.confidence} confidence
                </span>
                {fieldSources.map((source) => (
                  <a
                    key={`${field}-${source.id}`}
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    title={`Open ${source.label}`}
                    className="inline-flex items-center gap-0.5 text-blue-100/55 hover:text-blue-100"
                  >
                    {source.label}
                    <ArrowUpRight className="size-2.5" aria-hidden="true" />
                  </a>
                ))}
              </dd>
              {provenance.note ? (
                <dd className="mt-2 line-clamp-2 text-[10px] leading-4 text-white/30">
                  {provenance.note}
                </dd>
              ) : null}
            </div>
          );
        })}
      </dl>
    </section>
  );
}
