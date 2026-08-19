"use client";

import { BarChart3, FileText } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import type { SourceState } from "@/lib/types/company";

type ReportTab = "overview" | "public-listing";

export function ReportTabs({
  overview,
  publicListing,
  listingState,
  initialTab = "overview",
}: {
  overview: ReactNode;
  publicListing: ReactNode;
  listingState: SourceState;
  initialTab?: ReportTab;
}) {
  const [activeTab, setActiveTab] = useState<ReportTab>(initialTab);

  function selectTab(tab: ReportTab) {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    if (tab === "overview") url.searchParams.delete("tab");
    else url.searchParams.set("tab", tab);
    window.history.replaceState({}, "", url.toString());
  }

  const listingLabel =
    listingState === "success"
      ? "Connected"
      : listingState === "empty"
        ? "No match"
        : listingState === "rate_limited"
          ? "Rate limited"
          : "Unavailable";

  return (
    <div className="report-tabs-shell">
      <nav
        aria-label="Company report views"
        role="tablist"
        className="report-tabs mx-auto flex max-w-[1320px] gap-1 overflow-x-auto px-5 sm:px-8 lg:px-12"
      >
        <button
          type="button"
          id="overview-tab"
          role="tab"
          aria-selected={activeTab === "overview"}
          aria-controls="overview-panel"
          onClick={() => selectTab("overview")}
          className={`report-tab ${activeTab === "overview" ? "report-tab-active" : ""}`}
        >
          <FileText className="size-3.5" aria-hidden="true" />
          Overview
        </button>
        <button
          type="button"
          id="public-listing-tab"
          role="tab"
          aria-selected={activeTab === "public-listing"}
          aria-controls="public-listing-panel"
          onClick={() => selectTab("public-listing")}
          className={`report-tab ${activeTab === "public-listing" ? "report-tab-active" : ""}`}
        >
          <BarChart3 className="size-3.5" aria-hidden="true" />
          Public Listing
          <span className="report-tab-status">{listingLabel}</span>
        </button>
      </nav>
      <div
        id="overview-panel"
        role="tabpanel"
        aria-labelledby="overview-tab"
        hidden={activeTab !== "overview"}
      >
        {overview}
      </div>
      <div
        id="public-listing-panel"
        role="tabpanel"
        aria-labelledby="public-listing-tab"
        hidden={activeTab !== "public-listing"}
      >
        {publicListing}
      </div>
    </div>
  );
}
