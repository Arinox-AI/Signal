import { describe, expect, it } from "vitest";

import { selectScreenerCandidate, selectScreenerCandidates } from "./selection";

describe("selectScreenerCandidates", () => {
  const candidates = [
    { name: "Tata Motors Finance Ltd", url: "/company/TATA-MOTORS-FINANCE/" },
    { name: "Tata Motors Ltd", url: "/company/TATA-MOTORS/" },
    { name: "Tata Motors DVR Ltd", url: "/company/TATA-MOTORS-DVR/" },
    { name: "Tata Steel Ltd", url: "/company/TATA-STEEL/" },
  ];

  it("puts the exact match first and drops siblings outside the strict gate", () => {
    const ordered = selectScreenerCandidates(
      candidates,
      "Tata Motors Limited",
      "Tata Motors",
    );
    expect(ordered.map((candidate) => candidate.name)).toEqual([
      "Tata Motors Ltd",
    ]);
  });

  it("accepts scope-superset matches as the only acceptable fallback", () => {
    const ordered = selectScreenerCandidates(
      [
        { name: "Maruti Suzuki India Ltd", url: "/company/MARUTI/" },
        { name: "Maruti Suzuki Motor Corp", url: "/company/MARUTI-MOTOR/" },
      ],
      "Maruti Suzuki",
      "Maruti Suzuki",
    );
    expect(ordered.map((candidate) => candidate.name)).toEqual([
      "Maruti Suzuki India Ltd",
    ]);
  });

  it("lets the resolved identity rescue a broad query", () => {
    const ordered = selectScreenerCandidates(
      [
        { name: "Reliance Industries Ltd", url: "/company/RELIANCE/" },
        { name: "Reliance Infrastructure Ltd", url: "/company/RELINFRA/" },
        {
          name: "Reliance Industrial Infrastructure Ltd",
          url: "/company/RIIL/",
        },
      ],
      "Reliance Industries Limited",
      "Reliance",
    );
    expect(ordered.map((candidate) => candidate.name)).toEqual([
      "Reliance Industries Ltd",
    ]);
  });

  it("returns nothing for a broad query without an identity anchor", () => {
    const ordered = selectScreenerCandidates(
      [
        { name: "Reliance Industries Ltd", url: "/company/RELIANCE/" },
        { name: "Reliance Infrastructure Ltd", url: "/company/RELINFRA/" },
      ],
      "Reliance",
      "Reliance",
    );
    expect(ordered).toEqual([]);
    expect(
      selectScreenerCandidate(
        [{ name: "Bajaj Finance Ltd", url: "/company/BAJAJ-FINANCE/" }],
        "Bajaj Holdings",
        "Bajaj",
      ),
    ).toBeNull();
  });

  it("prefers the candidate that matches the identity exactly on ties", () => {
    const ordered = selectScreenerCandidates(
      [
        { name: "Infosys Ltd", url: "/company/INFOSYS/" },
        { name: "Infosys Technologies Ltd", url: "/company/INFOSYS-TECH/" },
      ],
      "Infosys Technologies",
      "Infosys",
    );
    expect(ordered[0]?.name).toBe("Infosys Technologies Ltd");
  });

  it("breaks rank-1 ties by fewest tokens, then alphabetically", () => {
    const ordered = selectScreenerCandidates(
      [
        { name: "Maruti Suzuki International Ltd", url: "/company/1/" },
        { name: "Maruti Suzuki Global Ltd", url: "/company/2/" },
        { name: "Maruti Suzuki India Ltd", url: "/company/3/" },
        {
          name: "Maruti Suzuki International India Ltd",
          url: "/company/4/",
        },
      ],
      "Maruti Suzuki",
      "Maruti Suzuki",
    );
    expect(ordered.map((candidate) => candidate.name)).toEqual([
      "Maruti Suzuki Global Ltd",
      "Maruti Suzuki India Ltd",
      "Maruti Suzuki International Ltd",
      "Maruti Suzuki International India Ltd",
    ]);
  });

  it("deduplicates candidates by normalized name", () => {
    const ordered = selectScreenerCandidates(
      [
        { name: "Tata Motors Ltd", url: "/company/A/" },
        { name: "Tata Motors Limited", url: "/company/B/" },
      ],
      "Tata Motors",
      "Tata Motors",
    );
    expect(ordered).toHaveLength(1);
  });
});
