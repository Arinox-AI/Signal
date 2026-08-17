import { describe, expect, it } from "vitest";

import { compactNumber, dateLabel, relativeDate } from "./format";

describe("format helpers", () => {
  it("formats large metrics without false precision", () => {
    expect(compactNumber(421_236)).toMatch(/421/);
    expect(compactNumber(0)).toBe("0");
  });

  it("falls back safely for invalid dates", () => {
    expect(dateLabel("not-a-date")).toBe("Recently");
  });

  it("describes the current day accessibly", () => {
    expect(relativeDate(new Date().toISOString())).toBe("today");
  });
});
