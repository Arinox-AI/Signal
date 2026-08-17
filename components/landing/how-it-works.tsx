import { Braces, Search, Sparkles } from "lucide-react";

import { Reveal } from "@/components/motion/reveal";

const steps = [
  {
    number: "01",
    icon: Search,
    title: "Resolve",
    detail:
      "Enter a company or official domain. Signal starts with a conservative identity match—not a guess.",
  },
  {
    number: "02",
    icon: Braces,
    title: "Connect",
    detail:
      "Independent public sources load in parallel, normalize into one report, and disclose their own state.",
  },
  {
    number: "03",
    icon: Sparkles,
    title: "Interrogate",
    detail:
      "Read the brief, open the sources, and keep an eye on what is still unknown.",
  },
] as const;

export function HowItWorks() {
  return (
    <section id="how-it-works" className="signal-method">
      <div className="signal-container">
        <Reveal>
          <div className="method-heading">
            <p className="section-kicker">The method</p>
            <h2>Three moves. No mystery layer.</h2>
          </div>
        </Reveal>
        <div className="method-track">
          <div className="method-line" aria-hidden="true" />
          {steps.map(({ number, icon: Icon, title, detail }, index) => (
            <Reveal
              key={title}
              delay={index * 0.1}
              className="method-step-wrap"
            >
              <article className="method-step">
                <div className="method-step-top">
                  <span>{number}</span>
                  <Icon className="size-5" aria-hidden="true" />
                </div>
                <h3>{title}</h3>
                <p>{detail}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
