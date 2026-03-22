"use client";

import { Shield } from "lucide-react";
import { TRUST_DATA_NOTE, TRUST_DISCLAIMER } from "@/lib/trust-copy";

type Props = {
  /** Tighter spacing when used in compact layouts (e.g. split panels). */
  compact?: boolean;
};

export default function TrustFooter({ compact = false }: Props) {
  return (
    <footer
      className={`border-t border-white/[0.06] ${compact ? "mt-6 pt-4" : "mt-10 pt-6"} pb-1`}
      role="contentinfo"
    >
      <div className="flex gap-3">
        <Shield
          className="mt-0.5 h-4 w-4 shrink-0 text-slate-600"
          strokeWidth={1.75}
          aria-hidden
        />
        <div className="min-w-0 space-y-1">
          <p className="text-[0.7rem] leading-relaxed text-slate-500">{TRUST_DISCLAIMER}</p>
          <p className="text-[0.65rem] leading-relaxed text-slate-600">{TRUST_DATA_NOTE}</p>
        </div>
      </div>
    </footer>
  );
}
