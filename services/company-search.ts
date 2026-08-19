import "server-only";

import { z } from "zod";

import {
  companyMatchRank,
  domainSearchTerm,
  extractDomain,
  isOrganizationDescription,
  normalizeCompanyName,
  type CompanyMatchRank,
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

const listingClaimsSchema = z.object({
  entities: z
    .record(
      z.string(),
      z.object({
        claims: z.record(z.string(), z.array(z.unknown())).optional(),
      }),
    )
    .optional(),
});

type RecordValue = Record<string, unknown>;
const isRecord = (value: unknown): value is RecordValue =>
  typeof value === "object" && value !== null && !Array.isArray(value);

interface WikidataItemContext {
  listed: boolean;
  parentId: string | null;
}

function firstItemClaimId(
  entity: unknown,
  properties: string[],
): string | null {
  if (!isRecord(entity) || !isRecord(entity.claims)) return null;
  for (const property of properties) {
    const claims = entity.claims[property];
    if (!Array.isArray(claims)) continue;
    for (const claim of claims) {
      if (
        isRecord(claim) &&
        isRecord(claim.mainsnak) &&
        isRecord(claim.mainsnak.datavalue) &&
        isRecord(claim.mainsnak.datavalue.value) &&
        typeof claim.mainsnak.datavalue.value.id === "string"
      ) {
        return claim.mainsnak.datavalue.value.id;
      }
    }
  }
  return null;
}

/**
 * Lists which wikidata items are listed companies, and which carry a parent
 * organization. An entity counts as listed when it carries a stock-exchange
 * (P414) or ISIN (P249) claim; the parent is the first of P749 (parent
 * organization), P127 (owned by), P361 (part of). Both dimensions are
 * batch-fetched in a single request, with one label lookup for the parents.
 */
async function wikidataItemContexts(
  ids: string[],
): Promise<Map<string, WikidataItemContext>> {
  const url = new URL("https://www.wikidata.org/w/api.php");
  url.search = new URLSearchParams({
    action: "wbgetentities",
    ids: ids.join("|"),
    props: "claims",
    format: "json",
    origin: "*",
  }).toString();
  let entities: z.infer<typeof listingClaimsSchema>["entities"] = undefined;
  try {
    const response = await resilientFetch(
      url.toString(),
      {},
      { revalidate: 86_400, timeoutMs: 4_500 },
    );
    const payload = listingClaimsSchema.parse(await response.json());
    entities = payload.entities ?? {};
  } catch {
    return new Map();
  }

  const contexts = new Map<string, WikidataItemContext>();
  const parentIds = new Set<string>();
  for (const [id, entity] of Object.entries(entities ?? {})) {
    const claims = entity?.claims ?? {};
    const listed = ["P414", "P249"].some(
      (property) => (claims[property]?.length ?? 0) > 0,
    );
    const parentId = firstItemClaimId(entity, ["P749", "P127", "P361"]);
    if (parentId) parentIds.add(parentId);
    contexts.set(id, { listed, parentId });
  }

  let parentLabels: Record<string, string> = {};
  const humanParentIds = new Set<string>();
  if (parentIds.size > 0) {
    const labelsUrl = new URL("https://www.wikidata.org/w/api.php");
    labelsUrl.search = new URLSearchParams({
      action: "wbgetentities",
      ids: [...parentIds].join("|"),
      props: "labels|claims",
      format: "json",
      origin: "*",
    }).toString();
    try {
      const response = await resilientFetch(
        labelsUrl.toString(),
        {},
        { revalidate: 86_400, timeoutMs: 4_500 },
      );
      const payload = (await response.json()) as unknown;
      if (isRecord(payload) && isRecord(payload.entities)) {
        parentLabels = Object.fromEntries(
          Object.entries(payload.entities).flatMap(([id, value]) =>
            isRecord(value) &&
            isRecord(value.labels) &&
            isRecord(value.labels.en) &&
            typeof value.labels.en.value === "string"
              ? [[id, value.labels.en.value]]
              : [],
          ),
        );
        for (const [id, value] of Object.entries(payload.entities)) {
          if (
            isRecord(value) &&
            isRecord(value.claims) &&
            Array.isArray(value.claims.P31) &&
            value.claims.P31.some((claim) => {
              if (
                !isRecord(claim) ||
                !isRecord(claim.mainsnak) ||
                !isRecord(claim.mainsnak.datavalue)
              )
                return false;
              const item = claim.mainsnak.datavalue.value;
              return isRecord(item) && item.id === "Q5";
            })
          ) {
            humanParentIds.add(id);
          }
        }
      }
    } catch {
      parentLabels = {};
    }
  }

  for (const context of contexts.values()) {
    context.parentId =
      context.parentId && !humanParentIds.has(context.parentId)
        ? (parentLabels[context.parentId] ?? null)
        : null;
  }
  return contexts;
}

/**
 * Orders suggestions for display: listed companies first (only they carry
 * verified exchange data on the report page), then by name-match rank, then
 * original order. Purely generic ordering — no company names are special-cased.
 */
export function orderSuggestions<
  T extends { rank: CompanyMatchRank | null; listed?: boolean },
>(items: T[]): T[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort(
      (left, right) =>
        Number(right.item.listed ?? false) -
          Number(left.item.listed ?? false) ||
        (left.item.rank ?? 4) - (right.item.rank ?? 4) ||
        left.index - right.index,
    )
    .map(({ item }) => item);
}

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
  const ranked = payload.search
    .filter((item) => {
      const normalizedLabel = normalizeCompanyName(item.label);
      const relevantName =
        normalizedLabel.includes(normalizedSearch) ||
        normalizedSearch.includes(normalizedLabel);
      return relevantName && isOrganizationDescription(item.description);
    })
    .map((item) => ({ item, rank: companyMatchRank(searchTerm, item.label) }))
    .filter((entry) => entry.rank !== null)
    .sort((left, right) => (left.rank ?? 4) - (right.rank ?? 4))
    .slice(0, 6);
  const listedIds = await wikidataItemContexts(
    ranked.map(({ item }) => item.id),
  );
  return orderSuggestions(
    ranked.map(({ item, rank }) => ({
      item,
      rank,
      listed: listedIds.get(item.id)?.listed ?? false,
    })),
  )
    .slice(0, 4)
    .map<CompanySuggestion>(({ item, listed }) => ({
      id: item.id,
      name: item.label,
      description: item.description,
      query: item.label,
      source: "wikidata",
      listed: listed || undefined,
      parentName: listedIds.get(item.id)?.parentId ?? undefined,
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
