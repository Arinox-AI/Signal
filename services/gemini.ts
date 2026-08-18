import "server-only";

import { z } from "zod";

import { resilientFetch } from "@/lib/http/request";
import type {
  AiBrief,
  CompanyIdentity,
  CountryContext,
  GithubActivity,
  NewsItem,
  SourceReference,
  WebsiteMetadata,
} from "@/lib/types/company";
import type { PublicListingData } from "@/lib/types/public-listing";

const sourceIdSchema = z.enum([
  "gleif",
  "wikidata",
  "wikipedia",
  "website",
  "github",
  "news",
  "country",
  "screener",
  "nse",
  "bse",
  "investor_relations",
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

function conciseOverview(text: string, maxLength = 420) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  const shortened = normalized.slice(0, maxLength - 1);
  return `${shortened.replace(/\s+\S*$/, "")}…`;
}

export function fallbackBrief(
  identity: CompanyIdentity,
  news: NewsItem[],
  github: GithubActivity | null,
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
      {
        title: "Builder footprint",
        detail: github
          ? `${github.publicRepos.toLocaleString()} public repositories and ${github.stars.toLocaleString()} stars were found on GitHub.`
          : "No verified GitHub organization was available for this company.",
        citations: [{ sourceId: "github" }],
      },
    ],
    watchItem:
      "Verify time-sensitive details against the linked primary sources before making a decision.",
    generated: false,
  };
}

export async function generateBrief(
  identity: CompanyIdentity,
  sources: SourceReference[],
  website: WebsiteMetadata | null,
  publicListing: PublicListingData | null,
  news: NewsItem[],
  github: GithubActivity | null,
  country: CountryContext | null,
): Promise<AiBrief> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return fallbackBrief(identity, news, github);
  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
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
    github: github
      ? {
          publicRepos: github.publicRepos,
          followers: github.followers,
          stars: github.stars,
          topRepositories: github.topRepositories.map(
            ({ name, stars, language }) => ({ name, stars, language }),
          ),
          sourceIds: ["github"],
        }
      : null,
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

Use only the supplied evidence. Do not invent revenue, employee counts, customers, funding, market position, growth, causality, or conclusions. Do not treat GitHub stars as commercial traction. Separate durable company context from time-sensitive signals. If evidence is thin, say so plainly rather than filling gaps.

Return concise JSON matching the schema:
- headline: a specific, decision-oriented takeaway; never use generic phrases such as "at a glance"
- summary: 2–3 compact sentences explaining what the evidence supports and its most important limitation
- signals: exactly 3 distinct objects with a 2–5 word title, a one-sentence evidence-based detail, and 1–3 sourceIds selected from the supplied evidence; cover company profile, current external signal, and builder footprint when available
- If publicListing evidence is present, a signal may reference its exchange, market snapshot, or financial availability, but do not invent a valuation conclusion.
- watchItem: one concrete fact or development worth checking next, grounded in the supplied evidence

EVIDENCE:
${JSON.stringify(evidence)}`;
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
        generationConfig: {
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
          thinkingConfig: { thinkingBudget: 0 },
          temperature: 0.2,
          maxOutputTokens: 1_200,
        },
      }),
    },
    { revalidate: 86_400, timeoutMs: 9_000, retries: 1 },
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
