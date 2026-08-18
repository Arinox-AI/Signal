import { describe, expect, it } from "vitest";

import { createCompanyProvenance } from "./provenance";

describe("company provenance", () => {
  it("assigns source IDs to every identity field and supports field overrides", () => {
    const provenance = createCompanyProvenance(["wikipedia"], "medium", {
      foundedYear: {
        sourceIds: ["wikidata"],
        confidence: "high",
      },
    });

    expect(provenance.name).toEqual({
      sourceIds: ["wikipedia"],
      confidence: "medium",
    });
    expect(provenance.foundedYear).toEqual({
      sourceIds: ["wikidata"],
      confidence: "high",
    });
    expect(provenance.lei.sourceIds).toEqual(["wikipedia"]);
  });
});
