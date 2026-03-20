import type { Variants } from "framer-motion";

/** Premium fintech-style easing — quick settle, no bounce */
export const EASE_OUT = [0.16, 1, 0.3, 1] as const;

export function fadeUpItem(reduce: boolean | null): Variants {
  if (reduce) {
    return { hidden: { opacity: 1, y: 0 }, visible: { opacity: 1, y: 0 } };
  }
  return {
    hidden: { opacity: 0, y: 12 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4, ease: EASE_OUT },
    },
  };
}

/** Parent: stagger children on enter */
export function staggerContainer(
  reduce: boolean | null,
  stagger = 0.055,
  delayChildren = 0.06
): Variants {
  if (reduce) {
    return {
      hidden: {},
      visible: { transition: { staggerChildren: 0, delayChildren: 0 } },
    };
  }
  return {
    hidden: {},
    visible: {
      transition: { staggerChildren: stagger, delayChildren },
    },
  };
}

export function fadeOnly(reduce: boolean | null, delay = 0): Variants {
  if (reduce) {
    return { hidden: { opacity: 1 }, visible: { opacity: 1 } };
  }
  return {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { duration: 0.32, ease: EASE_OUT, delay },
    },
  };
}
