import {
  ArrowUpRight,
  Building2,
  CalendarDays,
  Fingerprint,
  Globe2,
  MapPin,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { IdentityProvenance } from "@/components/report/identity-provenance";
import { SearchBar } from "@/components/search-bar";
import { CopyLinkButton } from "@/components/copy-link-button";
import type { IntelligenceReport } from "@/lib/types/company";

export function ReportHeader({ report }: { report: IntelligenceReport }) {
  const { identity } = report;
  const logo =
    report.website.state === "success" ? report.website.data.iconUrl : null;
  const websiteUrl =
    report.website.state === "success"
      ? report.website.data.url
      : identity.website;
  const ConfidenceIcon = identity.confidence.ambiguous
    ? TriangleAlert
    : ShieldCheck;
  const confidenceClass = identity.confidence.ambiguous
    ? "border-amber-200/15 bg-amber-200/[0.05] text-amber-100/75"
    : "border-emerald-200/15 bg-emerald-200/[0.05] text-emerald-100/75";
  return (
    <header className="report-header relative pb-10">
      <div
        aria-hidden="true"
        className="report-header-halo absolute inset-x-0 -top-52 h-96 blur-[120px]"
      />
      <div className="relative mx-auto max-w-[1320px] px-5 pt-8 sm:px-8 lg:px-12">
        <SearchBar compact defaultValue={identity.name} />
        <div className="report-masthead mt-14 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex min-w-0 items-start gap-5">
            <div className="report-logo relative grid size-16 shrink-0 place-items-center overflow-hidden text-xl font-semibold sm:size-20">
              {logo ? (
                <Image
                  src={logo}
                  alt=""
                  width={64}
                  height={64}
                  className="rounded-xl"
                />
              ) : (
                identity.name.slice(0, 2).toUpperCase()
              )}
            </div>
            <div className="min-w-0">
              <p className="report-kicker mb-2 font-mono text-[10px] tracking-[0.18em] uppercase">
                Field dossier · live public evidence
              </p>
              <h1 className="report-title max-w-4xl text-4xl font-medium tracking-[-0.055em] text-balance sm:text-6xl">
                {identity.name}
              </h1>
              <p className="report-description mt-3 max-w-2xl text-sm leading-6 sm:text-base">
                {identity.description}
              </p>
            </div>
          </div>
          <div className="report-tags flex flex-wrap items-center gap-2 text-xs">
            <span
              title={identity.confidence.reason}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-2 ${confidenceClass}`}
            >
              <ConfidenceIcon className="size-3.5" aria-hidden="true" />
              {identity.confidence.label}
              {identity.confidence.ambiguous ? " · Review match" : ""}
            </span>
            {report.parent && (
              <Link
                href={`/company/${encodeURIComponent(report.parent.query.toLowerCase())}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-blue-200/15 bg-blue-200/[0.05] px-3 py-2 text-blue-100/75 transition hover:bg-blue-200/[0.1]"
                title={`Group exposure runs through ${report.parent.name}`}
              >
                <Building2 className="size-3.5" aria-hidden="true" />
                Part of {report.parent.name}
                <ArrowUpRight className="size-3" aria-hidden="true" />
              </Link>
            )}
            {identity.countryName && (
              <span className="inline-flex items-center gap-1.5 px-3 py-2">
                <MapPin className="size-3.5" aria-hidden="true" />
                {identity.countryName}
              </span>
            )}
            {identity.foundedYear && (
              <span className="inline-flex items-center gap-1.5 px-3 py-2">
                <CalendarDays className="size-3.5" aria-hidden="true" />
                Founded {identity.foundedYear}
              </span>
            )}
            {identity.lei && (
              <span
                title="Legal Entity Identifier"
                className="inline-flex items-center gap-1.5 px-3 py-2 font-mono text-[10px]"
              >
                <Fingerprint className="size-3.5" aria-hidden="true" />
                LEI {identity.lei}
              </span>
            )}
            {websiteUrl && (
              <a
                href={websiteUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 transition"
              >
                <Globe2 className="size-3.5" aria-hidden="true" />
                Website
                <ArrowUpRight className="size-3" aria-hidden="true" />
              </a>
            )}
            <CopyLinkButton />
          </div>
        </div>
        <IdentityProvenance identity={identity} sources={report.sources} />
        <div className="report-header-scan" aria-hidden="true">
          <span className="scan-orbit scan-orbit-one" />
          <span className="scan-orbit scan-orbit-two" />
          <span className="scan-line scan-line-one" />
          <span className="scan-line scan-line-two" />
          <span className="scan-node scan-node-one" />
          <span className="scan-node scan-node-two" />
          <span className="scan-node scan-node-three" />
        </div>
      </div>
    </header>
  );
}
