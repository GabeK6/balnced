"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { MotionLink } from "@/components/motion/motion-link";
import { EASE_OUT } from "@/components/motion/overview-variants";

const links = [
  { href: "/dashboard", label: "Overview" },
  { href: "/retirement", label: "Retirement" },
  { href: "/goals", label: "Goals" },
  { href: "/bills", label: "Bills" },
  { href: "/expenses", label: "Expenses" },
  { href: "/projection", label: "Projection" },
  { href: "/insights", label: "Insights" },
];

function ProfileIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M20 21a8 8 0 0 0-16 0" />
      <circle cx="12" cy="8" r="4" />
    </svg>
  );
}

const navEase =
  "transition-[background-color,color,box-shadow] duration-150 ease-out motion-reduce:transition-none";

const tabTransition = { type: "tween" as const, duration: 0.22, ease: EASE_OUT };

export default function Navbar() {
  const pathname = usePathname();
  const reduce = useReducedMotion();

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-500/35 bg-slate-400/92 backdrop-blur-md">
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
        <div className="flex min-h-[4.25rem] flex-wrap items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-4 sm:gap-6 lg:gap-8">
            <Link
              href="/dashboard"
              className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl"
            >
              Balnced
            </Link>

            <nav className="hidden items-center gap-1 lg:flex">
              {links.map((link) => {
                const active = pathname === link.href;

                return (
                  <MotionLink
                    key={link.href}
                    href={link.href}
                    className={`relative inline-flex rounded-xl text-sm font-medium ${navEase} ${
                      active ? "text-white" : "text-slate-800 hover:bg-slate-500/35 hover:text-slate-950"
                    }`}
                    whileHover={
                      reduce || active ? undefined : { y: -1, transition: { duration: 0.15, ease: EASE_OUT } }
                    }
                    whileTap={reduce ? undefined : { scale: 0.97 }}
                  >
                    {/* Padding lives here so layoutId / absolute pill matches full chip, not just text */}
                    <span className="relative inline-block rounded-xl px-6 py-2.5">
                      {active &&
                        (reduce ? (
                          <span
                            className="absolute inset-0 -z-0 rounded-xl bg-emerald-600 shadow-[0_8px_24px_-8px_rgba(5,150,105,0.45)]"
                            aria-hidden
                          />
                        ) : (
                          <motion.span
                            layoutId="balnced-nav-tab-lg"
                            className="absolute inset-0 -z-0 rounded-xl bg-emerald-600 shadow-[0_8px_24px_-8px_rgba(5,150,105,0.45)]"
                            transition={tabTransition}
                            aria-hidden
                          />
                        ))}
                      <span className="relative z-10">{link.label}</span>
                    </span>
                  </MotionLink>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/onboarding"
              className="hidden rounded-xl border border-slate-600/30 bg-slate-300/55 px-4 py-2.5 text-sm font-medium text-slate-800 shadow-sm transition duration-150 hover:border-slate-700/35 hover:bg-slate-300/75 md:inline-flex"
            >
              Income & balance
            </Link>

            <div className="group relative">
              <button
                type="button"
                className="flex items-center gap-2 rounded-xl border border-slate-600/30 bg-slate-300/55 px-4 py-2.5 text-sm font-medium text-slate-900 shadow-sm transition duration-150 hover:border-slate-700/35 hover:bg-slate-300/75"
              >
                <ProfileIcon />
                Profile
              </button>

              <div className="invisible absolute right-0 top-full z-50 mt-2 w-60 rounded-2xl border border-slate-200/95 bg-white p-2.5 opacity-0 shadow-[0_16px_48px_-12px_rgba(15,23,42,0.2)] backdrop-blur-lg transition-all duration-150 group-hover:visible group-hover:opacity-100">
                <div className="px-3 py-2.5">
                  <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-slate-500">
                    Settings
                  </p>
                </div>

                <Link
                  href="/onboarding"
                  className="block rounded-lg px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-100"
                >
                  Income & balance
                </Link>

                <div className="my-2 border-t border-slate-200" />

                <button
                  onClick={handleLogout}
                  className="block w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-rose-600 hover:bg-rose-50"
                >
                  Log out
                </button>
              </div>
            </div>
          </div>
        </div>

        <nav className="flex gap-2 overflow-x-auto pb-4 pt-1 lg:hidden">
          {links.map((link) => {
            const active = pathname === link.href;

            return (
              <MotionLink
                key={link.href}
                href={link.href}
                className={`relative inline-flex whitespace-nowrap rounded-xl text-sm font-medium ${navEase} ${
                  active
                    ? "text-white"
                    : "border border-slate-600/30 bg-slate-300/50 text-slate-800 shadow-sm hover:bg-slate-300/70"
                }`}
                whileHover={
                  reduce || active ? undefined : { y: -1, transition: { duration: 0.15, ease: EASE_OUT } }
                }
                whileTap={reduce ? undefined : { scale: 0.97 }}
              >
                <span className="relative inline-block rounded-xl px-5 py-2.5">
                  {active &&
                    (reduce ? (
                      <span className="absolute inset-0 -z-0 rounded-xl bg-emerald-600" aria-hidden />
                    ) : (
                      <motion.span
                        layoutId="balnced-nav-tab-sm"
                        className="absolute inset-0 -z-0 rounded-xl bg-emerald-600"
                        transition={tabTransition}
                        aria-hidden
                      />
                    ))}
                  <span className="relative z-10">{link.label}</span>
                </span>
              </MotionLink>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
