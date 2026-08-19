import {
  companyMatchRank,
  normalizeCompanyName,
  normalizeCompanyTokens,
  type CompanyMatchRank,
} from "@/lib/company-query";

export interface ScreenerCandidate {
  name: string;
  url: string;
}

export interface RankedCandidate extends ScreenerCandidate {
  rank: CompanyMatchRank;
  identityRank: CompanyMatchRank | null;
  tokenCount: number;
}

/**
 * Strict gate for screener candidate selection.
 *
 * Only rank 0 (exact name) and rank 1 (token superset within scope
 * qualifiers) candidates may ever be auto-shown as financial data. Rank 2
 * (prefix) and rank 3 (containment) are deliberately excluded.
 *
 * This is intentionally strict for every market, not just India: same-prefix
 * sibling companies (Tata Motors / Tata Motors Finance, Reliance Industries /
 * Reliance Industrial Infrastructure, Birla group entities, Siemens ...) are
 * a global pattern, and displaying one company's financials under another's
 * name costs more trust than declining to show financials at all. Do not
 * relax this to improve coverage.
 */
export function selectScreenerCandidates(
  candidates: ScreenerCandidate[],
  identityName: string,
  query: string,
): RankedCandidate[] {
  const ranked = candidates
    .map((candidate) => {
      const queryRank = companyMatchRank(query, candidate.name);
      const identityRank = companyMatchRank(identityName, candidate.name);
      const rank = Math.min(queryRank ?? 4, identityRank ?? 4);
      if (rank > 1) return null;
      return {
        ...candidate,
        rank,
        identityRank,
        tokenCount: normalizeCompanyTokens(candidate.name).length,
      };
    })
    .filter((candidate): candidate is RankedCandidate => candidate !== null);

  const seen = new Set<string>();
  const unique: RankedCandidate[] = [];
  for (const candidate of ranked) {
    const key = normalizeCompanyName(candidate.name);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(candidate);
  }

  // Definite answer first: rank 0 before rank 1; within a rank, prefer the
  // candidate that matches the resolved identity exactly; then the shortest
  // name (fewest extra tokens); then alphabetical order for stability.
  return unique.sort((left, right) => {
    if (left.rank !== right.rank) return left.rank - right.rank;
    const leftIdentity = left.identityRank === 0 ? 0 : 1;
    const rightIdentity = right.identityRank === 0 ? 0 : 1;
    if (leftIdentity !== rightIdentity) return leftIdentity - rightIdentity;
    if (left.tokenCount !== right.tokenCount)
      return left.tokenCount - right.tokenCount;
    return left.name.localeCompare(right.name);
  });
}

export function selectScreenerCandidate(
  candidates: ScreenerCandidate[],
  identityName: string,
  query: string,
): RankedCandidate | null {
  return selectScreenerCandidates(candidates, identityName, query)[0] ?? null;
}
