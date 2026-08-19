import "server-only";

import { z } from "zod";

import {
  sourceEmpty,
  sourceSuccess,
  sourceUnavailable,
} from "@/lib/data/source-result";
import { UpstreamError, resilientFetch } from "@/lib/http/request";
import type {
  CompanyIdentity,
  SourceReference,
  SourceResult,
} from "@/lib/types/company";
import type {
  FinancialTable,
  InvestorDocuments,
  ListingChart,
  ListingIdentity,
  ListingExchange,
  ListingSnapshot,
  PeerComparison,
  PublicListingData,
} from "@/lib/types/public-listing";
import {
  fetchHistoricalStats,
  fetchIndianChart,
  fetchStockOverview,
  isIndianApiConfigured,
  overviewNumber,
  resolveIndianSymbol,
} from "@/services/indian-api/service";
import type { ResolvedIndianListing } from "@/services/indian-api/service";
import {
  parseChartPayload,
  parsePeerHtml,
  parseScreenerPage,
} from "@/services/public-listing/parser";
import {
  selectScreenerCandidates,
  type RankedCandidate,
  type ScreenerCandidate,
} from "@/services/public-listing/selection";

const screenerSearchSchema = z.array(
  z.object({
    id: z.union([z.string(), z.number()]),
    name: z.string(),
    url: z.string(),
  }),
);

function failure<T>(error: unknown, fallback: string): SourceResult<T> {
  return sourceUnavailable(
    error instanceof Error ? error.message : fallback,
    error instanceof UpstreamError && error.rateLimited,
  );
}

function absoluteScreenerUrl(value: string): string | null {
  try {
    const url = new URL(value, "https://www.screener.in");
    if (
      url.hostname !== "www.screener.in" ||
      !/^\/company\//.test(url.pathname)
    )
      return null;
    return url.toString();
  } catch {
    return null;
  }
}

function normalSymbol(value: string | null | undefined): string | null {
  const symbol = value?.trim().toUpperCase();
  if (!symbol) return null;
  return symbol.replace(/\.(NS|BO|NSE|BSE)$/i, "");
}

async function searchScreenerCompanies(
  searchTerm: string,
): Promise<ScreenerCandidate[]> {
  const url = new URL("https://www.screener.in/api/company/search/");
  url.searchParams.set("q", searchTerm.slice(0, 100));
  url.searchParams.set("v", "5");
  const response = await resilientFetch(
    url.toString(),
    { headers: { Accept: "application/json" } },
    { revalidate: 21_600, timeoutMs: 5_500 },
  );
  const payload = screenerSearchSchema.parse(await response.json());
  return payload.flatMap((item) => {
    const companyUrl = absoluteScreenerUrl(item.url);
    return companyUrl ? [{ name: item.name, url: companyUrl }] : [];
  });
}

function ref(
  id: SourceReference["id"],
  label: string,
  url: string,
): SourceReference {
  return { id, label, url };
}

function listingSources(
  screenerUrl: string,
  exchanges: ListingExchange[],
  investorRelationsUrl: string | null,
): SourceReference[] {
  return [
    ref("screener", "Screener financial profile", screenerUrl),
    ...exchanges.map((exchange) =>
      ref(
        exchange.name === "NSE" ? "nse" : "bse",
        `${exchange.name} listing`,
        exchange.url,
      ),
    ),
    ...(investorRelationsUrl
      ? [
          ref(
            "investor_relations",
            "Company investor relations",
            investorRelationsUrl,
          ),
        ]
      : []),
  ];
}

function sectionResult(
  table: FinancialTable | null,
  label: string,
): SourceResult<FinancialTable> {
  return table
    ? sourceSuccess(table)
    : sourceEmpty<FinancialTable>(
        `${label} data was not available for this listing.`,
      );
}

async function fetchChart(
  companyId: string,
): Promise<SourceResult<ListingChart>> {
  const url = new URL(
    `https://www.screener.in/api/company/${encodeURIComponent(companyId)}/chart/`,
  );
  url.searchParams.set("q", "Price-DMA50-DMA200-Volume");
  url.searchParams.set("days", "3652");
  try {
    const response = await resilientFetch(
      url.toString(),
      { headers: { Accept: "application/json" } },
      { revalidate: 900, timeoutMs: 7_000 },
    );
    const chart = parseChartPayload(
      await response.json(),
      url.toString(),
      3652,
    );
    return chart
      ? sourceSuccess(chart)
      : sourceEmpty("Price chart data was not available.");
  } catch (error) {
    return failure(error, "Price chart data is unavailable.");
  }
}

async function fetchPeers(
  warehouseId: string,
  screenerUrl: string,
): Promise<SourceResult<PeerComparison>> {
  const url = `https://www.screener.in/api/company/${encodeURIComponent(warehouseId)}/peers/`;
  try {
    const response = await resilientFetch(
      url,
      { headers: { Accept: "text/html" } },
      { revalidate: 1_800, timeoutMs: 7_000 },
    );
    const peers = parsePeerHtml(await response.text(), screenerUrl);
    return peers
      ? sourceSuccess(peers)
      : sourceEmpty<PeerComparison>("Peer comparison data was not available.");
  } catch (error) {
    return failure(error, "Peer comparison data is unavailable.");
  }
}

function dataSources(
  listing: ListingIdentity,
  identity: CompanyIdentity,
): SourceReference[] {
  const references = [...listing.sourceReferences];
  const website = identity.website;
  if (
    website &&
    !references.some(
      (item) => item.id === "investor_relations" || item.id === "website",
    )
  )
    references.push(ref("website", "Company website", website));
  return references;
}

function listedData(
  parsed: ReturnType<typeof parseScreenerPage>,
  listing: ListingIdentity,
  sources: SourceReference[],
  chart: PublicListingData["chart"],
  peers: PublicListingData["peers"],
): PublicListingData {
  const investors =
    parsed.investors.documents.length || parsed.investors.annualReports.length
      ? sourceSuccess(parsed.investors)
      : sourceEmpty<InvestorDocuments>(
          "Investor announcements and annual reports were not available.",
        );
  return {
    listing,
    snapshot: parsed.snapshot
      ? sourceSuccess(parsed.snapshot)
      : sourceEmpty("Listing snapshot metrics were not available."),
    chart,
    peers,
    quarters: sectionResult(parsed.tables.quarters, "Quarterly results"),
    profitLoss: sectionResult(parsed.tables.profitLoss, "Profit and loss"),
    balanceSheet: sectionResult(parsed.tables.balanceSheet, "Balance sheet"),
    cashFlow: sectionResult(parsed.tables.cashFlow, "Cash flow"),
    ratios: sectionResult(parsed.tables.ratios, "Ratio"),
    shareholding: sectionResult(parsed.tables.shareholding, "Shareholding"),
    investors,
    sources,
    generatedAt: new Date().toISOString(),
  };
}

function emptyGlobalSection<T>(message: string): SourceResult<T> {
  return sourceEmpty<T>(message);
}

function claimValues(entity: unknown, property: string): unknown[] {
  if (typeof entity !== "object" || entity === null) return [];
  const claims = (entity as { claims?: Record<string, unknown> }).claims?.[
    property
  ];
  if (!Array.isArray(claims)) return [];
  return claims.flatMap((claim) => {
    if (typeof claim !== "object" || claim === null) return [];
    const datavalue = (
      claim as { mainsnak?: { datavalue?: { value?: unknown } } }
    ).mainsnak?.datavalue;
    return datavalue && "value" in datavalue ? [datavalue.value] : [];
  });
}

async function globalListingBasics(
  identity: CompanyIdentity,
): Promise<SourceResult<PublicListingData>> {
  const wikidataUrl = identity.sourceReferences.find(
    (item) => item.id === "wikidata",
  )?.url;
  const qid = wikidataUrl?.match(/\/wiki\/(Q\d+)/i)?.[1];
  if (!qid)
    return sourceEmpty(
      "No NSE/BSE or verified global public listing was found.",
    );
  try {
    const response = await resilientFetch(
      `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`,
      {},
      { revalidate: 604_800, timeoutMs: 5_500 },
    );
    const payload = (await response.json()) as {
      entities?: Record<string, unknown>;
    };
    const entity = payload.entities?.[qid];
    const tickers = claimValues(entity, "P249").filter(
      (value): value is string =>
        typeof value === "string" && value.trim().length > 0,
    );
    const exchangeIds = claimValues(entity, "P414").flatMap((value) =>
      typeof value === "object" &&
      value !== null &&
      "id" in value &&
      typeof value.id === "string"
        ? [value.id]
        : [],
    );
    const isin =
      claimValues(entity, "P946").find(
        (value): value is string => typeof value === "string",
      ) ?? null;
    if (!tickers.length && !exchangeIds.length)
      return sourceEmpty("No verified global public listing was found.");

    const exchangeLabels = new Map<string, string>();
    if (exchangeIds.length) {
      const labelsUrl = new URL("https://www.wikidata.org/w/api.php");
      labelsUrl.search = new URLSearchParams({
        action: "wbgetentities",
        ids: exchangeIds.join("|"),
        props: "labels",
        format: "json",
        origin: "*",
      }).toString();
      const labelsResponse = await resilientFetch(
        labelsUrl.toString(),
        {},
        { revalidate: 604_800, timeoutMs: 5_500 },
      );
      const labelsPayload = (await labelsResponse.json()) as {
        entities?: Record<string, { labels?: { en?: { value?: string } } }>;
      };
      for (const [id, value] of Object.entries(labelsPayload.entities ?? {})) {
        const label = value.labels?.en?.value;
        if (label) exchangeLabels.set(id, label);
      }
    }
    const primarySource =
      identity.sourceReferences.find((item) => item.id === "wikidata") ??
      ref(
        "wikidata",
        "Wikidata structured record",
        `https://www.wikidata.org/wiki/${qid}`,
      );
    const exchanges: ListingExchange[] = (
      exchangeIds.length ? exchangeIds : ["global"]
    ).map((exchangeId, index) => ({
      name:
        exchangeLabels.get(exchangeId) ??
        (exchangeId === "global" ? "Public exchange" : exchangeId),
      symbol: tickers[index] ?? tickers[0] ?? null,
      securityId: null,
      url:
        exchangeId === "global"
          ? primarySource.url
          : `https://www.wikidata.org/wiki/${exchangeId}`,
    }));
    const listing: ListingIdentity = {
      state: "listed",
      name: identity.name,
      searchedName: identity.name,
      market: "global",
      isin,
      exchanges,
      screenerUrl: null,
      investorRelationsUrl: identity.website,
      consolidated: false,
      confidence: {
        level: "medium",
        label: "Global listing metadata",
        reason:
          "Ticker or exchange claims were found in Wikidata; full global fundamentals are not connected yet.",
        ambiguous: false,
      },
      sourceReferences: [
        primarySource,
        ...(identity.website
          ? [ref("investor_relations", "Company website", identity.website)]
          : []),
      ],
    };
    const sectionsMessage =
      "Full financial statements are currently available for Indian listings only.";
    const data: PublicListingData = {
      listing,
      snapshot: emptyGlobalSection(
        "Global snapshot metrics are not connected yet.",
      ),
      chart: emptyGlobalSection("Global price history is not connected yet."),
      peers: emptyGlobalSection("Global peer comparison is not connected yet."),
      quarters: emptyGlobalSection(sectionsMessage),
      profitLoss: emptyGlobalSection(sectionsMessage),
      balanceSheet: emptyGlobalSection(sectionsMessage),
      cashFlow: emptyGlobalSection(sectionsMessage),
      ratios: emptyGlobalSection(sectionsMessage),
      shareholding: emptyGlobalSection(sectionsMessage),
      investors: emptyGlobalSection(
        "Global investor documents were not resolved.",
      ),
      sources: listing.sourceReferences,
      generatedAt: new Date().toISOString(),
    };
    return sourceSuccess(data);
  } catch (error) {
    return failure(error, "Global listing metadata is unavailable.");
  }
}

async function indianListing(
  candidate: RankedCandidate,
  identity: CompanyIdentity,
  resolved: ResolvedIndianListing | null,
): Promise<SourceResult<PublicListingData> | null> {
  const response = await resilientFetch(
    candidate.url,
    { headers: { Accept: "text/html" } },
    { revalidate: 900, timeoutMs: 8_000 },
  );
  const parsed = parseScreenerPage(
    (await response.text()).slice(0, 1_500_000),
    candidate.url,
  );
  const parsedNseSymbol = normalSymbol(
    parsed.exchanges.find((exchange) => exchange.name === "NSE")?.symbol ??
      null,
  );
  // Symbol verification: when IndianAPI resolved a definitive NSE symbol, a
  // screener page whose own NSE symbol conflicts is a different company —
  // reject it (the caller then tries the next candidate or the fallback).
  if (resolved?.nseSymbol && parsedNseSymbol) {
    if (parsedNseSymbol !== normalSymbol(resolved.nseSymbol)) return null;
  }
  const verified = Boolean(resolved?.nseSymbol && parsedNseSymbol);
  const investorRelationsUrl = parsed.investors.investorRelationsUrl;
  const primarySource = ref(
    "screener",
    "Screener financial profile",
    candidate.url,
  );
  const sources = listingSources(
    candidate.url,
    parsed.exchanges,
    investorRelationsUrl,
  );
  const exact = candidate.rank === 0;
  const strong = exact || verified;
  const listing: ListingIdentity = {
    state: "listed",
    name: parsed.companyName,
    searchedName: identity.name,
    market: "india",
    isin: parsed.isin,
    exchanges: parsed.exchanges,
    screenerUrl: candidate.url,
    investorRelationsUrl,
    consolidated: parsed.consolidated,
    confidence: {
      level: strong ? "high" : "medium",
      label: exact
        ? "Indian listing verified"
        : verified
          ? "Indian listing verified by exchange symbol"
          : "Likely Indian listing",
      reason: exact
        ? "The listed company name matched the resolved company identity."
        : verified
          ? `The NSE symbol ${normalSymbol(resolved?.nseSymbol)} matched the listing's exchange record.`
          : "The listing was found by a close public-company name match; verify the exchange symbols before relying on it.",
      ambiguous: !strong,
      ...(strong
        ? {}
        : {
            warning:
              "A listed entity with a similar name was selected for the financial data. The data may belong to a different group company.",
          }),
    },
    sourceReferences: [
      primarySource,
      ...sources.filter((source) => source.id !== "screener"),
    ],
  };
  const chartPromise = parsed.companyId
    ? fetchChart(parsed.companyId)
    : Promise.resolve(
        sourceEmpty<ListingChart>("Price chart data was not available."),
      );
  const peersPromise = parsed.warehouseId
    ? fetchPeers(parsed.warehouseId, candidate.url)
    : Promise.resolve(
        sourceEmpty<PeerComparison>("Peer comparison data was not available."),
      );
  const [chart, peers] = await Promise.all([chartPromise, peersPromise]);
  return sourceSuccess(
    listedData(parsed, listing, dataSources(listing, identity), chart, peers),
  );
}

function historicalTable(
  title: string,
  rows: {
    url: string;
    rows: Record<string, Record<string, number | string>>;
  } | null,
): FinancialTable | null {
  if (!rows) return null;
  const periods: string[] = [];
  const seen = new Set<string>();
  for (const row of Object.values(rows.rows)) {
    for (const period of Object.keys(row)) {
      if (!seen.has(period)) {
        seen.add(period);
        periods.push(period);
      }
    }
  }
  if (!periods.length) return null;
  periods.sort((left, right) => {
    const leftTime = Date.parse(left);
    const rightTime = Date.parse(right);
    if (Number.isFinite(leftTime) && Number.isFinite(rightTime))
      return leftTime - rightTime;
    return left.localeCompare(right);
  });
  const tableRows = Object.entries(rows.rows)
    .map(([label, values]) => ({
      label,
      values: periods.map((period) => values[period] ?? null),
    }))
    .filter((row) => row.values.some((value) => value !== null));
  if (!tableRows.length) return null;
  return {
    title,
    unit: null,
    periods,
    rows: tableRows,
    sourceUrl: rows.url,
  };
}

function metricByKeys(
  metrics: Record<string, unknown>,
  keys: string[],
): number | null {
  for (const [key, value] of Object.entries(metrics)) {
    const normalized = key.toLowerCase().replace(/[_\s]+/g, "");
    if (keys.includes(normalized)) {
      const number = overviewNumber(value);
      if (number !== null) return number;
    }
  }
  return null;
}

async function indianApiListing(
  resolved: ResolvedIndianListing,
  identity: CompanyIdentity,
): Promise<SourceResult<PublicListingData>> {
  const [
    overview,
    chart,
    quarterStats,
    balanceStats,
    cashStats,
    ratioStats,
    shareholdingStats,
  ] = await Promise.all([
    fetchStockOverview(resolved.name),
    fetchIndianChart(resolved.name, 3_652),
    fetchHistoricalStats(resolved.name, "quarter_results"),
    fetchHistoricalStats(resolved.name, "balancesheet"),
    fetchHistoricalStats(resolved.name, "cashflow"),
    fetchHistoricalStats(resolved.name, "ratios"),
    fetchHistoricalStats(resolved.name, "shareholding_pattern_quarterly"),
  ]);

  const listedName = overview?.name ?? resolved.name;
  const exchanges: ListingExchange[] = [
    ...(resolved.nseSymbol
      ? [
          {
            name: "NSE" as const,
            symbol: resolved.nseSymbol,
            securityId: resolved.id,
            url: `https://www.nseindia.com/get-quotes/equity?symbol=${encodeURIComponent(resolved.nseSymbol)}`,
          },
        ]
      : []),
    ...(resolved.bseSymbol
      ? [
          {
            name: "BSE" as const,
            symbol: resolved.bseSymbol,
            securityId: null,
            url: `https://www.bseindia.com/stock-share-price/${encodeURIComponent(resolved.bseSymbol)}`,
          },
        ]
      : []),
  ];
  const fallbackSourceUrl = `https://stock.indianapi.in/search?name=${encodeURIComponent(resolved.name)}`;
  const listing: ListingIdentity = {
    state: "listed",
    name: listedName,
    searchedName: identity.name,
    market: "india",
    isin: null,
    exchanges,
    screenerUrl: null,
    investorRelationsUrl: identity.website,
    consolidated: false,
    confidence: {
      level: "high",
      label: "Symbol-verified Indian listing",
      reason: `The listing was resolved to exchange symbol${resolved.nseSymbol && resolved.bseSymbol ? "s" : ""} ${[resolved.nseSymbol, resolved.bseSymbol].filter(Boolean).join(" / ")} via IndianAPI.`,
      ambiguous: false,
    },
    sourceReferences: [
      ref("indian_api", "IndianAPI stock market data", fallbackSourceUrl),
      ...(identity.website
        ? [
            ref(
              "investor_relations",
              "Company investor relations",
              identity.website,
            ),
          ]
        : []),
    ],
  };

  const snapshot: ListingSnapshot = {
    currency: "INR",
    unit: "",
    currentPrice:
      overview?.currentPriceNse ?? overview?.currentPriceBse ?? null,
    changePercent: overview?.percentChange ?? null,
    marketCap: metricByKeys(overview?.keyMetrics ?? {}, [
      "marketcap",
      "mcap",
      "marketcapitalization",
    ]),
    pe: metricByKeys(overview?.keyMetrics ?? {}, [
      "pe",
      "peratio",
      "p/e",
      "pes",
    ]),
    bookValue: metricByKeys(overview?.keyMetrics ?? {}, [
      "bookvalue",
      "bookvaluepershare",
    ]),
    dividendYield: metricByKeys(overview?.keyMetrics ?? {}, [
      "dividendyield",
      "divyld",
      "dividendyieldpercent",
    ]),
    roce: metricByKeys(overview?.keyMetrics ?? {}, ["roce"]),
    roe: metricByKeys(overview?.keyMetrics ?? {}, ["roe"]),
    faceValue: metricByKeys(overview?.keyMetrics ?? {}, [
      "facevalue",
      "facevaluepershare",
    ]),
    high52Week: overview?.yearHigh ?? null,
    low52Week: overview?.yearLow ?? null,
    asOf: null,
  };
  const data: PublicListingData = {
    listing,
    snapshot: sourceSuccess(snapshot),
    chart: chart
      ? sourceSuccess(chart)
      : sourceEmpty("Price chart data was not available."),
    peers: sourceEmpty("Peer comparison data was not available."),
    quarters: sectionResult(
      historicalTable("Quarterly results", quarterStats),
      "Quarterly results",
    ),
    profitLoss: sourceEmpty(
      "Profit & loss data is not available from the fallback source.",
    ),
    balanceSheet: sectionResult(
      historicalTable("Balance sheet", balanceStats),
      "Balance sheet",
    ),
    cashFlow: sectionResult(
      historicalTable("Cash flow", cashStats),
      "Cash flow",
    ),
    ratios: sectionResult(historicalTable("Ratios", ratioStats), "Ratios"),
    shareholding: sectionResult(
      historicalTable("Shareholding pattern", shareholdingStats),
      "Shareholding",
    ),
    investors: sourceEmpty<InvestorDocuments>(
      "Investor announcements and annual reports were not available.",
    ),
    sources: dataSources(listing, identity),
    generatedAt: new Date().toISOString(),
  };
  return sourceSuccess(data);
}

export async function getPublicListingIntelligence(
  rawQuery: string,
  identity: CompanyIdentity,
): Promise<SourceResult<PublicListingData>> {
  try {
    const resolved = isIndianApiConfigured()
      ? await resolveIndianSymbol(identity.name, rawQuery)
      : null;
    const terms = [
      ...new Set(
        [identity.name, rawQuery].map((value) => value.trim()).filter(Boolean),
      ),
    ];
    // When screener.in is unreachable but IndianAPI resolved a definitive
    // symbol, skip candidate search and serve the listing from the fallback.
    const results = await Promise.all(
      terms.map((term) => searchScreenerCompanies(term)),
    ).catch((error: unknown) => {
      if (resolved) return null;
      throw error;
    });
    const ordered = results
      ? selectScreenerCandidates(results.flat(), identity.name, rawQuery)
      : [];

    for (const candidate of ordered.slice(0, 3)) {
      try {
        const outcome = await indianListing(candidate, identity, resolved);
        if (outcome) return outcome;
      } catch {
        // Page fetch failed or the candidate was rejected by symbol
        // verification; try the next candidate.
      }
    }

    if (resolved) return await indianApiListing(resolved, identity);
    return globalListingBasics(identity);
  } catch (error) {
    return failure(error, "Public listing lookup is unavailable.");
  }
}
