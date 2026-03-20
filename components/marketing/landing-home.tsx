"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  BadgeDollarSign,
  ListChecks,
  Gauge,
  Wallet,
  Target,
  Sparkles,
} from "lucide-react";
import { CountUpMoney } from "@/components/motion/count-up-money";
import { EASE_OUT, fadeUpItem, staggerContainer } from "@/components/motion/overview-variants";
import { formatMoney } from "@/lib/dashboard-data";

const DEMO_SAFE = 847.23;
const DEMO_DAILY = 38.5;

/** Subtle hover / tap on primary signup CTAs; skipped when reduced motion is on. */
function PrimaryCtaLink({
  href,
  className,
  children,
  reduce,
}: {
  href: string;
  className: string;
  children: ReactNode;
  reduce: boolean | null;
}) {
  return (
    <motion.span
      className="inline-flex"
      whileHover={
        reduce
          ? undefined
          : { scale: 1.02, transition: { duration: 0.18, ease: EASE_OUT } }
      }
      whileTap={reduce ? undefined : { scale: 0.98 }}
    >
      <Link href={href} className={className}>
        {children}
      </Link>
    </motion.span>
  );
}

const DEMO_BILLS = [
  { name: "Rent", amount: 1450, due: "Mar 12" },
  { name: "Electric", amount: 94.2, due: "Mar 15" },
  { name: "Streaming", amount: 17.99, due: "Mar 18" },
] as const;

function LandingDemoCard({ reduce }: { reduce: boolean | null }) {
  return (
    <motion.div
      initial={false}
      whileHover={
        reduce
          ? undefined
          : {
              y: -6,
              boxShadow:
                "0 28px 60px -16px rgba(5,150,105,0.35), 0 0 0 1px rgba(16,185,129,0.2)",
              transition: { duration: 0.22, ease: EASE_OUT },
            }
      }
      className="w-full max-w-[420px] rounded-3xl border border-white/[0.09] bg-slate-950/75 p-5 shadow-[0_20px_50px_-24px_rgba(0,0,0,0.85)] backdrop-blur-xl sm:p-6"
    >
      <p className="text-center text-[0.65rem] font-medium uppercase tracking-[0.12em] text-slate-500">
        Live preview
      </p>

      <div className="mt-4 overflow-hidden rounded-2xl border border-emerald-400/20 bg-gradient-to-br from-emerald-600 via-emerald-800 to-slate-900 p-4 shadow-[0_14px_36px_-12px_rgba(5,150,105,0.45)]">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-emerald-100/85">
            Safe to spend
          </p>
          <span className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[0.6rem] font-medium text-emerald-50">
            On track
          </span>
        </div>
        <p className="mt-3 text-3xl font-bold tabular-nums tracking-tight text-white">
          <CountUpMoney value={DEMO_SAFE} />
        </p>
        <p className="mt-2 text-xs text-emerald-100/75">
          After bills &amp; goals · through <span className="font-medium text-emerald-50">Mar 14</span>
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-white/[0.07] bg-slate-900/50 px-3.5 py-3">
          <p className="text-[0.6rem] font-medium uppercase tracking-wider text-slate-500">
            Next payday
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-100">Fri, Mar 14</p>
        </div>
        <div className="rounded-xl border border-white/[0.07] bg-slate-900/50 px-3.5 py-3">
          <p className="text-[0.6rem] font-medium uppercase tracking-wider text-slate-500">
            Daily limit
          </p>
          <p className="mt-1 text-sm font-semibold tabular-nums text-emerald-200/95">
            {formatMoney(DEMO_DAILY)}
          </p>
        </div>
      </div>

      <div className="mt-4 border-t border-white/[0.06] pt-4">
        <p className="text-[0.65rem] font-medium uppercase tracking-wider text-slate-500">
          Upcoming bills
        </p>
        <ul className="mt-2.5 space-y-2">
          {DEMO_BILLS.map((bill) => (
            <li
              key={bill.name}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-slate-900/35 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-100">{bill.name}</p>
                <p className="text-[0.65rem] text-slate-500">{bill.due}</p>
              </div>
              <p className="shrink-0 text-sm font-semibold tabular-nums text-emerald-200/90">
                {formatMoney(bill.amount)}
              </p>
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-4 text-center text-[0.65rem] leading-snug text-slate-600">
        Example numbers · sign in to use your own budget
      </p>
    </motion.div>
  );
}

const FEATURES = [
  {
    icon: Wallet,
    kicker: "Track",
    title: "Bills & balance",
    body: "See what’s due and what you can safely spend between paychecks.",
  },
  {
    icon: Target,
    kicker: "Plan",
    title: "Goals & investing",
    body: "Retirement, savings, and allocation you can actually follow.",
  },
  {
    icon: Sparkles,
    kicker: "Insights",
    title: "Guidance",
    body: "Plain-language next steps based on your real numbers.",
  },
] as const;

const STEPS = [
  {
    step: 1,
    icon: BadgeDollarSign,
    title: "Connect income",
    body: "Add your pay schedule and account balance so projections start from reality.",
  },
  {
    step: 2,
    icon: ListChecks,
    title: "Add bills",
    body: "Log recurring bills and spending so commitments are baked in before you spend.",
  },
  {
    step: 3,
    icon: Gauge,
    title: "See safe to spend",
    body: "Get a daily limit and a clear number for what’s safe until payday.",
  },
] as const;

export function LandingHome() {
  const reduce = useReducedMotion();

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* Background depth */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden motion-reduce:opacity-90"
      >
        <div className="absolute left-1/2 top-[-12%] h-[min(85vh,560px)] w-[min(140vw,900px)] -translate-x-1/2 rounded-[50%] bg-emerald-500/[0.14] blur-[120px]" />
        <div className="absolute right-[-8%] top-[22%] h-[340px] w-[340px] rounded-full bg-sky-500/[0.11] blur-[100px]" />
        <div className="absolute bottom-[5%] left-[-10%] h-[280px] w-[400px] rounded-full bg-teal-600/[0.08] blur-[90px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(16,185,129,0.09),transparent_55%)]" />
      </div>

      <div className="relative z-10">
        <motion.header
          initial={reduce ? false : { opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: EASE_OUT }}
          className="border-b border-white/[0.08] bg-slate-950/80 backdrop-blur-md"
        >
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
            <Link href="/" className="text-xl font-bold tracking-tight text-slate-50 sm:text-2xl">
              Balnced
            </Link>
            <div className="flex gap-2">
              <Link
                href="/login"
                className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/[0.06] hover:text-slate-100 motion-reduce:transition-none"
              >
                Log in
              </Link>
              <PrimaryCtaLink
                href="/signup"
                reduce={reduce}
                className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(5,150,105,0.45)] transition hover:bg-emerald-500 motion-reduce:transition-none"
              >
                Get started
              </PrimaryCtaLink>
            </div>
          </div>
        </motion.header>

        {/* Hero + demo */}
        <section className="mx-auto max-w-6xl px-5 pb-20 pt-14 sm:px-6 sm:pb-28 sm:pt-20">
          <div className="flex flex-col items-center gap-12 lg:flex-row lg:items-start lg:justify-between lg:gap-16">
            <motion.div
              variants={staggerContainer(reduce, 0.09, 0.08)}
              initial="hidden"
              animate="visible"
              className="max-w-xl flex-1 text-center lg:pt-2 lg:text-left"
            >
              <motion.h1
                variants={fadeUpItem(reduce)}
                className="text-3xl font-bold tracking-tight text-slate-50 sm:text-4xl lg:text-[2.65rem] lg:leading-[1.12]"
              >
                Know exactly what you can spend before payday.
              </motion.h1>

              <motion.p
                variants={fadeUpItem(reduce)}
                className="mt-5 max-w-2xl text-base leading-relaxed text-slate-400 sm:mt-6 sm:text-lg lg:mx-0"
              >
                Balnced plans bills, tracks spending, and shows a clear{" "}
                <span className="text-slate-200">safe to spend</span> number—plus goals and retirement
                context when you’re ready.
              </motion.p>

              <motion.div variants={fadeUpItem(reduce)} className="mt-9 sm:mt-10">
                <div className="flex flex-wrap justify-center gap-3 lg:justify-start">
                  <PrimaryCtaLink
                    href="/signup"
                    reduce={reduce}
                    className="inline-flex min-h-[2.75rem] items-center justify-center rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-[0_12px_32px_-10px_rgba(5,150,105,0.4)] transition hover:bg-emerald-500 motion-reduce:transition-none sm:px-8 sm:text-base"
                  >
                    Get started
                  </PrimaryCtaLink>
                  <Link
                    href="/login"
                    className="inline-flex min-h-[2.75rem] items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-6 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-white/25 hover:bg-white/[0.07] motion-reduce:transition-none sm:px-8 sm:text-base"
                  >
                    Log in
                  </Link>
                </div>
                <p className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-slate-500 lg:justify-start">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-1 w-1 rounded-full bg-emerald-500/80" aria-hidden />
                    Takes 30 seconds
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-1 w-1 rounded-full bg-emerald-500/80" aria-hidden />
                    Free to start
                  </span>
                </p>
              </motion.div>
            </motion.div>

            <motion.div
              variants={fadeUpItem(reduce)}
              initial="hidden"
              animate="visible"
              className="flex w-full shrink-0 justify-center lg:w-auto lg:justify-end lg:pt-4"
              transition={reduce ? undefined : { delay: 0.14 }}
            >
              <LandingDemoCard reduce={reduce} />
            </motion.div>
          </div>
        </section>

        {/* How it works */}
        <section className="mx-auto max-w-6xl px-5 pb-16 sm:px-6">
          <motion.div
            variants={staggerContainer(reduce, 0.08, 0.05)}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-40px" }}
            className="rounded-[2rem] border border-white/[0.07] bg-slate-950/40 px-6 py-12 sm:px-10 sm:py-14"
          >
            <motion.h2
              variants={fadeUpItem(reduce)}
              className="text-center text-xs font-semibold uppercase tracking-[0.16em] text-emerald-400/90"
            >
              How it works
            </motion.h2>
            <motion.p
              variants={fadeUpItem(reduce)}
              className="mx-auto mt-3 max-w-lg text-center text-xl font-semibold tracking-tight text-slate-100 sm:text-2xl"
            >
              From paycheck chaos to a calm daily number
            </motion.p>
            <div className="mt-12 grid gap-8 sm:grid-cols-3 sm:gap-10">
              {STEPS.map(({ step, icon: Icon, title, body }) => (
                <motion.div
                  key={step}
                  variants={fadeUpItem(reduce)}
                  className="relative text-center sm:text-left"
                >
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-400 sm:mx-0">
                    <Icon className="h-6 w-6" strokeWidth={1.75} aria-hidden />
                  </div>
                  <p className="mt-4 text-xs font-semibold text-slate-500">Step {step}</p>
                  <h3 className="mt-1 text-lg font-semibold text-slate-50">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">{body}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* Feature cards */}
        <section className="mx-auto max-w-6xl px-5 pb-24 sm:px-6">
          <motion.div
            variants={staggerContainer(reduce, 0.09, 0.06)}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            className="grid max-w-5xl grid-cols-1 gap-5 text-left sm:mx-auto sm:grid-cols-3 sm:gap-6"
          >
            {FEATURES.map(({ icon: Icon, kicker, title, body }) => (
              <motion.div
                key={title}
                variants={fadeUpItem(reduce)}
                whileHover={
                  reduce
                    ? undefined
                    : {
                        y: -4,
                        boxShadow: "0 18px 40px -20px rgba(0,0,0,0.75)",
                        borderColor: "rgba(16, 185, 129, 0.22)",
                        transition: { duration: 0.2, ease: EASE_OUT },
                      }
                }
                className="balnced-panel rounded-3xl p-6 transition-[border-color] duration-200 motion-reduce:transition-none sm:p-7"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/12 text-emerald-400">
                  <Icon className="h-5 w-5" strokeWidth={1.85} aria-hidden />
                </div>
                <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-emerald-400/90">
                  {kicker}
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-100">{title}</p>
                <p className="mt-3 text-sm leading-relaxed text-slate-500">{body}</p>
              </motion.div>
            ))}
          </motion.div>
        </section>
      </div>
    </main>
  );
}
