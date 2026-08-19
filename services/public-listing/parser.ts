import { load, type CheerioAPI } from "cheerio";
import type { Element } from "domhandler";

import type {
  FinancialTable,
  InvestorDocument,
  InvestorDocuments,
  ListingChart,
  ListingCell,
  ListingExchange,
  ListingSnapshot,
  PeerComparison,
  PricePoint,
} from "@/lib/types/public-listing";

export interface ParsedScreenerPage {
  companyName: string;
  companyId: string | null;
  warehouseId: string | null;
  consolidated: boolean;
  isin: string | null;
  exchanges: ListingExchange[];
  snapshot: ListingSnapshot | null;
  tables: {
    quarters: FinancialTable | null;
    profitLoss: FinancialTable | null;
    balanceSheet: FinancialTable | null;
    cashFlow: FinancialTable | null;
    ratios: FinancialTable | null;
    shareholding: FinancialTable | null;
  };
  investors: InvestorDocuments;
}

const SECTION_TITLES = {
  quarters: "Quarterly results",
  profitLoss: "Profit & loss",
  balanceSheet: "Balance sheet",
  cashFlow: "Cash flow",
  ratios: "Ratios",
  shareholding: "Shareholding pattern",
} as const;

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function parseNumber(value: string): number | null {
  const normalized = cleanText(value);
  if (!normalized || /^[-–—]$/.test(normalized) || /^n\/?a$/i.test(normalized))
    return null;
  const negative = normalized.startsWith("(") && normalized.endsWith(")");
  const numberText = normalized
    .replace(/[₹$€£,%]/g, "")
    .replace(/[()]/g, "")
    .replace(/,/g, "")
    .match(/[-+]?\d*\.?\d+/)?.[0];
  if (!numberText) return null;
  const parsed = Number(numberText);
  if (!Number.isFinite(parsed)) return null;
  return negative ? -Math.abs(parsed) : parsed;
}

function parseCell(value: string): ListingCell {
  const normalized = cleanText(value);
  if (!normalized || /^[-–—]$/.test(normalized)) return null;
  if (normalized.includes("%")) return normalized;
  return parseNumber(normalized) ?? normalized;
}

function absoluteUrl(
  value: string | undefined,
  baseUrl: string,
): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, baseUrl);
    return /^https?:$/.test(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

function firstNumber(value: string): number | null {
  return parseNumber(value.match(/[-+]?\(?[\d,]+(?:\.\d+)?\)?/)?.[0] ?? "");
}

function metricValue(
  metrics: Map<string, string>,
  label: string,
): number | null {
  const value = metrics.get(label.toLowerCase());
  return value ? firstNumber(value) : null;
}

function metricText(metrics: Map<string, string>, label: string): string {
  return metrics.get(label.toLowerCase()) ?? "";
}

function parseSnapshot($: CheerioAPI): ListingSnapshot | null {
  const ratioItems = $("#top-ratios li");
  if (!ratioItems.length) return null;
  const metrics = new Map<string, string>();
  ratioItems.each((_, item) => {
    const label = cleanText($(item).find(".name").text()).toLowerCase();
    const value = cleanText($(item).find(".value").text());
    if (label) metrics.set(label, value);
  });

  const highLow = metricText(metrics, "high / low").match(
    /[-+]?\(?[\d,]+(?:\.\d+)?\)?/g,
  );
  const changeText = cleanText($("#top .font-size-12").first().text());
  const unitText = cleanText($("#quarters .sub").first().text());
  const unitMatch = unitText.match(/in\s+(.+?)(?:\s+\/|$)/i);
  const currency =
    unitText.includes("₹") || $("body").text().includes("₹")
      ? "INR"
      : "Unknown";

  return {
    currency,
    unit: unitMatch?.[1]?.trim() ?? "Reported units",
    currentPrice: metricValue(metrics, "current price"),
    changePercent: firstNumber(changeText),
    marketCap: metricValue(metrics, "market cap"),
    pe: metricValue(metrics, "stock p/e"),
    bookValue: metricValue(metrics, "book value"),
    dividendYield: metricValue(metrics, "dividend yield"),
    roce: metricValue(metrics, "roce"),
    roe: metricValue(metrics, "roe"),
    faceValue: metricValue(metrics, "face value"),
    high52Week: highLow?.[0] ? firstNumber(highLow[0]) : null,
    low52Week: highLow?.[1] ? firstNumber(highLow[1]) : null,
    asOf: null,
  };
}

function parseTable(
  $: CheerioAPI,
  sectionId: keyof typeof SECTION_TITLES,
  sourceUrl: string,
): FinancialTable | null {
  const section = $(
    `#${sectionId === "profitLoss" ? "profit-loss" : sectionId === "balanceSheet" ? "balance-sheet" : sectionId}`,
  );
  const table = section.find("table.data-table").first();
  if (!table.length) return null;

  const headers = table
    .find("thead tr")
    .last()
    .find("th")
    .map((_, cell) => cleanText($(cell).text()))
    .toArray()
    .slice(1)
    .filter(Boolean);
  if (!headers.length) return null;

  const rows: FinancialTable["rows"] = [];
  table.find("tbody tr").each((_, row) => {
    const cells = $(row).find("td");
    if (!cells.length) return;
    const label = cleanText($(cells[0]).text()).replace(/\s*\+\s*$/, "");
    if (!label || /^raw pdf$/i.test(label)) return;
    const values: ListingCell[] = cells
      .slice(1)
      .map((_, cell) => parseCell($(cell).text()))
      .toArray();
    while (values.length < headers.length) values.push(null);
    rows.push({ label, values: values.slice(0, headers.length) });
  });
  if (!rows.length) return null;

  const unitText = cleanText(section.find(".sub").first().text());
  const unit = unitText.match(/in\s+(.+?)(?:\s+\/|$)/i)?.[1]?.trim() ?? null;
  return {
    title: SECTION_TITLES[sectionId],
    unit,
    periods: headers,
    rows,
    sourceUrl,
  };
}

function parseExchangeLinks($: CheerioAPI, baseUrl: string): ListingExchange[] {
  const exchanges: ListingExchange[] = [];
  $("a[href]").each((_, anchor) => {
    const href = absoluteUrl($(anchor).attr("href"), baseUrl);
    if (!href) return;
    const text = cleanText($(anchor).text());
    if (/bseindia\.com/i.test(href)) {
      const securityId = href.match(/\/([0-9]{6})\/?$/)?.[1] ?? null;
      if (!exchanges.some((item) => item.name === "BSE"))
        exchanges.push({
          name: "BSE",
          symbol: text.match(/BSE\s*:\s*([A-Z0-9-]+)/i)?.[1] ?? null,
          securityId,
          url: href,
        });
    } else if (/nseindia\.com/i.test(href)) {
      const symbol = new URL(href).searchParams.get("symbol");
      if (!exchanges.some((item) => item.name === "NSE"))
        exchanges.push({
          name: "NSE",
          symbol: symbol ?? text.match(/NSE\s*:\s*([A-Z0-9-]+)/i)?.[1] ?? null,
          securityId: null,
          url: href,
        });
    }
  });
  return exchanges;
}

function parseIsin($: CheerioAPI): string | null {
  const match = cleanText($("body").text()).match(
    /\bISIN\s*[:\-]?\s*([A-Z]{2}[A-Z0-9]{10})\b/i,
  );
  return match?.[1]?.toUpperCase() ?? null;
}

function documentText($: CheerioAPI, element: Element): string {
  return cleanText($(element).text());
}

function linkTitle($: CheerioAPI, element: Element): string {
  const copy = $(element).clone();
  copy.find("div").remove();
  return cleanText(copy.text());
}

function parseDocuments($: CheerioAPI, baseUrl: string): InvestorDocuments {
  const documents: InvestorDocument[] = [];
  const annualReports: InvestorDocument[] = [];
  const add = (document: InvestorDocument) => {
    if (
      !documents.some(
        (item) => item.url === document.url && item.type === document.type,
      )
    )
      documents.push(document);
  };

  $(
    "#documents .documents:not(.annual-reports):not(.credit-ratings):not(.concalls) ul.list-links li a",
  ).each((_, anchor) => {
    const url = absoluteUrl($(anchor).attr("href"), baseUrl);
    if (!url) return;
    add({
      type: "announcement",
      title: linkTitle($, anchor),
      description: cleanText($(anchor).find("div").first().text()) || null,
      date: null,
      source: null,
      url,
    });
  });

  $("#documents .annual-reports ul.list-links li a").each((_, anchor) => {
    const url = absoluteUrl($(anchor).attr("href"), baseUrl);
    if (!url) return;
    const title = linkTitle($, anchor);
    const source = cleanText($(anchor).find("div").text()) || null;
    const report = {
      type: "annual_report" as const,
      title,
      description: null,
      date: title.match(/\d{4}/)?.[0] ?? null,
      source,
      url,
    };
    annualReports.push(report);
    add(report);
  });

  $("#documents .credit-ratings ul.list-links li a").each((_, anchor) => {
    const url = absoluteUrl($(anchor).attr("href"), baseUrl);
    if (!url) return;
    const title = linkTitle($, anchor);
    const detail = cleanText($(anchor).find("div").text());
    const parts = detail.match(/(.+?)\s+from\s+(.+)/i);
    add({
      type: "credit_rating",
      title,
      description: null,
      date: (parts?.[1]?.trim() ?? detail) || null,
      source: parts?.[2]?.trim() ?? null,
      url,
    });
  });

  $("#documents .concalls ul.list-links li").each((_, item) => {
    const month = cleanText($(item).find(":scope > div").first().text());
    $(item)
      .find("a[href]")
      .each((_, anchor) => {
        const url = absoluteUrl($(anchor).attr("href"), baseUrl);
        if (!url) return;
        const label = documentText($, anchor).toLowerCase();
        const type = label.includes("transcript")
          ? "concall_transcript"
          : label === "ppt" || label.includes("presentation")
            ? "investor_presentation"
            : "recording";
        add({
          type,
          title: `${month || "Investor call"} ${label || "recording"}`,
          description: null,
          date: month || null,
          source: null,
          url,
        });
      });
  });

  const investorRelationsUrl =
    $("a[href]")
      .map((_, anchor) => {
        const href = absoluteUrl($(anchor).attr("href"), baseUrl);
        const label = cleanText($(anchor).text());
        return href && /investor|financial results|shareholder/i.test(label)
          ? href
          : null;
      })
      .toArray()
      .find(Boolean) ?? null;

  return { investorRelationsUrl, documents, annualReports };
}

export function parseScreenerPage(
  html: string,
  screenerUrl: string,
): ParsedScreenerPage {
  const $ = load(html);
  const companyInfo = $("#company-info");
  const companyName =
    cleanText($("#top h1").first().text()) ||
    cleanText($("title").text()).split(" share price")[0] ||
    "Listed company";
  const tableUrl = screenerUrl;
  return {
    companyName,
    companyId: companyInfo.attr("data-company-id") ?? null,
    warehouseId: companyInfo.attr("data-warehouse-id") ?? null,
    consolidated: companyInfo.attr("data-consolidated") === "true",
    isin: parseIsin($),
    exchanges: parseExchangeLinks($, screenerUrl),
    snapshot: parseSnapshot($),
    tables: {
      quarters: parseTable($, "quarters", tableUrl),
      profitLoss: parseTable($, "profitLoss", tableUrl),
      balanceSheet: parseTable($, "balanceSheet", tableUrl),
      cashFlow: parseTable($, "cashFlow", tableUrl),
      ratios: parseTable($, "ratios", tableUrl),
      shareholding: parseTable($, "shareholding", tableUrl),
    },
    investors: parseDocuments($, screenerUrl),
  };
}

function chartNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  return typeof value === "string" ? parseNumber(value) : null;
}

export function parseChartPayload(
  payload: unknown,
  sourceUrl: string,
  periodDays: number,
): ListingChart | null {
  if (typeof payload !== "object" || payload === null) return null;
  const datasets = (payload as { datasets?: unknown }).datasets;
  if (!Array.isArray(datasets)) return null;
  const points = new Map<string, PricePoint>();
  for (const dataset of datasets) {
    if (typeof dataset !== "object" || dataset === null) continue;
    const metric = String((dataset as { metric?: unknown }).metric ?? "");
    const values = (dataset as { values?: unknown }).values;
    if (!Array.isArray(values)) continue;
    for (const value of values) {
      if (!Array.isArray(value) || typeof value[0] !== "string") continue;
      const date = value[0];
      const point = points.get(date) ?? {
        date,
        price: null,
        dma50: null,
        dma200: null,
        volume: null,
      };
      const number = chartNumber(value[1]);
      if (/^price$/i.test(metric)) point.price = number;
      else if (/dma50/i.test(metric)) point.dma50 = number;
      else if (/dma200/i.test(metric)) point.dma200 = number;
      else if (/volume/i.test(metric)) point.volume = number;
      points.set(date, point);
    }
  }
  const chartPoints = [...points.values()].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  if (!chartPoints.length) return null;
  return {
    points: chartPoints,
    periodDays,
    sourceUrl,
    asOf: chartPoints.at(-1)?.date ?? null,
  };
}

export function parsePeerHtml(
  html: string,
  sourceUrl: string,
): PeerComparison | null {
  const $ = load(html);
  const table = $("table.data-table").first();
  if (!table.length) return null;
  const headers = table
    .find("thead th")
    .map((_, cell) => cleanText($(cell).text()))
    .toArray();
  const companies: PeerComparison["companies"] = [];
  table.find("tbody tr[data-row-company-id]").each((_, row) => {
    const cells = $(row).find("td");
    if (cells.length < 2) return;
    const nameLink = $(cells[1]).find("a").first();
    const name = cleanText(nameLink.text() || $(cells[1]).text());
    if (!name) return;
    const metrics: Record<string, ListingCell> = {};
    cells.slice(2).each((index, cell) => {
      const label = headers[index + 2] || `Metric ${index + 1}`;
      metrics[label] = parseCell($(cell).text());
    });
    companies.push({
      name,
      url: absoluteUrl(nameLink.attr("href"), sourceUrl),
      metrics,
    });
  });

  const median: Record<string, ListingCell> = {};
  table
    .find("tfoot tr")
    .last()
    .find("td")
    .each((index, cell) => {
      const label = headers[index + 1];
      if (label) median[label] = parseCell($(cell).text());
    });
  if (!companies.length) return null;
  return { headers, companies, median, sourceUrl };
}
