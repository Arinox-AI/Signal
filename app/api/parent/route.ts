import { NextResponse } from "next/server";

import { getParentEnrichment } from "@/services/parent-enrichment";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2 || query.length > 120)
    return NextResponse.json(
      { error: "A company name between 2 and 120 characters is required." },
      { status: 400 },
    );

  try {
    const data = await getParentEnrichment(query);
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Parent evidence could not be assembled." },
      { status: 502 },
    );
  }
}
