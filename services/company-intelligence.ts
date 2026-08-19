import "server-only";

import { cache } from "react";

import { UpstreamError } from "@/lib/http/request";
import {
  sourceEmpty,
  sourceSuccess,
  sourceUnavailable,
} from "@/lib/data/source-result";
import type {
  BusinessDeepDive,
  CountryContext,
  IntelligenceReport,
  NewsItem,
  OrgPeopleData,
  ParentCompany,
  SourceResult,
  SourceReference,
  WebsiteMetadata,
} from "@/lib/types/company";
import { getCountryContext } from "@/services/country";
import {
  fallbackBrief,
  fallbackBusinessDeepDive,
  generateBrief,
  generateBusinessDeepDive,
} from "@/services/gemini";
import { getCompanyNews, getCompanyTechNews } from "@/services/news";
import {
  getOrgPeopleIntelligence,
  resolveParentFromOverview,
} from "@/services/org-people";
import {
  buildPrioritiesSignal,
  collectPrioritiesEvidence,
  type PrioritiesEvidence,
} from "@/services/priorities";
import { getPublicListingIntelligence } from "@/services/public-listing/service";
import { getWebsiteMetadata } from "@/services/website";
import { getCompanyIdentity } from "@/services/wikipedia";

function failure<T>(error: unknown, fallback: string): SourceResult<T> {
  return sourceUnavailable(
    error instanceof Error ? error.message : fallback,
    error instanceof UpstreamError && error.rateLimited,
  );
}

function newsSearchUrl(
  companyName: string,
  countryName: string | null,
): string {
  const context = countryName ? ` "${countryName}"` : " company";
  const query = encodeURIComponent(`"${companyName}"${context}`);
  return `https://news.google.com/search?q=${query}&hl=en-US&gl=US&ceid=US:en`;
}

function mergeSourceReferences(
  references: Array<SourceReference | null>,
): SourceReference[] {
  const byId = new Map<SourceReference["id"], SourceReference>();
  for (const reference of references) {
    if (reference) byId.set(reference.id, reference);
  }
  return [...byId.values()];
}

export const getCompanyIntelligence = cache(
  async (rawQuery: string): Promise<IntelligenceReport> => {
    const query = decodeURIComponent(rawQuery).trim().slice(0, 120);
    const identity = await getCompanyIdentity(query);
    const websitePromise: Promise<SourceResult<WebsiteMetadata>> =
      identity.website
        ? getWebsiteMetadata(identity.website)
            .then(sourceSuccess)
            .catch((error: unknown) =>
              failure<WebsiteMetadata>(
                error,
                "Website metadata is unavailable.",
              ),
            )
        : Promise.resolve(
            sourceEmpty(
              "No official website was listed in the public company record.",
            ),
          );
    const newsPromise: Promise<SourceResult<NewsItem[]>> = getCompanyNews(
      identity.name,
      identity.countryName,
    )
      .then((items) =>
        items.length
          ? sourceSuccess(items)
          : sourceEmpty<NewsItem[]>("No recent coverage matched this company."),
      )
      .catch((error: unknown) =>
        failure<NewsItem[]>(error, "News is unavailable."),
      );
    const techNewsPromise: Promise<SourceResult<NewsItem[]>> =
      getCompanyTechNews(identity.name)
        .then((items) =>
          items.length
            ? sourceSuccess(items)
            : sourceEmpty<NewsItem[]>(
                "No recent AI or technology coverage matched this company.",
              ),
        )
        .catch((error: unknown) =>
          failure<NewsItem[]>(
            error,
            "AI and technology coverage is unavailable.",
          ),
        );
    const countryPromise: Promise<SourceResult<CountryContext>> =
      identity.countryName
        ? getCountryContext(identity.countryName)
            .then(sourceSuccess)
            .catch((error: unknown) =>
              failure<CountryContext>(error, "Country context is unavailable."),
            )
        : Promise.resolve(
            sourceEmpty("No headquarters country was available."),
          );
    const pubListingResolved = getPublicListingIntelligence(query, identity);
    const orgPeoplePromise = pubListingResolved.then((publicListing) =>
      getOrgPeopleIntelligence(
        identity,
        publicListing.state === "success" &&
          publicListing.data.shareholding.state === "success"
          ? publicListing.data.shareholding.data
          : null,
      )
        .then(sourceSuccess)
        .catch((error: unknown) =>
          failure<OrgPeopleData>(
            error,
            "Org & people intelligence is unavailable.",
          ),
        ),
    );
    // Priorities signal evidence (earnings-call transcript, blog/newsroom,
    // hiring skill emphasis, public internal announcements) is collected in
    // parallel with the other sources and is synthesis-independent.
    const prioritiesPromise: Promise<PrioritiesEvidence> =
      orgPeoplePromise.then(async (orgPeople) =>
        collectPrioritiesEvidence({
          identity,
          hiringRoles:
            orgPeople.state === "success" ? orgPeople.data.hiring.roles : [],
          publicListing: await pubListingResolved,
        }),
      );

    const [
      website,
      news,
      techNews,
      country,
      publicListing,
      orgPeople,
      prioritiesEvidence,
    ] = await Promise.all([
      websitePromise,
      newsPromise,
      techNewsPromise,
      countryPromise,
      pubListingResolved,
      orgPeoplePromise,
      prioritiesPromise,
    ]);

    // Parent detection rides on org-people (Wikidata entity in hand); when
    // that path failed entirely, fall back to "owned by X" prose detection
    // against the identity that did resolve.
    const parent: ParentCompany | null =
      orgPeople.state === "success" && orgPeople.data.parent !== null
        ? orgPeople.data.parent
        : await resolveParentFromOverview(identity).catch(() => null);

    const sources = mergeSourceReferences([
      ...identity.sourceReferences,
      ...(publicListing.state === "success" ? publicListing.data.sources : []),
      identity.website
        ? {
            id: "website",
            label: "Official company website",
            url: identity.website,
          }
        : null,
      {
        id: "news",
        label: "Google News coverage",
        url:
          news.state === "success" && news.data[0]
            ? news.data[0].url
            : newsSearchUrl(identity.name, identity.countryName),
      },
      prioritiesEvidence.concall
        ? {
            id: "concall",
            label: "Latest earnings-call transcript",
            url: prioritiesEvidence.concall.url,
          }
        : null,
      prioritiesEvidence.blogSignals[0]
        ? {
            id: "blog",
            label: "Company blog & newsroom",
            url: prioritiesEvidence.blogSignals[0].url,
          }
        : null,
      country.state === "success"
        ? {
            id: "country",
            label: "REST Countries profile",
            url: "https://restcountries.com/",
          }
        : null,
      orgPeople.state === "success" && orgPeople.data.people.length
        ? {
            id: "linkedin",
            label: "LinkedIn people search",
            url: `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(identity.name)}`,
          }
        : null,
    ]);

    const [briefData, deepDiveData, prioritiesData] = await Promise.all([
      generateBrief(
        identity,
        sources,
        website.state === "success" ? website.data : null,
        publicListing.state === "success" ? publicListing.data : null,
        news.state === "success" ? news.data : [],
        country.state === "success" ? country.data : null,
        parent,
      ).catch((error: unknown) => {
        console.warn(
          "[signal] Gemini brief generation failed; using the deterministic fallback.",
          error instanceof Error ? error.message : error,
        );
        return fallbackBrief(
          identity,
          news.state === "success" ? news.data : [],
        );
      }),
      generateBusinessDeepDive(
        identity,
        website.state === "success" ? website.data : null,
        news.state === "success" ? news.data : [],
        techNews.state === "success" ? techNews.data : [],
      ).catch((error: unknown) => {
        console.warn(
          "[signal] Gemini business deep-dive failed; using the deterministic fallback.",
          error instanceof Error ? error.message : error,
        );
        return fallbackBusinessDeepDive(
          identity,
          website.state === "success" ? website.data : null,
        );
      }),
      buildPrioritiesSignal(prioritiesEvidence),
    ]);
    const brief = sourceSuccess(briefData);
    const business = sourceSuccess<BusinessDeepDive>(deepDiveData);
    const priorities = sourceSuccess(prioritiesData);

    return {
      query,
      slug: query
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, ""),
      identity,
      parent,
      sources,
      website,
      news,
      techNews,
      country,
      brief,
      business,
      priorities,
      publicListing,
      orgPeople,
      generatedAt: new Date().toISOString(),
    };
  },
);
