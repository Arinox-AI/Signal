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
  WebsiteMetadata,
} from "@/lib/types/company";
import { getCountryContext } from "@/services/country";
import { fallbackBrief, generateBrief } from "@/services/gemini";
import { getGithubActivity, GithubNotFoundError } from "@/services/github";
import { getCompanyNews } from "@/services/news";
import { getWebsiteMetadata } from "@/services/website";
import { getCompanyIdentity } from "@/services/wikipedia";

function failure<T>(error: unknown, fallback: string): SourceResult<T> {
  return sourceUnavailable(
    error instanceof Error ? error.message : fallback,
    error instanceof UpstreamError && error.rateLimited,
  );
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

    const [website, github, news, country] = await Promise.all([
      websitePromise,
      githubPromise,
      newsPromise,
      countryPromise,
    ]);

    const briefData = await generateBrief(
      identity,
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
      website,
      github,
      news,
      country,
      brief,
      generatedAt: new Date().toISOString(),
    };
  },
);
