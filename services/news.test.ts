import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { mergeNewsFeeds, techNewsKind } from "./news";
import type { NewsItem } from "@/lib/types/company";

function item(
  title: string,
  publishedAt: string,
  overrides: Partial<NewsItem> = {},
): NewsItem {
  return {
    id: title,
    title,
    url: `https://example.com/${encodeURIComponent(title)}`,
    source: "Test Press",
    publishedAt,
    ...overrides,
  };
}

describe("mergeNewsFeeds", () => {
  it("dedupes the same story appearing in multiple feeds", () => {
    const merged = mergeNewsFeeds(
      [
        [item("Company adopts AI", "2026-08-10T00:00:00Z")],
        [item("Company adopts AI", "2026-08-10T00:00:00Z")],
      ],
      10,
    );
    expect(merged).toHaveLength(1);
  });

  it("sorts merged items most recent first", () => {
    const merged = mergeNewsFeeds(
      [
        [item("Old story", "2026-07-01T00:00:00Z")],
        [item("New story", "2026-08-15T00:00:00Z")],
        [item("Middle story", "2026-08-01T00:00:00Z")],
      ],
      10,
    );
    expect(merged.map((entry) => entry.title)).toEqual([
      "New story",
      "Middle story",
      "Old story",
    ]);
  });

  it("respects the limit across merged feeds", () => {
    const merged = mergeNewsFeeds(
      [
        [item("A", "2026-08-15T00:00:00Z"), item("B", "2026-08-14T00:00:00Z")],
        [item("C", "2026-08-13T00:00:00Z")],
      ],
      2,
    );
    expect(merged.map((entry) => entry.title)).toEqual(["A", "B"]);
  });

  it("keeps the earliest items when feeds are empty", () => {
    expect(mergeNewsFeeds([[], []], 5)).toEqual([]);
  });
});

describe("techNewsKind", () => {
  it("classifies AI-specific titles as ai", () => {
    expect(
      techNewsKind("Infosys signs AI deal to modernise Knorr-Bremse IT"),
    ).toBe("ai");
    expect(
      techNewsKind("Company adopts machine learning for fraud detection"),
    ).toBe("ai");
  });

  it("classifies technology titles as tech", () => {
    expect(techNewsKind("Infosys migrates workloads to AWS cloud")).toBe(
      "tech",
    );
    expect(techNewsKind("Company launches new software platform")).toBe("tech");
    expect(techNewsKind("Company unveils cybersecurity offering")).toBe("tech");
  });

  it("rejects plain business and finance coverage", () => {
    expect(techNewsKind("Infosys shares rise on Q1 results")).toBeNull();
    expect(techNewsKind("Infosys announces dividend of Rs 20")).toBeNull();
    expect(techNewsKind("Infosys wins multi-year contract")).toBeNull();
    expect(techNewsKind("Infosys stock hits 52-week high")).toBeNull();
  });

  it("rejects finance-only titles even when they contain generic tech words", () => {
    expect(techNewsKind("Infosys launches Rs 10,000 crore buyback")).toBeNull();
    expect(techNewsKind("Infosys ADR trapped in Ichimoku cloud")).toBeNull();
    expect(
      techNewsKind("Company stock breaks above Bollinger band resistance"),
    ).toBeNull();
  });
});
