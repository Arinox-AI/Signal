import { describe, expect, it } from "vitest";

import { parseChartPayload, parsePeerHtml, parseScreenerPage } from "./parser";

const page = `
  <html>
    <head><title>Acme share price | About Acme | Screener</title></head>
    <body>
      <div id="company-info" data-company-id="42" data-warehouse-id="84" data-consolidated="true"></div>
      <div id="top">
        <h1>Acme Industries Ltd</h1>
        <span class="font-size-12 up">4.25%</span>
        <ul id="top-ratios">
          <li><span class="name">Market Cap</span><span class="value">₹ 12,345 Cr.</span></li>
          <li><span class="name">Current Price</span><span class="value">₹ 1,234</span></li>
          <li><span class="name">High / Low</span><span class="value">₹ 1,500 / ₹ 900</span></li>
          <li><span class="name">Stock P/E</span><span class="value">24.5</span></li>
          <li><span class="name">ROE</span><span class="value">18.2%</span></li>
        </ul>
      </div>
      <div class="company-links">
        <a href="https://www.bseindia.com/stock-share-price/acme/ACME/123456/">BSE: 123456</a>
        <a href="https://www.nseindia.com/get-quotes/equity?symbol=ACME">NSE: ACME</a>
      </div>
      <section id="quarters">
        <p class="sub">Consolidated Figures in Rs. Crores</p>
        <table class="data-table"><thead><tr><th></th><th>Mar 2024</th><th>Jun 2024</th></tr></thead><tbody>
          <tr><td><button>Sales <span>+</span></button></td><td>1,200</td><td>1,350</td></tr>
          <tr><td>Net Profit</td><td>100</td><td>120</td></tr>
        </tbody></table>
      </section>
      <section id="documents">
        <div class="documents annual-reports"><ul class="list-links"><li><a href="/annual-2024.pdf">Financial Year 2024<div>from bse</div></a></li></ul></div>
        <div class="documents credit-ratings"><ul class="list-links"><li><a href="/rating.html">Rating update<div>1 Jan 2025 from crisil</div></a></li></ul></div>
        <div class="documents concalls"><ul class="list-links"><li><div>Jan 2025</div><a href="/call.pdf">Transcript</a><a href="/slides.pdf">PPT</a></li></ul></div>
      </section>
    </body>
  </html>
`;

describe("public listing parser", () => {
  it("normalizes listing identity, snapshot, financial tables, and documents", () => {
    const parsed = parseScreenerPage(
      page,
      "https://www.screener.in/company/ACME/consolidated/",
    );

    expect(parsed.companyName).toBe("Acme Industries Ltd");
    expect(parsed.companyId).toBe("42");
    expect(parsed.warehouseId).toBe("84");
    expect(parsed.consolidated).toBe(true);
    expect(parsed.exchanges.map((exchange) => exchange.name)).toEqual([
      "BSE",
      "NSE",
    ]);
    expect(parsed.snapshot?.marketCap).toBe(12345);
    expect(parsed.snapshot?.changePercent).toBe(4.25);
    expect(parsed.tables.quarters?.rows[0]).toEqual({
      label: "Sales",
      values: [1200, 1350],
    });
    expect(parsed.investors.annualReports).toHaveLength(1);
    expect(parsed.investors.documents.map((document) => document.type)).toEqual(
      [
        "annual_report",
        "credit_rating",
        "concall_transcript",
        "investor_presentation",
      ],
    );
  });

  it("parses price, moving-average, and volume datasets", () => {
    const chart = parseChartPayload(
      {
        datasets: [
          {
            metric: "Price",
            values: [
              ["2026-01-01", "100"],
              ["2026-01-02", "105"],
            ],
          },
          {
            metric: "DMA50",
            values: [
              ["2026-01-01", "98"],
              ["2026-01-02", "99"],
            ],
          },
          {
            metric: "Volume",
            values: [
              ["2026-01-01", 1000],
              ["2026-01-02", 1200],
            ],
          },
        ],
      },
      "https://www.screener.in/api/company/42/chart/",
      365,
    );

    expect(chart?.points).toEqual([
      { date: "2026-01-01", price: 100, dma50: 98, dma200: null, volume: 1000 },
      { date: "2026-01-02", price: 105, dma50: 99, dma200: null, volume: 1200 },
    ]);
  });

  it("parses peers loaded as a separate HTML table", () => {
    const peers = parsePeerHtml(
      `<table class="data-table"><thead><tr><th>S.No.</th><th>Name</th><th>P/E</th><th>ROCE</th></tr></thead><tbody><tr data-row-company-id="42"><td>1</td><td><a href="/company/ACME/">Acme</a></td><td>24.5</td><td>18%</td></tr></tbody><tfoot><tr><td></td><td>Median: 1 Co.</td><td>24.5</td><td>18%</td></tr></tfoot></table>`,
      "https://www.screener.in/company/ACME/",
    );

    expect(peers?.companies[0]).toEqual({
      name: "Acme",
      url: "https://www.screener.in/company/ACME/",
      metrics: { "P/E": 24.5, ROCE: "18%" },
    });
  });
});
