import { NextResponse } from "next/server";

import { searchCompanies } from "@/services/company-search";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2 || query.length > 100)
    return NextResponse.json({ suggestions: [] });

  try {
    const suggestions = await searchCompanies(query);
    return NextResponse.json(
      { suggestions },
      {
        headers: {
          "Cache-Control":
            "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      },
    );
  } catch {
    return NextResponse.json(
      { suggestions: [], unavailable: true },
      { status: 200 },
    );
  }
}
