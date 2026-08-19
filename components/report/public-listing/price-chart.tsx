"use client";

import { useMemo, useState } from "react";

import { Panel, SourceUnavailable } from "@/components/report/panel";
import type { SourceResult } from "@/lib/types/company";
import type { ListingChart, PricePoint } from "@/lib/types/public-listing";

const RANGES = [
  { label: "1Y", days: 365 },
  { label: "3Y", days: 1_095 },
  { label: "5Y", days: 1_825 },
  { label: "10Y", days: 3_652 },
] as const;

function pathFor(
  points: PricePoint[],
  key: "price" | "dma50" | "dma200",
  min: number,
  max: number,
): string {
  const width = 920;
  const height = 180;
  return points
    .map((point, index) => {
      const value = point[key];
      if (value === null) return null;
      const x = (index / Math.max(points.length - 1, 1)) * width;
      const y = height - ((value - min) / Math.max(max - min, 1)) * height;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .filter(Boolean)
    .join(" ");
}

function chartPoints(points: PricePoint[], days: number): PricePoint[] {
  const last = points.at(-1)?.date;
  if (!last) return points;
  const end = new Date(last).getTime();
  const start = end - days * 86_400_000;
  return points.filter((point) => new Date(point.date).getTime() >= start);
}

function percentChange(
  first: PricePoint | undefined,
  last: PricePoint | undefined,
) {
  if (!first?.price || !last?.price) return null;
  return ((last.price - first.price) / first.price) * 100;
}

export function PriceChart({ result }: { result: SourceResult<ListingChart> }) {
  const [range, setRange] = useState(365);
  const [showAverages, setShowAverages] = useState(true);

  const points = useMemo(() => {
    if (result.state !== "success") return [];
    return chartPoints(result.data.points, range);
  }, [range, result]);

  if (result.state !== "success") {
    return (
      <Panel label="Price trend" className="public-listing-chart-panel">
        <SourceUnavailable message={result.message} />
      </Panel>
    );
  }

  const priceValues = points.flatMap((point) =>
    [
      point.price,
      showAverages ? point.dma50 : null,
      showAverages ? point.dma200 : null,
    ].filter((value): value is number => value !== null),
  );
  const min = Math.min(...priceValues);
  const max = Math.max(...priceValues);
  const latest = points.at(-1);
  const first = points[0];
  const change = percentChange(first, latest);
  const trendLabel =
    change === null
      ? "Trend unavailable"
      : change > 0
        ? `${change.toFixed(1)}% higher`
        : `${Math.abs(change).toFixed(1)}% lower`;

  return (
    <Panel
      label="Price trend"
      className="public-listing-chart-panel"
      action={
        <a
          href={result.data.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="text-[10px] text-blue-100/50 hover:text-blue-100"
        >
          Data source ↗
        </a>
      }
    >
      <div className="p-5 sm:p-6">
        <div className="public-listing-chart-hero">
          <div>
            <p className="text-[11px] tracking-[0.14em] text-blue-100/45 uppercase">
              {range === 365
                ? "1 year"
                : range === 1_095
                  ? "3 years"
                  : range === 1_825
                    ? "5 years"
                    : "10 years"}
            </p>
            <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-2">
              <p className="text-4xl font-medium tracking-[-0.05em] text-white">
                {latest?.price?.toLocaleString("en-IN", {
                  maximumFractionDigits: 2,
                }) ?? "—"}
              </p>
              <p
                className={`pb-1 text-sm font-medium ${change !== null && change >= 0 ? "text-emerald-200/80" : "text-red-200/80"}`}
              >
                {trendLabel}
              </p>
            </div>
            <p className="mt-2 text-xs text-white/35">
              {first?.date ?? "—"} → {latest?.date ?? "—"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {RANGES.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => setRange(item.days)}
                className={`public-listing-chart-button ${range === item.days ? "public-listing-chart-button-active" : ""}`}
              >
                {item.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowAverages((value) => !value)}
              className={`public-listing-chart-button ${showAverages ? "public-listing-chart-button-active" : ""}`}
            >
              Averages
            </button>
          </div>
        </div>
        <div
          role="img"
          aria-label={`Price trend over the selected period. Latest price is ${latest?.price ?? "not available"}.`}
          className="mt-6"
        >
          <svg
            viewBox="0 0 920 230"
            className="h-auto w-full"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="price-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#a7b8ff" stopOpacity="0.24" />
                <stop offset="100%" stopColor="#a7b8ff" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0, 1, 2, 3].map((line) => (
              <line
                key={line}
                x1="0"
                x2="920"
                y1={line * 45}
                y2={line * 45}
                stroke="rgba(255,255,255,.075)"
                strokeWidth="1"
              />
            ))}
            <path
              d={`${pathFor(points, "price", min, max)} L920 230 L0 230 Z`}
              fill="url(#price-fill)"
            />
            <path
              d={pathFor(points, "price", min, max)}
              fill="none"
              stroke="#a7b8ff"
              strokeWidth="2.2"
              vectorEffect="non-scaling-stroke"
            />
            {showAverages ? (
              <>
                <path
                  d={pathFor(points, "dma50", min, max)}
                  fill="none"
                  stroke="#f4b476"
                  strokeWidth="1.2"
                  strokeDasharray="5 4"
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  d={pathFor(points, "dma200", min, max)}
                  fill="none"
                  stroke="#52d7a8"
                  strokeWidth="1.2"
                  strokeDasharray="2 5"
                  vectorEffect="non-scaling-stroke"
                />
              </>
            ) : null}
          </svg>
        </div>
        <div className="mt-4 grid gap-2 text-[11px] sm:grid-cols-4">
          <div className="chart-fact">
            <span>Price</span>
            <strong>{latest?.price?.toLocaleString("en-IN") ?? "—"}</strong>
          </div>
          <div className="chart-fact">
            <span>50 DMA</span>
            <strong>{latest?.dma50?.toLocaleString("en-IN") ?? "—"}</strong>
          </div>
          <div className="chart-fact">
            <span>200 DMA</span>
            <strong>{latest?.dma200?.toLocaleString("en-IN") ?? "—"}</strong>
          </div>
          <div className="chart-fact">
            <span>Latest volume</span>
            <strong>{latest?.volume?.toLocaleString("en-IN") ?? "—"}</strong>
          </div>
        </div>
        <details className="mt-5 text-xs text-white/45">
          <summary className="cursor-pointer text-blue-100/60 hover:text-blue-100">
            View recent data points
          </summary>
          <div className="mt-3 max-h-48 overflow-auto">
            <table className="public-listing-mini-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Price</th>
                  <th>50 DMA</th>
                  <th>200 DMA</th>
                  <th>Volume</th>
                </tr>
              </thead>
              <tbody>
                {points
                  .slice(-12)
                  .reverse()
                  .map((point) => (
                    <tr key={point.date}>
                      <td>{point.date}</td>
                      <td>{point.price ?? "—"}</td>
                      <td>{point.dma50 ?? "—"}</td>
                      <td>{point.dma200 ?? "—"}</td>
                      <td>{point.volume?.toLocaleString("en-IN") ?? "—"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </details>
      </div>
    </Panel>
  );
}
