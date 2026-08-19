import "server-only";

import { z } from "zod";

import { companyMatchRank } from "@/lib/company-query";
import { resilientFetch } from "@/lib/http/request";
import type { ListingChart } from "@/lib/types/public-listing";
import { parseChartPayload } from "@/services/public-listing/parser";

/**
 * Optional companion source for Indian listings. Two roles:
 *
 * 1. Definitive symbol resolution: the Screener search API returns only
 *    display names, which collide across group companies (Tata, Reliance,
 *    Birla ...). IndianAPI returns explicit NSE/BSE exchange codes, the
 *    strongest possible "this is the definite company" signal.
 * 2. Outage fallback: when screener.in is unreachable, snapshot, chart and
 *    financial tables can be served from IndianAPI.
 *
 * Everything here is gated on INDIANAPI_API_KEY being set; without a key the
 * functions degrade to null/empty and screener.in remains the only source.
 */

export const INDIAN_API_DEFAULT_BASE = "https://stock.indianapi.in";

function indianApiConfig(): { baseUrl: string; apiKey: string } | null {
  const apiKey = process.env.INDIANAPI_API_KEY?.trim();
  if (!apiKey) return null;
  const baseUrl = (
    process.env.INDIANAPI_BASE_URL?.trim() ?? INDIAN_API_DEFAULT_BASE
  ).replace(/\/+$/, "");
  return { baseUrl, apiKey };
}

export function isIndianApiConfigured(): boolean {
  return indianApiConfig() !== null;
}

function normalSymbol(value: string | null | undefined): string | null {
  const symbol = value?.trim().toUpperCase();
  if (!symbol) return null;
  return symbol.replace(/\.(NS|BO|NSE|BSE)$/i, "");
}

interface IndianApiResponse<T> {
  url: string;
  data: T;
}

async function indianApiGet<T>(
  path: string,
  params: Record<string, string>,
  revalidate: number,
  timeoutMs: number,
): Promise<IndianApiResponse<T> | null> {
  const config = indianApiConfig();
  if (!config) return null;
  const url = new URL(`${config.baseUrl}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  try {
    const response = await resilientFetch(
      url.toString(),
      { headers: { "x-api-key": config.apiKey } },
      { revalidate, timeoutMs },
    );
    return { url: url.toString(), data: (await response.json()) as T };
  } catch {
    return null;
  }
}

const stockSearchItemSchema = z.object({
  id: z.string().optional(),
  commonName: z.string().optional().default(""),
  exchangeCodeNse: z.string().optional().nullable(),
  exchangeCodeBse: z.string().optional().nullable(),
});

export interface IndianStockMatch {
  name: string;
  nseSymbol: string | null;
  bseSymbol: string | null;
  id: string | null;
}

export interface ResolvedIndianListing {
  name: string;
  nseSymbol: string | null;
  bseSymbol: string | null;
  id: string | null;
}

export async function searchIndianStocks(
  searchTerm: string,
): Promise<IndianStockMatch[]> {
  const response = await indianApiGet<unknown>(
    "/industry_search",
    { query: searchTerm.slice(0, 100) },
    3_600,
    5_500,
  );
  if (!response || !Array.isArray(response.data)) return [];
  return response.data.flatMap((item) => {
    const parsed = stockSearchItemSchema.safeParse(item);
    if (!parsed.success) return [];
    const name = parsed.data.commonName;
    if (!name) return [];
    return [
      {
        name,
        nseSymbol: normalSymbol(parsed.data.exchangeCodeNse),
        bseSymbol: normalSymbol(parsed.data.exchangeCodeBse),
        id: parsed.data.id ?? null,
      },
    ];
  });
}

/**
 * Resolves the searched company to a definitive listed entity using IndianAPI
 * search plus the strict name ladder. Only rank 0 (exact) and rank 1 (token
 * superset within scope qualifiers) count as definite; prefix/contains
 * matches are deliberately NOT used here.
 */
export async function resolveIndianSymbol(
  identityName: string,
  query: string,
): Promise<ResolvedIndianListing | null> {
  const terms = [
    ...new Set(
      [identityName, query].map((value) => value.trim()).filter(Boolean),
    ),
  ];
  for (const term of terms) {
    const results = await searchIndianStocks(term);
    const ordered = results
      .map((match) => ({ match, rank: companyMatchRank(term, match.name) }))
      .filter(
        (item): item is { match: IndianStockMatch; rank: 0 | 1 } =>
          item.rank === 0 || item.rank === 1,
      )
      .sort((left, right) => left.rank - right.rank);
    const best = ordered[0];
    if (!best) continue;
    return {
      name: best.match.name,
      nseSymbol: best.match.nseSymbol,
      bseSymbol: best.match.bseSymbol,
      id: best.match.id,
    };
  }
  return null;
}

export interface IndianStockOverview {
  name: string;
  tickerId: string | null;
  currentPriceNse: number | null;
  currentPriceBse: number | null;
  percentChange: number | null;
  yearHigh: number | null;
  yearLow: number | null;
  keyMetrics: Record<string, unknown>;
}

export function overviewNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[,%₹\s]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

const overviewSchema = z
  .object({
    tickerId: z.string().optional().nullable(),
    companyName: z.string().optional().default(""),
    currentPrice: z.record(z.string(), z.unknown()).optional(),
    percentChange: z.unknown().optional(),
    yearHigh: z.unknown().optional(),
    yearLow: z.unknown().optional(),
    keyMetrics: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export async function fetchStockOverview(
  stockName: string,
): Promise<IndianStockOverview | null> {
  const response = await indianApiGet<unknown>(
    "/stock",
    { name: stockName.slice(0, 100) },
    900,
    7_000,
  );
  const parsed = overviewSchema.safeParse(response?.data);
  if (!parsed.success) return null;
  const price = parsed.data.currentPrice ?? {};
  return {
    name: parsed.data.companyName || stockName,
    tickerId: parsed.data.tickerId ?? null,
    currentPriceNse:
      overviewNumber(price.NSE) ?? overviewNumber(price["NSE Equity"]),
    currentPriceBse:
      overviewNumber(price.BSE) ?? overviewNumber(price["BSE Equity"]),
    percentChange: overviewNumber(parsed.data.percentChange),
    yearHigh: overviewNumber(parsed.data.yearHigh),
    yearLow: overviewNumber(parsed.data.yearLow),
    keyMetrics: parsed.data.keyMetrics ?? {},
  };
}

export type IndianHistoricalStat =
  | "quarter_results"
  | "yoy_results"
  | "balancesheet"
  | "cashflow"
  | "ratios"
  | "shareholding_pattern_quarterly"
  | "shareholding_pattern_yearly";

const statsSchema = z.record(
  z.string(),
  z.record(z.string(), z.union([z.number(), z.string()])),
);

/**
 * Returns historical statement rows: metric label -> { period -> value }.
 * Period keys keep their original (chronological) order because JSON object
 * keys preserve insertion order.
 */
export async function fetchHistoricalStats(
  stockName: string,
  stats: IndianHistoricalStat,
): Promise<{
  url: string;
  rows: Record<string, Record<string, number | string>>;
} | null> {
  const response = await indianApiGet<unknown>(
    "/historical_stats",
    { stock_name: stockName.slice(0, 100), stats },
    900,
    7_000,
  );
  if (!response || typeof response.data !== "object" || response.data === null)
    return null;
  const parsed = statsSchema.safeParse(response.data);
  return parsed.success ? { url: response.url, rows: parsed.data } : null;
}

export const CHART_PERIODS: Record<number, string> = {
  365: "1yr",
  1_095: "3yr",
  1_825: "5yr",
  3_652: "10yr",
};

export async function fetchIndianChart(
  stockName: string,
  periodDays: number,
): Promise<ListingChart | null> {
  const period = CHART_PERIODS[periodDays] ?? "5yr";
  const response = await indianApiGet<unknown>(
    "/historical_data",
    { stock_name: stockName.slice(0, 100), period, filter: "default" },
    900,
    7_000,
  );
  if (!response || typeof response.data !== "object" || response.data === null)
    return null;
  const chart = parseChartPayload(response.data, response.url, periodDays);
  return chart && chart.points.length ? chart : null;
}
