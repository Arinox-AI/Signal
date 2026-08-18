const LEGAL_SUFFIXES = new Set([
  "ag",
  "co",
  "company",
  "corp",
  "corporation",
  "gmbh",
  "group",
  "holdings",
  "inc",
  "incorporated",
  "intl",
  "limited",
  "llc",
  "ltd",
  "nv",
  "plc",
  "pty",
  "sa",
]);

/**
 * Tokens that only describe the geographic scope of an entity rather than its
 * business. These are the ONLY "extra" tokens allowed when matching names on a
 * token-superset basis. Business-type words (finance, power, chemicals,
 * motors, ...) must never be treated this way: they distinguish sibling
 * companies (Tata Motors vs Tata Motors Finance), and conflating them is
 * exactly the wrong-company mistake the listing resolver must avoid.
 */
const SCOPE_QUALIFIERS = new Set([
  "asia",
  "global",
  "india",
  "indian",
  "international",
  "worldwide",
]);

function normalizedWords(value: string): string[] {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .filter((word, index) => !(index === 0 && word === "the"))
    .filter((word) => !LEGAL_SUFFIXES.has(word));
}

export function normalizeCompanyTokens(value: string): string[] {
  return normalizedWords(value);
}

export function normalizeCompanyName(value: string): string {
  return normalizedWords(value).join("");
}

/**
 * Ranks how confidently a candidate company name matches a query, from most to
 * least definite:
 *
 * 0 - exact after normalization (legal suffixes, case, punctuation stripped)
 * 1 - token superset: every token of both names agrees, and any "extra"
 *     tokens on either side are scope qualifiers only ("Maruti Suzuki" matches
 *     "Maruti Suzuki India Ltd"; "Tata Motors" does NOT match "Tata Motors
 *     Finance")
 * 2 - prefix match of the concatenated normalized names
 * 3 - containment match of the concatenated normalized names
 * null - no relation
 */
export type CompanyMatchRank = 0 | 1 | 2 | 3;

export function companyMatchRank(
  query: string,
  candidate: string,
): CompanyMatchRank | null {
  const queryTokens = normalizedWords(query);
  const candidateTokens = normalizedWords(candidate);
  if (!queryTokens.length || !candidateTokens.length) return null;
  const joinedQuery = queryTokens.join("");
  const joinedCandidate = candidateTokens.join("");
  if (joinedQuery === joinedCandidate) return 0;
  const supersetWithinScope =
    queryTokens.every(
      (token) => candidateTokens.includes(token) || SCOPE_QUALIFIERS.has(token),
    ) &&
    candidateTokens.every(
      (token) => queryTokens.includes(token) || SCOPE_QUALIFIERS.has(token),
    );
  if (supersetWithinScope) return 1;
  if (
    joinedQuery.startsWith(joinedCandidate) ||
    joinedCandidate.startsWith(joinedQuery)
  )
    return 2;
  if (
    joinedQuery.includes(joinedCandidate) ||
    joinedCandidate.includes(joinedQuery)
  )
    return 3;
  return null;
}

export function extractDomain(value: string): string | null {
  const candidate = value.trim().toLowerCase();
  if (!candidate || candidate.includes(" ")) return null;
  try {
    const url = new URL(
      candidate.startsWith("http://") || candidate.startsWith("https://")
        ? candidate
        : `https://${candidate}`,
    );
    const hostname = url.hostname.replace(/^www\./, "");
    return hostname.includes(".") && /^[a-z0-9.-]+$/.test(hostname)
      ? hostname
      : null;
  } catch {
    return null;
  }
}

export function domainSearchTerm(domain: string): string {
  return domain.split(".")[0]?.replace(/[-_]+/g, " ") ?? domain;
}

export function isOrganizationDescription(description: string): boolean {
  return /(airline|automaker|bank|brewery|business|chain|company|conglomerate|cooperative|corporation|enterprise|firm|group|hotel|manufacturer|marketplace|media|multinational|nonprofit|organisation|organization|pharmaceutical|publisher|restaurant|retailer|services|startup|studio|supermarket|technology|telecommunications)/i.test(
    description,
  );
}
