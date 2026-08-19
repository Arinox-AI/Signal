import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Reveal } from "@/components/motion/reveal";
import { BusinessPanel } from "@/components/report/business-panel";
import { CountryCard } from "@/components/report/country-card";
import { Metrics } from "@/components/report/metrics";
import { NewsGrid } from "@/components/report/news-grid";
import { OrgPeopleView } from "@/components/report/org-people-view";
import { ParentPanel } from "@/components/report/parent-panel";
import { PrioritiesSignalPanel } from "@/components/report/priorities-signal";
import { PublicListingView } from "@/components/report/public-listing/public-listing-view";
import { ReportHeader } from "@/components/report/report-header";
import { ReportTabs } from "@/components/report/report-tabs";
import { SummaryCard } from "@/components/report/summary-card";
import { SourceCoverageCard } from "@/components/report/source-coverage-card";
import { TechNewsPanel } from "@/components/report/tech-news";
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
  searchParams,
}: {
  params: Promise<{ query: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ query }, { tab }] = await Promise.all([params, searchParams]);
  const report = await getCompanyIntelligence(query).catch(() => null);
  if (!report) notFound();

  return (
    <div className="company-dossier flex min-h-screen flex-col">
      <SiteHeader />
      <main className="dossier-main">
        <ReportHeader report={report} />
        <ReportTabs
          listingState={report.publicListing.state}
          initialTab={tab === "public-listing" ? "public-listing" : "overview"}
          overview={
            <div className="dossier-content mx-auto max-w-[1320px] space-y-5 px-5 py-8 sm:px-8 lg:px-12 lg:py-10">
              <Reveal>
                <Metrics report={report} />
              </Reveal>
              <div className="grid items-start gap-5 lg:grid-cols-12">
                <Reveal className="lg:col-span-8">
                  <SummaryCard report={report} />
                </Reveal>
                <Reveal delay={0.04} className="lg:col-span-4">
                  <SourceCoverageCard report={report} />
                </Reveal>
                <Reveal delay={0.08} className="lg:col-span-12">
                  <BusinessPanel
                    result={report.business}
                    identity={report.identity}
                  />
                </Reveal>
                <Reveal delay={0.1} className="lg:col-span-12">
                  <PrioritiesSignalPanel
                    result={report.priorities}
                    sources={report.sources}
                  />
                </Reveal>
                <Reveal delay={0.12} className="lg:col-span-7">
                  <NewsGrid result={report.news} />
                </Reveal>
                <Reveal delay={0.16} className="lg:col-span-5">
                  <TechNewsPanel result={report.techNews} />
                </Reveal>
                <Reveal delay={0.2} className="lg:col-span-5">
                  <CountryCard result={report.country} />
                </Reveal>
                <Reveal delay={0.16} className="lg:col-span-12">
                  <OrgPeopleView result={report.orgPeople} />
                </Reveal>
                {report.parent && (
                  <Reveal delay={0.18} className="lg:col-span-12">
                    <ParentPanel parent={report.parent} />
                  </Reveal>
                )}
                <Reveal delay={0.2} className="lg:col-span-12">
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
                  href={report.identity.primarySource.url}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white/60"
                >
                  Review {report.identity.primarySource.label} →
                </a>
              </div>
            </div>
          }
          publicListing={<PublicListingView result={report.publicListing} />}
        />
      </main>
      <SiteFooter />
    </div>
  );
}
