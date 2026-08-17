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
  "limited",
  "llc",
  "ltd",
  "nv",
  "plc",
  "sa",
]);

export function normalizeCompanyName(value: string): string {
  const words = value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .filter((word, index) => !(index === 0 && word === "the"))
    .filter((word) => !LEGAL_SUFFIXES.has(word));
  return words.join("");
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
