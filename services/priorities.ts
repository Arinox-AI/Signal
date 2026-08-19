import "server-only";

import { load } from "cheerio";
import { z } from "zod";

import { resilientFetch } from "@/lib/http/request";
import type {
  CompanyIdentity,
  NewsItem,
  PrioritiesSignal,
  PrioritiesTheme,
  SignalCitation,
  SourceResult,
} from "@/lib/types/company";
import type { PublicListingData } from "@/lib/types/public-listing";
import { searchNews } from "@/services/news";

export interface BlogSignal {
  title: string;
  url: string;
  date: string | null;
}

export interface SkillCluster {
  skill: string;
  count: number;
  roles: string[];
}

export interface ConcallEvidence {
  title: string;
  date: string | null;
  url: string;
  pdf: boolean;
  /** Cleaned transcript text, null when the transcript is a PDF/unreadable. */
  transcriptText: string | null;
}

export interface PrioritiesEvidence {
  identity: CompanyIdentity;
  concall: ConcallEvidence | null;
  blogSignals: BlogSignal[];
  skillClusters: SkillCluster[];
  internalSignals: NewsItem[];
  website: string | null;
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

export function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** Irrelevant headings that should never surface as roadmap/blog signals. */
const BLOG_NOISE =
  /\b(subscribe|newsletter|menu|read more|contact us|privacy|cookies|terms|careers|join us|investors|sitemap|all rights|share this|follow us|search|back to|related articles?|©|posted (in|on)|by the numbers|about (us|the)\b)/i;

/** Short nav/menu labels that are not post titles. Only drops short headings. */
const MENU_WORDS =
  /\b(industries?|services|solutions|products?|insights|resources|about( us)?|leadership|who we are|what we do|our (story|work)|newsroom|media|press|sustainability|company|home|menu|quick links|next|navigate your next)\b/i;

/**
 * Parses a blog/newsroom page into dated, meaningful post titles. Best-effort:
 * pulls h1-h3 headings that carry a post link or a date, drops boilerplate and
 * short menu labels. Pure — unit-tested.
 */
export function parseBlogPage(html: string, baseUrl: string): BlogSignal[] {
  const $ = load(html);
  const pageDate =
    $('meta[property="article:published_time"]').attr("content") ??
    $("time[datetime]").first().attr("datetime") ??
    null;
  const signals: BlogSignal[] = [];
  const seen = new Set<string>();

  const linkFor = (heading: ReturnType<typeof $>): string | null => {
    const scoped = heading.closest("article, li, section");
    const href =
      scoped.find("a[href]").first().attr("href") ??
      heading.closest("a[href]").attr("href") ??
      heading.find("a[href]").first().attr("href");
    if (!href) return null;
    const url = new URL(href, baseUrl);
    if (url.hash || url.toString() === baseUrl) return null;
    return url.toString();
  };

  const consider = (heading: ReturnType<typeof $>) => {
    const title = cleanText(heading.text());
    if (title.length < 8 || title.length > 90) return;
    if (BLOG_NOISE.test(title)) return;
    if (title.length <= 40 && MENU_WORDS.test(title)) return;
    const key = title.toLowerCase();
    if (seen.has(key) || signals.length >= 8) return;
    const link = linkFor(heading);
    const date =
      heading
        .closest("article, li, section")
        .find("time[datetime]")
        .first()
        .attr("datetime") ?? pageDate;
    if (!link && !date) return;
    seen.add(key);
    signals.push({
      title,
      url: link ?? baseUrl,
      date: date ? new Date(date).toISOString().slice(0, 10) : null,
    });
  };

  $("h1, h2, h3").each((_, element) => consider($(element)));
  return signals;
}

/** Sentences that read as stated company priorities in an earnings call. */
const CONCALL_PRIORITY =
  /\b(will (invest|expand|launch|enter|focus|build|double|grow|hire|scale|transform|roll out|accelerate|pursue|prioritize)|next (quarter|year|fiscal)|this (quarter|year|fiscal)|we (are|continue to|plan to|aim to|intend to) (invest|focus|build|expand|launch|grow|hire|prioritize|accelerate)|our (priority|priorities|focus|strategy|plan|area of focus)|committed to|planned|rolling out|introducing|staying the course|capital allocation|we have been investing)\b/i;

/**
 * Pulls the priority-bearing sentences out of a cleaned transcript. Pure —
 * unit-tested. Skipped sentences that merely say "we will" with no substance
 * are still subject to the same signal filter.
 */
export function prioritySentencesFromConcall(text: string): string[] {
  const sentences = text
    .replace(/[\r\n]+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => cleanText(sentence))
    .filter((sentence) => sentence.length > 40 && sentence.length <= 260);
  const seen = new Set<string>();
  const matches: string[] = [];
  for (const sentence of sentences) {
    if (!CONCALL_PRIORITY.test(sentence)) continue;
    const key = sentence.toLowerCase().slice(0, 80);
    if (seen.has(key) || matches.length >= 6) continue;
    seen.add(key);
    matches.push(sentence);
  }
  return matches;
}

const SKILL_GROUPS: Array<{ skill: string; test: RegExp }> = [
  {
    skill: "AI & machine learning",
    test: /\b(ai\b|artificial intelligence|machine learning|\bml\b|deep learning|llm|generative|genai|nlp|computer vision|data science|data scientist|data engineer|analytics)\b/i,
  },
  {
    skill: "Cloud & platform engineering",
    test: /\b(cloud|devops|sre|site reliability|kubernetes|k8s|infrastructure|platform|aws|azure|gcp|container)\b/i,
  },
  {
    skill: "Software engineering",
    test: /\b(software|full[- ]stack|front[- ]end|backend|back[- ]end|react|typescript|javascript|java|python|golang|\.net|api|engineering)\b/i,
  },
  {
    skill: "Cybersecurity",
    test: /\b(cyber|security|zero trust|threat|soc analyst)\b/i,
  },
  {
    skill: "Product & design",
    test: /\b(product ((manager|analyst|owner)\b|designer|ux|ui)\b)/i,
  },
  {
    skill: "Go-to-market",
    test: /\b(sales|marketing|growth|business development|account executive|client success|partnership|presales)\b/i,
  },
  {
    skill: "Operations & delivery",
    test: /\b(operations|delivery|program|project|supply chain|logistics|procurement|governance)\b/i,
  },
  {
    skill: "Finance & talent",
    test: /\b(finance|accounting|hr|talent|recruiter|legal|compliance)\b/i,
  },
];

/**
 * Aggregates open-role titles into skill emphasis clusters — "hiring heavily
 * toward X" == a stated priority, per PLAN §2.9. Pure — unit-tested.
 */
export function hiringSkillClusters(
  roles: Array<{ title: string; ai: boolean }>,
): SkillCluster[] {
  return SKILL_GROUPS.map((group) => ({
    skill: group.skill,
    count: roles.filter((role) => group.test.test(role.title)).length,
    roles: roles
      .filter((role) => group.test.test(role.title))
      .slice(0, 4)
      .map((role) => role.title),
  }))
    .filter((cluster) => cluster.count > 0)
    .sort((left, right) => right.count - left.count)
    .slice(0, 4);
}

/** Google News query for public records of internal/company-wide announcements. */
export function leakQuery(companyName: string): string {
  return `"${companyName}" (town hall OR "all hands" OR memo OR leaked OR "internal email" OR "employee meeting" OR "company-wide")`;
}

const LEAK_TERMS =
  /\b(town hall|all hands|memo|leak(ed|s)?|internal (email|memo|note|letter)|company-wide|employee meeting|huddle)\b/i;
const LEAK_NOISE =
  /\b(stock|shares?|rating|downgrade|target price|analyst|buyback|dividend|clsa)\b/i;

/** Whether a news title is about a public record of an internal announcement. */
export function isLeakStory(title: string): boolean {
  return LEAK_TERMS.test(title) && !LEAK_NOISE.test(title);
}

// ---------------------------------------------------------------------------
// Source collecting (network)
// ---------------------------------------------------------------------------

export function latestConcall(
  publicListing: SourceResult<PublicListingData>,
): { title: string; date: string | null; url: string } | null {
  if (
    publicListing.state !== "success" ||
    publicListing.data.investors.state !== "success"
  )
    return null;
  const transcripts = publicListing.data.investors.data.documents
    .filter((document) => document.type === "concall_transcript")
    .sort(
      (left, right) =>
        new Date(right.date ?? 0).getTime() -
        new Date(left.date ?? 0).getTime(),
    );
  const latest = transcripts[0];
  if (!latest) return null;
  return { title: latest.title, date: latest.date, url: latest.url };
}

/**
 * Fetches the latest earnings-call transcript. HTML transcripts are cleaned to
 * text for keyword extraction; PDFs (and unreadable assets) are reported as
 * link-only so we never invent content we cannot read.
 */
export async function fetchConcallTranscript(concall: {
  title: string;
  date: string | null;
  url: string;
}): Promise<ConcallEvidence> {
  try {
    const response = await resilientFetch(
      concall.url,
      { headers: { Accept: "text/html, application/pdf" } },
      { revalidate: 86_400, timeoutMs: 8_000 },
    );
    const contentType = response.headers.get("content-type") ?? "";
    const isPdf =
      contentType.includes("pdf") ||
      (/\.pdf(\?|$)/i.test(concall.url) && !contentType.includes("html"));
    if (isPdf) {
      return { ...concall, pdf: true, transcriptText: null };
    }
    const $ = load(await response.text());
    $("script, style, nav, footer, header, aside, svg, button").remove();
    const text = cleanText($("body").text());
    if (text.length < 200) {
      return { ...concall, pdf: false, transcriptText: null };
    }
    return { ...concall, pdf: false, transcriptText: text.slice(0, 30_000) };
  } catch {
    return { ...concall, pdf: false, transcriptText: null };
  }
}

const BLOG_PATHS = [
  "blog",
  "news",
  "newsroom",
  "insights",
  "resources",
  "press-releases",
  "media",
  "company/news",
];

/** Scrapes common blog/newsroom routes for dated post headings. */
export async function scrapeBlogSignals(
  website: string | null,
): Promise<BlogSignal[]> {
  if (!website) return [];
  for (const path of BLOG_PATHS) {
    try {
      const url = new URL(`/${path}`, website);
      const response = await resilientFetch(
        url.toString(),
        { headers: { Accept: "text/html" } },
        { revalidate: 86_400, timeoutMs: 5_000 },
      );
      const signals = parseBlogPage(await response.text(), url.toString());
      if (signals.length) return signals;
    } catch {
      // try the next common blog path
    }
  }
  return [];
}

/** Public record of internal/company-wide announcements (leaks, memos, town halls). */
export async function searchInternalSignals(
  companyName: string,
  limit = 5,
): Promise<NewsItem[]> {
  const items = await searchNews(leakQuery(companyName), limit * 3);
  return items.filter((item) => isLeakStory(item.title)).slice(0, limit);
}

/** Collects every priority-evidence source in parallel; never throws. */
export async function collectPrioritiesEvidence(input: {
  identity: CompanyIdentity;
  hiringRoles: Array<{ title: string; ai: boolean }>;
  publicListing: SourceResult<PublicListingData>;
}): Promise<PrioritiesEvidence> {
  const concall = latestConcall(input.publicListing);
  const [concallEvidence, blogSignals, internalSignals] = await Promise.all([
    concall ? fetchConcallTranscript(concall) : Promise.resolve(null),
    scrapeBlogSignals(input.identity.website),
    searchInternalSignals(input.identity.name).catch(() => []),
  ]);
  return {
    identity: input.identity,
    concall: concallEvidence,
    blogSignals,
    skillClusters: hiringSkillClusters(input.hiringRoles),
    internalSignals,
    website: input.identity.website,
  };
}

// ---------------------------------------------------------------------------
// Deterministic fallback
// ---------------------------------------------------------------------------

function themeSources(
  evidence: PrioritiesEvidence,
  kind: string,
): SignalCitation[] {
  switch (kind) {
    case "hiring":
      return [{ sourceId: "website" }];
    case "concall":
      return evidence.concall
        ? [{ sourceId: "concall", url: evidence.concall.url }]
        : [];
    case "blog":
      return [
        {
          sourceId: "blog",
          ...(evidence.blogSignals[0]?.url
            ? { url: evidence.blogSignals[0].url }
            : {}),
        },
      ];
    case "leak":
      return evidence.internalSignals
        .slice(0, 2)
        .map((item) => ({ sourceId: "news" as const, url: item.url }));
    default:
      return [];
  }
}

function fallbackHeadline(
  evidence: PrioritiesEvidence,
  themes: PrioritiesTheme[],
): string {
  const name = evidence.identity.name;
  const hiring = themes.find(
    (theme) => theme.sources[0]?.sourceId === "website",
  );
  if (hiring) {
    const skill = evidence.skillClusters[0]?.skill;
    if (skill) return `${name} is hiring heavily toward ${skill}.`;
  }
  const concall = themes.find(
    (theme) => theme.sources[0]?.sourceId === "concall",
  );
  if (concall && evidence.concall) {
    const sentence = evidence.concall.transcriptText
      ? prioritySentencesFromConcall(evidence.concall.transcriptText)[0]
      : null;
    if (sentence) return `${name}: "${cleanText(sentence).slice(0, 90)}…"`;
  }
  const leak = themes.find((theme) => theme.sources[0]?.sourceId === "news");
  if (leak) {
    return `${name}: public record shows internal signals worth watching.`;
  }
  const blog = themes.find((theme) => theme.sources[0]?.sourceId === "blog");
  if (blog && evidence.blogSignals[0]) {
    return `${name}'s public roadmap: "${evidence.blogSignals[0].title.slice(0, 90)}".`;
  }
  if (concall && evidence.concall) {
    return `${name}'s latest earnings call is the reference point for its stated quarterly priorities.`;
  }
  return `No public priority signals found for ${name} right now.`;
}

function fallbackWatchItem(
  evidence: PrioritiesEvidence,
  themes: PrioritiesTheme[],
): string | null {
  if (
    evidence.concall?.pdf &&
    themes.some((t) => t.sources[0]?.sourceId === "concall")
  ) {
    return `Latest earnings call: ${evidence.concall.title} — the transcript is a PDF, open it for the stated quarterly priorities.`;
  }
  if (evidence.internalSignals.length) {
    return "Watch for follow-ups on the internal-announcement reports surfaced above.";
  }
  if (evidence.concall) {
    return "Watch the next earnings call to see these priorities confirmed or revised.";
  }
  if (evidence.blogSignals.length) {
    return `Watch for the next post on the ${evidence.identity.name} blog/newsroom.`;
  }
  return null;
}

/**
 * Deterministic fallback for the priorities signal. Priority order: hiring
 * skill emphasis, earnings-call transcript, public internal announcements,
 * then public roadmap. Never invents facts.
 */
export function buildFallbackPrioritiesSignal(
  evidence: PrioritiesEvidence,
): PrioritiesSignal {
  const themes: PrioritiesTheme[] = [];
  const hiring = evidence.skillClusters[0];
  if (hiring) {
    const detail = evidence.skillClusters.length
      ? `Open roles skew toward ${evidence.skillClusters.map((cluster) => `"${cluster.skill}"`).join(", ")} — ${hiring.count} of ${evidence.skillClusters.reduce((sum, cluster) => sum + cluster.count, 0)} matched postings.`
      : "";
    themes.push({
      theme: "Hiring signal",
      detail,
      sources: themeSources(evidence, "hiring"),
      weight: hiring.count >= 3 ? "high" : "medium",
    });
  }
  if (evidence.concall) {
    if (evidence.concall.transcriptText) {
      const sentences = prioritySentencesFromConcall(
        evidence.concall.transcriptText,
      );
      if (sentences.length) {
        themes.push({
          theme: "Earnings-call priorities",
          detail: cleanText(sentences.join(" ")).slice(0, 340),
          sources: themeSources(evidence, "concall"),
          weight: "high",
        });
      }
    }
    if (evidence.concall.pdf || !evidence.concall.transcriptText) {
      const withDate =
        evidence.concall.date &&
        !evidence.concall.title.includes(evidence.concall.date);
      themes.push({
        theme: "Latest earnings call",
        detail: `${evidence.concall.title}${withDate ? ` (${evidence.concall.date})` : ""} — the transcript is ${
          evidence.concall.pdf ? "a PDF" : "not machine-readable"
        }; open the link for the stated quarterly priorities.`,
        sources: themeSources(evidence, "concall"),
        weight: "medium",
      });
    }
  }
  if (evidence.internalSignals.length) {
    themes.push({
      theme: "Internal announcements (public record)",
      detail: evidence.internalSignals
        .slice(0, 3)
        .map((item) => `"${item.title}" (${item.source})`)
        .join("; "),
      sources: themeSources(evidence, "leak"),
      weight: "high",
    });
  }
  if (evidence.blogSignals.length) {
    themes.push({
      theme: "Public roadmap (blog/newsroom)",
      detail: evidence.blogSignals
        .slice(0, 4)
        .map((item) => `"${item.title}"${item.date ? ` (${item.date})` : ""}`)
        .join("; "),
      sources: themeSources(evidence, "blog"),
      weight: "medium",
    });
  }

  const headline = fallbackHeadline(evidence, themes);
  const watchItem = fallbackWatchItem(evidence, themes);
  return { headline, themes, watchItem, generated: false };
}

// ---------------------------------------------------------------------------
// Gemini synthesis
// ---------------------------------------------------------------------------

const prioritiesSourceSchema = z.enum(["concall", "news", "blog", "website"]);

const generatedPrioritiesSchema = z.object({
  headline: z.string().min(8).max(140),
  themes: z
    .array(
      z.object({
        theme: z.string().min(3).max(60),
        detail: z.string().min(10).max(320),
        sourceIds: z.array(prioritiesSourceSchema).min(1).max(2),
        weight: z.enum(["high", "medium", "low"]),
      }),
    )
    .min(1)
    .max(4),
  watchItem: z.string().min(6).max(220).nullable(),
});

function citationsForSourceIds(
  evidence: PrioritiesEvidence,
  sourceIds: string[],
): SignalCitation[] {
  return sourceIds.flatMap((sourceId): SignalCitation[] => {
    switch (sourceId) {
      case "concall":
        return evidence.concall
          ? [{ sourceId: "concall", url: evidence.concall.url }]
          : [];
      case "blog":
        return evidence.blogSignals[0]?.url
          ? [{ sourceId: "blog", url: evidence.blogSignals[0].url }]
          : evidence.website
            ? [{ sourceId: "blog", url: evidence.website }]
            : [];
      case "news":
        return evidence.internalSignals
          .slice(0, 2)
          .map((item) => ({ sourceId: "news" as const, url: item.url }));
      case "website":
        return evidence.website
          ? [{ sourceId: "website", url: evidence.website }]
          : [];
      default:
        return [];
    }
  });
}

/**
 * Gemini-synthesized priorities signal (PLAN §2.9): a short, evidence-grounded
 * statement of what the company is prioritizing, from earnings-call text,
 * blog/newsroom posts, hiring skill emphasis, and public internal signals.
 * Schema-validated; never invents facts not in the supplied evidence.
 */
export async function generatePrioritiesSignal(
  evidence: PrioritiesEvidence,
): Promise<PrioritiesSignal> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return buildFallbackPrioritiesSignal(evidence);
  const model = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";
  const data = {
    company: {
      name: evidence.identity.name,
      industry: evidence.identity.industry,
    },
    hiringSkillEmphasis: evidence.skillClusters.map((cluster) => ({
      skill: cluster.skill,
      count: cluster.count,
      roles: cluster.roles,
    })),
    earningsCall: evidence.concall
      ? {
          title: evidence.concall.title,
          date: evidence.concall.date,
          transcriptExcerpt: evidence.concall.transcriptText?.slice(0, 8_000),
          pdfOnly: !evidence.concall.transcriptText,
        }
      : null,
    publicBlogPosts: evidence.blogSignals.map((signal) => ({
      title: signal.title,
      date: signal.date,
    })),
    internalSignals: evidence.internalSignals.map((item) => ({
      title: item.title,
      source: item.source,
      url: item.url,
    })),
  };
  const prompt = `You write a short "priorities signal" for a business-intelligence product. Use ONLY the supplied evidence.
- headline: one sentence answering "what is this company prioritizing right now?" grounded in the evidence (hiring skill emphasis, earnings-call statements, public blog/roadmap posts, or public records of internal announcements). Max 140 chars.
- themes: 1-4 ranked evidence-backed priorities. The deepest evidence wins (earnings-call statements and internal-announcement records rank above blog posts; hiring skill emphasis supports anything). For each theme give a theme label, a 1-2 sentence detail naming the evidence, and the sourceIds backing it (concall, news, blog, website). Never exceed what the evidence supports - if evidence is thin, fewer themes.
- watchItem: the single most useful thing to watch next, or null if nothing follows from the evidence.
Never invent revenue, budgets, or capabilities not visible in the evidence. Return concise JSON matching the schema.
EVIDENCE:
${JSON.stringify(data)}`;
  const generationConfig: Record<string, unknown> = {
    responseMimeType: "application/json",
    responseSchema: {
      type: "OBJECT",
      properties: {
        headline: { type: "STRING" },
        themes: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              theme: { type: "STRING" },
              detail: { type: "STRING" },
              sourceIds: { type: "ARRAY", items: { type: "STRING" } },
              weight: { type: "STRING" },
            },
            required: ["theme", "detail", "sourceIds", "weight"],
          },
        },
        watchItem: { type: "STRING" },
      },
      required: ["headline", "themes", "watchItem"],
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
  const parsed = generatedPrioritiesSchema.parse(
    JSON.parse(payload.candidates[0]!.content.parts[0]!.text) as unknown,
  );
  const signal: PrioritiesSignal = {
    headline: parsed.headline,
    themes: parsed.themes.map((theme) => ({
      theme: theme.theme,
      detail: theme.detail,
      sources: citationsForSourceIds(evidence, theme.sourceIds),
      weight: theme.weight,
    })),
    watchItem: parsed.watchItem,
    generated: true,
  };
  return signal;
}

/** Gemini-first with the deterministic fallback; never throws. */
export async function buildPrioritiesSignal(
  evidence: PrioritiesEvidence,
): Promise<PrioritiesSignal> {
  try {
    return await generatePrioritiesSignal(evidence);
  } catch (error) {
    console.warn(
      "[signal] Gemini priorities signal failed; using the deterministic fallback.",
      error instanceof Error ? error.message : error,
    );
    return buildFallbackPrioritiesSignal(evidence);
  }
}
