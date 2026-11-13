'use client';

import { motion, useReducedMotion } from 'motion/react';

/** Fade + collapse on add/remove. Wrap each item with a stable `key`; parent list needs <AnimatePresence>. */
export function AnimatedListItem({ children }: { children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      layout={!reduceMotion}
      initial={reduceMotion ? false : { opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={reduceMotion ? undefined : { opacity: 0, height: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="overflow-hidden"
    >
      {children}
    </motion.div>
  );
}
