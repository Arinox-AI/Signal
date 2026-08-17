import { describe, expect, it } from "vitest";

import {
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
