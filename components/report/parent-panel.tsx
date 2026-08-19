"use client";

import {
  ArrowUpRight,
  Building2,
  ChevronDown,
  ExternalLink,
  Loader2,
  Newspaper,
  RefreshCw,
  TrendingUp,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";

import { Panel } from "@/components/report/panel";
import type {
  CompanyIdentity,
  NewsItem,
  ParentCompany,
  SourceResult,
} from "@/lib/types/company";
import type { ListingSnapshot } from "@/lib/types/public-listing";

interface ParentHeadcount {
  total: number | null;
  year: number | null;
  samples: Array<{ year: number | null; total: number }>;
}

interface ParentEnrichmentResponse {
  identity: SourceResult<CompanyIdentity>;
  news: SourceResult<NewsItem[]>;
  listing: SourceResult<ListingSnapshot>;
  headcount: SourceResult<ParentHeadcount>;
}

type SnapshotState = "idle" | "loading" | "ready" | "error";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSourceResult(value: unknown): boolean {
  return (
    isRecord(value) &&
    (value.state === "success" ||
      value.state === "empty" ||
      value.state === "unavailable" ||
      value.state === "rate_limited")
  );
}

function isEnrichment(value: unknown): value is ParentEnrichmentResponse {
  return (
    isRecord(value) &&
    isRecord(value.identity) &&
    isSourceResult(value.identity) &&
    isRecord(value.news) &&
    isSourceResult(value.news) &&
    isRecord(value.listing) &&
    isSourceResult(value.listing) &&
    isRecord(value.headcount) &&
    isSourceResult(value.headcount)
  );
}

function formatMetric(value: number | null): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(
    value,
  );
}

function dateLabel(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString("en", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";
}

function SectionLabel({
  icon: Icon,
  children,
}: {
  icon: typeof Building2;
  children: ReactNode;
}) {
  return (
    <p className="flex items-center gap-1.5 text-[10px] tracking-wider text-white/28 uppercase">
      <Icon className="size-3" aria-hidden="true" />
      {children}
    </p>
  );
}

function FallbackLine({ message }: { message: string }) {
  return <p className="py-1 text-sm text-white/25">{message}</p>;
}

function LinkRow({
  wikipediaUrl,
  wikidataUrl,
  name,
}: {
  wikipediaUrl: string | null;
  wikidataUrl: string | null;
  name: string;
}) {
  const wikiHref =
    wikipediaUrl ??
    `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(name)}`;
  const dataHref =
    wikidataUrl ??
    `https://www.wikidata.org/w/index.php?search=${encodeURIComponent(name)}`;
  return (
    <div className="mt-3 flex items-center gap-3">
      <a
        href={wikiHref}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-[11px] text-blue-100/55 transition-colors hover:text-blue-100"
      >
        Wikipedia
        <ExternalLink className="size-2.5" aria-hidden="true" />
      </a>
      <a
        href={dataHref}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-[11px] text-blue-100/55 transition-colors hover:text-blue-100"
      >
        Wikidata
        <ExternalLink className="size-2.5" aria-hidden="true" />
      </a>
    </div>
  );
}

function SnapshotGrid({ data }: { data: ParentEnrichmentResponse }) {
  const identity =
    data.identity.state === "success" ? data.identity.data : null;
  const headcount =
    data.headcount.state === "success" ? data.headcount.data : null;

  return (
    <div className="grid gap-x-8 gap-y-8 border-t border-white/[0.06] p-6 sm:grid-cols-2 xl:grid-cols-3">
      <div>
        <SectionLabel icon={Building2}>Parent identity</SectionLabel>
        <div className="mt-3">
          {identity ? (
            <p className="text-sm leading-5 text-white/55">
              {identity.description}
            </p>
          ) : (
            <FallbackLine message="No public record beyond the detected name." />
          )}
          <p className="mt-2 text-[11px] leading-5 text-white/30">
            {identity?.foundedYear ? `Founded ${identity.foundedYear}. ` : ""}
            {identity?.countryName ? `Based in ${identity.countryName}.` : ""}
          </p>
          {identity?.website && (
            <a
              href={identity.website}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-[11px] text-blue-100/55 transition-colors hover:text-blue-100"
            >
              {identity.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
              <ExternalLink className="size-2.5" aria-hidden="true" />
            </a>
          )}
          {identity?.overview && (
            <p className="mt-3 line-clamp-4 text-xs leading-5 text-white/40">
              {identity.overview}
            </p>
          )}
        </div>
      </div>

      <div>
        <SectionLabel icon={TrendingUp}>Market snapshot</SectionLabel>
        <div className="mt-3">
          {data.listing.state === "success" ? (
            <dl className="space-y-3">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-[11px] text-white/35">Price</dt>
                <dd className="font-mono text-sm text-white/80">
                  {formatMetric(data.listing.data.currentPrice)}
                  {data.listing.data.currency
                    ? ` ${data.listing.data.currency}`
                    : ""}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-[11px] text-white/35">Market cap</dt>
                <dd className="font-mono text-sm text-white/80">
                  {formatMetric(data.listing.data.marketCap)}
                  {data.listing.data.unit ? ` ${data.listing.data.unit}` : ""}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-[11px] text-white/35">P/E</dt>
                <dd className="font-mono text-sm text-white/80">
                  {formatMetric(data.listing.data.pe)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-[11px] text-white/35">52-week range</dt>
                <dd className="font-mono text-sm text-white/80">
                  {formatMetric(data.listing.data.low52Week)} –{" "}
                  {formatMetric(data.listing.data.high52Week)}
                </dd>
              </div>
            </dl>
          ) : data.listing.state === "empty" ? (
            <FallbackLine message="No public listing verified for the parent." />
          ) : (
            <FallbackLine
              message={data.listing.message ?? "Listing data is unavailable."}
            />
          )}
        </div>
      </div>

      <div>
        <SectionLabel icon={Users}>Group headcount</SectionLabel>
        <div className="mt-3">
          {headcount !== null && headcount.total !== null ? (
            <p className="text-2xl font-medium tracking-[-0.03em] text-white">
              ~{headcount.total.toLocaleString("en")}
              <span className="ml-2 text-[11px] font-normal tracking-normal text-white/35">
                {headcount.year ? `employees (${headcount.year})` : "employees"}
              </span>
            </p>
          ) : (
            <FallbackLine message="No dated headcount sample was found for the parent." />
          )}
        </div>
      </div>

      <div className="sm:col-span-2 xl:col-span-3">
        <SectionLabel icon={Newspaper}>Parent coverage</SectionLabel>
        <div className="mt-3">
          {data.news.state === "success" ? (
            data.news.data.length ? (
              <ul className="grid gap-x-8 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
                {data.news.data.slice(0, 3).map((item) => (
                  <li key={item.id}>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block text-xs leading-5 text-white/55 transition-colors hover:text-white/85"
                    >
                      {item.title}
                    </a>
                    <p className="mt-0.5 text-[10px] text-white/25">
                      {item.source} · {dateLabel(item.publishedAt)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <FallbackLine message="No recent coverage matched the parent." />
            )
          ) : data.news.state === "empty" ? (
            <FallbackLine message="No recent coverage matched the parent." />
          ) : (
            <FallbackLine
              message={data.news.message ?? "News is unavailable."}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export function ParentPanel({ parent }: { parent: ParentCompany }) {
  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<ParentEnrichmentResponse | null>(
    null,
  );
  const [state, setState] = useState<SnapshotState>("idle");

  async function loadSnapshot() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (snapshot || state === "loading") return;
    setState("loading");
    try {
      const response = await fetch(
        `/api/parent?q=${encodeURIComponent(parent.query.slice(0, 120))}`,
      );
      const payload = (await response.json()) as unknown;
      if (!isEnrichment(payload)) throw new Error("Unexpected payload");
      setSnapshot(payload);
      setState("ready");
    } catch {
      setState("error");
    }
  }

  const reportHref = `/company/${encodeURIComponent(parent.query.toLowerCase())}`;

  return (
    <Panel label="Parent company" className="dossier-parent">
      <div className="p-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <p className="text-lg font-medium tracking-[-0.02em] text-white">
              {parent.name}
            </p>
            <p className="mt-1.5 space-y-0.5 text-[11px] leading-5 text-white/35">
              {parent.industry && <span>{parent.industry}</span>}
              {parent.country && (
                <span className="block">Based in {parent.country}</span>
              )}
            </p>
            <p className="mt-2 text-[11px] leading-5 text-white/28">
              {parent.detectedVia === "text"
                ? "Parent named in the public record; treat the relationship as reported, not verified."
                : "Ownership relationship from the structured record."}
            </p>
            <LinkRow
              wikipediaUrl={parent.wikipediaUrl}
              wikidataUrl={parent.wikidataUrl}
              name={parent.name}
            />
          </div>
          <div className="flex shrink-0 flex-col items-stretch gap-2 sm:flex-row md:flex-col md:items-end">
            <button
              type="button"
              onClick={loadSnapshot}
              aria-expanded={open}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-xs text-white/75 transition hover:bg-white/[0.06]"
            >
              {state === "loading" ? (
                <Loader2
                  className="size-3.5 animate-spin text-blue-200/70"
                  aria-hidden="true"
                />
              ) : state === "error" ? (
                <RefreshCw
                  className="size-3.5 text-blue-200/70"
                  aria-hidden="true"
                />
              ) : (
                <ChevronDown
                  className={open ? "size-3.5 rotate-180" : "size-3.5"}
                  aria-hidden="true"
                />
              )}
              {state === "error"
                ? "Retry snapshot"
                : open
                  ? "Hide snapshot"
                  : "Load parent snapshot"}
            </button>
            <Link
              href={reportHref}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-300 px-4 py-2.5 text-xs font-medium text-[#071226] shadow-[0_8px_24px_rgba(120,169,255,0.25)] transition hover:bg-blue-200"
            >
              Open full parent report
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
      {open && snapshot && <SnapshotGrid data={snapshot} />}
      {open && state === "error" && (
        <div className="border-t border-white/[0.06] px-6 py-5">
          <p className="text-sm leading-6 text-white/45">
            The parent snapshot could not be loaded. Check the connection and
            retry, or open the full parent report above.
          </p>
        </div>
      )}
      {open && state === "loading" && (
        <div className="border-t border-white/[0.06] p-6">
          <div
            className="space-y-2"
            aria-busy="true"
            aria-label="Loading parent snapshot"
          >
            {["w-3/5", "w-4/5", "w-2/3"].map((width) => (
              <span
                key={width}
                className={`shimmer block h-3 rounded-full bg-white/[0.05] ${width}`}
              />
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}
