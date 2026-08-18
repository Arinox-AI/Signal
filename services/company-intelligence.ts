import "server-only";

import { cache } from "react";

import { UpstreamError } from "@/lib/http/request";
import {
  sourceEmpty,
  sourceSuccess,
  sourceUnavailable,
} from "@/lib/data/source-result";
import type {
  CountryContext,
  GithubActivity,
  IntelligenceReport,
  NewsItem,
  SourceResult,
  SourceReference,
  WebsiteMetadata,
} from "@/lib/types/company";
import { getCountryContext } from "@/services/country";
import { fallbackBrief, generateBrief } from "@/services/gemini";
import { getGithubActivity, GithubNotFoundError } from "@/services/github";
import { getCompanyNews } from "@/services/news";
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
    const githubPromise: Promise<SourceResult<GithubActivity>> =
      getGithubActivity(identity.name)
        .then(sourceSuccess)
        .catch((error: unknown) =>
          error instanceof GithubNotFoundError
            ? sourceEmpty<GithubActivity>(error.message)
            : failure<GithubActivity>(error, "GitHub activity is unavailable."),
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
    const publicListingPromise = getPublicListingIntelligence(query, identity);

    const [website, github, news, country, publicListing] = await Promise.all([
      websitePromise,
      githubPromise,
      newsPromise,
      countryPromise,
      publicListingPromise,
    ]);

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
        id: "github",
        label:
          github.state === "success"
            ? "GitHub organization"
            : "GitHub organization search",
        url:
          github.state === "success"
            ? github.data.url
            : `https://github.com/search?q=${encodeURIComponent(identity.name)}&type=users`,
      },
      {
        id: "news",
        label: "Google News coverage",
        url:
          news.state === "success" && news.data[0]
            ? news.data[0].url
            : newsSearchUrl(identity.name, identity.countryName),
      },
      country.state === "success"
        ? {
            id: "country",
            label: "REST Countries profile",
            url: "https://restcountries.com/",
          }
        : null,
    ]);

    const briefData = await generateBrief(
      identity,
      sources,
      website.state === "success" ? website.data : null,
      publicListing.state === "success" ? publicListing.data : null,
      news.state === "success" ? news.data : [],
      github.state === "success" ? github.data : null,
      country.state === "success" ? country.data : null,
    ).catch(() =>
      fallbackBrief(
        identity,
        news.state === "success" ? news.data : [],
        github.state === "success" ? github.data : null,
      ),
    );
    const brief = sourceSuccess(briefData);

    return {
      query,
      slug: query
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, ""),
      identity,
      sources,
      website,
      github,
      news,
      country,
      brief,
      publicListing,
      generatedAt: new Date().toISOString(),
    };
  },
);
