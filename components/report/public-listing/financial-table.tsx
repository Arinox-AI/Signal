"use client";

import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Panel, SourceUnavailable } from "@/components/report/panel";
import type { SourceResult } from "@/lib/types/company";
import type { FinancialTable, ListingCell } from "@/lib/types/public-listing";

const PERIODS_PER_PAGE = 6;

function formatCell(value: ListingCell): string {
  if (value === null) return "—";
  if (typeof value === "number") {
    return new Intl.NumberFormat("en-IN", {
      maximumFractionDigits: 2,
    }).format(value);
  }
  return value;
}

function numericValue(value: ListingCell): number | null {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return null;
  const normalized = value.replace(/[,%₹\s]/g, "");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function changeTone(value: number | null): string {
  if (value === null || Math.abs(value) < 0.01) return "text-white/35";
  return value > 0 ? "text-emerald-200/75" : "text-red-200/75";
}

function changeIcon(value: number | null) {
  if (value === null || Math.abs(value) < 0.01) return ArrowRight;
  return value > 0 ? ArrowUp : ArrowDown;
}

function pageCount(length: number): number {
  return Math.max(Math.ceil(length / PERIODS_PER_PAGE), 1);
}

export function FinancialTablePanel({
  label,
  result,
  className,
}: {
  label: string;
  result: SourceResult<FinancialTable>;
  className?: string;
}) {
  const [page, setPage] = useState(0);

  const totalPages =
    result.state === "success" ? pageCount(result.data.periods.length) : 1;
  const currentPage = Math.min(page, totalPages - 1);
  const visiblePeriods = useMemo(() => {
    if (result.state !== "success") return [];
    return result.data.periods.slice(
      currentPage * PERIODS_PER_PAGE,
      (currentPage + 1) * PERIODS_PER_PAGE,
    );
  }, [currentPage, result]);

  if (result.state !== "success") {
    return (
      <Panel label={label} className={className}>
        <SourceUnavailable message={result.message} />
      </Panel>
    );
  }

  const table = result.data;

  const firstPeriod = table.periods[0];
  const lastPeriod = table.periods.at(-1);
  const summaryRows = table.rows.slice(0, 3).map((row) => {
    const first = row.values[0] ?? null;
    const last = row.values.at(-1) ?? null;
    const firstNumber = numericValue(first);
    const lastNumber = numericValue(last);
    const change =
      firstNumber !== null && lastNumber !== null && firstNumber !== 0
        ? ((lastNumber - firstNumber) / Math.abs(firstNumber)) * 100
        : null;
    return { label: row.label, first, last, change };
  });

  return (
    <Panel
      label={label}
      className={className}
      action={
        <a
          href={table.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[10px] text-blue-100/50 hover:text-blue-100"
        >
          Source
          <ArrowUpRight className="size-3" aria-hidden="true" />
        </a>
      }
    >
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-full text-xs leading-5 text-white/38">
            {firstPeriod ?? "Earliest"} to {lastPeriod ?? "Latest"}
            {table.unit ? ` · ${table.unit}` : ""}
          </p>
          <div
            className="flex items-center gap-1"
            aria-label="Financial periods"
          >
            <button
              type="button"
              onClick={() => setPage(Math.max(0, currentPage - 1))}
              disabled={currentPage === 0}
              aria-label="Show earlier periods"
              className="financial-page-button"
            >
              <ChevronLeft className="size-3.5" aria-hidden="true" />
            </button>
            <span className="font-mono text-[10px] text-white/35">
              {currentPage + 1}/{totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage(Math.min(totalPages - 1, currentPage + 1))}
              disabled={currentPage >= totalPages - 1}
              aria-label="Show later periods"
              className="financial-page-button"
            >
              <ChevronRight className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="financial-summary mt-5">
          {summaryRows.map((row) => {
            const Icon = changeIcon(row.change);
            return (
              <div key={row.label} className="financial-summary-item">
                <p>{row.label}</p>
                <div className="financial-summary-values">
                  <span>{formatCell(row.last)}</span>
                  <small className={changeTone(row.change)}>
                    <Icon className="size-3" aria-hidden="true" />
                    {row.change === null
                      ? "No trend"
                      : `${row.change > 0 ? "+" : ""}${row.change.toFixed(0)}%`}
                  </small>
                </div>
              </div>
            );
          })}
        </div>
        <div className="financial-table-wrap mt-6 overflow-x-auto">
          <table className="financial-table">
            <caption className="sr-only">{label}</caption>
            <thead>
              <tr>
                <th scope="col">Metric</th>
                {visiblePeriods.map((period) => (
                  <th key={period} scope="col">
                    {period}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  {visiblePeriods.map((period) => {
                    const periodIndex = table.periods.indexOf(period);
                    return (
                      <td key={`${row.label}-${period}`}>
                        {formatCell(row.values[periodIndex] ?? null)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Panel>
  );
}
