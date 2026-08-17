import { NextResponse } from "next/server";

import { getCompanyIntelligence } from "@/services/company-intelligence";

export async function GET(
  _request: Request,
  context: { params: Promise<{ query: string }> },
) {
  try {
    const { query } = await context.params;
    if (query.trim().length < 2 || query.length > 120)
      return NextResponse.json(
        { error: "Enter a valid company name." },
        { status: 400 },
      );
    const report = await getCompanyIntelligence(query);
    return NextResponse.json(report, {
      headers: {
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=86400",
      },
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "Signal could not resolve that company. Try its full name or domain.",
      },
      { status: 404 },
    );
  }
}
