"use client";

import { motion, useScroll, useSpring } from "framer-motion";

export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 150,
    damping: 28,
    mass: 0.18,
  });

  return (
    <motion.div
      aria-hidden="true"
      className="fixed top-0 right-0 left-0 z-[70] h-px origin-left bg-gradient-to-r from-blue-300 via-cyan-200 to-emerald-300 shadow-[0_0_18px_rgba(120,169,255,.65)]"
      style={{ scaleX }}
    />
  );
}
