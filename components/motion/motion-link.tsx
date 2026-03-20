"use client";

import NextLink from "next/link";
import { motion, type HTMLMotionProps } from "framer-motion";
import type { LinkProps } from "next/link";

/**
 * Next.js `Link` (default `<a>`) with motion on an inner `motion.span`.
 * Avoids `legacyBehavior` + `motion.a`, which can crash with React 19 / Turbopack
 * (`displayName` on undefined during Link’s `cloneElement` path).
 */
export type MotionLinkProps = LinkProps &
  Omit<HTMLMotionProps<"span">, keyof LinkProps>;

export function MotionLink(props: MotionLinkProps) {
  const p = props as LinkProps & HTMLMotionProps<"span">;
  const {
    href,
    as,
    replace,
    scroll,
    shallow,
    prefetch,
    locale,
    onNavigate,
    passHref: _passHref,
    legacyBehavior: _legacyBehavior,
    children,
    className,
    ...motionSpanProps
  } = p;

  if ("unstable_dynamicOnHover" in motionSpanProps) {
    delete (motionSpanProps as Record<string, unknown>).unstable_dynamicOnHover;
  }

  return (
    <NextLink
      href={href}
      as={as}
      replace={replace}
      scroll={scroll}
      shallow={shallow}
      prefetch={prefetch}
      locale={locale}
      onNavigate={onNavigate}
      className={className}
    >
      <motion.span className="relative inline-flex max-w-full" {...motionSpanProps}>
        {children}
      </motion.span>
    </NextLink>
  );
}
