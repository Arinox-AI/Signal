import "server-only";

import { load } from "cheerio";
import { XMLParser } from "fast-xml-parser";
import { z } from "zod";

import { resilientFetch } from "@/lib/http/request";
import {
  companyMatchRank,
  isOrganizationDescription,
  normalizeCompanyName,
} from "@/lib/company-query";
import type {
  CompanyIdentity,
  NewsItem,
  OrgPeopleData,
  OrgPerson,
  ParentCompany,
  PersonActivity,
} from "@/lib/types/company";
import type { FinancialTable } from "@/lib/types/public-listing";

type RecordValue = Record<string, unknown>;
const isRecord = (value: unknown): value is RecordValue =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

const CLAIM_PROPS = {
  founder: "P112",
  chairperson: "P488",
  ceo: "P169",
  boardMember: "P3320",
  employees: "P1128",
  parent: "P749",
  ownedBy: "P127",
  partOf: "P361",
  instanceOf: "P31",
  industry: "P452",
  country: "P17",
  pointInTime: "P585",
  startTime: "P580",
  endTime: "P582",
} as const;

/** Ownership-property order for parent detection: explicit parent wins. */
const PARENT_CLAIM_PROPS = [
  CLAIM_PROPS.parent,
  CLAIM_PROPS.ownedBy,
  CLAIM_PROPS.partOf,
] as const;

const wikiItemSchema = z.object({
  entities: z
    .record(
      z.string(),
      z.object({
        labels: z
          .record(z.string(), z.object({ value: z.string() }))
          .optional(),
        sitelinks: z
          .record(
            z.string(),
            z.object({
              title: z.string().optional().default(""),
            }),
          )
          .optional(),
        claims: z.record(z.string(), z.array(z.unknown())).optional(),
      }),
    )
    .optional(),
});

function claimSnak(claim: unknown): { value: unknown } | null {
  if (
    !isRecord(claim) ||
    !isRecord(claim.mainsnak) ||
    !isRecord(claim.mainsnak.datavalue)
  )
    return null;
  return { value: claim.mainsnak.datavalue.value };
}

function claimValues(entity: unknown, property: string): unknown[] {
  if (!isRecord(entity) || !isRecord(entity.claims)) return [];
  const claims = entity.claims[property];
  return Array.isArray(claims)
    ? claims.flatMap((claim) => {
        const snak = claimSnak(claim);
        return snak ? [snak.value] : [];
      })
    : [];
}

function qualifierYear(claim: unknown, property: string): number | null {
  const qualifiers =
    isRecord(claim) && isRecord(claim.qualifiers)
      ? claim.qualifiers[property]
      : null;
  if (!Array.isArray(qualifiers)) return null;
  for (const qualifier of qualifiers) {
    if (
      isRecord(qualifier) &&
      isRecord(qualifier.datavalue) &&
      isRecord(qualifier.datavalue.value) &&
      typeof qualifier.datavalue.value.time === "string"
    ) {
      const match = /^[+-](\d{4})/.exec(qualifier.datavalue.value.time);
      if (match?.[1]) return Number(match[1]) || null;
    }
  }
  return null;
}

/**
 * Values of the claims for a role property that have not ended yet, most
 * recently started first. A claim without an end time counts as current —
 * this keeps stale appointments (e.g. a CEO who left years ago) from
 * shadowing the incumbent.
 */
function currentRoleValues(entity: unknown, property: string): unknown[] {
  if (!isRecord(entity) || !isRecord(entity.claims)) return [];
  const claims = entity.claims[property];
  if (!Array.isArray(claims)) return [];
  const now = new Date().getFullYear();
  return claims
    .filter((claim) => {
      const end = qualifierYear(claim, CLAIM_PROPS.endTime);
      return end === null || end >= now;
    })
    .sort((left, right) => {
      const leftStart = qualifierYear(left, CLAIM_PROPS.startTime) ?? 0;
      const rightStart = qualifierYear(right, CLAIM_PROPS.startTime) ?? 0;
      return rightStart - leftStart;
    })
    .flatMap((claim) => {
      const snak = claimSnak(claim);
      return snak ? [snak.value] : [];
    });
}

/**
 * Reads every dated headcount sample from Wikidata's "number of employees"
 * (P1128) claims, each with its "point in time" (P585) qualifier. Multiple
 * claims over the years form the headcount trend.
 */
export function extractHeadcount(entity: unknown): {
  total: number | null;
  year: number | null;
  samples: Array<{ year: number | null; total: number }>;
} {
  if (!isRecord(entity) || !isRecord(entity.claims))
    return { total: null, year: null, samples: [] };
  const claims = entity.claims[CLAIM_PROPS.employees];
  const samples: Array<{ year: number | null; total: number }> = [];
  if (Array.isArray(claims)) {
    for (const claim of claims) {
      const snak = claimSnak(claim);
      if (
        !snak ||
        !isRecord(snak.value) ||
        typeof snak.value.amount !== "string"
      )
        continue;
      const parsed = Number(snak.value.amount);
      if (!Number.isFinite(parsed)) continue;
      const year = qualifierYear(claim, CLAIM_PROPS.pointInTime);
      samples.push({ year, total: parsed });
    }
  }
  samples.sort((left, right) => (left.year ?? 0) - (right.year ?? 0));
  const latest = samples[samples.length - 1] ?? null;
  return {
    total: latest?.total ?? null,
    year: latest?.year ?? null,
    samples,
  };
}

interface PersonEntry {
  id: string;
  label: string;
  tier: OrgPerson["tier"];
  role: string;
}

export function peopleFromEntity(entity: unknown): PersonEntry[] {
  if (!isRecord(entity) || !isRecord(entity.claims)) return [];
  const entries: PersonEntry[] = [];
  for (const value of claimValues(entity, CLAIM_PROPS.founder).slice(0, 4)) {
    if (isRecord(value) && typeof value.id === "string")
      entries.push({
        id: value.id,
        label: "",
        tier: "founder",
        role: "Founder",
      });
  }
  for (const value of currentRoleValues(entity, CLAIM_PROPS.ceo).slice(0, 1)) {
    if (isRecord(value) && typeof value.id === "string")
      entries.push({
        id: value.id,
        label: "",
        tier: "executive",
        role: "Chief Executive Officer",
      });
  }
  for (const value of currentRoleValues(entity, CLAIM_PROPS.chairperson).slice(
    0,
    1,
  )) {
    if (isRecord(value) && typeof value.id === "string")
      entries.push({
        id: value.id,
        label: "",
        tier: "executive",
        role: "Chairperson",
      });
  }
  for (const value of currentRoleValues(entity, CLAIM_PROPS.boardMember).slice(
    0,
    8,
  )) {
    if (isRecord(value) && typeof value.id === "string")
      entries.push({
        id: value.id,
        label: "",
        tier: "board",
        role: "Board member",
      });
  }
  return entries;
}

const linkedinSearchUrl = (name: string) =>
  `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(name)}`;

/**
 * Builds the deduped, tiered people list from Wikidata claims, resolving labels
 * and Wikipedia pages in one batch request.
 */
export async function resolvePeople(
  entity: unknown,
  entityUrl: string | null = null,
): Promise<OrgPerson[]> {
  const entries = peopleFromEntity(entity);
  if (!entries.length) return [];

  const ids = [...new Set(entries.map((entry) => entry.id))];
  let entities: Record<string, unknown> = {};
  try {
    const url = new URL("https://www.wikidata.org/w/api.php");
    url.search = new URLSearchParams({
      action: "wbgetentities",
      ids: ids.join("|"),
      props: "labels|sitelinks",
      format: "json",
      origin: "*",
    }).toString();
    const response = await resilientFetch(
      url.toString(),
      {},
      { revalidate: 86_400 },
    );
    const payload = wikiItemSchema.parse(await response.json());
    entities = payload.entities ?? {};
  } catch {
    return [];
  }

  const people: OrgPerson[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    const item = entities[entry.id];
    const label = itemLabel(item);
    if (!label || seen.has(label.toLowerCase())) continue;
    seen.add(label.toLowerCase());
    const wikiTitle =
      isRecord(item) &&
      isRecord(item.sitelinks) &&
      isRecord(item.sitelinks.enwiki) &&
      typeof item.sitelinks.enwiki.title === "string"
        ? item.sitelinks.enwiki.title
        : null;
    people.push({
      name: label,
      role: entry.role,
      tier: entry.tier,
      wikipediaUrl: wikiTitle
        ? `https://en.wikipedia.org/wiki/${encodeURIComponent(wikiTitle.replace(/ /g, "_"))}`
        : null,
      linkedinUrl: linkedinSearchUrl(label),
      sourceUrl: entityUrl,
    });
  }
  return people;
}

const ROLE_HINT =
  /(chief|officer|director|founder|president|chairman|chairperson|vice|head|manager|partner|lead)/i;
const ROLE_FILLER = /\b(at|for|with|since|from|joined)\b/i;
const NAME_PATTERN = /^[A-Z][A-Za-z.'&]*(\s[A-Z][A-Za-z.'&]*){1,3}$/;
const DESCRIPTOR_WORDS = new Set([
  "non",
  "executive",
  "independent",
  "director",
  "directors",
  "board",
  "member",
  "chairman",
  "chairperson",
  "founder",
  "ceo",
  "md",
  "president",
  "principal",
  "general",
  "vice",
  "senior",
  "junior",
  "management",
  "leadership",
  "team",
  "the",
  "our",
  "of",
  "and",
  "&",
]);
const FORMER_ROLE =
  /^(former|previous|outgoing|ex\b|retired|stepped|resigned)(\s|$)/i;
const TENURE_RANGE = /\b((19|20)\d{2})\s*[–-]\s*((19|20)\d{2})\b/;

function isDescriptorOnly(name: string): boolean {
  const words = name
    .toLowerCase()
    .split(/[^a-z&]+/)
    .filter(Boolean);
  return words.length > 0 && words.every((word) => DESCRIPTOR_WORDS.has(word));
}

function isCurrentRole(role: string): boolean {
  return !FORMER_ROLE.test(role) && !TENURE_RANGE.test(role);
}

const CAREER_ROLE =
  /(engineer|developer|scientist|architect|analyst|specialist|associate|consultant|manager|director|head|lead|designer|technician|officer|executive|intern|trainee)\b/i;
const AI_HINT =
  /(\bai\b|artificial intelligence|machine learning|\bml\b|deep learning|llm|generative|data science|data (scientist|engineer|analytics)|computer vision|nlp|chatbot|automation|robotics)/i;
const CAREER_NOISE =
  /^(home|about|careers?|jobs?|current openings|job openings|openings?|contact|apply|join|join us|team|menu|search|see all|all jobs|our people|life at|read more|click here|submit|next|previous|board of|students|everyone|welcome)\b/i;
const CAREER_SECTION =
  /\b(subsidiaries?|associates?|datasheets?|brands?|products|thrive|recruiter|meet|training programme|programme|recognition|relations?)\b/i;

/**
 * Best-effort extraction of "Name — Role" leadership entries from a company
 * team/leadership page. Conservative: only clearly role-tagged pairs survive.
 */
export function parseLeadershipPage(html: string): Array<{
  name: string;
  role: string;
}> {
  const $ = load(html);
  const results: Array<{ name: string; role: string }> = [];
  const seen = new Set<string>();

  const add = (name: string, role: string) => {
    const key = `${name.toLowerCase()} ${role.toLowerCase()}`;
    if (seen.has(key) || results.length >= 6) return;
    seen.add(key);
    results.push({ name, role });
  };

  $("h1, h2, h3, h4").each((_, heading) => {
    const text = cleanText($(heading).text());
    if (isDescriptorOnly(text)) return;
    const inline = text.split(/[–—|·,]/).map((part) => part.trim());
    if (
      inline.length === 2 &&
      NAME_PATTERN.test(inline[0]!) &&
      ROLE_HINT.test(inline[1]!) &&
      !ROLE_FILLER.test(inline[1]!) &&
      !isDescriptorOnly(inline[0]!) &&
      isCurrentRole(inline[1]!)
    ) {
      add(inline[0]!, inline[1]!);
      return;
    }
    if (NAME_PATTERN.test(text)) {
      const sibling = $(heading).next();
      const roleText = cleanText(sibling.first().text());
      if (
        roleText &&
        roleText.length <= 60 &&
        ROLE_HINT.test(roleText) &&
        !ROLE_FILLER.test(roleText) &&
        isCurrentRole(roleText)
      )
        add(text, roleText);
    }
  });

  return results;
}

export interface CareerPostings {
  roles: Array<{ title: string; ai: boolean }>;
  aiRoleCount: number;
  sourceUrl: string | null;
}

/**
 * Best-effort extraction of open roles from a careers page's static HTML.
 * Dynamic job boards (Greenhouse, Workday, ...) won't surface in raw HTML and
 * are reported as no postings. Conservative: only role-shaped text survives.
 */
export function parseCareerPage(html: string): CareerPostings {
  const $ = load(html);
  const roles: Array<{ title: string; ai: boolean }> = [];
  const seen = new Set<string>();
  const consider = (text: string) => {
    const value = cleanText(text);
    if (value.length < 3 || value.length > 60) return;
    if (
      !CAREER_ROLE.test(value) ||
      CAREER_NOISE.test(value) ||
      CAREER_SECTION.test(value)
    )
      return;
    const key = value.toLowerCase();
    if (seen.has(key) || roles.length >= 12) return;
    seen.add(key);
    roles.push({ title: value, ai: AI_HINT.test(value) });
  };
  $("h2, h3, h4, li, strong, a[href]").each((_, element) => {
    consider($(element).text());
  });
  const aiRoleCount = roles.filter((role) => role.ai).length;
  return { roles, aiRoleCount, sourceUrl: null };
}

async function fetchCareerRoles(
  website: string | null,
): Promise<CareerPostings> {
  if (!website) return { roles: [], aiRoleCount: 0, sourceUrl: null };
  for (const path of ["careers", "career", "jobs", "join-us"]) {
    try {
      const url = new URL(`/${path}`, website);
      const response = await resilientFetch(
        url.toString(),
        {},
        { revalidate: 86_400, timeoutMs: 5_000 },
      );
      const parsed = parseCareerPage(await response.text());
      if (parsed.roles.length) return { ...parsed, sourceUrl: url.toString() };
    } catch {
      // try the next common careers path
    }
  }
  return { roles: [], aiRoleCount: 0, sourceUrl: null };
}

function readNewsFeed(query: string, limit: number): Promise<NewsFeedItem[]> {
  const url = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`;
  return resilientFetch(
    url,
    { headers: { Accept: "application/rss+xml, application/xml, text/xml" } },
    { revalidate: 600, timeoutMs: 5_500 },
  )
    .then((response) => response.text())
    .then((text) => {
      const parsed = new XMLParser({ ignoreAttributes: false }).parse(
        text,
      ) as unknown;
      if (
        !isRecord(parsed) ||
        !isRecord(parsed.rss) ||
        !isRecord(parsed.rss.channel)
      )
        return [];
      const rawItems = parsed.rss.channel.item;
      const items = Array.isArray(rawItems)
        ? rawItems
        : rawItems
          ? [rawItems]
          : [];
      return items
        .filter(isRecord)
        .flatMap((item, index) => {
          const title = typeof item.title === "string" ? item.title : "";
          const link = typeof item.link === "string" ? item.link : "";
          if (!title || !link) return [];
          const source = typeof item.source === "string" ? item.source : "News";
          const publishedAt =
            typeof item.pubDate === "string"
              ? item.pubDate
              : new Date().toISOString();
          const publishedTime = new Date(publishedAt).getTime();
          if (!Number.isFinite(publishedTime)) return [];
          const sourceSuffix = ` - ${source}`;
          const cleanTitle = title.endsWith(sourceSuffix)
            ? title.slice(0, -sourceSuffix.length)
            : title;
          return [
            {
              id: `${index}-${title.slice(0, 30)}`,
              title: cleanTitle,
              url: link,
              source,
              publishedAt: new Date(publishedAt).toISOString(),
            },
          ];
        })
        .slice(0, limit);
    })
    .catch(() => []);
}

async function companyAiNews(companyName: string): Promise<NewsFeedItem[]> {
  const query = encodeURIComponent(
    `"${companyName}" (AI OR "artificial intelligence" OR "machine learning")`,
  );
  return readNewsFeed(query, 6);
}

/**
 * Extracts promoter / public ownership percentages from the screener
 * shareholding table. Screener columns run most-recent period first, so the
 * first numeric value is the latest sample.
 */
export function extractOwnership(table: FinancialTable | null): {
  promoterPct: number | null;
  publicPct: number | null;
} {
  if (!table) return { promoterPct: null, publicPct: null };
  const read = (pattern: RegExp) => {
    const row = table.rows.find((candidate) => pattern.test(candidate.label));
    if (!row) return null;
    const cell = row.values.find((value) => {
      if (typeof value === "number") return true;
      return typeof value === "string" && /%/.test(value);
    });
    if (typeof cell === "number") return Number.isFinite(cell) ? cell : null;
    if (typeof cell === "string") {
      const parsed = Number(cell.replace(/[^\d.-]/g, ""));
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };
  return {
    promoterPct: read(/^promoters?$/i),
    publicPct: read(/^public( shareholding)?$/i),
  };
}

export interface OrgSignalInput {
  people: OrgPerson[];
  ownership: { promoterPct: number | null; publicPct: number | null };
  headcount: { total: number | null; year: number | null };
  hiring: CareerPostings;
  parent?: ParentCompany | null;
}

/**
 * Rule-based interpretation of the org & people data, so the panel reads as a
 * signal rather than a raw dump. No LLM dependency.
 */
export function buildOrgSignal(input: OrgSignalInput): string {
  const { people, ownership, headcount, hiring, parent } = input;
  const parts: string[] = [];
  const founder = people.find((person) => person.tier === "founder");
  const ceo =
    people.find((person) => person.role === "Chief Executive Officer") ??
    people.find(
      (person) =>
        person.role !== null && /chief executive officer/i.test(person.role),
    );
  const chair = people.find((person) => person.role === "Chairperson");
  const boardCount = people.filter((person) => person.tier === "board").length;

  if (founder && ceo && founder.name !== ceo.name) {
    parts.push(
      `Founded by ${founder.name}; ${ceo.name} leads as CEO — approach the founder for vision, the CEO for execution.`,
    );
  } else if (founder) {
    parts.push(`Founded by ${founder.name}.`);
  } else if (ceo) {
    parts.push(`${ceo.name} leads as CEO.`);
  }
  if (chair) parts.push(`The board is chaired by ${chair.name}.`);
  if (parent) {
    const context = [
      parent.industry,
      parent.country ? `based in ${parent.country}` : null,
    ]
      .filter(Boolean)
      .join(", ");
    parts.push(
      `Part of ${parent.name}${context ? ` (${context})` : ""} — check the parent for group-level exposure.`,
    );
  }
  if (boardCount)
    parts.push(
      `${boardCount} board member${boardCount === 1 ? "" : "s"} identified.`,
    );

  if (ownership.promoterPct !== null) {
    parts.push(`Promoters hold ${ownership.promoterPct}% of the company.`);
  } else if (ownership.publicPct !== null) {
    parts.push(
      `Public shareholders hold ${ownership.publicPct}% of the company.`,
    );
  }

  if (headcount.total !== null) {
    parts.push(
      `Reports ~${headcount.total.toLocaleString("en")} employees${headcount.year ? ` (${headcount.year})` : ""}.`,
    );
  }

  if (hiring.roles.length) {
    const ratio = hiring.aiRoleCount / hiring.roles.length;
    const adoption =
      ratio >= 0.5
        ? "a strong"
        : ratio >= 0.25
          ? "a moderate"
          : hiring.aiRoleCount > 0
            ? "an early"
            : "no visible";
    parts.push(
      `${hiring.roles.length} open roles found on the careers page, ${hiring.aiRoleCount} AI-related — ${adoption} AI-adoption signal.`,
    );
  }

  if (!parts.length)
    return "No key people were identified in public records — verify the target before outreach.";
  return parts.join(" ");
}

interface NewsFeedItem {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string;
}

async function personNews(
  personName: string,
  companyName: string,
): Promise<NewsFeedItem[]> {
  const query = encodeURIComponent(`"${personName}" "${companyName}"`);
  return readNewsFeed(query, 3);
}

const LEADERSHIP_PATHS = [
  "leadership",
  "about/leadership",
  "about-us/leadership",
  "board-of-directors",
  "management",
  "team",
  "about-us/team",
];

/**
 * The company's own site is the primary source for its current leadership —
 * Wikidata claims trail reality by years. Tries the common leadership page
 * paths and returns the first one that yields parsable entries.
 */
async function websiteLeadership(website: string | null): Promise<OrgPerson[]> {
  if (!website) return [];
  for (const path of LEADERSHIP_PATHS) {
    try {
      const url = new URL(`/${path}`, website);
      const response = await resilientFetch(
        url.toString(),
        {},
        { revalidate: 86_400, timeoutMs: 5_000 },
      );
      const entries = parseLeadershipPage(await response.text());
      if (!entries.length) continue;
      const pageUrl = url.toString();
      return entries.map((entry) => ({
        name: entry.name,
        role: entry.role,
        tier: "executive" as const,
        wikipediaUrl: null,
        linkedinUrl: linkedinSearchUrl(entry.name),
        sourceUrl: pageUrl,
      }));
    } catch {
      // try the next common leadership path
    }
  }
  return [];
}

export function parentIdFromEntity(entity: unknown): string | null {
  const values = claimValues(entity, CLAIM_PROPS.parent);
  const first = values.find(isRecord);
  return first && typeof first.id === "string" ? first.id : null;
}

/**
 * First ownership claim resolving the parent: P749 (parent organization),
 * then P127 (owned by), then P361 (part of). The first explicit claim wins;
 * the rest are ignored.
 */
export function parentClaimId(entity: unknown): string | null {
  for (const property of PARENT_CLAIM_PROPS) {
    const value = claimValues(entity, property).find(isRecord);
    if (value && typeof value.id === "string") return value.id;
  }
  return null;
}

/**
 * True when a Wikidata entity is a human (instance of: human, Q5). Parent
 * detection must reject people: a person is never a "parent company", and
 * Wikidata's P127 (owned by) routinely points at the founding family member
 * (e.g. Reliance Industries -> Mukesh Ambani).
 */
export function isHumanEntity(entity: unknown): boolean {
  return claimValues(entity, CLAIM_PROPS.instanceOf).some(
    (value) => isRecord(value) && value.id === "Q5",
  );
}

/**
 * Extraction of "owned by X" / "subsidiary of X" / "part of X" style clauses
 * from free prose (Wikipedia extracts routinely state ownership where
 * Wikidata carries no claim). Reads a run of capitalized words after the
 * trigger phrase, stopping at sentence-continuation words ("It", "The", ...)
 * so abbreviations like "Co." and "Ltd." stay part of the name.
 */
const PARENT_CLAUSE =
  /\b(?:owned by|brand of|subsidiary of|a subsidiary of|division of|a division of|part of|a unit of|unit of)\b/i;
const PARENT_CONTINUATION_STOP = new Set([
  "its",
  "it",
  "the",
  "a",
  "an",
  "which",
  "and",
  "was",
  "is",
  "has",
  "had",
  "established",
  "founded",
  "now",
  "today",
  "in",
  "at",
  "with",
  "as",
  "later",
  "originally",
  "also",
  "however",
  "following",
  "offered",
  "operates",
  "operating",
  "following",
]);

export function extractParentFromText(text: string): string | null {
  if (!text) return null;
  const match = PARENT_CLAUSE.exec(text);
  if (!match) return null;
  const words = text.slice(match.index + match[0].length).split(/\s+/);
  const parts: string[] = [];
  for (const word of words) {
    const cleaned = word.replace(/^[^A-Za-z&]+/, "").replace(/[,;:]+$/, "");
    if (!cleaned) continue;
    if (!/^[A-Z&]/.test(cleaned)) break;
    if (PARENT_CONTINUATION_STOP.has(cleaned.toLowerCase())) break;
    if (parts.length >= 6) break;
    parts.push(cleaned);
  }
  const name = parts.join(" ").replace(/[.,;:]+$/, "");
  return parts.length >= 2 && name.length >= 2 ? name : null;
}

export function itemSearchEntries(
  searchTerm: string,
): Promise<Array<{ id: string; label: string; description: string }>> {
  const url = new URL("https://www.wikidata.org/w/api.php");
  url.search = new URLSearchParams({
    action: "wbsearchentities",
    search: searchTerm,
    language: "en",
    uselang: "en",
    type: "item",
    limit: "6",
    format: "json",
    origin: "*",
  }).toString();
  return resilientFetch(url.toString(), {}, { revalidate: 86_400 })
    .then(async (response) => {
      const payload = (await response.json()) as unknown;
      if (!isRecord(payload) || !Array.isArray(payload.search)) return [];
      return payload.search.flatMap((entry) =>
        isRecord(entry) &&
        typeof entry.id === "string" &&
        typeof entry.label === "string" &&
        typeof entry.description === "string"
          ? [
              {
                id: entry.id,
                label: entry.label,
                description: entry.description,
              },
            ]
          : [],
      );
    })
    .catch(() => []);
}

/**
 * Resolves a parent item id (from a claim or a name search) into the parent
 * record with context. Best-effort — any failed step degrades to fewer
 * fields.
 */
async function resolveParentFromId(
  id: string,
  detectedVia: "wikidata" | "text",
): Promise<ParentCompany | null> {
  try {
    const items = await wikidataItems([id]);
    const parentItem = items[id];
    const name = itemLabel(parentItem);
    if (!name || isHumanEntity(parentItem)) return null;
    const industryId = claimValues(parentItem, CLAIM_PROPS.industry).find(
      isRecord,
    ) as { id?: unknown } | undefined;
    const countryId = claimValues(parentItem, CLAIM_PROPS.country).find(
      isRecord,
    ) as { id?: unknown } | undefined;
    const contextIds = [industryId?.id, countryId?.id].filter(
      (id): id is string => typeof id === "string",
    );
    const contextItems = await wikidataItems(contextIds);
    const industry =
      typeof industryId?.id === "string"
        ? itemLabel(contextItems[industryId.id])
        : null;
    const country =
      typeof countryId?.id === "string"
        ? itemLabel(contextItems[countryId.id])
        : null;
    const wikiTitle = itemWikiTitle(parentItem);
    return {
      name,
      industry,
      country,
      wikipediaUrl: wikiTitle
        ? `https://en.wikipedia.org/wiki/${encodeURIComponent(wikiTitle.replace(/ /g, "_"))}`
        : null,
      wikidataUrl: `https://www.wikidata.org/wiki/${id}`,
      query: wikiTitle ?? name,
      detectedVia,
    };
  } catch {
    return null;
  }
}

/** Resolves a text-extracted parent name, optionally via Wikidata search. */
async function resolveParentByName(name: string): Promise<ParentCompany> {
  const entries = await itemSearchEntries(name);
  const ranked = entries
    .filter((entry) => isOrganizationDescription(entry.description))
    .map((entry) => ({
      entry,
      rank: companyMatchRank(name, entry.label),
    }))
    .filter(
      (item): item is { entry: (typeof entries)[number]; rank: 0 | 1 } =>
        item.rank === 0 || item.rank === 1,
    )
    .sort((left, right) => left.rank - right.rank);
  const id = ranked[0]?.entry.id ?? null;
  if (!id) {
    return {
      name,
      industry: null,
      country: null,
      wikipediaUrl: null,
      wikidataUrl: null,
      query: name,
      detectedVia: "text",
    };
  }
  const resolved = await resolveParentFromId(id, "text");
  return (
    resolved ?? {
      name,
      industry: null,
      country: null,
      wikipediaUrl: null,
      wikidataUrl: null,
      query: name,
      detectedVia: "text",
    }
  );
}

/** True when the parent candidate normalizes to the company itself. */
export function isSelfParent(
  identityName: string,
  parentName: string,
): boolean {
  return (
    normalizeCompanyName(identityName) === normalizeCompanyName(parentName)
  );
}

/**
 * Multi-source parent detection. Claim-based (P749 > P127 > P361) when the
 * entity carries ownership claims; otherwise "owned by X" style prose in the
 * public record. One level only — the parent's own parent is out of scope.
 */
export async function detectParent(
  entity: unknown,
  identity: CompanyIdentity | null = null,
): Promise<ParentCompany | null> {
  const claimId = parentClaimId(entity);
  if (claimId) return resolveParentFromId(claimId, "wikidata");
  if (!identity) return null;
  const textName = extractParentFromText(identity.overview);
  if (!textName || isSelfParent(identity.name, textName)) return null;
  return resolveParentByName(textName);
}

/**
 * Text-only parent detection for identities with no Wikidata entity in hand
 * (domain-based identities, failed org-people lookups, ...). Runs only when
 * the identity already exists so a failed helper never blocks the report.
 */
export async function resolveParentFromOverview(
  identity: CompanyIdentity,
): Promise<ParentCompany | null> {
  return detectParent({}, identity);
}

const parentItemSchema = z.object({
  entities: z
    .record(
      z.string(),
      z.object({
        labels: z
          .record(z.string(), z.object({ value: z.string() }))
          .optional(),
        sitelinks: z
          .record(
            z.string(),
            z.object({
              title: z.string().optional().default(""),
            }),
          )
          .optional(),
        claims: z.record(z.string(), z.array(z.unknown())).optional(),
      }),
    )
    .optional(),
});

async function wikidataItems(ids: string[]): Promise<Record<string, unknown>> {
  if (!ids.length) return {};
  const url = new URL("https://www.wikidata.org/w/api.php");
  url.search = new URLSearchParams({
    action: "wbgetentities",
    ids: [...new Set(ids)].join("|"),
    props: "labels|sitelinks|claims",
    format: "json",
    origin: "*",
  }).toString();
  const response = await resilientFetch(
    url.toString(),
    {},
    { revalidate: 86_400 },
  );
  const payload = parentItemSchema.parse(await response.json());
  return payload.entities ?? {};
}

export function itemLabel(item: unknown): string | null {
  if (
    isRecord(item) &&
    isRecord(item.labels) &&
    isRecord(item.labels.en) &&
    typeof item.labels.en.value === "string"
  ) {
    return item.labels.en.value;
  }
  if (
    isRecord(item) &&
    isRecord(item.labels) &&
    isRecord(item.labels.mul) &&
    typeof item.labels.mul.value === "string"
  ) {
    return item.labels.mul.value;
  }
  return itemWikiTitle(item);
}

function itemWikiTitle(item: unknown): string | null {
  return isRecord(item) &&
    isRecord(item.sitelinks) &&
    isRecord(item.sitelinks.enwiki) &&
    typeof item.sitelinks.enwiki.title === "string"
    ? item.sitelinks.enwiki.title
    : null;
}

/**
 * How much verified public ground this panel stands on, 0..1. Site-confirmed
 * leadership is the strongest evidence; every further corroborating source
 * (headcount, ownership, hiring, AI news, activity) adds weight.
 */
export function computeOrgConfidence(input: {
  siteLeaders: number;
  people: number;
  headcount: number | null;
  ownership: { promoterPct: number | null; publicPct: number | null };
  hiringRoles: number;
  aiNews: number;
  activity: number;
}): number {
  let score = 0;
  if (input.siteLeaders > 0) score += 0.4;
  if (input.people >= 2) score += 0.15;
  else if (input.people === 1) score += 0.1;
  if (input.headcount !== null) score += 0.15;
  if (
    input.ownership.promoterPct !== null ||
    input.ownership.publicPct !== null
  )
    score += 0.15;
  if (input.hiringRoles > 0) score += 0.1;
  if (input.aiNews > 0) score += 0.1;
  if (input.activity > 0) score += 0.1;
  return Math.min(1, score);
}

export async function getOrgPeopleIntelligence(
  identity: CompanyIdentity,
  shareholding: FinancialTable | null,
): Promise<OrgPeopleData> {
  let people: OrgPerson[] = [];
  let headcount: { total: number | null; year: number | null } = {
    total: null,
    year: null,
  };
  let headcountSamples: Array<{ year: number | null; total: number }> = [];
  let wikidataUrl: string | null = null;
  let parent: ParentCompany | null = null;
  if (/en\.wikipedia\.org\/wiki\//.test(identity.wikipediaUrl)) {
    try {
      const propsUrl = new URL("https://en.wikipedia.org/w/api.php");
      propsUrl.search = new URLSearchParams({
        action: "query",
        prop: "pageprops",
        titles: decodeURIComponent(
          identity.wikipediaUrl.split("/wiki/")[1] ?? "",
        ),
        format: "json",
        origin: "*",
      }).toString();
      const propsResponse = await resilientFetch(
        propsUrl.toString(),
        {},
        { revalidate: 86_400 },
      );
      const props = (await propsResponse.json()) as unknown;
      const page =
        isRecord(props) && isRecord(props.query) && isRecord(props.query.pages)
          ? Object.values(props.query.pages).find(isRecord)
          : null;
      const itemId =
        page &&
        isRecord(page.pageprops) &&
        typeof page.pageprops.wikibase_item === "string"
          ? page.pageprops.wikibase_item
          : null;
      if (itemId) {
        wikidataUrl = `https://www.wikidata.org/wiki/${itemId}`;
        const entityResponse = await resilientFetch(
          `https://www.wikidata.org/wiki/Special:EntityData/${itemId}.json`,
          {},
          { revalidate: 86_400 },
        );
        const payload = (await entityResponse.json()) as unknown;
        const entity =
          isRecord(payload) && isRecord(payload.entities)
            ? payload.entities[itemId]
            : null;
        if (entity) {
          people = await resolvePeople(entity, wikidataUrl);
          const extracted = extractHeadcount(entity);
          headcount = {
            total: extracted.total,
            year: extracted.year,
          };
          headcountSamples = extracted.samples;
          parent = await detectParent(entity, identity).catch(() => null);
        }
      }
    } catch {
      // wikidata people are best-effort; fall through to the website path
    }
  }

  const websiteLeaders = await websiteLeadership(identity.website);
  const wikiSupplement = supplementFromWikidata(people, websiteLeaders);
  const merged = mergePeople(websiteLeaders, wikiSupplement);

  const activity: PersonActivity[] = [];
  const priority = [
    ...merged.filter((person) => person.tier === "founder"),
    ...merged.filter(
      (person) =>
        person.role === "Chief Executive Officer" ||
        person.role === "Chairperson",
    ),
  ].slice(0, 3);
  await Promise.all(
    priority.map(async (person) => {
      const headlines = await personNews(person.name, identity.name).catch(
        () => [] as NewsItem[],
      );
      if (headlines.length)
        activity.push({ name: person.name, role: person.role, headlines });
    }),
  );
  activity.sort((left, right) => left.name.localeCompare(right.name));

  const ownership = extractOwnership(shareholding);
  const [hiring, aiNews] = await Promise.all([
    fetchCareerRoles(identity.website),
    companyAiNews(identity.name).catch(() => [] as NewsFeedItem[]),
  ]);
  const confidence = computeOrgConfidence({
    siteLeaders: websiteLeaders.length,
    people: merged.length,
    headcount: headcount.total,
    ownership,
    hiringRoles: hiring.roles.length,
    aiNews: aiNews.length,
    activity: activity.length,
  });
  const signal = buildOrgSignal({
    people: merged,
    ownership,
    headcount,
    hiring,
    parent,
  });

  return {
    people: merged,
    activity,
    ownership: {
      ...ownership,
      sourceUrl: shareholding?.sourceUrl ?? null,
    },
    headcount: {
      ...headcount,
      samples: headcountSamples,
      sourceUrl: headcountSamples.length ? wikidataUrl : null,
    },
    hiring,
    aiNews,
    parent,
    confidence,
    signal,
  };
}

function mergePeople(primary: OrgPerson[], extra: OrgPerson[]): OrgPerson[] {
  const people = [...primary];
  const names = new Set(primary.map((person) => person.name.toLowerCase()));
  for (const person of extra) {
    if (names.has(person.name.toLowerCase())) continue;
    names.add(person.name.toLowerCase());
    people.push(person);
  }
  return people;
}

/**
 * The company's site outranks Wikidata for who leads now: Wikipeople only fill
 * roles the site didn't report — founders always (they're historical facts the
 * site rarely lists), plus CEO/chairperson only when the site names nobody in
 * that role. A stale undated CEO claim (e.g. a 2020 departure never marked as
 * ended) therefore never shadows the site's current leadership.
 */
export function supplementFromWikidata(
  wikiPeople: OrgPerson[],
  sitePeople: OrgPerson[],
): OrgPerson[] {
  const siteHasCeo = sitePeople.some(
    (person) =>
      person.role !== null && /chief executive officer/i.test(person.role),
  );
  const siteHasChair = sitePeople.some(
    (person) =>
      person.role !== null &&
      /(chairman|chairperson|chair of|chair$)/i.test(person.role),
  );
  return wikiPeople.filter(
    (person) =>
      person.tier === "founder" ||
      (person.role === "Chief Executive Officer" && !siteHasCeo) ||
      (person.role === "Chairperson" && !siteHasChair),
  );
}
