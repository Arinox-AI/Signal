import { describe, expect, it } from "vitest";

import {
  companyMatchRank,
  extractDomain,
  isOrganizationDescription,
  normalizeCompanyName,
} from "./company-query";

describe("company query normalization", () => {
  it("normalizes global legal suffixes and punctuation", () => {
    expect(normalizeCompanyName("The Coca-Cola Company")).toBe("cocacola");
    expect(normalizeCompanyName("Stripe, Inc.")).toBe("stripe");
    expect(normalizeCompanyName("McDonald’s Corporation")).toBe("mcdonalds");
  });

  it("extracts official domains without accepting free text", () => {
    expect(extractDomain("https://www.example.co.in/about")).toBe(
      "example.co.in",
    );
    expect(extractDomain("Example Company")).toBeNull();
  });

  it("accepts companies across industries but rejects product-only brands", () => {
    expect(isOrganizationDescription("Japanese automotive manufacturer")).toBe(
      true,
    );
    expect(isOrganizationDescription("international supermarket chain")).toBe(
      true,
    );
    expect(isOrganizationDescription("brand of toothpaste")).toBe(false);
  });
});

describe("companyMatchRank", () => {
  it("treats exact normalized names as the most definite match", () => {
    expect(companyMatchRank("Tata Steel Ltd", "Tata Steel")).toBe(0);
    expect(companyMatchRank("Reliance Industries", "Reliance Industries")).toBe(
      0,
    );
    expect(
      companyMatchRank(
        "Oil and Natural Gas Corporation",
        "Oil and Natural Gas Corp Ltd",
      ),
    ).toBe(0);
  });

  it("accepts scope qualifiers as a rank-1 superset match", () => {
    expect(companyMatchRank("Maruti Suzuki", "Maruti Suzuki India Ltd")).toBe(
      1,
    );
    expect(companyMatchRank("Infosys India", "Infosys")).toBe(1);
    expect(companyMatchRank("Suzuki Global", "Suzuki")).toBe(1);
  });

  it("rejects sibling companies with business-type extra tokens", () => {
    expect(companyMatchRank("Tata Motors", "Tata Motors Finance")).toBe(2);
    expect(
      companyMatchRank(
        "Reliance Industries",
        "Reliance Industrial Infrastructure",
      ),
    ).toBeNull();
  });

  it("ranks prefix and containment matches below supersets", () => {
    expect(companyMatchRank("Tata", "Tata Steel")).toBe(2);
    expect(companyMatchRank("Tech Infosys", "Infosys")).toBe(3);
  });

  it("returns null for unrelated names", () => {
    expect(companyMatchRank("Apple", "Tata Steel")).toBeNull();
    expect(companyMatchRank("", "Tata Steel")).toBeNull();
  });
});
