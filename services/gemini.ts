import "server-only";

import { z } from "zod";

import { resilientFetch } from "@/lib/http/request";
import type {
  AiBrief,
  BusinessDeepDive,
  CompanyIdentity,
  CountryContext,
  NewsItem,
  ParentCompany,
  SourceReference,
  WebsiteMetadata,
} from "@/lib/types/company";
import type { PublicListingData } from "@/lib/types/public-listing";

const sourceIdSchema = z.enum([
  "gleif",
  "wikidata",
  "wikipedia",
  "website",
  "news",
  "country",
  "screener",
  "nse",
  "bse",
  "investor_relations",
  "indian_api",
  "linkedin",
  "concall",
  "blog",
]);

const generatedBriefSchema = z.object({
  headline: z.string().min(8).max(120),
  summary: z.string().min(40).max(440),
  signals: z
    .array(
      z.object({
        title: z.string().min(3).max(42),
        detail: z.string().min(8).max(180),
        sourceIds: z.array(sourceIdSchema).min(1).max(3),
      }),
    )
    .min(3)
    .max(3),
  watchItem: z.string().min(8).max(220),
});

const generatedDeepDiveSchema = z.object({
  what: z.string().min(20).max(600),
  process: z.string().min(20).max(600),
  customers: z.string().min(10).max(400),
  unknown: z.string().min(10).max(400),
});

function conciseOverview(text: string, maxLength = 420) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  const shortened = normalized.slice(0, maxLength - 1);
  return `${shortened.replace(/\s+\S*$/, "")}…`;
}

export function fallbackBrief(
  identity: CompanyIdentity,
  news: NewsItem[],
): AiBrief {
  return {
    headline: `${identity.name}, at a glance`,
    summary:
      conciseOverview(identity.overview) ||
      `${identity.name} is ${identity.description.toLowerCase()}. Signal found limited public context and preserved the available sources below.`,
    signals: [
      {
        title: "Public profile",
        detail: identity.description,
        citations: [{ sourceId: identity.primarySource.id }],
      },
      {
        title: "Current coverage",
        detail: news[0]
          ? news[0].title
          : "No recent coverage was available from the connected news feed.",
        citations: [
          {
            sourceId: "news",
            ...(news[0]?.url ? { url: news[0].url } : {}),
          },
        ],
      },
    ],
    watchItem:
      "Verify time-sensitive details against the linked primary sources before making a decision.",
    generated: false,
  };
}

/**
 * Deterministic fallback for the business deep dive: assembled from the
 * identity record and website metadata, never invented.
 */
export function fallbackBusinessDeepDive(
  identity: CompanyIdentity,
  website: WebsiteMetadata | null,
): BusinessDeepDive {
  const sources: string[] = [];
  if (identity.overview) sources.push(identity.overview);
  if (website?.organizationDescription)
    sources.push(website.organizationDescription);
  if (website?.description && !sources.includes(website.description))
    sources.push(website.description);
  const text = sources.join(" ").replace(/\s+/g, " ").trim();
  const paragraphs = text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const what =
    paragraphs.slice(0, 2).join(" ") ||
    `${identity.name} is ${identity.description.toLowerCase()}.`;
  const unknown =
    identity.foundedYear !== null
      ? "No public source described the company's internal operating process."
      : "No public source described the company's founding or internal operating process.";
  return {
    what,
    process:
      paragraphs.slice(2, 4).join(" ") ||
      "No public source described how the company operates internally.",
    customers:
      "No public source named the company's customer segments explicitly.",
    unknown,
    generated: false,
  };
}

export async function generateBusinessDeepDive(
  identity: CompanyIdentity,
  website: WebsiteMetadata | null,
  news: NewsItem[],
  techNews: NewsItem[],
): Promise<BusinessDeepDive> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return fallbackBusinessDeepDive(identity, website);
  const model = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";
  const evidence = {
    company: {
      name: identity.name,
      description: identity.description,
      overview: identity.overview,
      industry: identity.industry,
      foundedYear: identity.foundedYear,
      website: website
        ? {
            title: website.title,
            description: website.description,
            organizationDescription: website.organizationDescription,
            locality: website.locality,
          }
        : null,
    },
    recentNews: news.slice(0, 6).map(({ title, source, publishedAt }) => ({
      title,
      source,
      publishedAt,
    })),
    techNews: techNews.slice(0, 8).map(({ title, source, publishedAt }) => ({
      title,
      source,
      publishedAt,
    })),
  };
  const prompt = `You are a business analyst explaining how a company operates, using only the supplied evidence.
Describe concretely:
- what: what the company actually does (products, services, sector) — 2-4 sentences
- process: how it operates — its operating model, how it makes or delivers its offering, how it makes money where visible (manufacturing, distribution, platform, services, subscriptions, ...) — 2-4 sentences; say explicitly when this is inferred from news rather than stated
- customers: who its customers/segments are — 1-2 sentences; say "not stated" when absent
- unknown: what important operating facts remain unknown — 1-2 sentences
Never invent revenue, customers, pricing, or processes not visible in the evidence. If evidence is thin, say so in "unknown" rather than filling gaps.
Return concise JSON matching the schema.
EVIDENCE:
${JSON.stringify(evidence)}`;
  const generationConfig: Record<string, unknown> = {
    responseMimeType: "application/json",
    responseSchema: {
      type: "OBJECT",
      properties: {
        what: { type: "STRING" },
        process: { type: "STRING" },
        customers: { type: "STRING" },
        unknown: { type: "STRING" },
      },
      required: ["what", "process", "customers", "unknown"],
    },
    temperature: 0.2,
    maxOutputTokens: 2_048,
  };
  if (model.startsWith("gemini-2.")) {
    generationConfig.thinkingConfig = { thinkingBudget: 0 };
  }
  const response = await resilientFetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig,
      }),
    },
    { revalidate: 86_400, timeoutMs: 30_000, retries: 1 },
  );
  const payload = z
    .object({
      candidates: z
        .array(
          z.object({
            content: z.object({
              parts: z.array(z.object({ text: z.string() })),
            }),
          }),
        )
        .min(1),
    })
    .parse(await response.json());
  const deepDive = generatedDeepDiveSchema.parse(
    JSON.parse(payload.candidates[0]!.content.parts[0]!.text) as unknown,
  );
  return { ...deepDive, generated: true };
}

export async function generateBrief(
  identity: CompanyIdentity,
  sources: SourceReference[],
  website: WebsiteMetadata | null,
  publicListing: PublicListingData | null,
  news: NewsItem[],
  country: CountryContext | null,
  parent: ParentCompany | null = null,
): Promise<AiBrief> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn(
      "[signal] GEMINI_API_KEY is not configured; using the deterministic fallback brief.",
    );
    return fallbackBrief(identity, news);
  }
  const model = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";
  const evidence = {
    sources: sources.map(({ id, label }) => ({ id, label })),
    company: {
      name: identity.name,
      description: identity.description,
      overview: identity.overview,
      industry: identity.industry,
      foundedYear: identity.foundedYear,
      fieldSources: identity.provenance,
    },
    parent: parent
      ? {
          name: parent.name,
          industry: parent.industry,
          country: parent.country,
          sourceIds: ["wikidata"],
        }
      : null,
    website: website
      ? {
          title: website.title,
          description: website.description,
          organizationName: website.organizationName,
          organizationDescription: website.organizationDescription,
          countryName: website.countryName,
          locality: website.locality,
          industry: website.industry,
          foundedYear: website.foundedYear,
          sourceIds: ["website"],
        }
      : null,
    publicListing: publicListing
      ? {
          market: publicListing.listing.market,
          name: publicListing.listing.name,
          exchanges: publicListing.listing.exchanges.map(
            ({ name, symbol, securityId }) => ({ name, symbol, securityId }),
          ),
          isin: publicListing.listing.isin,
          snapshot:
            publicListing.snapshot.state === "success"
              ? publicListing.snapshot.data
              : null,
          sourceIds: publicListing.sources.map(({ id }) => id),
        }
      : null,
    news: news.slice(0, 5).map(({ title, source, publishedAt }) => ({
      title,
      source,
      publishedAt,
      sourceIds: ["news"],
    })),
    country: country
      ? {
          name: country.name,
          region: country.region,
          capital: country.capital,
          sourceIds: ["country"],
        }
      : null,
  };
  const prompt = `You are a rigorous company-intelligence analyst writing a decision brief for a busy executive.

Use only the supplied evidence. Do not invent revenue, employee counts, customers, funding, market position, growth, causality, or conclusions. Separate durable company context from time-sensitive signals. If evidence is thin, say so plainly rather than filling gaps.

Return concise JSON matching the schema:
- headline: a specific, decision-oriented takeaway; never use generic phrases such as "at a glance"
- summary: 2–3 compact sentences explaining what the evidence supports and its most important limitation
- signals: exactly 3 distinct objects with a 2–5 word title, a one-sentence evidence-based detail, and 1–3 sourceIds selected from the supplied evidence; cover company profile, current external signal, and corporate structure when available
- If a parent company is present in the evidence, treat group-level context as first-class: the searched entity's exposure often runs through the parent, so name the parent in the corporate-structure signal and keep the entity's own profile distinct from the group's.
- If publicListing evidence is present, a signal may reference its exchange, market snapshot, or financial availability, but do not invent a valuation conclusion.
- watchItem: one concrete fact or development worth checking next, grounded in the supplied evidence

EVIDENCE:
${JSON.stringify(evidence)}`;
  const generationConfig: Record<string, unknown> = {
    responseMimeType: "application/json",
    responseSchema: {
      type: "OBJECT",
      properties: {
        headline: { type: "STRING" },
        summary: { type: "STRING" },
        signals: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              title: { type: "STRING" },
              detail: { type: "STRING" },
              sourceIds: {
                type: "ARRAY",
                items: { type: "STRING" },
                minItems: 1,
                maxItems: 3,
              },
            },
            required: ["title", "detail", "sourceIds"],
          },
          minItems: 3,
          maxItems: 3,
        },
        watchItem: { type: "STRING" },
      },
      required: ["headline", "summary", "signals", "watchItem"],
    },
    temperature: 0.2,
    maxOutputTokens: 4_096,
  };
  // thinkingConfig is not accepted by gemini-3.x models; only send it for
  // models known to support it (gemini-2.x family).
  if (model.startsWith("gemini-2.")) {
    generationConfig.thinkingConfig = { thinkingBudget: 0 };
  }
  const response = await resilientFetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig,
      }),
    },
    { revalidate: 86_400, timeoutMs: 30_000, retries: 1 },
  );
  const payload = z
    .object({
      candidates: z
        .array(
          z.object({
            content: z.object({
              parts: z.array(z.object({ text: z.string() })),
            }),
          }),
        )
        .min(1),
    })
    .parse(await response.json());
  const brief = generatedBriefSchema.parse(
    JSON.parse(payload.candidates[0]!.content.parts[0]!.text) as unknown,
  );
  const availableSourceIds = new Set(sources.map(({ id }) => id));
  return {
    headline: brief.headline,
    summary: brief.summary,
    signals: brief.signals.map((signal) => {
      const sourceIds = signal.sourceIds.filter((id) =>
        availableSourceIds.has(id),
      );
      return {
        title: signal.title,
        detail: signal.detail,
        citations: (sourceIds.length
          ? sourceIds
          : [identity.primarySource.id]
        ).map((sourceId) => ({ sourceId })),
      };
    }),
    watchItem: brief.watchItem,
    generated: true,
  };
}
