import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  isIndianApiConfigured,
  overviewNumber,
  resolveIndianSymbol,
} from "./service";

describe("indian-api gating", () => {
  beforeEach(() => {
    vi.stubEnv("INDIANAPI_API_KEY", "");
    vi.stubEnv("INDIANAPI_BASE_URL", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reports not configured without an API key", () => {
    expect(isIndianApiConfigured()).toBe(false);
  });

  it("reports configured with an API key", () => {
    vi.stubEnv("INDIANAPI_API_KEY", "test-key");
    expect(isIndianApiConfigured()).toBe(true);
  });

  it("never resolves a symbol without a key", async () => {
    await expect(
      resolveIndianSymbol("Reliance Industries", "Reliance"),
    ).resolves.toBeNull();
  });

  it("parses overview numbers strictly", () => {
    expect(overviewNumber("₹ 1,234.50")).toBe(1234.5);
    expect(overviewNumber("-3.25%")).toBe(-3.25);
    expect(overviewNumber(84)).toBe(84);
    expect(overviewNumber("n/a")).toBeNull();
    expect(overviewNumber(null)).toBeNull();
  });
});
