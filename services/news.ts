import "server-only";

import { XMLParser } from "fast-xml-parser";

import { resilientFetch } from "@/lib/http/request";
import type { NewsItem } from "@/lib/types/company";

type RecordValue = Record<string, unknown>;
const isRecord = (value: unknown): value is RecordValue =>
  typeof value === "object" && value !== null;
const text = (value: unknown) =>
  typeof value === "string"
    ? value
    : isRecord(value) && typeof value["#text"] === "string"
      ? value["#text"]
      : "";

/** News older than this is "not recent" — PLAN §2.4 (30/90-day window). */
const RECENT_WINDOW_MS = 90 * 24 * 60 * 60 * 1_000;

async function readNewsFeed(query: string, limit: number): Promise<NewsItem[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
  const response = await resilientFetch(
    url,
    { headers: { Accept: "application/rss+xml, application/xml, text/xml" } },
    { revalidate: 600, timeoutMs: 5_500 },
  );
  const parsed = new XMLParser({ ignoreAttributes: false }).parse(
    await response.text(),
  ) as unknown;
  if (
    !isRecord(parsed) ||
    !isRecord(parsed.rss) ||
    !isRecord(parsed.rss.channel)
  )
    return [];
  const rawItems = parsed.rss.channel.item;
  const items = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];
  const recentThreshold = Date.now() - RECENT_WINDOW_MS;
  return items
    .filter(isRecord)
    .flatMap((item, index) => {
      const title = text(item.title);
      const link = text(item.link);
      if (!title || !link) return [];
      const source = text(item.source) || "News";
      const publishedAt = text(item.pubDate) || new Date().toISOString();
      const publishedTime = new Date(publishedAt).getTime();
      if (!Number.isFinite(publishedTime) || publishedTime < recentThreshold)
        return [];
      const sourceSuffix = ` - ${source}`;
      const cleanTitle = (
        title.endsWith(sourceSuffix)
          ? title.slice(0, -sourceSuffix.length)
          : title
      ).replace(/[\s-]+$/, "");
      return [
        {
          id: `${index}-${title.slice(0, 30)}`,
          title: cleanTitle,
          url: link,
          source,
          publishedAt: new Date(publishedAt).toISOString(),
        },
      ];
    })
    .slice(0, limit);
}

/**
 * Merges several feeds into one deduped, most-recent-first list. Titles are
 * compared loosely (lowercased) so the same story from two queries appears
 * once. Pure — unit-tested.
 */
export function mergeNewsFeeds(feeds: NewsItem[][], limit: number): NewsItem[] {
  const seen = new Set<string>();
  const merged: NewsItem[] = [];
  for (const feed of feeds) {
    for (const item of feed) {
      const key = item.title.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
    }
  }
  return merged
    .sort(
      (left, right) =>
        new Date(right.publishedAt).getTime() -
        new Date(left.publishedAt).getTime(),
    )
    .slice(0, limit);
}

/** Runs an arbitrary Google News RSS query, most-recent-first, ≤ `limit`. */
export async function searchNews(
  query: string,
  limit: number,
): Promise<NewsItem[]> {
  return readNewsFeed(query, limit);
}

export async function getCompanyNews(
  companyName: string,
  countryName: string | null = null,
): Promise<NewsItem[]> {
  const context = countryName ? ` "${countryName}"` : " company";
  return searchNews(`"${companyName}"${context}`, 8);
}

const TECH_FEED_QUERIES = (companyName: string) => [
  `"${companyName}" (AI OR "artificial intelligence" OR "machine learning" OR "deep learning" OR "large language model" OR "generative AI" OR chatbot OR automation OR robotics)`,
  `"${companyName}" (software OR cloud OR cybersecurity OR "tech stack" OR infrastructure OR "data center" OR "technology platform")`,
];

/**
 * Title-level signal classification for the AI/tech feed. Google News RSS
 * OR-queries match anywhere in an article, so generic business coverage
 * ("shares rise", "Q1 results") leaks in otherwise. Every item must match one
 * of these to be shown, and finance-only stories are rejected. Pure —
 * unit-tested.
 */
const AI_SIGNAL =
  /\b(ai|a\.i\.|artificial intelligence|machine learning|deep learning|large language model|generative ai|genai|llm|chatbot|automation|robotics|computer vision|nlp)\b/i;
const TECH_SIGNAL =
  /\b(software|cloud|cybersecurity|cyber security|tech stack|technology platform|data center|datacenter|infrastructure|digital transformation|r&d|research and development|technology|unveils?|launch(es|ed|ing)?|upgrade|migrat(e|ion|ing)?)\b/i;
const FINANCE_NOISE =
  /\b(shares?|stock|dividend|buyback|q[1-4]|quarter|earnings|revenue|profit|margin|rating|target price|analysts?|outperform|underperform|adr|gdr|ichimoku|bollinger|rsi\b|moving average|breakout|resistance|support level|rs[ .]|₹)\b/i;

export function techNewsKind(title: string): "ai" | "tech" | null {
  if (AI_SIGNAL.test(title)) return "ai";
  if (TECH_SIGNAL.test(title) && !FINANCE_NOISE.test(title)) return "tech";
  return null;
}

/**
 * Dedicated AI/technology coverage for a company: two parallel Google News
 * RSS queries (AI-focused and technology-focused) filtered by title so only
 * real AI/tech signals survive, then merged into one most-recent-first feed.
 */
export async function getCompanyTechNews(
  companyName: string,
  limit = 10,
): Promise<NewsItem[]> {
  const feeds: NewsItem[][] = (
    await Promise.allSettled(
      TECH_FEED_QUERIES(companyName).map((query) =>
        readNewsFeed(query, 20).then((items) =>
          items.flatMap((item) => {
            const kind = techNewsKind(item.title);
            return kind ? [{ ...item, kind }] : [];
          }),
        ),
      ),
    )
  ).flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
  return mergeNewsFeeds(feeds, limit);
}
