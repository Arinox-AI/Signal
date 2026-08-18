import type { PublicListingData } from "@/lib/types/public-listing";

export type SourceId =
  | "gleif"
  | "wikidata"
  | "wikipedia"
  | "website"
  | "github"
  | "news"
  | "country"
  | "screener"
  | "nse"
  | "bse"
  | "investor_relations"
  | "indian_api";
export type SourceKey = SourceId | "gemini";
export type SourceState = "success" | "empty" | "unavailable" | "rate_limited";
export type ConfidenceLevel = "high" | "medium" | "low";

export interface SourceReference {
  id: SourceId;
  label: string;
  url: string;
}

export interface FieldProvenance {
  sourceIds: SourceId[];
  confidence: ConfidenceLevel;
  note?: string;
}

export type CompanyIdentityField =
  | "name"
  | "description"
  | "overview"
  | "website"
  | "countryName"
  | "industry"
  | "foundedYear"
  | "lei";

export type CompanyProvenance = Record<CompanyIdentityField, FieldProvenance>;

export interface IdentityConfidence {
  level: ConfidenceLevel;
  label: string;
  reason: string;
  ambiguous: boolean;
}

export interface SignalCitation {
  sourceId: SourceId;
  url?: string;
}

export interface CompanySuggestion {
  id: string;
  name: string;
  description: string;
  query: string;
  source: "wikidata" | "gleif" | "web" | "domain";
  listed?: boolean;
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
  lei: string | null;
  imageUrl: string | null;
  website: string | null;
  countryName: string | null;
  industry: string | null;
  foundedYear: number | null;
  primarySource: SourceReference;
  sourceReferences: SourceReference[];
  confidence: IdentityConfidence;
  provenance: CompanyProvenance;
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
    citations: SignalCitation[];
  }>;
  watchItem: string;
  generated: boolean;
}

export interface IntelligenceReport {
  query: string;
  slug: string;
  identity: CompanyIdentity;
  sources: SourceReference[];
  website: SourceResult<WebsiteMetadata>;
  github: SourceResult<GithubActivity>;
  news: SourceResult<NewsItem[]>;
  country: SourceResult<CountryContext>;
  brief: SourceResult<AiBrief>;
  publicListing: SourceResult<PublicListingData>;
  generatedAt: string;
}
