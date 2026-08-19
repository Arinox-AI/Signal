import type { PublicListingData } from "@/lib/types/public-listing";

export type SourceId =
  | "gleif"
  | "wikidata"
  | "wikipedia"
  | "website"
  | "news"
  | "country"
  | "screener"
  | "nse"
  | "bse"
  | "investor_relations"
  | "indian_api"
  | "linkedin"
  | "concall"
  | "blog";
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
  /** Parent organization name when the item is a known subsidiary/brand. */
  parentName?: string;
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

export interface NewsItem {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  /** Set only for items from the AI/tech feed: "ai" or "tech". */
  kind?: "ai" | "tech";
}

export interface OrgPerson {
  name: string;
  role: string | null;
  tier: "founder" | "board" | "executive";
  wikipediaUrl: string | null;
  linkedinUrl: string | null;
  sourceUrl: string | null;
}

export interface PersonActivity {
  name: string;
  role: string | null;
  headlines: NewsItem[];
}

export type ParentDetectionSource = "wikidata" | "text";

export interface ParentCompany {
  name: string;
  industry: string | null;
  country: string | null;
  wikipediaUrl: string | null;
  wikidataUrl: string | null;
  /** Navigable search term for the parent's own report (/company/<query>). */
  query: string;
  /**
   * "wikidata" — resolved from an ownership claim (P749/P127/P361);
   * "text" — extracted from the public record (e.g. "owned by X") and
   * optionally confirmed against Wikidata.
   */
  detectedVia: ParentDetectionSource;
}

export interface OrgPeopleData {
  people: OrgPerson[];
  activity: PersonActivity[];
  ownership: {
    promoterPct: number | null;
    publicPct: number | null;
    sourceUrl: string | null;
  };
  headcount: {
    total: number | null;
    year: number | null;
    samples: Array<{ year: number | null; total: number }>;
    sourceUrl: string | null;
  };
  hiring: {
    roles: Array<{ title: string; ai: boolean }>;
    aiRoleCount: number;
    sourceUrl: string | null;
  };
  aiNews: NewsItem[];
  parent: ParentCompany | null;
  confidence: number;
  signal: string;
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

/**
 * Evidence-grounded explanation of how the company actually operates: what it
 * does, its process/operating model, who it serves, and what remains unknown.
 */
export interface BusinessDeepDive {
  what: string;
  process: string;
  customers: string;
  unknown: string;
  generated: boolean;
}

/**
 * A ranked theme inside a "priorities signal" — an inference about what the
 * company is visibly prioritizing, always backed by at least one citation.
 */
export interface PrioritiesTheme {
  theme: string;
  detail: string;
  sources: SignalCitation[];
  weight: "high" | "medium" | "low";
}

/**
 * Priorities signal (PLAN §2.9): a compact, evidence-grounded statement of
 * what the company is prioritizing right now — derived from earnings-call
 * transcripts, public blog/newsroom posts, hiring's skill emphasis, and any
 * public record of internal announcements (leaks, town halls, memos).
 */
export interface PrioritiesSignal {
  headline: string;
  themes: PrioritiesTheme[];
  /** The one thing worth watching next, when it is publicly visible. */
  watchItem: string | null;
  generated: boolean;
}

export interface IntelligenceReport {
  query: string;
  slug: string;
  identity: CompanyIdentity;
  /**
   * Detected parent organization, when the resolved entity is a
   * subsidiary/brand. Content of the parent's own report is fetched lazily
   * via /api/parent, not embedded here.
   */
  parent: ParentCompany | null;
  sources: SourceReference[];
  website: SourceResult<WebsiteMetadata>;
  news: SourceResult<NewsItem[]>;
  /** AI/technology-specific recent coverage, merged from dedicated feeds. */
  techNews: SourceResult<NewsItem[]>;
  country: SourceResult<CountryContext>;
  brief: SourceResult<AiBrief>;
  /** Evidence-grounded "what it does / how it operates" deep dive. */
  business: SourceResult<BusinessDeepDive>;
  /** What the company is prioritizing right now, with citations. */
  priorities: SourceResult<PrioritiesSignal>;
  publicListing: SourceResult<PublicListingData>;
  orgPeople: SourceResult<OrgPeopleData>;
  generatedAt: string;
}
