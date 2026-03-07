"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

const links = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/bills", label: "Bills" },
  { href: "/dashboard/recurring", label: "Recurring" },
  { href: "/dashboard/expenses", label: "Expenses" },
  { href: "/dashboard/projection", label: "Projection" },
  { href: "/dashboard/insights", label: "Insights" },
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

export default function Navbar() {
  const pathname = usePathname();

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur">
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
        <div className="flex min-h-[76px] flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-8">
            <Link
              href="/dashboard"
              className="text-3xl font-bold tracking-tight text-slate-900"
            >
              Balnced
            </Link>

            <nav className="hidden items-center gap-2 lg:flex">
              {links.map((link) => {
                const active = pathname === link.href;

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`rounded-2xl px-4 py-2.5 text-sm font-medium transition ${
                      active
                        ? "bg-emerald-500 text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/onboarding"
              className="hidden rounded-2xl bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-200 md:inline-flex"
            >
              Edit Budget
            </Link>

            <div className="group relative">
              <button
                type="button"
                className="flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
              >
                <ProfileIcon />
                Profile
              </button>

              <div className="invisible absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-2 opacity-0 shadow-xl transition-all duration-200 group-hover:visible group-hover:opacity-100">
                <div className="px-3 py-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    User Settings
                  </p>
                </div>

                <Link
                  href="/dashboard/profile"
                  className="block rounded-xl px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-100"
                >
                  Change Email
                </Link>

                <Link
                  href="/dashboard/profile"
                  className="block rounded-xl px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-100"
                >
                  Change Password
                </Link>

                <div className="my-2 border-t border-slate-200" />

                <button
                  onClick={handleLogout}
                  className="block w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-red-500 hover:bg-red-50"
                >
                  Log Out
                </button>
              </div>
            </div>
          </div>
        </div>

        <nav className="flex gap-2 overflow-x-auto pb-4 lg:hidden">
          {links.map((link) => {
            const active = pathname === link.href;

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`whitespace-nowrap rounded-2xl px-4 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-emerald-500 text-white shadow-sm"
                    : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}