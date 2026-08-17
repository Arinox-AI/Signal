"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

export function Reveal({
  children,
  delay = 0,
  className,
  distance = 42,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  distance?: number;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={
        reduceMotion
          ? false
          : {
              opacity: 0,
              y: distance,
              scale: 0.985,
              filter: "blur(10px)",
            }
      }
      whileInView={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
      viewport={{ once: true, amount: 0.16, margin: "0px 0px -7% 0px" }}
      transition={{
        duration: 0.8,
        delay: reduceMotion ? 0 : delay,
        ease: [0.22, 1, 0.36, 1],
      }}
      style={{ willChange: reduceMotion ? "auto" : "transform, opacity" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
