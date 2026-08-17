import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Reveal } from "@/components/motion/reveal";
import { CountryCard } from "@/components/report/country-card";
import { GithubCard } from "@/components/report/github-card";
import { Metrics } from "@/components/report/metrics";
import { NewsGrid } from "@/components/report/news-grid";
import { ReportHeader } from "@/components/report/report-header";
import { SummaryCard } from "@/components/report/summary-card";
import { SourceCoverageCard } from "@/components/report/source-coverage-card";
import { Timeline } from "@/components/report/timeline";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getCompanyIntelligence } from "@/services/company-intelligence";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ query: string }>;
}): Promise<Metadata> {
  try {
    const { query } = await params;
    const report = await getCompanyIntelligence(query);
    return {
      title: report.identity.name,
      description: `A live public-intelligence brief for ${report.identity.name}: ${report.identity.description}`,
    };
  } catch {
    return { title: "Company not found" };
  }
}

export default async function CompanyPage({
  params,
}: {
  params: Promise<{ query: string }>;
}) {
  const { query } = await params;
  const report = await getCompanyIntelligence(query).catch(() => null);
  if (!report) notFound();

  return (
    <div className="company-dossier flex min-h-screen flex-col">
      <SiteHeader />
      <main className="dossier-main">
        <ReportHeader report={report} />
        <div className="dossier-content mx-auto max-w-[1320px] space-y-5 px-5 py-8 sm:px-8 lg:px-12 lg:py-10">
          <Reveal>
            <Metrics report={report} />
          </Reveal>
          <div className="grid items-start gap-5 lg:grid-cols-12">
            <Reveal className="lg:col-span-8">
              <SummaryCard report={report} />
            </Reveal>
            <Reveal delay={0.04} className="lg:col-span-4">
              {report.github.state === "success" ? (
                <GithubCard result={report.github} />
              ) : (
                <SourceCoverageCard report={report} />
              )}
            </Reveal>
            <Reveal delay={0.08} className="lg:col-span-7">
              <NewsGrid result={report.news} />
            </Reveal>
            <Reveal delay={0.12} className="lg:col-span-5">
              <CountryCard result={report.country} />
            </Reveal>
            <Reveal delay={0.16} className="lg:col-span-12">
              <Timeline report={report} />
            </Reveal>
          </div>
          <div className="dossier-provenance flex flex-col gap-2 pt-5 text-[11px] sm:flex-row sm:items-center sm:justify-between">
            <p>
              Generated{" "}
              {new Date(report.generatedAt).toLocaleString("en", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
              . Public data may be incomplete.
            </p>
            <a
              href={report.identity.wikipediaUrl}
              target="_blank"
              rel="noreferrer"
              className="hover:text-white/60"
            >
              Review the primary company record →
            </a>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
