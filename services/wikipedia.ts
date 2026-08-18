import "server-only";

import { z } from "zod";

import {
  companyMatchRank,
  domainSearchTerm,
  extractDomain,
  isOrganizationDescription,
} from "@/lib/company-query";
import { resilientFetch } from "@/lib/http/request";
import { createCompanyProvenance } from "@/lib/provenance";
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
  sourceUrl: string | null;
  website: string | null;
  countryName: string | null;
  industry: string | null;
  foundedYear: number | null;
}
const EMPTY_DETAILS: WikidataDetails = {
  sourceUrl: null,
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
    sourceUrl: `https://www.wikidata.org/wiki/${page.pageprops.wikibase_item}`,
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
  // Identity matching is intentionally looser than listing matching: a
  // rank-2/rank-3 candidate is acceptable here because the resolved identity
  // is displayed to the user for confirmation, whereas listing data is
  // attached silently. Exact (0) and scope-superset (1) matches are always
  // preferred so the definite company comes first.
  const rankedCandidates = entitySearch.search
    .filter((item) => isOrganizationDescription(item.description))
    .map((item) => ({
      item,
      rank: companyMatchRank(entityQuery, item.label),
    }))
    .filter((entry) => entry.rank !== null)
    .sort((left, right) => (left.rank ?? 4) - (right.rank ?? 4));
  const entityCandidate = rankedCandidates[0]?.item ?? null;
  const exactMatch = rankedCandidates[0]?.rank === 0;

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
      const confidence = metadata.organizationName ? "high" : "medium";
      const primarySource = {
        id: "website" as const,
        label: "Official company website",
        url: metadata.url,
      };
      return {
        name,
        description,
        overview: description,
        wikipediaUrl: metadata.url,
        lei: null,
        imageUrl: metadata.iconUrl,
        website: metadata.url,
        countryName: metadata.countryName,
        industry: metadata.industry,
        foundedYear: metadata.foundedYear,
        primarySource,
        sourceReferences: [primarySource],
        confidence: {
          level: confidence,
          label:
            confidence === "high"
              ? "Official website verified"
              : "Official domain match",
          reason: metadata.organizationName
            ? "The supplied domain published matching organization metadata."
            : "The identity was inferred from the supplied official domain.",
          ambiguous: confidence !== "high",
        },
        provenance: createCompanyProvenance(["website"], confidence, {
          name: metadata.organizationName
            ? undefined
            : {
                confidence: "medium",
                note: "The company name was inferred from page metadata or the domain.",
              },
          countryName: metadata.countryName
            ? undefined
            : {
                confidence: "low",
                note: "The official website did not publish a headquarters country.",
              },
          industry: metadata.industry
            ? undefined
            : {
                confidence: "low",
                note: "The official website did not publish a structured industry.",
              },
          foundedYear: metadata.foundedYear
            ? undefined
            : {
                confidence: "low",
                note: "The official website did not publish a founding year.",
              },
          lei: {
            confidence: "low",
            note: "No Legal Entity Identifier was available from the website path.",
          },
        }),
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
  const wikipediaSource = {
    id: "wikipedia" as const,
    label: "Wikipedia company profile",
    url: summary.content_urls.desktop.page,
  };
  const wikidataSource = {
    id: "wikidata" as const,
    label: "Wikidata structured record",
    url:
      details.sourceUrl ??
      `https://www.wikidata.org/w/index.php?search=${encodeURIComponent(title)}`,
  };
  const confidence = exactMatch ? "high" : "medium";

  return {
    name: summary.title,
    description: summary.description,
    overview: summary.extract,
    wikipediaUrl: summary.content_urls.desktop.page,
    lei: null,
    imageUrl:
      summary.originalimage?.source ?? summary.thumbnail?.source ?? null,
    website: details.website ?? null,
    countryName: details.countryName ?? null,
    industry: details.industry ?? null,
    foundedYear: details.foundedYear ?? null,
    primarySource: wikipediaSource,
    sourceReferences: [wikipediaSource, wikidataSource],
    confidence: {
      level: confidence,
      label:
        confidence === "high"
          ? "Organization match verified"
          : "Likely organization match",
      reason: exactMatch
        ? "The organization label matched exactly and has a confirmed English Wikipedia profile."
        : "The organization label matched by name proximity and has a confirmed English Wikipedia profile.",
      ambiguous: !exactMatch,
    },
    provenance: createCompanyProvenance(["wikipedia"], confidence, {
      website: {
        sourceIds: ["wikidata"],
        confidence: details.website ? "high" : "low",
        ...(details.website
          ? {}
          : { note: "No official website was listed in the Wikidata record." }),
      },
      countryName: {
        sourceIds: ["wikidata"],
        confidence: details.countryName ? "high" : "low",
        ...(details.countryName
          ? {}
          : {
              note: "No headquarters country was listed in the Wikidata record.",
            }),
      },
      industry: {
        sourceIds: ["wikidata"],
        confidence: details.industry ? "high" : "low",
        ...(details.industry
          ? {}
          : { note: "No industry was listed in the Wikidata record." }),
      },
      foundedYear: {
        sourceIds: ["wikidata"],
        confidence: details.foundedYear ? "high" : "low",
        ...(details.foundedYear
          ? {}
          : { note: "No founding year was listed in the Wikidata record." }),
      },
      lei: {
        sourceIds: ["wikidata"],
        confidence: "low",
        note: "The Wikipedia/Wikidata path did not resolve a Legal Entity Identifier.",
      },
    }),
  };
}
