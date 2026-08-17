"use client";

import { ArrowDown, ArrowRight, Braces, Globe2, Newspaper } from "lucide-react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";
import Link from "next/link";
import { useRef } from "react";

const sources = [
  {
    label: "Identity",
    detail: "Wikidata + GLEIF",
    icon: Globe2,
    position: "source-a",
  },
  {
    label: "Build",
    detail: "GitHub activity",
    icon: Braces,
    position: "source-b",
  },
  {
    label: "Now",
    detail: "News coverage",
    icon: Newspaper,
    position: "source-c",
  },
] as const;

export function LandingHero() {
  const fieldRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const smoothX = useSpring(pointerX, {
    stiffness: 110,
    damping: 18,
    mass: 0.2,
  });
  const smoothY = useSpring(pointerY, {
    stiffness: 110,
    damping: 18,
    mass: 0.2,
  });
  const rotateY = useTransform(smoothX, [-0.5, 0.5], [-5, 5]);
  const rotateX = useTransform(smoothY, [-0.5, 0.5], [4, -4]);
  const translateX = useTransform(smoothX, [-0.5, 0.5], [-12, 12]);
  const translateY = useTransform(smoothY, [-0.5, 0.5], [-10, 10]);

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    pointerX.set((event.clientX - bounds.left) / bounds.width - 0.5);
    pointerY.set((event.clientY - bounds.top) / bounds.height - 0.5);
  }

  function resetPointer() {
    pointerX.set(0);
    pointerY.set(0);
  }

  return (
    <section className="signal-hero relative overflow-hidden">
      <div className="hero-noise" aria-hidden="true" />
      <div className="hero-halo hero-halo-one" aria-hidden="true" />
      <div className="hero-halo hero-halo-two" aria-hidden="true" />
      <div className="signal-hero-inner">
        <div className="hero-copy">
          <motion.h1
            initial={reduceMotion ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.85,
              delay: 0.08,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            Find the fact that
            <span> changes the decision.</span>
          </motion.h1>
          <motion.p
            initial={reduceMotion ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.75,
              delay: 0.18,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="hero-description"
          >
            Signal brings identity, activity, coverage, and operating context
            into one evidence-aware company brief—without losing the source
            behind the claim.
          </motion.p>
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.7,
              delay: 0.28,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="hero-actions"
          >
            <Link href="#get-signal" className="hero-primary-action">
              Start with a company{" "}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link href="#how-it-works" className="hero-secondary-action">
              Trace the method{" "}
              <ArrowDown className="size-4" aria-hidden="true" />
            </Link>
          </motion.div>
          <p className="hero-proof">
            No account · No black-box score · Every source remains visible
          </p>
        </div>

        <motion.div
          ref={fieldRef}
          onPointerMove={reduceMotion ? undefined : handlePointerMove}
          onPointerLeave={reduceMotion ? undefined : resetPointer}
          className="evidence-field"
          style={{
            rotateX: reduceMotion ? 0 : rotateX,
            rotateY: reduceMotion ? 0 : rotateY,
            x: reduceMotion ? 0 : translateX,
            y: reduceMotion ? 0 : translateY,
          }}
          aria-label="A visual representation of public sources converging into one company brief"
        >
          <div className="field-grid" aria-hidden="true" />
          <div className="field-orbit field-orbit-outer" aria-hidden="true" />
          <div className="field-orbit field-orbit-inner" aria-hidden="true" />
          <div className="field-beam field-beam-a" aria-hidden="true" />
          <div className="field-beam field-beam-b" aria-hidden="true" />
          <div className="field-beam field-beam-c" aria-hidden="true" />
          {sources.map(({ label, detail, icon: Icon, position }, index) => (
            <motion.div
              key={label}
              initial={reduceMotion ? false : { opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                duration: 0.55,
                delay: 0.42 + index * 0.12,
                ease: [0.22, 1, 0.36, 1],
              }}
              className={`field-source ${position}`}
            >
              <span className="field-source-icon">
                <Icon className="size-3.5" aria-hidden="true" />
              </span>
              <span>
                <b>{label}</b>
                <small>{detail}</small>
              </span>
              <i aria-hidden="true" />
            </motion.div>
          ))}
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              duration: 0.8,
              delay: 0.78,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="field-core"
          >
            <div className="field-core-mark">
              <span />
              <span />
              <span />
            </div>
            <p>Signal brief</p>
            <small>Evidence attached</small>
          </motion.div>
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.7,
              delay: 0.95,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="field-readout"
          >
            <span>Confidence is not a score.</span>
            <strong>It is a trail you can inspect.</strong>
          </motion.div>
        </motion.div>
      </div>
      <div className="hero-footnote" aria-hidden="true">
        <span>SCROLL TO FIND THE SIGNAL</span>
        <i />
      </div>
    </section>
  );
}
