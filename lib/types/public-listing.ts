import type {
  ConfidenceLevel,
  SourceReference,
  SourceResult,
} from "@/lib/types/company";

export type ListingMarket = "india" | "global";
export type ListingResolutionState = "listed" | "not_listed" | "ambiguous";

export interface ListingConfidence {
  level: ConfidenceLevel;
  label: string;
  reason: string;
  ambiguous: boolean;
  /**
   * When set, the UI must surface a prominent hard-warning banner: financial
   * data may belong to a different company with a similar name.
   */
  warning?: string;
}

export interface ListingExchange {
  name: string;
  symbol: string | null;
  securityId: string | null;
  url: string;
}

export interface ListingIdentity {
  state: ListingResolutionState;
  name: string;
  /** The company name the user actually searched for / identity resolved to. */
  searchedName: string | null;
  market: ListingMarket;
  isin: string | null;
  exchanges: ListingExchange[];
  screenerUrl: string | null;
  investorRelationsUrl: string | null;
  consolidated: boolean;
  confidence: ListingConfidence;
  sourceReferences: SourceReference[];
}

export interface ListingSnapshot {
  currency: string;
  unit: string;
  currentPrice: number | null;
  changePercent: number | null;
  marketCap: number | null;
  pe: number | null;
  bookValue: number | null;
  dividendYield: number | null;
  roce: number | null;
  roe: number | null;
  faceValue: number | null;
  high52Week: number | null;
  low52Week: number | null;
  asOf: string | null;
}

export interface PricePoint {
  date: string;
  price: number | null;
  dma50: number | null;
  dma200: number | null;
  volume: number | null;
}

export interface ListingChart {
  points: PricePoint[];
  periodDays: number;
  sourceUrl: string;
  asOf: string | null;
}

export type ListingCell = number | string | null;

export interface FinancialRow {
  label: string;
  values: ListingCell[];
}

export interface FinancialTable {
  title: string;
  unit: string | null;
  periods: string[];
  rows: FinancialRow[];
  sourceUrl: string;
}

export interface PeerCompany {
  name: string;
  url: string | null;
  metrics: Record<string, ListingCell>;
}

export interface PeerComparison {
  headers: string[];
  companies: PeerCompany[];
  median: Record<string, ListingCell>;
  sourceUrl: string;
}

export type InvestorDocumentType =
  | "announcement"
  | "annual_report"
  | "credit_rating"
  | "concall_transcript"
  | "investor_presentation"
  | "recording";

export interface InvestorDocument {
  type: InvestorDocumentType;
  title: string;
  description: string | null;
  date: string | null;
  source: string | null;
  url: string;
}

export interface InvestorDocuments {
  investorRelationsUrl: string | null;
  documents: InvestorDocument[];
  annualReports: InvestorDocument[];
}

export interface PublicListingData {
  listing: ListingIdentity;
  snapshot: SourceResult<ListingSnapshot>;
  chart: SourceResult<ListingChart>;
  peers: SourceResult<PeerComparison>;
  quarters: SourceResult<FinancialTable>;
  profitLoss: SourceResult<FinancialTable>;
  balanceSheet: SourceResult<FinancialTable>;
  cashFlow: SourceResult<FinancialTable>;
  ratios: SourceResult<FinancialTable>;
  shareholding: SourceResult<FinancialTable>;
  investors: SourceResult<InvestorDocuments>;
  sources: SourceReference[];
  generatedAt: string;
}
