import "server-only";

import { resilientFetch } from "@/lib/http/request";
import type { WebsiteMetadata } from "@/lib/types/company";
import { parseWebsiteProfile } from "@/lib/website-profile";

export async function getWebsiteMetadata(
  website: string,
): Promise<WebsiteMetadata> {
  const url = new URL(website);
  if (
    !/^https?:$/.test(url.protocol) ||
    /^(localhost|127\.|10\.|192\.168\.)/.test(url.hostname)
  )
    throw new Error("Unsafe website URL");
  const response = await resilientFetch(
    url.toString(),
    { headers: { Accept: "text/html" } },
    { revalidate: 86_400, timeoutMs: 4_500 },
  );
  const resolvedUrl = new URL(response.url);
  const html = (await response.text()).slice(0, 300_000);
  return parseWebsiteProfile(html, resolvedUrl);
}
