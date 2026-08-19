import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  buildFallbackPrioritiesSignal,
  hiringSkillClusters,
  isLeakStory,
  leakQuery,
  parseBlogPage,
  prioritySentencesFromConcall,
  type PrioritiesEvidence,
} from "./priorities";
import type { CompanyIdentity } from "@/lib/types/company";

function identity(): CompanyIdentity {
  return {
    name: "Test Corp",
    description: "Indian software company",
    overview: "Test Corp builds enterprise software.",
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

function evidence(
  overrides: Partial<PrioritiesEvidence> = {},
): PrioritiesEvidence {
  return {
    identity: identity(),
    concall: {
      title: "Q1 FY27 Earnings Call",
      date: "2026-07-15",
      url: "https://example.com/concall",
      pdf: false,
      transcriptText:
        "Operator: welcome everyone. We will focus on AI-led transformation and invest in generative AI this year. We are expanding our cloud platform in the next quarter. Thank you.",
    },
    blogSignals: [
      {
        title: "Announcing our new AI platform",
        url: "https://example.com/blog/a",
        date: "2026-08-01",
      },
    ],
    skillClusters: [
      {
        skill: "AI & machine learning",
        count: 3,
        roles: ["AI Engineer", "ML Engineer"],
      },
    ],
    internalSignals: [],
    website: "https://testcorp.example",
    ...overrides,
  };
}

describe("parseBlogPage", () => {
  it("extracts dated post titles and drops boilerplate", () => {
    const signals = parseBlogPage(
      `<article><h2>Announcing our AI platform</h2><time datetime="2026-08-01"></time></article>
       <nav><h2>Subscribe to our newsletter</h2></nav>
       <footer><h3>Privacy policy</h3></footer>`,
      "https://testcorp.example/blog",
    );
    expect(signals[0]?.title).toBe("Announcing our AI platform");
    expect(signals[0]?.date).toBe("2026-08-01");
    expect(signals).toHaveLength(1);
  });

  it("drops short nav/menu headings that are not posts", () => {
    const signals = parseBlogPage(
      `<nav><h2>Industries</h2><a href="/industries"></a></nav>
       <header><h1>Navigate your next</h1></header>
       <section><h2>Services</h2><a href="/services"></a></section>
       <li><h3>Test Corp ships a new AI platform</h3><a href="/news/ai-platform"></a></li>`,
      "https://testcorp.example/newsroom",
    );
    expect(signals.map((s) => s.title)).toEqual([
      "Test Corp ships a new AI platform",
    ]);
  });
});

describe("prioritySentencesFromConcall", () => {
  it("keeps sentences that state priorities and skips boilerplate", () => {
    const sentences = prioritySentencesFromConcall(
      "Operator: welcome everyone. We will focus on AI-led transformation and invest in generative AI this year. We are expanding our cloud platform in the next quarter. ",
    );
    expect(sentences.length).toBe(2);
    expect(sentences.join(" ")).toContain("focus on AI-led transformation");
    expect(sentences.join(" ")).toContain("expanding our cloud platform");
  });
});

describe("hiringSkillClusters", () => {
  it("clusters roles by skill emphasis, most numerous first", () => {
    const clusters = hiringSkillClusters([
      { title: "AI Engineer", ai: true },
      { title: "ML Researcher", ai: true },
      { title: "Sales Executive", ai: false },
    ]);
    expect(clusters[0]?.skill).toBe("AI & machine learning");
    expect(clusters[0]?.count).toBe(2);
  });
});

describe("isLeakStory / leakQuery", () => {
  it("builds a targeted Google News query", () => {
    expect(leakQuery("Test Corp")).toContain("town hall");
    expect(leakQuery("Test Corp")).toContain("all hands");
  });

  it("only accepts public records of internal announcements", () => {
    expect(isLeakStory("Test Corp leaked internal memo on AI hiring")).toBe(
      true,
    );
    expect(
      isLeakStory("Test Corp shares rise after town hall on results"),
    ).toBe(false);
  });
});

describe("buildFallbackPrioritiesSignal", () => {
  it("prioritizes hiring and earnings-call themes with citations", () => {
    const signal = buildFallbackPrioritiesSignal(evidence());
    expect(signal.generated).toBe(false);
    expect(signal.headline).toContain("hiring heavily toward");
    expect(
      signal.themes.some((t) => t.theme === "Earnings-call priorities"),
    ).toBe(true);
    expect(signal.themes[0]?.sources[0]?.sourceId).toBe("website");
  });

  it("handles a PDF transcript honestly as a linked-only note", () => {
    const signal = buildFallbackPrioritiesSignal(
      evidence({
        concall: {
          title: "Q1 FY27 Earnings Call",
          date: "2026-07-15",
          url: "https://example.com/concall.pdf",
          pdf: true,
          transcriptText: null,
        },
      }),
    );
    expect(
      signal.themes.some(
        (t) => t.theme === "Latest earnings call" && t.detail.includes("a PDF"),
      ),
    ).toBe(true);
  });

  it("surfaces public internal announcements when present", () => {
    const signal = buildFallbackPrioritiesSignal(
      evidence({
        internalSignals: [
          {
            id: "l1",
            title: "Leaked memo shows Test Corp plans massive AI hiring",
            url: "https://news.example/l1",
            source: "TechWire",
            publishedAt: "2026-08-10T00:00:00Z",
          },
        ],
      }),
    );
    expect(
      signal.themes.some((t) => t.theme.includes("Internal announcements")),
    ).toBe(true);
  });

  it("stays honest when there is no evidence at all", () => {
    const signal = buildFallbackPrioritiesSignal(
      evidence({
        concall: null,
        blogSignals: [],
        skillClusters: [],
        internalSignals: [],
      }),
    );
    expect(signal.headline).toContain("No public priority signals");
    expect(signal.themes).toHaveLength(0);
    expect(signal.watchItem).toBeNull();
  });
});
