import type { ReactNode } from "react";
import { AuthLoginAtmosphere } from "@/components/auth/auth-login-atmosphere";
import { AuthLoginFloatingCards } from "@/components/auth/auth-login-floating-cards";

type Props = {
  children: ReactNode;
};

/**
 * Centered login: calm atmosphere + two ambient cards + soft spotlight + form (z-10).
 */
export function AuthLoginCenteredShell({ children }: Props) {
  return (
    <main className="relative min-h-dvh min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <AuthLoginAtmosphere />
      <AuthLoginFloatingCards />

      {/* Auth stage — soft halo behind the card (true viewport center) */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 z-[5] h-[min(36rem,78vh)] w-[min(52rem,96vw)] -translate-x-1/2 -translate-y-1/2"
        aria-hidden
      >
        <div className="h-full w-full rounded-[3.5rem] bg-[radial-gradient(ellipse_at_center,rgba(15,23,42,0.45)_0%,rgba(16,185,129,0.085)_45%,transparent_70%)] blur-[2.5rem]" />
        <div className="absolute inset-0 rounded-[3.5rem] bg-[radial-gradient(ellipse_at_center,transparent_28%,rgba(2,6,23,0.38)_100%)]" />
      </div>

      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0 z-[1] h-px bg-gradient-to-r from-transparent via-emerald-500/15 to-transparent"
        aria-hidden
      />

      <div className="relative z-10 flex min-h-dvh min-h-screen w-full flex-col items-center justify-center px-4 py-10 sm:px-8 sm:py-12">
        <div className="flex w-full min-w-0 max-w-xl flex-col items-stretch justify-center">
          {children}
        </div>
      </div>
    </main>
  );
}
