"use client";

import { animate, useMotionValue, useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";
import { formatMoney } from "@/lib/dashboard-data";

type CountUpMoneyProps = {
  value: number;
  className?: string;
};

/**
 * Short count-up for currency; respects prefers-reduced-motion.
 */
export function CountUpMoney({ value, className = "" }: CountUpMoneyProps) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const mv = useMotionValue(reduce ? value : 0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (reduce) {
      el.textContent = formatMoney(value);
      return;
    }

    const unsub = mv.on("change", (v) => {
      el.textContent = formatMoney(Math.round(v * 100) / 100);
    });

    const controls = animate(mv, value, {
      duration: 0.88,
      ease: [0.16, 1, 0.3, 1],
    });

    return () => {
      unsub();
      controls.stop();
    };
  }, [value, reduce, mv]);

  return (
    <span ref={ref} className={className}>
      {reduce ? formatMoney(value) : formatMoney(0)}
    </span>
  );
}
