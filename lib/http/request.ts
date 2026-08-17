import "server-only";

export class UpstreamError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly rateLimited: boolean,
  ) {
    super(message);
    this.name = "UpstreamError";
  }
}

interface RequestPolicy {
  revalidate: number;
  timeoutMs?: number;
  retries?: number;
}

export async function resilientFetch(
  url: string,
  init: RequestInit = {},
  policy: RequestPolicy,
): Promise<Response> {
  const retries = policy.retries ?? 1;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...init,
        headers: {
          "User-Agent": "SignalCompanyIntelligence/1.0 (portfolio assessment)",
          Accept: "application/json, application/xml, text/xml, text/html",
          ...init.headers,
        },
        signal: AbortSignal.timeout(policy.timeoutMs ?? 5_500),
        next: { revalidate: policy.revalidate },
      });
      if (response.ok) return response;
      const rateLimited =
        response.status === 429 ||
        (response.status === 403 &&
          response.headers.get("x-ratelimit-remaining") === "0");
      const retryable = rateLimited || response.status >= 500;
      if (!retryable || attempt === retries)
        throw new UpstreamError(
          `Upstream request failed (${response.status})`,
          response.status,
          rateLimited,
        );
      const retryAfter = Number(response.headers.get("retry-after"));
      await new Promise((resolve) =>
        setTimeout(
          resolve,
          Number.isFinite(retryAfter)
            ? Math.min(retryAfter * 1_000, 2_000)
            : 250 * 2 ** attempt,
        ),
      );
    } catch (error) {
      if (error instanceof UpstreamError) throw error;
      if (attempt === retries)
        throw new UpstreamError(
          error instanceof Error ? error.message : "Upstream request failed",
          503,
          false,
        );
      await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
    }
  }
  throw new UpstreamError("Upstream request failed", 503, false);
}
