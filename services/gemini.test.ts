import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { fallbackBusinessDeepDive } from "./gemini";
import type { CompanyIdentity } from "@/lib/types/company";

function identity(overview: string): CompanyIdentity {
  return {
    name: "Test Corp",
    description: "Indian software company",
    overview,
    wikipediaUrl: "https://en.wikipedia.org/wiki/Test_Corp",
    lei: null,
    imageUrl: null,
    website: "https://testcorp.example",
    countryName: "India",
    industry: "Software",
    foundedYear: 1999,
    primarySource: {
      id: "wikipedia",
      label: "Wikipedia company profile",
      url: "https://en.wikipedia.org/wiki/Test_Corp",
    },
    sourceReferences: [],
    confidence: {
      level: "high",
      label: "verified",
      reason: "test",
      ambiguous: false,
    },
    provenance: {
      name: { sourceIds: ["wikipedia"], confidence: "high" },
      description: { sourceIds: ["wikipedia"], confidence: "high" },
      overview: { sourceIds: ["wikipedia"], confidence: "high" },
      website: { sourceIds: ["wikipedia"], confidence: "high" },
      countryName: { sourceIds: ["wikipedia"], confidence: "high" },
      industry: { sourceIds: ["wikipedia"], confidence: "high" },
      foundedYear: { sourceIds: ["wikipedia"], confidence: "high" },
      lei: { sourceIds: ["wikipedia"], confidence: "low" },
    },
  };
}

describe("fallbackBusinessDeepDive", () => {
  it("builds the what-section from the public overview", () => {
    const deepDive = fallbackBusinessDeepDive(
      identity(
        "Test Corp builds enterprise software. It develops accounting platforms for mid-sized firms.",
      ),
      null,
    );
    expect(deepDive.what).toContain("Test Corp builds enterprise software");
    expect(deepDive.generated).toBe(false);
  });

  it("falls back to the description when no overview exists", () => {
    const deepDive = fallbackBusinessDeepDive(identity(""), null);
    expect(deepDive.what.toLowerCase()).toContain("indian software company");
  });

  it("keeps unknown facts honest instead of inventing them", () => {
    const deepDive = fallbackBusinessDeepDive(identity(""), null);
    expect(deepDive.process).toContain("No public source described");
    expect(deepDive.customers).toContain("No public source named");
  });
});
