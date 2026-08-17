"use client";

import { BrainCircuit, Clock3, Link2, ShieldCheck } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

import { Reveal } from "@/components/motion/reveal";

const benefits = [
  {
    icon: Clock3,
    index: "01",
    title: "Minutes, not tabs",
    detail:
      "Bring an unwieldy research session down to one concise, source-aware brief.",
  },
  {
    icon: Link2,
    index: "02",
    title: "Claims with receipts",
    detail:
      "Follow the record, repository, article, or official website that supports each signal.",
  },
  {
    icon: ShieldCheck,
    index: "03",
    title: "Useful when incomplete",
    detail:
      "A missing source is named plainly. The rest of the evidence stays available.",
  },
  {
    icon: BrainCircuit,
    index: "04",
    title: "AI with a boundary",
    detail:
      "Gemini can synthesize supplied evidence; it never becomes the source of a fact.",
  },
] as const;

export function ProductStory() {
  const reduceMotion = useReducedMotion();
  return (
    <section id="product" className="signal-story">
      <div className="signal-container">
        <Reveal>
          <div className="story-intro">
            <p className="section-kicker">The research problem</p>
            <h2>The web gives you evidence. It rarely gives you context.</h2>
            <p>
              Signal is built for the moment you need to know what matters about
              a company—and need to be able to defend why.
            </p>
          </div>
        </Reveal>
        <div className="story-list">
          {benefits.map(({ icon: Icon, index, title, detail }, itemIndex) => (
            <Reveal key={title} delay={itemIndex * 0.07}>
              <motion.article
                className="story-item"
                whileHover={reduceMotion ? undefined : { x: 8 }}
                transition={{ type: "spring", stiffness: 260, damping: 23 }}
              >
                <span className="story-index">{index}</span>
                <span className="story-icon">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <div>
                  <h3>{title}</h3>
                  <p>{detail}</p>
                </div>
                <span className="story-rule" aria-hidden="true" />
              </motion.article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
