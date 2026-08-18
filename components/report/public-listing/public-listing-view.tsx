import Link from "next/link";
import {
  ArrowUpRight,
  Globe2,
  Landmark,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";

import { Panel, SourceUnavailable } from "@/components/report/panel";
import { FinancialTablePanel } from "@/components/report/public-listing/financial-table";
import { InvestorsPanel } from "@/components/report/public-listing/investors";
import { PriceChart } from "@/components/report/public-listing/price-chart";
import type { SourceResult } from "@/lib/types/company";
import type {
  FinancialTable,
  ListingCell,
  ListingSnapshot,
  PeerComparison,
  PublicListingData,
} from "@/lib/types/public-listing";

function formatMetric(value: number | null, suffix = ""): string {
  if (value === null) return "—";
  return `${new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
  }).format(value)}${suffix}`;
}

function formatCell(value: ListingCell): string {
  if (value === null) return "—";
  if (typeof value === "number")
    return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(
      value,
    );
  return value;
}

function listingQuery(company: { name: string; url: string | null }): string {
  if (company.url) {
    const symbol = new URL(company.url).pathname.split("/").filter(Boolean)[1];
    if (symbol) return symbol;
  }
  return company.name;
}

function ListingIdentity({ data }: { data: PublicListingData }) {
  const listing = data.listing;
  const ConfidenceIcon = listing.confidence.ambiguous
    ? TriangleAlert
    : ShieldCheck;
  const searchedDifferently =
    listing.searchedName !== null &&
    listing.searchedName !== listing.name &&
    !listing.confidence.warning;
  return (
    <Panel
      label="Market identity"
      className="public-listing-identity-panel"
      action={
        listing.screenerUrl ? (
          <a
            href={listing.screenerUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[10px] text-blue-100/50 hover:text-blue-100"
          >
            Source
            <ArrowUpRight className="size-3" aria-hidden="true" />
          </a>
        ) : null
      }
    >
      <div className="p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl border border-blue-200/15 bg-blue-200/[0.06] text-blue-100/70">
            {listing.market === "india" ? (
              <Landmark className="size-5" aria-hidden="true" />
            ) : (
              <Globe2 className="size-5" aria-hidden="true" />
            )}
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-xl font-medium tracking-[-0.035em] text-white">
              {listing.name}
            </h2>
            <p className="mt-1 text-xs text-white/35">
              {listing.market === "india"
                ? "Indian exchange coverage"
                : "Global listing metadata"}
              {listing.consolidated ? " · Consolidated view" : ""}
              {searchedDifferently ? (
                <span className="text-blue-100/60">
                  {" "}
                  · Searched for {listing.searchedName}
                </span>
              ) : null}
            </p>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          {listing.exchanges.map((exchange) => (
            <a
              key={`${exchange.name}-${exchange.symbol}`}
              href={exchange.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-white/65 hover:border-blue-200/25 hover:text-blue-100"
            >
              {exchange.name}
              {exchange.symbol ? ` · ${exchange.symbol}` : ""}
              <ArrowUpRight className="size-3" aria-hidden="true" />
            </a>
          ))}
          {listing.isin ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-2 font-mono text-[10px] text-white/50">
              ISIN {listing.isin}
            </span>
          ) : null}
        </div>
        {listing.confidence.warning ? (
          <div
            role="alert"
            className="mt-6 flex items-start gap-2.5 border border-amber-200/30 bg-amber-200/[0.07] p-3.5"
          >
            <TriangleAlert
              className="mt-0.5 size-4 shrink-0 text-amber-200/90"
              aria-hidden="true"
            />
            <div className="text-xs leading-5 text-amber-100/85">
              <p className="font-medium text-amber-100">
                Approximate listing match
              </p>
              <p className="mt-1">
                {listing.confidence.warning}
                {listing.searchedName && listing.searchedName !== listing.name
                  ? ` Searched for ${listing.searchedName}; financial data shown is for the listed entity ${listing.name}.`
                  : ""}
              </p>
            </div>
          </div>
        ) : null}
        <div className="mt-6 flex items-start gap-2 border-t border-white/[0.07] pt-4 text-xs">
          <ConfidenceIcon
            className={`mt-0.5 size-3.5 ${listing.confidence.ambiguous ? "text-amber-200/70" : "text-emerald-200/70"}`}
            aria-hidden="true"
          />
          <div>
            <p className="text-white/65">{listing.confidence.label}</p>
            <p className="mt-1 leading-5 text-white/35">
              {listing.confidence.reason}
            </p>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function Snapshot({ result }: { result: SourceResult<ListingSnapshot> }) {
  if (result.state !== "success") {
    return (
      <Panel label="Market snapshot" className="public-listing-snapshot-panel">
        <SourceUnavailable message={result.message} />
      </Panel>
    );
  }
  const snapshot = result.data;
  const metrics = [
    [
      "Price",
      `${snapshot.currency === "INR" ? "₹ " : ""}${formatMetric(snapshot.currentPrice)}`,
    ],
    [
      "Market cap",
      `${formatMetric(snapshot.marketCap)}${snapshot.unit ? ` ${snapshot.unit}` : ""}`,
    ],
    ["P/E", formatMetric(snapshot.pe)],
    ["Book value", formatMetric(snapshot.bookValue)],
    ["Dividend yield", formatMetric(snapshot.dividendYield, "%")],
    ["ROCE", formatMetric(snapshot.roce, "%")],
    ["ROE", formatMetric(snapshot.roe, "%")],
    [
      "52-week range",
      `${formatMetric(snapshot.low52Week)} / ${formatMetric(snapshot.high52Week)}`,
    ],
  ];
  return (
    <Panel label="Market snapshot" className="public-listing-snapshot-panel">
      <dl className="public-listing-metrics-grid">
        {metrics.map(([label, value]) => (
          <div key={label} className="public-listing-metric">
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

function Peers({ result }: { result: SourceResult<PeerComparison> }) {
  if (result.state !== "success") {
    return (
      <Panel label="Peers" className="public-listing-peers-panel">
        <SourceUnavailable message={result.message} />
      </Panel>
    );
  }
  const headers = result.data.headers.filter(
    (header) => !/^s\.?no\.?$/i.test(header),
  );
  const metricHeaders = headers
    .slice(1)
    .filter((header) => /cmp|p\/e|mar cap|roe|roce|div yld/i.test(header));
  return (
    <Panel
      label="Peer comparison"
      className="public-listing-peers-panel"
      action={
        <a
          href={result.data.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[10px] text-blue-100/50 hover:text-blue-100"
        >
          Source
          <ArrowUpRight className="size-3" aria-hidden="true" />
        </a>
      }
    >
      <div className="overflow-x-auto">
        <table className="peer-table">
          <caption className="sr-only">Peer comparison</caption>
          <thead>
            <tr>
              <th scope="col">Company</th>
              {metricHeaders.map((header) => (
                <th key={header} scope="col">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.data.companies.map((company) => (
              <tr key={company.name}>
                <th scope="row">
                  <Link
                    href={`/company/${encodeURIComponent(listingQuery(company).toLowerCase())}?tab=public-listing`}
                    className="peer-link"
                  >
                    {company.name}
                    <ArrowUpRight className="size-3" aria-hidden="true" />
                  </Link>
                </th>
                {metricHeaders.map((header) => (
                  <td key={`${company.name}-${header}`}>
                    {formatCell(company.metrics[header] ?? null)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function Shareholding({ result }: { result: SourceResult<FinancialTable> }) {
  if (result.state !== "success") {
    return (
      <Panel
        label="Shareholding pattern"
        className="public-listing-shareholding-panel"
      >
        <SourceUnavailable message={result.message} />
      </Panel>
    );
  }
  const latestIndex = result.data.periods.length - 1;
  const latestPeriod = result.data.periods[latestIndex] ?? "Latest period";
  const ownershipRows = result.data.rows.filter((row) =>
    /promoter|fii|dii|public|government/i.test(row.label),
  );
  return (
    <Panel
      label="Shareholding pattern"
      className="public-listing-shareholding-panel"
    >
      <div className="p-5 sm:p-6">
        <p className="font-mono text-[10px] tracking-[0.14em] text-white/30 uppercase">
          Latest reported period · {latestPeriod}
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {ownershipRows.map((row) => {
            const value = row.values[latestIndex];
            const numeric =
              typeof value === "string" ? Number.parseFloat(value) : value;
            const width =
              typeof numeric === "number" && Number.isFinite(numeric)
                ? Math.max(0, Math.min(numeric, 100))
                : 0;
            return (
              <div key={row.label} className="shareholding-card">
                <div className="flex items-center justify-between gap-2 text-[10px] text-white/45">
                  <span>{row.label}</span>
                  <span>{formatCell(value ?? null)}</span>
                </div>
                <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[0.08]">
                  <span
                    className="block h-full rounded-full bg-blue-200/70"
                    style={{ width: `${width}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <FinancialTablePanel
        label="Shareholding history"
        result={result}
        className="shareholding-history"
      />
    </Panel>
  );
}

export function PublicListingView({
  result,
}: {
  result: SourceResult<PublicListingData>;
}) {
  if (result.state !== "success") {
    return (
      <div className="public-listing-content mx-auto max-w-[1320px] px-5 py-8 sm:px-8 lg:px-12 lg:py-10">
        <Panel label="Public listing">
          <SourceUnavailable message={result.message} />
        </Panel>
      </div>
    );
  }

  const data = result.data;
  return (
    <div className="public-listing-content mx-auto max-w-[1320px] space-y-5 px-5 py-8 sm:px-8 lg:px-12 lg:py-10">
      <div className="grid items-start gap-5 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <ListingIdentity data={data} />
        </div>
        <div className="lg:col-span-3">
          <Snapshot result={data.snapshot} />
        </div>
      </div>
      <PriceChart result={data.chart} />
      {data.listing.market === "india" ? (
        <>
          <Peers result={data.peers} />
          <FinancialTablePanel
            label="Quarterly results"
            result={data.quarters}
          />
          <div className="grid items-start gap-5 lg:grid-cols-2">
            <FinancialTablePanel
              label="Profit & loss"
              result={data.profitLoss}
            />
            <FinancialTablePanel
              label="Balance sheet"
              result={data.balanceSheet}
            />
          </div>
          <FinancialTablePanel label="Cash flow" result={data.cashFlow} />
          <FinancialTablePanel label="Ratios" result={data.ratios} />
          <Shareholding result={data.shareholding} />
          <InvestorsPanel result={data.investors} />
        </>
      ) : (
        <Panel label="Global listing coverage">
          <div className="flex items-start gap-3 p-6 text-sm leading-6 text-white/45">
            <Globe2
              className="mt-0.5 size-4 shrink-0 text-blue-100/60"
              aria-hidden="true"
            />
            This listing has verified global exchange metadata. Full price
            history, financial statements, peers, shareholding, and investor
            documents are currently connected for Indian NSE/BSE listings.
          </div>
        </Panel>
      )}
    </div>
  );
}
