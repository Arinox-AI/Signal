import "server-only";

import { z } from "zod";

import { companyMatchRank } from "@/lib/company-query";
import { resilientFetch } from "@/lib/http/request";
import { createCompanyProvenance } from "@/lib/provenance";
import type { CompanyIdentity, CompanySuggestion } from "@/lib/types/company";

const addressSchema = z.object({
  addressLines: z.array(z.string()).default([]),
  city: z.string().nullable().default(null),
  country: z.string().nullable().default(null),
  postalCode: z.string().nullable().default(null),
});

const leiRecordSchema = z.object({
  id: z.string(),
  attributes: z.object({
    lei: z.string(),
    entity: z.object({
      legalName: z.object({ name: z.string() }),
      legalAddress: addressSchema,
      headquartersAddress: addressSchema,
      jurisdiction: z.string().nullable().default(null),
      category: z.string().nullable().default(null),
      status: z.string().nullable().default(null),
      creationDate: z.string().nullable().default(null),
    }),
    registration: z.object({
      status: z.string().nullable().default(null),
      lastUpdateDate: z.string().nullable().default(null),
    }),
  }),
  links: z.object({ self: z.string().url() }),
});

const searchResponseSchema = z.object({ data: z.array(leiRecordSchema) });

type LeiRecord = z.infer<typeof leiRecordSchema>;

function regionName(code: string | null): string | null {
  if (!code) return null;
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

function entityKind(category: string | null): string {
  return (
    {
      BRANCH: "Registered branch",
      FUND: "Registered fund",
      GENERAL: "Registered legal entity",
      RESIDENT_GOVERNMENT_ENTITY: "Government entity",
      SOLE_PROPRIETOR: "Sole proprietor",
    }[category ?? ""] ?? "Registered legal entity"
  );
}

function suggestionDescription(record: LeiRecord): string {
  const entity = record.attributes.entity;
  const location = [
    entity.headquartersAddress.city ?? entity.legalAddress.city,
    regionName(
      entity.headquartersAddress.country ??
        entity.legalAddress.country ??
        entity.jurisdiction,
    ),
  ].filter(Boolean);
  return [entityKind(entity.category), ...location].join(" · ");
}

export async function searchLegalEntities(
  rawQuery: string,
): Promise<CompanySuggestion[]> {
  const query = rawQuery.trim().slice(0, 100);
  if (query.length < 2) return [];

  const url = new URL("https://api.gleif.org/api/v1/lei-records");
  url.search = new URLSearchParams({
    "filter[entity.legalName]": query,
    "page[size]": "8",
  }).toString();
  const response = await resilientFetch(
    url.toString(),
    {},
    { revalidate: 21_600, timeoutMs: 5_000 },
  );
  const payload = searchResponseSchema.parse(await response.json());

  return payload.data
    .map((record) => {
      const name = record.attributes.entity.legalName.name;
      // Shared ranker (see PLAN §7): rank 0 (exact) and rank 1 (token
      // superset within scope qualifiers) are the only acceptable matches.
      // Prefix/containment matches are deliberately excluded — same-prefix
      // legal entities (Reliance Industries vs Reliance B.V.) must not
      // surface as "the" company.
      const nameRank = companyMatchRank(query, name);
      const activeRank =
        record.attributes.entity.status === "ACTIVE" &&
        record.attributes.registration.status === "ISSUED"
          ? 0
          : 1;
      return { record, name, nameRank, activeRank };
    })
    .filter(
      (
        entry,
      ): entry is {
        record: LeiRecord;
        name: string;
        nameRank: 0 | 1;
        activeRank: number;
      } => entry.nameRank === 0 || entry.nameRank === 1,
    )
    .sort(
      (left, right) =>
        left.nameRank - right.nameRank || left.activeRank - right.activeRank,
    )
    .slice(0, 4)
    .map(({ record, name }) => ({
      id: `lei:${record.id}`,
      name,
      description: suggestionDescription(record),
      query: `lei:${record.id}`,
      source: "gleif" as const,
    }));
}

export async function getLegalEntityIdentity(
  lei: string,
): Promise<CompanyIdentity> {
  const response = await resilientFetch(
    `https://api.gleif.org/api/v1/lei-records/${encodeURIComponent(lei)}`,
    {},
    { revalidate: 21_600, timeoutMs: 5_000 },
  );
  const payload = z
    .object({ data: leiRecordSchema })
    .parse(await response.json());
  const record = payload.data;
  const entity = record.attributes.entity;
  const countryName = regionName(
    entity.headquartersAddress.country ??
      entity.legalAddress.country ??
      entity.jurisdiction,
  );
  const address = [
    ...entity.headquartersAddress.addressLines,
    entity.headquartersAddress.city,
    entity.headquartersAddress.postalCode,
    countryName,
  ]
    .filter(Boolean)
    .join(", ");
  const kind = entityKind(entity.category);
  const description = `${kind}${countryName ? ` in ${countryName}` : ""}`;
  const creationYear = entity.creationDate
    ? Number(entity.creationDate.slice(0, 4)) || null
    : null;
  const primarySource = {
    id: "gleif" as const,
    label: "GLEIF legal entity record",
    url: record.links.self,
  };

  return {
    name: entity.legalName.name,
    description,
    overview: `${entity.legalName.name} is a ${description.toLowerCase()} with Legal Entity Identifier ${record.attributes.lei}.${address ? ` Its registered headquarters is ${address}.` : ""}`,
    wikipediaUrl: record.links.self,
    lei: record.attributes.lei,
    imageUrl: null,
    website: null,
    countryName,
    industry: null,
    foundedYear: creationYear,
    primarySource,
    sourceReferences: [primarySource],
    confidence: {
      level: "high",
      label: "Legal entity verified",
      reason: "Resolved directly from a unique Legal Entity Identifier.",
      ambiguous: false,
    },
    provenance: createCompanyProvenance(["gleif"], "high", {
      website: {
        note: "The GLEIF record did not list an official website.",
      },
      industry: {
        note: "GLEIF does not provide an operating industry for this record.",
      },
    }),
  };
}
