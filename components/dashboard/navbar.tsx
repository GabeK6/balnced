"use client";

import { useState } from "react";
import Link from "next/link";
import { Home } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { MotionLink } from "@/components/motion/motion-link";
import { EASE_OUT } from "@/components/motion/overview-variants";
import { useUserPlan } from "@/hooks/use-user-plan";
import { navTrialBadgeText, shouldShowSubscribeCta } from "@/lib/plan-access";
import UpgradeModal from "@/components/dashboard/upgrade-modal";
import BalncedLogo from "@/components/brand/balnced-logo";
import { formatMoney } from "@/lib/dashboard-data";
import { useWalletBalance } from "@/components/dashboard/wallet-balance-context";

/** Day-to-day money control */
const NAV_CORE = [
  { href: "/dashboard", label: "Overview" },
  { href: "/bills", label: "Bills" },
  { href: "/debts", label: "Debts" },
  { href: "/expenses", label: "Expenses" },
] as const;

/** Planning & insights */
const NAV_PLANNING = [
  { href: "/goals", label: "Goals" },
  { href: "/retirement", label: "Retirement" },
  { href: "/projection", label: "Projection" },
  { href: "/insights", label: "Insights" },
] as const;

const tabTransition = { type: "tween" as const, duration: 0.22, ease: EASE_OUT };

const inactiveLinkClass =
  "rounded-lg px-3 py-2 text-sm font-medium text-slate-400 transition-colors duration-150 hover:text-slate-100 motion-reduce:transition-none";

const inactiveLinkHoverUnderline =
  "underline-offset-[4px] decoration-transparent hover:decoration-slate-500/50 hover:underline";

function UtilityDivider() {
  return (
    <span
      className="mx-1 hidden h-4 w-px shrink-0 bg-white/[0.07] sm:block"
      aria-hidden
    />
  );
}

type NavItemProps = {
  href: string;
  label: string;
  pathname: string;
  reduce: boolean | null;
  compact?: boolean;
};

function NavItem({ href, label, pathname, reduce, compact }: NavItemProps) {
  const active = pathname === href;
  const isOverview = href === "/dashboard";
  const padX = compact ? "px-4" : "px-5";
  const padY = "py-2.5";

  if (isOverview) {
    return (
      <MotionLink
        href="/dashboard"
        aria-current={active ? "page" : undefined}
        className="relative inline-flex rounded-full text-sm font-medium"
        whileHover={
          reduce
            ? undefined
            : active
              ? undefined
              : { y: -1, transition: { duration: 0.15, ease: EASE_OUT } }
        }
        whileTap={reduce ? undefined : { scale: 0.97 }}
      >
        <span
          className={`relative inline-flex items-center gap-2 rounded-full text-sm font-medium ${padX} ${padY}`}
        >
          {active ? (
            reduce ? (
              <span
                className="absolute inset-0 -z-0 rounded-full bg-emerald-600 shadow-[0_8px_24px_-8px_rgba(5,150,105,0.45)]"
                aria-hidden
              />
            ) : (
              <motion.span
                layoutId="balnced-nav-active-pill"
                className="absolute inset-0 -z-0 rounded-full bg-emerald-600 shadow-[0_8px_24px_-8px_rgba(5,150,105,0.45)]"
                transition={tabTransition}
                aria-hidden
              />
            )
          ) : (
            <span
              className="absolute inset-0 -z-0 rounded-full border border-emerald-500/30 bg-emerald-500/[0.12] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] shadow-[0_0_28px_-14px_rgba(52,211,153,0.22)]"
              aria-hidden
            />
          )}
          <Home
            className={`relative z-10 h-3.5 w-3.5 shrink-0 ${active ? "text-white" : "text-emerald-200/90"}`}
            strokeWidth={2}
            aria-hidden
          />
          <span
            className={`relative z-10 ${active ? "text-white" : "text-emerald-100/95"}`}
          >
            {label}
          </span>
        </span>
      </MotionLink>
    );
  }

  if (active) {
    return (
      <MotionLink
        href={href}
        aria-current="page"
        className={`relative inline-flex rounded-xl text-sm font-medium text-white transition-[color] duration-150`}
        whileHover={reduce ? undefined : { y: -1, transition: { duration: 0.15, ease: EASE_OUT } }}
        whileTap={reduce ? undefined : { scale: 0.97 }}
      >
        <span className={`relative inline-block rounded-xl ${compact ? "px-5" : "px-6"} ${padY}`}>
          {reduce ? (
            <span
              className="absolute inset-0 -z-0 rounded-xl bg-emerald-600 shadow-[0_8px_24px_-8px_rgba(5,150,105,0.45)]"
              aria-hidden
            />
          ) : (
            <motion.span
              layoutId="balnced-nav-active-pill"
              className="absolute inset-0 -z-0 rounded-xl bg-emerald-600 shadow-[0_8px_24px_-8px_rgba(5,150,105,0.45)]"
              transition={tabTransition}
              aria-hidden
            />
          )}
          <span className="relative z-10">{label}</span>
        </span>
      </MotionLink>
    );
  }

  return (
    <Link
      href={href}
      className={`${inactiveLinkClass} ${inactiveLinkHoverUnderline}`}
    >
      {label}
    </Link>
  );
}


export default function Navbar() {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const { plan, loading: planLoading, hasProAccess, planAccess, refresh } = useUserPlan();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const trialBadge = !planLoading ? navTrialBadgeText(planAccess) : null;
  const showSubscribeCta = !planLoading && shouldShowSubscribeCta(planAccess);
  /** Paid Pro chip: `plan === "pro"` + `hasProAccess`. Trial users get `trialBadge` instead (`plan` stays free). */
  const showProBadge = !planLoading && hasProAccess && plan === "pro";
  const showPlanBadges =
    Boolean(trialBadge) || showSubscribeCta || showProBadge;
  const {
    availableBalance: walletBalance,
    loaded: walletLoaded,
    userInitial,
  } = useWalletBalance();

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const groupDivider = (
    <div
      className="mx-2 hidden h-7 w-px shrink-0 bg-gradient-to-b from-transparent via-white/18 to-transparent lg:block"
      aria-hidden
    />
  );

  const mobileDivider = (
    <div
      className="mx-1 h-6 w-px shrink-0 bg-white/12 lg:hidden"
      aria-hidden
    />
  );

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-slate-950/85 backdrop-blur-md">
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
        <div className="flex min-h-[4.25rem] flex-wrap items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-4 sm:gap-6 lg:gap-8">
            <BalncedLogo size="md" href="/dashboard" />

            <nav className="hidden items-center lg:flex" aria-label="Primary">
              <div className="flex items-center gap-1">
                {NAV_CORE.map((link) => (
                  <NavItem
                    key={link.href}
                    href={link.href}
                    label={link.label}
                    pathname={pathname}
                    reduce={reduce}
                  />
                ))}
              </div>
              {groupDivider}
              <div className="flex items-center gap-1">
                {NAV_PLANNING.map((link) => (
                  <NavItem
                    key={link.href}
                    href={link.href}
                    label={link.label}
                    pathname={pathname}
                    reduce={reduce}
                  />
                ))}
              </div>
            </nav>
          </div>

          <div className="flex min-w-0 shrink-0 items-center gap-2">
            <div
              className="flex h-9 max-w-[min(100vw-8rem,24rem)] items-center gap-1.5 rounded-2xl border border-white/[0.06] bg-slate-900/40 px-2 py-0.5 backdrop-blur-sm sm:h-10 sm:max-w-none sm:gap-2 sm:px-2.5 md:px-3"
              role="group"
              aria-label="Wallet, plan status, and account menu"
            >
              <Link
                href="/onboarding"
                className="group/wallet flex min-w-0 max-w-[9.5rem] shrink flex-col justify-center rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-white/[0.04] sm:max-w-[11rem] md:max-w-[13rem]"
                title="Income & balance"
              >
                <span className="text-[0.6rem] font-medium uppercase tracking-wider text-slate-500">
                  Wallet
                </span>
                <span className="truncate text-[0.8125rem] font-medium tabular-nums leading-tight text-slate-200 sm:text-sm">
                  {!walletLoaded ? (
                    <span className="text-slate-500">…</span>
                  ) : walletBalance != null && Number.isFinite(walletBalance) ? (
                    <>
                      {formatMoney(walletBalance)}{" "}
                      <span className="font-normal text-slate-500">available</span>
                    </>
                  ) : (
                    <span className="text-slate-500">Set income</span>
                  )}
                </span>
              </Link>

              <UtilityDivider />

              {showPlanBadges ? (
                <div className="flex min-w-0 items-center gap-1.5">
                  {trialBadge ? (
                    <span
                      className="max-w-[8.5rem] truncate rounded-full border border-amber-500/20 bg-amber-500/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-100/85"
                      title={
                        planAccess?.trialEndsAt
                          ? `Trial ends ${new Date(planAccess.trialEndsAt).toLocaleString()}`
                          : undefined
                      }
                    >
                      {trialBadge}
                    </span>
                  ) : null}

                  {showSubscribeCta ? (
                    <button
                      type="button"
                      onClick={() => setUpgradeOpen(true)}
                      className="shrink-0 rounded-full border border-emerald-500/18 bg-emerald-500/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-200/85 transition hover:border-emerald-500/30 hover:bg-emerald-500/10"
                    >
                      {planAccess?.trialExpiredWithoutSubscription ? "Subscribe" : "Upgrade"}
                    </button>
                  ) : null}

                  {showProBadge ? (
                    <span
                      className="shrink-0 rounded-full border border-emerald-500/18 bg-emerald-500/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-100/80"
                      title="Paid Pro — see Subscription in the account menu for details"
                    >
                      Pro
                    </span>
                  ) : null}
                </div>
              ) : null}

              {showPlanBadges ? <UtilityDivider /> : null}

              <div className="group relative shrink-0">
                <button
                  type="button"
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-white/[0.08] bg-gradient-to-br from-slate-700/90 to-slate-900/90 text-xs font-semibold text-slate-100 shadow-inner shadow-black/20 transition hover:border-white/15 hover:from-slate-600/90 sm:h-8 sm:w-8 sm:text-sm"
                  aria-label="Account menu"
                  aria-haspopup="true"
                >
                  {userInitial || "?"}
                </button>

                <div className="invisible absolute right-0 top-full z-50 mt-2 w-60 rounded-2xl border border-white/10 bg-slate-950/95 p-2 opacity-0 shadow-[0_16px_48px_-12px_rgba(0,0,0,0.55)] backdrop-blur-lg transition-all duration-150 group-hover:visible group-hover:opacity-100">
                  <div className="px-1.5 pb-1 pt-0.5">
                    <p className="px-2.5 pb-2 pt-1 text-[0.65rem] font-semibold uppercase tracking-wider text-slate-500">
                      Account
                    </p>
                  </div>

                  <Link
                    href="/settings"
                    className="block rounded-lg px-3 py-2.5 text-sm text-slate-200 transition-colors hover:bg-white/10"
                  >
                    User settings
                  </Link>

                  <Link
                    href="/onboarding"
                    className="block rounded-lg px-3 py-2.5 text-sm text-slate-200 transition-colors hover:bg-white/10"
                  >
                    Income & balance
                  </Link>

                  <Link
                    href="/settings/subscription"
                    className="block rounded-lg px-3 py-2.5 text-sm text-slate-200 transition-colors hover:bg-white/10"
                  >
                    Subscription
                  </Link>

                  <div className="my-2 border-t border-white/10" />

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="block w-full cursor-pointer rounded-lg px-3 py-2.5 text-left text-sm font-medium text-rose-400 transition-colors duration-150 hover:bg-gradient-to-br hover:from-red-600 hover:to-black hover:text-white"
                  >
                    Log out
                  </button>
                </div>
              </div>
            </div>

            <UpgradeModal
              open={upgradeOpen}
              onClose={() => setUpgradeOpen(false)}
              planAccess={planAccess}
              loadingPlan={planLoading}
              onRefresh={refresh}
            />
          </div>
        </div>

        <nav
          className="flex items-center gap-0 overflow-x-auto pb-4 pt-1 lg:hidden"
          aria-label="Primary"
        >
          <div className="flex shrink-0 items-center gap-1">
            {NAV_CORE.map((link) => (
              <NavItem
                key={link.href}
                href={link.href}
                label={link.label}
                pathname={pathname}
                reduce={reduce}
                compact
              />
            ))}
          </div>
          {mobileDivider}
          <div className="flex shrink-0 items-center gap-1">
            {NAV_PLANNING.map((link) => (
              <NavItem
                key={link.href}
                href={link.href}
                label={link.label}
                pathname={pathname}
                reduce={reduce}
                compact
              />
            ))}
          </div>
        </nav>
      </div>
    </header>
  );
}
