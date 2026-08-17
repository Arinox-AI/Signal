import { ArrowUpRight, CheckCircle2 } from "lucide-react";

import { Reveal } from "@/components/motion/reveal";
import { SearchBar } from "@/components/search-bar";
import { ScrollToTopLink } from "@/components/scroll-to-top-link";

const examples = [
  { label: "Coca-Cola", query: "coca-cola" },
  { label: "Toyota", query: "toyota" },
  { label: "Stripe", query: "stripe" },
] as const;

export function GetSignal() {
  return (
    <section id="get-signal" className="signal-command">
      <Reveal>
        <div className="command-panel">
          <div className="command-panel-grid" aria-hidden="true" />
          <div className="command-content">
            <div>
              <p className="section-kicker">Open a field note</p>
              <h2>Begin with the company.</h2>
              <p>
                The brief stays shareable. The sources stay attached. The
                unknowns stay visible.
              </p>
            </div>
            <div className="command-query">
              <SearchBar />
              <div className="query-examples">
                <span>Try</span>
                {examples.map((example) => (
                  <ScrollToTopLink
                    key={example.label}
                    href={`/company/${encodeURIComponent(example.query)}`}
                  >
                    {example.label}
                  </ScrollToTopLink>
                ))}
              </div>
            </div>
          </div>
          <div className="command-footer">
            <span>
              <CheckCircle2 className="size-3.5" aria-hidden="true" /> No signup
            </span>
            <span>
              <CheckCircle2 className="size-3.5" aria-hidden="true" /> Source
              links included
            </span>
            <span>
              <CheckCircle2 className="size-3.5" aria-hidden="true" /> Graceful
              partial results
            </span>
            <ScrollToTopLink href="/company/vercel">
              Preview a finished brief{" "}
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </ScrollToTopLink>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
