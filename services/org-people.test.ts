import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  buildOrgSignal,
  supplementFromWikidata,
  extractHeadcount,
  extractOwnership,
  parseCareerPage,
  parseLeadershipPage,
  peopleFromEntity,
} from "./org-people";
import type { FinancialTable } from "@/lib/types/public-listing";
import type { OrgPerson } from "@/lib/types/company";

function entityWith(claims: Record<string, unknown>): unknown {
  return { claims };
}

function roleClaim(
  id: string,
  tenure?: { start?: string; end?: string },
): unknown {
  const claim: {
    mainsnak: Record<string, unknown>;
    qualifiers: Record<string, unknown[]>;
  } = {
    mainsnak: { datavalue: { value: { id, "entity-type": "item" } } },
    qualifiers: {},
  };
  if (tenure) {
    claim.qualifiers = {};
    if (tenure.start)
      claim.qualifiers.P580 = [
        { datavalue: { value: { time: `+${tenure.start}-01-01T00:00:00Z` } } },
      ];
    if (tenure.end)
      claim.qualifiers.P582 = [
        { datavalue: { value: { time: `+${tenure.end}-01-01T00:00:00Z` } } },
      ];
  }
  return claim;
}

function employeeClaim(amount: string, year?: string): unknown {
  return {
    mainsnak: {
      datavalue: { value: { amount, unit: "1" } },
    },
    qualifiers: year
      ? {
          P585: [
            { datavalue: { value: { time: `+${year}-01-01T00:00:00Z` } } },
          ],
        }
      : {},
  };
}

describe("extractHeadcount", () => {
  it("reads employee count and sample year", () => {
    const entity = entityWith({ P1128: [employeeClaim("239312", "2022")] });
    expect(extractHeadcount(entity)).toEqual({
      total: 239312,
      year: 2022,
      samples: [{ year: 2022, total: 239312 }],
    });
  });

  it("handles a claim without a sample year", () => {
    const entity = entityWith({ P1128: [employeeClaim("1200")] });
    expect(extractHeadcount(entity)).toEqual({
      total: 1200,
      year: null,
      samples: [{ year: null, total: 1200 }],
    });
  });

  it("builds a chronological trend from all dated claims", () => {
    const entity = entityWith({
      P1128: [
        employeeClaim("239312", "2022"),
        employeeClaim("195798", "2021"),
        employeeClaim("169500", "2020"),
      ],
    });
    expect(extractHeadcount(entity)).toEqual({
      total: 239312,
      year: 2022,
      samples: [
        { year: 2020, total: 169500 },
        { year: 2021, total: 195798 },
        { year: 2022, total: 239312 },
      ],
    });
  });

  it("returns nulls when absent or malformed", () => {
    expect(extractHeadcount({ claims: {} })).toEqual({
      total: null,
      year: null,
      samples: [],
    });
    expect(extractHeadcount(entityWith({ P1128: [{}] }))).toEqual({
      total: null,
      year: null,
      samples: [],
    });
    expect(extractHeadcount(null)).toEqual({
      total: null,
      year: null,
      samples: [],
    });
  });
});

describe("peopleFromEntity", () => {
  it("prefers the incumbent CEO over a former one with an end date", () => {
    const entity = entityWith({
      P169: [
        roleClaim("Q-Former-CEO", { start: "2014", end: "2017" }),
        roleClaim("Q-Current-CEO", { start: "2018" }),
      ],
    });
    const ceos = peopleFromEntity(entity).filter(
      (entry) => entry.role === "Chief Executive Officer",
    );
    expect(ceos.map((entry) => entry.id)).toEqual(["Q-Current-CEO"]);
  });

  it("treats a claim without tenure as current and prefers it over ended ones", () => {
    const entity = entityWith({
      P169: [roleClaim("Q-Former-CEO", { start: "2010", end: "2013" })],
      P488: [roleClaim("Q-Current-Chair")],
    });
    const leaders = peopleFromEntity(entity);
    expect(leaders.map((entry) => entry.id)).toEqual(["Q-Current-Chair"]);
    expect(leaders.map((entry) => entry.role)).toEqual(["Chairperson"]);
  });

  it("drops board members whose term has ended", () => {
    const entity = entityWith({
      P3320: [
        roleClaim("Q-Board-Still-Serving", { start: "2019" }),
        roleClaim("Q-Board-Left", { start: "2005", end: "2015" }),
      ],
    });
    const board = peopleFromEntity(entity).filter(
      (entry) => entry.tier === "board",
    );
    expect(board.map((entry) => entry.id)).toEqual(["Q-Board-Still-Serving"]);
  });
});

describe("supplementFromWikidata", () => {
  const person = (
    name: string,
    role: string,
    overrides: Partial<OrgPerson> = {},
  ): OrgPerson => ({
    name,
    role,
    tier: "executive",
    wikipediaUrl: `https://en.wikipedia.org/wiki/${name.replace(/ /g, "_")}`,
    linkedinUrl: null,
    ...overrides,
  });

  it("drops the Wikipedia CEO when the site names a live CEO, keeps founders", () => {
    const wikiPeople = [
      person("Azim Premji", "Founder", { tier: "founder" }),
      person("Abidali Neemuchwala", "Chief Executive Officer"),
    ];
    const sitePeople = [
      person("Srini Pallia", "Chief Executive Officer & Managing Director", {
        wikipediaUrl: null,
      }),
      person("Rishad Premji", "Executive Chairman", {
        wikipediaUrl: null,
      }),
    ];
    const result = supplementFromWikidata(wikiPeople, sitePeople);
    expect(result.map((entry) => entry.name)).toEqual(["Azim Premji"]);
  });

  it("keeps the Wikipedia CEO and chairperson when the site names none", () => {
    const wikiPeople = [
      person("N. R. Narayana Murthy", "Founder", { tier: "founder" }),
      person("Salil Parekh", "Chief Executive Officer"),
      person("Nandan Nilekani", "Chairperson"),
    ];
    const result = supplementFromWikidata(wikiPeople, []);
    expect(result.map((entry) => entry.name)).toEqual([
      "N. R. Narayana Murthy",
      "Salil Parekh",
      "Nandan Nilekani",
    ]);
  });

  it("drops the Wikipedia CEO and chairperson the site already names", () => {
    const wikiPeople = [
      person("Salil Parekh", "Chief Executive Officer"),
      person("Nandan Nilekani", "Chairperson"),
    ];
    const sitePeople = [
      person("Salil Parekh", "Chief Executive Officer & Managing Director", {
        wikipediaUrl: null,
      }),
      person("Nandan Nilekani", "Chairman", { wikipediaUrl: null }),
    ];
    const result = supplementFromWikidata(wikiPeople, sitePeople);
    expect(result).toEqual([]);
  });
});

describe("extractOwnership", () => {
  const table: FinancialTable = {
    title: "Shareholding pattern",
    unit: "%",
    periods: ["Mar 2025", "Dec 2024"],
    rows: [
      { label: "Promoters", values: [52.3, 52.3] },
      { label: "Public", values: [7.2, 7.4] },
      { label: "Other DIIs", values: [2.1, 2.0] },
    ],
    sourceUrl: "https://www.screener.in/company/X/",
  };

  it("takes the most recent numeric value per row", () => {
    expect(extractOwnership(table)).toEqual({
      promoterPct: 52.3,
      publicPct: 7.2,
    });
  });

  it("reads percentage strings as well as numbers", () => {
    const table: FinancialTable = {
      title: "Shareholding pattern",
      unit: "%",
      periods: ["Mar 2025", "Dec 2024"],
      rows: [
        { label: "Promoters", values: ["50.10%", "50.10%"] },
        { label: "Public", values: ["8.40%", "8.30%"] },
      ],
      sourceUrl: "https://www.screener.in/company/X/",
    };
    expect(extractOwnership(table)).toEqual({
      promoterPct: 50.1,
      publicPct: 8.4,
    });
  });

  it("returns nulls for a missing table or rows", () => {
    expect(extractOwnership(null)).toEqual({
      promoterPct: null,
      publicPct: null,
    });
    expect(
      extractOwnership({ ...table, rows: [{ label: "Other", values: [1] }] }),
    ).toEqual({ promoterPct: null, publicPct: null });
  });
});

describe("parseLeadershipPage", () => {
  it("extracts inline name — role pairs from headings", () => {
    const html = `
      <html><body>
        <h2>Ambarish Raghuvanshi — Chief Financial Officer</h2>
        <h2>Naveen Jindal — Chairman</h2>
      </body></html>
    `;
    expect(parseLeadershipPage(html)).toEqual([
      { name: "Ambarish Raghuvanshi", role: "Chief Financial Officer" },
      { name: "Naveen Jindal", role: "Chairman" },
    ]);
  });

  it("extracts name headings with a role sibling", () => {
    const html = `
      <html><body>
        <h3>Ratan Tata</h3>
        <p>Chairman Emeritus</p>
        <h3>Contact form</h3>
      </body></html>
    `;
    expect(parseLeadershipPage(html)).toEqual([
      { name: "Ratan Tata", role: "Chairman Emeritus" },
    ]);
  });

  it("rejects non-name headings and non-role descriptions", () => {
    const html = `
      <html><body>
        <h2>Our leadership team</h2>
        <h2>Jane Doe — Product manager at example</h2>
        <h3>Growing since 1999</h3>
      </body></html>
    `;
    expect(parseLeadershipPage(html)).toEqual([]);
  });

  it("rejects descriptor-only cards and former or dated roles", () => {
    const html = `
      <html><body>
        <h3>Non Executive</h3>
        <p>Non Independent Director</p>
        <h3>Abidali Neemuchwala</h3>
        <p>Former Chief Executive Officer</p>
        <h3>Vikram Kumar</h3>
        <p>Chief Technology Officer (2015-2019)</p>
        <h3>Meera Nair</h3>
        <p>Chief Financial Officer</p>
      </body></html>
    `;
    expect(parseLeadershipPage(html)).toEqual([
      { name: "Meera Nair", role: "Chief Financial Officer" },
    ]);
  });
});

describe("parseCareerPage", () => {
  it("extracts role-shaped text and flags AI roles", () => {
    const html = `
      <html><body>
        <h3>Senior Software Engineer</h3>
        <li>Machine Learning Engineer</li>
        <li>Sales Executive - Pune</li>
        <a href="/careers">See all jobs</a>
        <li>Apply Now</li>
      </body></html>
    `;
    const parsed = parseCareerPage(html);
    expect(parsed.roles.map((role) => role.title)).toEqual([
      "Senior Software Engineer",
      "Machine Learning Engineer",
      "Sales Executive - Pune",
    ]);
    expect(parsed.aiRoleCount).toBe(1);
    expect(parsed.roles.find((role) => role.ai)?.title).toBe(
      "Machine Learning Engineer",
    );
  });

  it("rejects navigation sections and social-media style noise", () => {
    const html = `
      <html><body>
        <nav><a href="/">Home</a><a href="/careers">Careers</a></nav>
        <h2>Products & Brands</h2>
        <li>#MeetYourRecruiter Anca from our Bucharest HR team</li>
        <li>Students/Internships</li>
        <li>Oil and Gas Exploration & Production</li>
        <div id="job-widget" data-widget="greenhouse"></div>
      </body></html>
    `;
    expect(parseCareerPage(html)).toEqual({ roles: [], aiRoleCount: 0 });
  });
});

describe("buildOrgSignal", () => {
  const people = (
    overrides: Partial<
      Parameters<typeof buildOrgSignal>[0]["people"][number]
    >[] = [],
  ) =>
    overrides.map((item, index) => ({
      name: `Person ${index}`,
      role: "Founder",
      tier: "founder" as const,
      wikipediaUrl: null,
      linkedinUrl: null,
      ...item,
    }));

  it("names founder and CEO with an approach line", () => {
    const signal = buildOrgSignal({
      people: [
        ...people([
          { name: "Alice", role: "Founder" },
          { name: "Bob", role: "Chief Executive Officer", tier: "executive" },
        ]),
      ],
      ownership: { promoterPct: 52.3, publicPct: 7.2 },
      headcount: { total: 239312, year: 2022 },
      hiring: { roles: [], aiRoleCount: 0 },
    });
    expect(signal).toContain(
      "Founded by Alice; Bob leads as CEO — approach the founder for vision, the CEO for execution.",
    );
    expect(signal).toContain("Promoters hold 52.3%");
    expect(signal).toContain("~239,312 employees (2022)");
  });

  it("recognises CEO-shaped roles when no exact CEO title exists", () => {
    const signal = buildOrgSignal({
      people: [
        ...people([
          { name: "Alice", role: "Founder" },
          {
            name: "Srini Pallia",
            role: "Chief Executive Officer & Managing Director",
            tier: "executive",
          },
        ]),
      ],
      ownership: { promoterPct: null, publicPct: null },
      headcount: { total: null, year: null },
      hiring: { roles: [], aiRoleCount: 0 },
    });
    expect(signal).toContain("Srini Pallia leads as CEO");
  });

  it("falls back when nothing is known", () => {
    const signal = buildOrgSignal({
      people: [],
      ownership: { promoterPct: null, publicPct: null },
      headcount: { total: null, year: null },
      hiring: { roles: [], aiRoleCount: 0 },
    });
    expect(signal).toBe(
      "No key people were identified in public records — verify the target before outreach.",
    );
  });

  it("counts board members in the signal", () => {
    const signal = buildOrgSignal({
      people: people([
        { name: "A", tier: "board", role: "Board member" },
        { name: "B", tier: "board", role: "Board member" },
      ]),
      ownership: { promoterPct: null, publicPct: null },
      headcount: { total: null, year: null },
      hiring: { roles: [], aiRoleCount: 0 },
    });
    expect(signal).toContain("2 board members identified");
  });

  it("ranks the AI-adoption signal from open roles", () => {
    const hiring = {
      roles: [
        { title: "Machine Learning Engineer", ai: true },
        { title: "Senior Software Engineer", ai: false },
      ],
      aiRoleCount: 1,
    };
    const signal = buildOrgSignal({
      people: [],
      ownership: { promoterPct: null, publicPct: null },
      headcount: { total: null, year: null },
      hiring,
    });
    expect(signal).toBe(
      "2 open roles found on the careers page, 1 AI-related — a strong AI-adoption signal.",
    );

    const quarterly = {
      roles: [
        { title: "Machine Learning Engineer", ai: true },
        { title: "SAP Consultant", ai: false },
        { title: "Network Engineer", ai: false },
        { title: "Sales Executive", ai: false },
      ],
      aiRoleCount: 1,
    };
    expect(
      buildOrgSignal({
        people: [],
        ownership: { promoterPct: null, publicPct: null },
        headcount: { total: null, year: null },
        hiring: quarterly,
      }),
    ).toContain("a moderate AI-adoption signal");

    expect(
      buildOrgSignal({
        people: [],
        ownership: { promoterPct: null, publicPct: null },
        headcount: { total: null, year: null },
        hiring: { roles: [], aiRoleCount: 0 },
      }),
    ).not.toContain("AI-adoption");
  });
});
