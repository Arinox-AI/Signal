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

export async function getCompanyNews(
  companyName: string,
  countryName: string | null = null,
): Promise<NewsItem[]> {
  const context = countryName ? ` "${countryName}"` : " company";
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(`"${companyName}"${context}`)}&hl=en-US&gl=US&ceid=US:en`;
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
  const recentThreshold = Date.now() - 5 * 365.25 * 24 * 60 * 60 * 1_000;
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
    .slice(0, 8);
}
