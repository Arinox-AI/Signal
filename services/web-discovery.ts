import "server-only";

import { extractDomain } from "@/lib/company-query";
import { resilientFetch } from "@/lib/http/request";
import type { CompanySuggestion } from "@/lib/types/company";

const BLOCKED_HOSTS = [
  "bloomberg.com",
  "crunchbase.com",
  "dnb.com",
  "facebook.com",
  "github.com",
  "instagram.com",
  "linkedin.com",
  "signalhire.com",
  "wikipedia.org",
  "x.com",
  "youtube.com",
  "zoominfo.com",
] as const;

function decodeHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&mdash;|&#x2014;/g, "—")
    .replace(/&ndash;|&#x2013;/g, "–")
    .replace(/\s+/g, " ")
    .trim();
}

function resultUrl(rawHref: string): URL | null {
  try {
    const href = decodeHtml(rawHref);
    const redirect = new URL(
      href.startsWith("//") ? `https:${href}` : href,
      "https://duckduckgo.com",
    );
    const destination = redirect.searchParams.get("uddg");
    const url = new URL(destination ?? redirect.toString());
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

function companyNameFromTitle(title: string, hostname: string): string {
  const candidate = title.split(/\s+(?:[|–—:-])\s+/)[0]?.trim();
  if (candidate && candidate.length >= 2 && candidate.length <= 80)
    return candidate;
  const domainName = hostname.split(".")[0] ?? hostname;
  return domainName
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export async function discoverCompanyWebsites(
  rawQuery: string,
): Promise<CompanySuggestion[]> {
  const query = rawQuery.trim().slice(0, 100);
  if (query.length < 2 || extractDomain(query)) return [];

  const url = new URL("https://html.duckduckgo.com/html/");
  url.searchParams.set("q", `${query} official company website`);
  const response = await resilientFetch(
    url.toString(),
    { headers: { Accept: "text/html" } },
    { revalidate: 21_600, timeoutMs: 6_000, retries: 0 },
  );
  const html = await response.text();
  const matches = html.matchAll(
    /class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g,
  );
  const queryTokens = query
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3);
  const suggestions: CompanySuggestion[] = [];
  const seenHosts = new Set<string>();

  for (const match of matches) {
    const target = resultUrl(match[1] ?? "");
    const title = decodeHtml(match[2] ?? "");
    if (!target || !title) continue;
    const hostname = target.hostname.replace(/^www\./, "").toLowerCase();
    if (
      seenHosts.has(hostname) ||
      BLOCKED_HOSTS.some(
        (blocked) => hostname === blocked || hostname.endsWith(`.${blocked}`),
      )
    )
      continue;
    const normalizedTitle = title.toLowerCase();
    const tokenMatches = queryTokens.filter((token) =>
      normalizedTitle.includes(token),
    ).length;
    const requiredMatches = queryTokens.length <= 1 ? 1 : 2;
    if (tokenMatches < requiredMatches) continue;

    seenHosts.add(hostname);
    suggestions.push({
      id: `web:${hostname}`,
      name: companyNameFromTitle(title, hostname),
      description: `${hostname} · Official website candidate`,
      query: hostname,
      source: "web",
    });
    if (suggestions.length === 2) break;
  }

  return suggestions;
}
