export type SourceKey =
  "wikipedia" | "website" | "github" | "news" | "country" | "gemini";
export type SourceState = "success" | "empty" | "unavailable" | "rate_limited";

export interface CompanySuggestion {
  id: string;
  name: string;
  description: string;
  query: string;
  source: "wikidata" | "gleif" | "web" | "domain";
}

export type SourceResult<T> =
  | { state: "success"; data: T; updatedAt: string }
  | {
      state: "empty" | "unavailable" | "rate_limited";
      data: null;
      message: string;
      updatedAt: string;
    };

export interface CompanyIdentity {
  name: string;
  description: string;
  overview: string;
  wikipediaUrl: string;
  imageUrl: string | null;
  website: string | null;
  countryName: string | null;
  industry: string | null;
  foundedYear: number | null;
}

export interface WebsiteMetadata {
  url: string;
  hostname: string;
  title: string | null;
  description: string | null;
  iconUrl: string;
  organizationName: string | null;
  organizationDescription: string | null;
  countryName: string | null;
  locality: string | null;
  industry: string | null;
  foundedYear: number | null;
}

export interface GithubActivity {
  organization: string;
  url: string;
  avatarUrl: string;
  followers: number;
  publicRepos: number;
  stars: number;
  forks: number;
  openIssues: number;
  updatedAt: string;
  topRepositories: Array<{
    name: string;
    url: string;
    description: string | null;
    stars: number;
    language: string | null;
    updatedAt: string;
  }>;
}

export interface NewsItem {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string;
}

export interface CountryContext {
  name: string;
  officialName: string;
  capital: string | null;
  region: string;
  population: number;
  flagUrl: string | null;
  currencies: string[];
  languages: string[];
}

export interface AiBrief {
  headline: string;
  summary: string;
  signals: Array<{
    title: string;
    detail: string;
  }>;
  watchItem: string;
  generated: boolean;
}

export interface IntelligenceReport {
  query: string;
  slug: string;
  identity: CompanyIdentity;
  website: SourceResult<WebsiteMetadata>;
  github: SourceResult<GithubActivity>;
  news: SourceResult<NewsItem[]>;
  country: SourceResult<CountryContext>;
  brief: SourceResult<AiBrief>;
  generatedAt: string;
}
