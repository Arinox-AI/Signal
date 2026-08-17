import "server-only";

import { z } from "zod";

import {
  domainSearchTerm,
  extractDomain,
  isOrganizationDescription,
  normalizeCompanyName,
} from "@/lib/company-query";
import { resilientFetch } from "@/lib/http/request";
import type { CompanySuggestion } from "@/lib/types/company";
import { searchLegalEntities } from "@/services/gleif";
import { discoverCompanyWebsites } from "@/services/web-discovery";

const entitySearchSchema = z.object({
  search: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      description: z.string().optional().default("Organization"),
    }),
  ),
});

async function searchWikidata(
  searchTerm: string,
): Promise<CompanySuggestion[]> {
  const url = new URL("https://www.wikidata.org/w/api.php");
  url.search = new URLSearchParams({
    action: "wbsearchentities",
    search: searchTerm,
    language: "en",
    uselang: "en",
    type: "item",
    limit: "14",
    format: "json",
    origin: "*",
  }).toString();
  const response = await resilientFetch(
    url.toString(),
    {},
    { revalidate: 3_600, timeoutMs: 4_500 },
  );
  const payload = entitySearchSchema.parse(await response.json());
  const normalizedSearch = normalizeCompanyName(searchTerm);
  return payload.search
    .filter((item) => {
      const normalizedLabel = normalizeCompanyName(item.label);
      const relevantName =
        normalizedLabel.includes(normalizedSearch) ||
        normalizedSearch.includes(normalizedLabel);
      return relevantName && isOrganizationDescription(item.description);
    })
    .slice(0, 4)
    .map<CompanySuggestion>((item) => ({
      id: item.id,
      name: item.label,
      description: item.description,
      query: item.label,
      source: "wikidata",
    }));
}

export async function searchCompanies(
  rawQuery: string,
): Promise<CompanySuggestion[]> {
  const query = decodeURIComponent(rawQuery).trim().slice(0, 100);
  if (query.length < 2) return [];

  const domain = extractDomain(query);
  const searchTerm = domain ? domainSearchTerm(domain) : query;
  const lookups = await Promise.allSettled([
    searchWikidata(searchTerm),
    domain ? Promise.resolve([]) : searchLegalEntities(searchTerm),
    domain ? Promise.resolve([]) : discoverCompanyWebsites(query),
  ]);
  const [wikidata, legalEntities, websites] = lookups.map((result) =>
    result?.status === "fulfilled" ? result.value : [],
  );
  const suggestions = [
    ...(wikidata ?? []).slice(0, 3),
    ...(websites ?? []).slice(0, 2),
    ...(legalEntities ?? []).slice(0, 3),
  ];

  const merged = domain
    ? [
        ...suggestions,
        {
          id: `domain:${domain}`,
          name: domain,
          description: "Research this official company domain",
          query: domain,
          source: "domain" as const,
        },
      ]
    : suggestions;
  return merged
    .filter(
      (item, index, list) =>
        list.findIndex(
          (candidate) =>
            normalizeCompanyName(candidate.name) ===
            normalizeCompanyName(item.name),
        ) === index,
    )
    .slice(0, 8);
}
