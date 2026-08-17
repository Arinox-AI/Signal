import "server-only";

import { z } from "zod";

import { resilientFetch } from "@/lib/http/request";
import type {
  AiBrief,
  CompanyIdentity,
  CountryContext,
  GithubActivity,
  NewsItem,
} from "@/lib/types/company";

const briefSchema = z.object({
  headline: z.string().min(8).max(120),
  summary: z.string().min(40).max(440),
  signals: z
    .array(
      z.object({
        title: z.string().min(3).max(42),
        detail: z.string().min(8).max(180),
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
      },
      {
        title: "Current coverage",
        detail: news[0]
          ? news[0].title
          : "No recent coverage was available from the connected news feed.",
      },
      {
        title: "Builder footprint",
        detail: github
          ? `${github.publicRepos.toLocaleString()} public repositories and ${github.stars.toLocaleString()} stars were found on GitHub.`
          : "No verified GitHub organization was available for this company.",
      },
    ],
    watchItem:
      "Verify time-sensitive details against the linked primary sources before making a decision.",
    generated: false,
  };
}

export async function generateBrief(
  identity: CompanyIdentity,
  news: NewsItem[],
  github: GithubActivity | null,
  country: CountryContext | null,
): Promise<AiBrief> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return fallbackBrief(identity, news, github);
  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
  const evidence = {
    company: {
      name: identity.name,
      description: identity.description,
      overview: identity.overview,
      industry: identity.industry,
      foundedYear: identity.foundedYear,
    },
    news: news.slice(0, 5).map(({ title, source, publishedAt }) => ({
      title,
      source,
      publishedAt,
    })),
    github: github
      ? {
          publicRepos: github.publicRepos,
          followers: github.followers,
          stars: github.stars,
          topRepositories: github.topRepositories.map(
            ({ name, stars, language }) => ({ name, stars, language }),
          ),
        }
      : null,
    country: country
      ? { name: country.name, region: country.region, capital: country.capital }
      : null,
  };
  const prompt = `You are a rigorous company-intelligence analyst writing a decision brief for a busy executive.

Use only the supplied evidence. Do not invent revenue, employee counts, customers, funding, market position, growth, causality, or conclusions. Do not treat GitHub stars as commercial traction. Separate durable company context from time-sensitive signals. If evidence is thin, say so plainly rather than filling gaps.

Return concise JSON matching the schema:
- headline: a specific, decision-oriented takeaway; never use generic phrases such as "at a glance"
- summary: 2–3 compact sentences explaining what the evidence supports and its most important limitation
- signals: exactly 3 distinct objects with a 2–5 word title and a one-sentence evidence-based detail; cover company profile, current external signal, and builder footprint when available
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
                  },
                  required: ["title", "detail"],
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
  const brief = briefSchema.parse(
    JSON.parse(payload.candidates[0]!.content.parts[0]!.text) as unknown,
  );
  return { ...brief, generated: true };
}
