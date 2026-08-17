import { describe, expect, it } from "vitest";

import { sourceEmpty, sourceSuccess, sourceUnavailable } from "./source-result";

describe("source results", () => {
  it("keeps successful normalized data typed and available", () => {
    const result = sourceSuccess({ name: "Signal" });
    expect(result.state).toBe("success");
    if (result.state !== "success") throw new Error("Expected success");
    expect(result.data.name).toBe("Signal");
  });

  it("distinguishes empty, unavailable, and rate-limited sources", () => {
    expect(sourceEmpty("No matches").state).toBe("empty");
    expect(sourceUnavailable("Offline").state).toBe("unavailable");
    expect(sourceUnavailable("Quota", true).state).toBe("rate_limited");
  });
});
