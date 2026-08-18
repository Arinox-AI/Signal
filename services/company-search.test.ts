import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { orderSuggestions } from "./company-search";

interface Fixture {
  name: string;
  rank: 0 | 1 | 2 | 3 | null;
  listed?: boolean;
}

function fixture(
  name: string,
  rank: Fixture["rank"],
  listed?: boolean,
): Fixture {
  return { name, rank, listed };
}

describe("orderSuggestions", () => {
  it("puts listed companies ahead of unlisted ones at the same rank", () => {
    const ordered = orderSuggestions([
      fixture("JSW Group", 2),
      fixture("JSW Steel", 2, true),
    ]);
    expect(ordered.map((item) => item.name)).toEqual([
      "JSW Steel",
      "JSW Group",
    ]);
  });

  it("keeps listed companies ahead even when their name match is weaker", () => {
    const ordered = orderSuggestions([
      fixture("JSW Group", 0),
      fixture("JSW Steel", 2, true),
    ]);
    expect(ordered.map((item) => item.name)).toEqual([
      "JSW Steel",
      "JSW Group",
    ]);
  });

  it("ranks by match quality only within the same listed status", () => {
    const ordered = orderSuggestions([
      fixture("weak listed", 3, true),
      fixture("strong unlisted", 1),
      fixture("exact listed", 0, true),
    ]);
    expect(ordered.map((item) => item.name)).toEqual([
      "exact listed",
      "weak listed",
      "strong unlisted",
    ]);
  });

  it("keeps the original order for full ties", () => {
    const items = [
      fixture("a", 2, true),
      fixture("b", 2, true),
      fixture("c", 2, true),
    ];
    expect(orderSuggestions(items).map((item) => item.name)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("treats missing listed status like unlisted", () => {
    const ordered = orderSuggestions([
      fixture("unknown", 2),
      fixture("unlisted", 2, false),
    ]);
    expect(ordered.map((item) => item.name)).toEqual(["unknown", "unlisted"]);
  });
});
