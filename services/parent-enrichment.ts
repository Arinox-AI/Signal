import "server-only";

import {
  companyMatchRank,
  isOrganizationDescription,
} from "@/lib/company-query";
import {
  sourceEmpty,
  sourceSuccess,
  sourceUnavailable,
} from "@/lib/data/source-result";
import { resilientFetch } from "@/lib/http/request";
import type {
  CompanyIdentity,
  NewsItem,
  SourceResult,
} from "@/lib/types/company";
import type { ListingSnapshot } from "@/lib/types/public-listing";
import { getCompanyNews } from "@/services/news";
import { itemSearchEntries, extractHeadcount } from "@/services/org-people";
import { getPublicListingIntelligence } from "@/services/public-listing/service";
import { getCompanyIdentity } from "@/services/wikipedia";

type RecordValue = Record<string, unknown>;
const isRecord = (value: unknown): value is RecordValue =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export interface ParentHeadcount {
  total: number | null;
  year: number | null;
  samples: Array<{ year: number | null; total: number }>;
}

export interface ParentEnrichmentData {
  identity: SourceResult<CompanyIdentity>;
  news: SourceResult<NewsItem[]>;
  listing: SourceResult<ListingSnapshot>;
  headcount: SourceResult<ParentHeadcount>;
}

async function wikidataHeadcount(
  name: string,
): Promise<ParentHeadcount | null> {
  const entries = await itemSearchEntries(name);
  const best = entries
    .filter((entry) => isOrganizationDescription(entry.description))
    .map((entry) => ({ entry, rank: companyMatchRank(name, entry.label) }))
    .filter(
      (item): item is { entry: (typeof entries)[number]; rank: 0 | 1 } =>
        item.rank === 0 || item.rank === 1,
    )
    .sort((left, right) => left.rank - right.rank)[0]?.entry;
  if (!best) return null;
  const response = await resilientFetch(
    `https://www.wikidata.org/wiki/Special:EntityData/${best.id}.json`,
    {},
    { revalidate: 86_400 },
  );
  const payload = (await response.json()) as unknown;
  const entity =
    isRecord(payload) && isRecord(payload.entities)
      ? payload.entities[best.id]
      : null;
  const extracted = extractHeadcount(entity);
  return extracted.samples.length ? extracted : null;
}

/**
 * Assembles the parent's own evidence for the lazy parent snapshot:
 * identity, recent news, listed-market snapshot, and headcount. Each element
 * is an independent SourceResult so a thin parent (private, no Wikipedia
 * record) still yields name-anchored news and links rather than nothing.
 */
export async function getParentEnrichment(
  query: string,
): Promise<ParentEnrichmentData> {
  const identity = await getCompanyIdentity(query)
    .then((data) => sourceSuccess(data))
    .catch((error: unknown) =>
      sourceUnavailable<CompanyIdentity>(
        error instanceof Error
          ? error.message
          : "No public record resolved for the parent.",
      ),
    );

  const newsPromise = getCompanyNews(
    identity.state === "success" ? identity.data.name : query,
    identity.state === "success" ? identity.data.countryName : null,
  )
    .then((items) =>
      items.length
        ? sourceSuccess(items)
        : sourceEmpty<NewsItem[]>("No recent coverage matched the parent."),
    )
    .catch((error: unknown) =>
      sourceUnavailable<NewsItem[]>(
        error instanceof Error ? error.message : "News is unavailable.",
      ),
    );

  const listingPromise =
    identity.state === "success"
      ? getPublicListingIntelligence(identity.data.name, identity.data).then(
          (result): SourceResult<ListingSnapshot> => {
            if (result.state !== "success") return result;
            if (result.data.snapshot.state !== "success")
              return result.data.snapshot;
            return sourceSuccess(result.data.snapshot.data);
          },
        )
      : Promise.resolve(
          sourceEmpty<ListingSnapshot>(
            "No identity resolved, so no listing could be verified.",
          ),
        );

  const headcountPromise = wikidataHeadcount(query)
    .then((data) =>
      data
        ? sourceSuccess(data)
        : sourceEmpty<ParentHeadcount>(
            "No dated headcount sample was found for the parent.",
          ),
    )
    .catch(() =>
      sourceEmpty<ParentHeadcount>(
        "No dated headcount sample was found for the parent.",
      ),
    );

  const [news, listing, headcount] = await Promise.all([
    newsPromise,
    listingPromise,
    headcountPromise,
  ]);

  return { identity, news, listing, headcount };
}
