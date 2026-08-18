import type {
  CompanyIdentityField,
  CompanyProvenance,
  ConfidenceLevel,
  FieldProvenance,
  SourceId,
} from "@/lib/types/company";

type ProvenanceOverride = Partial<FieldProvenance>;

function field(
  sourceIds: SourceId[],
  confidence: ConfidenceLevel,
  override?: ProvenanceOverride,
): FieldProvenance {
  return {
    sourceIds: override?.sourceIds ?? sourceIds,
    confidence: override?.confidence ?? confidence,
    ...(override?.note ? { note: override.note } : {}),
  };
}

export function createCompanyProvenance(
  sourceIds: SourceId[],
  confidence: ConfidenceLevel,
  overrides: Partial<Record<CompanyIdentityField, ProvenanceOverride>> = {},
): CompanyProvenance {
  return {
    name: field(sourceIds, confidence, overrides.name),
    description: field(sourceIds, confidence, overrides.description),
    overview: field(sourceIds, confidence, overrides.overview),
    website: field(sourceIds, confidence, overrides.website),
    countryName: field(sourceIds, confidence, overrides.countryName),
    industry: field(sourceIds, confidence, overrides.industry),
    foundedYear: field(sourceIds, confidence, overrides.foundedYear),
    lei: field(sourceIds, confidence, overrides.lei),
  };
}
