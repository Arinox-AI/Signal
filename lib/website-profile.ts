import type { WebsiteMetadata } from "@/lib/types/company";

type RecordValue = Record<string, unknown>;

const isRecord = (value: unknown): value is RecordValue =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function metaContent(html: string, keys: string[]): string | null {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const attributes = Object.fromEntries(
      [...tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)].map((match) => [
        match[1]?.toLowerCase(),
        match[2] ?? "",
      ]),
    );
    const key = (attributes.name ?? attributes.property)?.toLowerCase();
    if (key && keys.includes(key) && attributes.content)
      return decodeHtml(attributes.content);
  }
  return null;
}

function countryName(value: unknown): string | null {
  const code =
    typeof value === "string"
      ? value
      : isRecord(value) && typeof value.name === "string"
        ? value.name
        : null;
  if (!code) return null;
  if (code.length !== 2) return code;
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

function organizationRecord(value: unknown): RecordValue | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const record = organizationRecord(item);
      if (record) return record;
    }
    return null;
  }
  if (!isRecord(value)) return null;
  const type = value["@type"];
  const types = Array.isArray(type) ? type : [type];
  if (
    types.some(
      (item) =>
        typeof item === "string" &&
        /^(Corporation|LocalBusiness|Organization)$/i.test(item),
    )
  )
    return value;
  for (const child of Object.values(value)) {
    const record = organizationRecord(child);
    if (record) return record;
  }
  return null;
}

function structuredOrganization(html: string): RecordValue | null {
  for (const match of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const parsed = JSON.parse(match[1]?.trim() ?? "") as unknown;
      const record = organizationRecord(parsed);
      if (record) return record;
    } catch {
      continue;
    }
  }
  return null;
}

export function parseWebsiteProfile(
  html: string,
  resolvedUrl: URL,
): WebsiteMetadata {
  const title =
    metaContent(html, ["og:title", "twitter:title"]) ??
    (decodeHtml(html.match(/<title[^>]*>([^<]+)/i)?.[1] ?? "") || null);
  const description = metaContent(html, [
    "description",
    "og:description",
    "twitter:description",
  ]);
  const organization = structuredOrganization(html);
  const address = isRecord(organization?.address) ? organization.address : null;
  const foundingDate =
    typeof organization?.foundingDate === "string"
      ? organization.foundingDate
      : null;
  const knowsAbout = organization?.knowsAbout;
  const industry = Array.isArray(knowsAbout)
    ? knowsAbout.filter((item): item is string => typeof item === "string")[0]
    : typeof knowsAbout === "string"
      ? knowsAbout
      : null;

  return {
    url: resolvedUrl.toString(),
    hostname: resolvedUrl.hostname.replace(/^www\./, ""),
    title,
    description,
    iconUrl: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(resolvedUrl.hostname)}&sz=128`,
    organizationName:
      typeof organization?.name === "string" ? organization.name : null,
    organizationDescription:
      typeof organization?.description === "string"
        ? organization.description
        : null,
    countryName: countryName(address?.addressCountry),
    locality:
      typeof address?.addressLocality === "string"
        ? address.addressLocality
        : metaContent(html, ["geo.placename"]),
    industry: industry ?? null,
    foundedYear: foundingDate ? Number(foundingDate.slice(0, 4)) || null : null,
  };
}
