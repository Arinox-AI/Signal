import "server-only";

import { z } from "zod";

import {
  domainSearchTerm,
  extractDomain,
  isOrganizationDescription,
  normalizeCompanyName,
} from "@/lib/company-query";
import { resilientFetch } from "@/lib/http/request";
import type { CompanyIdentity } from "@/lib/types/company";
import { getLegalEntityIdentity } from "@/services/gleif";
import { getWebsiteMetadata } from "@/services/website";

const entitySearchSchema = z.object({
  search: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      description: z.string().optional().default(""),
    }),
  ),
});
const summarySchema = z.object({
  title: z.string(),
  description: z.string().optional().default("Company"),
  extract: z.string().optional().default(""),
  content_urls: z.object({ desktop: z.object({ page: z.string().url() }) }),
  originalimage: z.object({ source: z.string().url() }).optional(),
  thumbnail: z.object({ source: z.string().url() }).optional(),
});

type RecordValue = Record<string, unknown>;
interface WikidataDetails {
  website: string | null;
  countryName: string | null;
  industry: string | null;
  foundedYear: number | null;
}
const EMPTY_DETAILS: WikidataDetails = {
  website: null,
  countryName: null,
  industry: null,
  foundedYear: null,
};
const isRecord = (value: unknown): value is RecordValue =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function firstClaim(entity: unknown, property: string): unknown {
  if (!isRecord(entity) || !isRecord(entity.claims)) return null;
  const claims = entity.claims[property];
  if (
    !Array.isArray(claims) ||
    !isRecord(claims[0]) ||
    !isRecord(claims[0].mainsnak) ||
    !isRecord(claims[0].mainsnak.datavalue)
  )
    return null;
  return claims[0].mainsnak.datavalue.value;
}

async function wikidataDetails(title: string): Promise<WikidataDetails> {
  const propsUrl = new URL("https://en.wikipedia.org/w/api.php");
  propsUrl.search = new URLSearchParams({
    action: "query",
    prop: "pageprops",
    titles: title,
    format: "json",
    origin: "*",
  }).toString();
  const propsResponse = await resilientFetch(
    propsUrl.toString(),
    {},
    { revalidate: 86_400 },
  );
  const props = (await propsResponse.json()) as unknown;
  if (
    !isRecord(props) ||
    !isRecord(props.query) ||
    !isRecord(props.query.pages)
  )
    return EMPTY_DETAILS;
  const page = Object.values(props.query.pages).find(isRecord);
  if (
    !page ||
    !isRecord(page.pageprops) ||
    typeof page.pageprops.wikibase_item !== "string"
  )
    return EMPTY_DETAILS;

  const entityResponse = await resilientFetch(
    `https://www.wikidata.org/wiki/Special:EntityData/${page.pageprops.wikibase_item}.json`,
    {},
    { revalidate: 86_400 },
  );
  const entityPayload = (await entityResponse.json()) as unknown;
  if (!isRecord(entityPayload) || !isRecord(entityPayload.entities))
    return EMPTY_DETAILS;
  const entity = entityPayload.entities[page.pageprops.wikibase_item];
  const website = firstClaim(entity, "P856");
  let countryValue = firstClaim(entity, "P17");
  const headquartersValue = firstClaim(entity, "P159");
  if (
    !countryValue &&
    isRecord(headquartersValue) &&
    typeof headquartersValue.id === "string"
  ) {
    const headquartersResponse = await resilientFetch(
      `https://www.wikidata.org/wiki/Special:EntityData/${headquartersValue.id}.json`,
      {},
      { revalidate: 604_800 },
    );
    const headquartersPayload = (await headquartersResponse.json()) as unknown;
    if (
      isRecord(headquartersPayload) &&
      isRecord(headquartersPayload.entities)
    ) {
      countryValue = firstClaim(
        headquartersPayload.entities[headquartersValue.id],
        "P17",
      );
    }
  }
  const industryValue = firstClaim(entity, "P452");
  const inceptionValue = firstClaim(entity, "P571");
  const ids = [countryValue, industryValue]
    .filter(isRecord)
    .map((value) => value.id)
    .filter((value): value is string => typeof value === "string");

  let labels: Record<string, string> = {};
  if (ids.length > 0) {
    const labelsUrl = new URL("https://www.wikidata.org/w/api.php");
    labelsUrl.search = new URLSearchParams({
      action: "wbgetentities",
      ids: ids.join("|"),
      props: "labels",
      languages: "en",
      format: "json",
      origin: "*",
    }).toString();
    const labelsResponse = await resilientFetch(
      labelsUrl.toString(),
      {},
      { revalidate: 604_800 },
    );
    const labelPayload = (await labelsResponse.json()) as unknown;
    if (isRecord(labelPayload) && isRecord(labelPayload.entities)) {
      labels = Object.fromEntries(
        Object.entries(labelPayload.entities).flatMap(([id, value]) =>
          isRecord(value) &&
          isRecord(value.labels) &&
          isRecord(value.labels.en) &&
          typeof value.labels.en.value === "string"
            ? [[id, value.labels.en.value]]
            : [],
        ),
      );
    }
  }
  const countryId =
    isRecord(countryValue) && typeof countryValue.id === "string"
      ? countryValue.id
      : null;
  const industryId =
    isRecord(industryValue) && typeof industryValue.id === "string"
      ? industryValue.id
      : null;
  const time =
    isRecord(inceptionValue) && typeof inceptionValue.time === "string"
      ? inceptionValue.time
      : null;
  return {
    website: typeof website === "string" ? website : null,
    countryName: countryId ? (labels[countryId] ?? null) : null,
    industry: industryId ? (labels[industryId] ?? null) : null,
    foundedYear: time ? Number(time.slice(1, 5)) || null : null,
  };
}

export async function getCompanyIdentity(
  query: string,
): Promise<CompanyIdentity> {
  const leiMatch = /^lei:([a-z0-9]{20})$/i.exec(query.trim());
  if (leiMatch?.[1]) return getLegalEntityIdentity(leiMatch[1].toUpperCase());

  const domain = extractDomain(query);
  const entityQuery = domain ? domainSearchTerm(domain) : query;
  const entitySearchUrl = new URL("https://www.wikidata.org/w/api.php");
  entitySearchUrl.search = new URLSearchParams({
    action: "wbsearchentities",
    search: entityQuery,
    language: "en",
    uselang: "en",
    type: "item",
    limit: "10",
    format: "json",
    origin: "*",
  }).toString();
  const entitySearchResponse = await resilientFetch(
    entitySearchUrl.toString(),
    {},
    { revalidate: 86_400 },
  );
  const entitySearch = entitySearchSchema.parse(
    await entitySearchResponse.json(),
  );
  const normalizedEntityQuery = normalizeCompanyName(entityQuery);
  const entityCandidate = entitySearch.search.find((item) => {
    const normalizedLabel = normalizeCompanyName(item.label);
    const nameMatches =
      normalizedLabel === normalizedEntityQuery ||
      normalizedLabel.startsWith(normalizedEntityQuery) ||
      normalizedEntityQuery.startsWith(normalizedLabel);
    return nameMatches && isOrganizationDescription(item.description);
  });

  let entityTitle: string | null = null;
  if (entityCandidate) {
    const candidateResponse = await resilientFetch(
      `https://www.wikidata.org/wiki/Special:EntityData/${entityCandidate.id}.json`,
      {},
      { revalidate: 86_400 },
    );
    const candidatePayload = (await candidateResponse.json()) as unknown;
    if (isRecord(candidatePayload) && isRecord(candidatePayload.entities)) {
      const candidateEntity = candidatePayload.entities[entityCandidate.id];
      if (
        isRecord(candidateEntity) &&
        isRecord(candidateEntity.sitelinks) &&
        isRecord(candidateEntity.sitelinks.enwiki) &&
        typeof candidateEntity.sitelinks.enwiki.title === "string"
      ) {
        entityTitle = candidateEntity.sitelinks.enwiki.title;
      }
    }
  }

  const title = entityTitle;
  if (!title) {
    if (domain) {
      const metadata = await getWebsiteMetadata(`https://${domain}`);
      const domainLabel = domain
        .split(".")[0]!
        .split(/[-_]/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
      const titleCandidate = metadata.title?.split(/\s+[|–—]\s+/)[0]?.trim();
      const name =
        metadata.organizationName ??
        (titleCandidate && titleCandidate.length <= 80
          ? titleCandidate
          : domainLabel);
      const description =
        metadata.organizationDescription ??
        metadata.description ??
        `Organization operating the official domain ${metadata.hostname}`;
      return {
        name,
        description,
        overview: description,
        wikipediaUrl: metadata.url,
        imageUrl: metadata.iconUrl,
        website: metadata.url,
        countryName: metadata.countryName,
        industry: metadata.industry,
        foundedYear: metadata.foundedYear,
      };
    }
    throw new Error(
      "No unambiguous public company record was found. Try the full legal name or official domain.",
    );
  }

  const summaryResponse = await resilientFetch(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
    {},
    { revalidate: 86_400 },
  );
  const summary = summarySchema.parse(await summaryResponse.json());
  const details = await wikidataDetails(title).catch(() => EMPTY_DETAILS);

  return {
    name: summary.title,
    description: summary.description,
    overview: summary.extract,
    wikipediaUrl: summary.content_urls.desktop.page,
    imageUrl:
      summary.originalimage?.source ?? summary.thumbnail?.source ?? null,
    website: details.website ?? null,
    countryName: details.countryName ?? null,
    industry: details.industry ?? null,
    foundedYear: details.foundedYear ?? null,
  };
}
