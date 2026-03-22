import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
};

/** Shared auth card — matches Balnced panel + premium shadow. */
export function AuthFormSurface({ children, className = "" }: Props) {
  return (
    <div
      className={`balnced-panel rounded-3xl p-8 shadow-[0_24px_80px_-32px_rgba(0,0,0,0.85)] sm:p-10 ${className}`}
    >
      {children}
    </div>
  );
}
