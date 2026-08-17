import { Bot, Braces, Flag, Globe2, Landmark, Newspaper } from "lucide-react";

import { Reveal } from "@/components/motion/reveal";

const sources = [
  { icon: Landmark, name: "Entity records", detail: "GLEIF + Wikidata" },
  { icon: Globe2, name: "Official presence", detail: "Website + public web" },
  { icon: Braces, name: "Builder signal", detail: "GitHub" },
  { icon: Newspaper, name: "Current context", detail: "Google News RSS" },
  { icon: Flag, name: "Operating context", detail: "REST Countries" },
  { icon: Bot, name: "Grounded synthesis", detail: "Gemini" },
] as const;

export function SourceGrid() {
  return (
    <section id="sources" className="signal-sources">
      <div className="signal-container">
        <Reveal>
          <div className="sources-heading">
            <p className="section-kicker">The evidence field</p>
            <h2>Every signal has a point of origin.</h2>
            <p>
              Sources remain visible, independent, and honest about their
              availability. There is no hidden relevance score to trust on
              faith.
            </p>
          </div>
        </Reveal>
        <div className="constellation">
          <div className="constellation-core" aria-hidden="true">
            <span>ONE</span>
            <b>brief</b>
            <i />
          </div>
          {sources.map(({ icon: Icon, name, detail }, index) => (
            <Reveal
              key={name}
              delay={index * 0.065}
              className={`constellation-node constellation-node-${index + 1}`}
            >
              <article>
                <Icon className="size-4" aria-hidden="true" />
                <div>
                  <h3>{name}</h3>
                  <p>{detail}</p>
                </div>
                <span>live</span>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
