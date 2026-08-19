"use client";

import {
  ArrowUpRight,
  Building2,
  ChevronLeft,
  ChevronRight,
  FileBarChart,
  FileText,
} from "lucide-react";
import { useState } from "react";

import { Panel, SourceUnavailable } from "@/components/report/panel";
import type { SourceResult } from "@/lib/types/company";
import type {
  InvestorDocument,
  InvestorDocuments,
} from "@/lib/types/public-listing";

const DOCUMENTS_PER_PAGE = 6;

function DocumentLink({ document }: { document: InvestorDocument }) {
  return (
    <a
      href={document.url}
      target="_blank"
      rel="noreferrer"
      className="public-listing-document group"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-blue-100/60">
        {document.type === "annual_report" ? (
          <FileText className="size-4" aria-hidden="true" />
        ) : (
          <FileBarChart className="size-4" aria-hidden="true" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-white/70 group-hover:text-white">
          {document.title}
        </span>
        <span className="mt-1 block truncate text-[10px] text-white/30">
          {[document.date, document.source].filter(Boolean).join(" · ") ||
            "Public filing"}
        </span>
      </span>
      <ArrowUpRight
        className="size-3.5 shrink-0 text-white/25 group-hover:text-blue-100"
        aria-hidden="true"
      />
    </a>
  );
}

function DocumentList({
  documents,
  emptyMessage,
}: {
  documents: InvestorDocument[];
  emptyMessage: string;
}) {
  const [page, setPage] = useState(0);

  if (documents.length === 0) {
    return <p className="text-xs text-white/35">{emptyMessage}</p>;
  }

  const totalPages = Math.max(
    Math.ceil(documents.length / DOCUMENTS_PER_PAGE),
    1,
  );
  const currentPage = Math.min(page, totalPages - 1);
  const visibleDocuments = documents.slice(
    currentPage * DOCUMENTS_PER_PAGE,
    (currentPage + 1) * DOCUMENTS_PER_PAGE,
  );

  return (
    <div className="space-y-2">
      {visibleDocuments.map((document) => (
        <DocumentLink
          key={`${document.type}-${document.url}`}
          document={document}
        />
      ))}
      {totalPages > 1 ? (
        <div className="flex items-center justify-between pt-1">
          <span className="font-mono text-[10px] text-white/35">
            {currentPage + 1}/{totalPages}
          </span>
          <div className="flex items-center gap-1" aria-label="Document pages">
            <button
              type="button"
              onClick={() => setPage(Math.max(0, currentPage - 1))}
              disabled={currentPage === 0}
              aria-label="Show earlier documents"
              className="financial-page-button"
            >
              <ChevronLeft className="size-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setPage(Math.min(totalPages - 1, currentPage + 1))}
              disabled={currentPage >= totalPages - 1}
              aria-label="Show later documents"
              className="financial-page-button"
            >
              <ChevronRight className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function InvestorsPanel({
  result,
}: {
  result: SourceResult<InvestorDocuments>;
}) {
  if (result.state !== "success") {
    return (
      <Panel
        label="Investors & reports"
        className="public-listing-investors-panel"
      >
        <SourceUnavailable message={result.message} />
      </Panel>
    );
  }

  const otherDocuments = result.data.documents.filter(
    (document) => document.type !== "annual_report",
  );

  return (
    <Panel
      label="Investors & reports"
      className="public-listing-investors-panel"
      action={
        result.data.investorRelationsUrl ? (
          <a
            href={result.data.investorRelationsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[10px] text-blue-100/50 hover:text-blue-100"
          >
            Investor site
            <ArrowUpRight className="size-3" aria-hidden="true" />
          </a>
        ) : null
      }
    >
      <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-2">
        <div>
          <div className="flex items-center gap-2 text-xs text-white/65">
            <FileText
              className="size-3.5 text-blue-100/60"
              aria-hidden="true"
            />
            Annual reports
          </div>
          <div className="mt-3">
            <DocumentList
              documents={result.data.annualReports}
              emptyMessage="No annual report links were found."
            />
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2 text-xs text-white/65">
            <Building2
              className="size-3.5 text-blue-100/60"
              aria-hidden="true"
            />
            Announcements, presentations & calls
          </div>
          <div className="mt-3">
            <DocumentList
              documents={otherDocuments}
              emptyMessage="No additional investor documents were found."
            />
          </div>
        </div>
      </div>
    </Panel>
  );
}
