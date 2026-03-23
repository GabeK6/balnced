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
import BalncedLogo from "@/components/brand/balnced-logo";
import { TRUST_DATA_NOTE, TRUST_DISCLAIMER } from "@/lib/trust-copy";
import { LandingSpendDemo } from "@/components/marketing/landing-spend-demo";

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

/** Shared content width — slightly tighter for balance */
const SECTION = "mx-auto max-w-5xl px-5 sm:px-6";

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
      <p className="mt-1 text-center text-[0.6rem] text-slate-600">What you&apos;ll see in the app</p>

      <motion.div
        animate={
          reduce
            ? undefined
            : {
                boxShadow: [
                  "0 14px 36px -12px rgba(5,150,105,0.42)",
                  "0 18px 44px -10px rgba(5,150,105,0.55)",
                  "0 14px 36px -12px rgba(5,150,105,0.42)",
                ],
              }
        }
        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        className="mt-4 overflow-hidden rounded-2xl border border-emerald-400/20 bg-gradient-to-br from-emerald-600 via-emerald-800 to-slate-900 p-4 shadow-[0_14px_36px_-12px_rgba(5,150,105,0.45)]"
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-emerald-100/85">
            Safe to spend today
          </p>
          <motion.span
            animate={reduce ? undefined : { opacity: [0.75, 1, 0.75] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[0.6rem] font-medium text-emerald-50"
          >
            On track
          </motion.span>
        </div>
        <p className="mt-3 text-3xl font-bold tabular-nums tracking-tight text-white">
          <CountUpMoney value={DEMO_SAFE} />
        </p>
        <p className="mt-2 text-xs text-emerald-100/75">
          After bills &amp; goals · through <span className="font-medium text-emerald-50">Mar 14</span>
        </p>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-black/20">
          <motion.div
            className="h-full rounded-full bg-white/85"
            initial={{ width: reduce ? "78%" : "0%" }}
            animate={{ width: "78%" }}
            transition={{
              duration: reduce ? 0 : 1.15,
              delay: reduce ? 0 : 0.45,
              ease: [0.16, 1, 0.3, 1],
            }}
          />
        </div>
      </motion.div>

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
    kicker: "Cash flow",
    title: "Never get surprised by bills again",
    body: "Less stress, more control—see what’s due before you swipe.",
  },
  {
    icon: Target,
    kicker: "Goals",
    title: "Save without the guilt trip",
    body: "Know what’s actually left for savings after real life—not wishful math.",
  },
  {
    icon: Sparkles,
    kicker: "Insights",
    title: "One clear next move",
    body: "Guidance from your numbers—not generic tips you’ll ignore tomorrow.",
  },
] as const;

const STEPS = [
  {
    step: 1,
    icon: BadgeDollarSign,
    title: "Add your paycheck",
    body: "When you get paid and what hits your account.",
  },
  {
    step: 2,
    icon: ListChecks,
    title: "Add your bills",
    body: "Recurring costs—locked in before you spend.",
  },
  {
    step: 3,
    icon: Gauge,
    title: "Get your daily limit",
    body: "Safe-to-spend until payday, broken into a daily pace.",
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
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
            <BalncedLogo size="lg" href="/" />
            <div className="flex items-center gap-2.5 sm:gap-3">
              <Link
                href="/login"
                className="rounded-xl border border-white/[0.08] bg-transparent px-4 py-2.5 text-sm font-medium text-slate-500 transition hover:border-white/[0.14] hover:bg-white/[0.03] hover:text-slate-300 motion-reduce:transition-none"
              >
                Log in
              </Link>
              <PrimaryCtaLink
                href="/signup"
                reduce={reduce}
                className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(5,150,105,0.45)] ring-1 ring-emerald-400/20 transition hover:bg-emerald-500 motion-reduce:transition-none"
              >
                Get started free
              </PrimaryCtaLink>
            </div>
          </div>
        </motion.header>

        {/* Hero + demo */}
        <section className={`${SECTION} pb-16 pt-12 sm:pb-20 sm:pt-16`}>
          <div className="flex flex-col items-center gap-12 lg:flex-row lg:items-start lg:justify-between lg:gap-16">
            <motion.div
              variants={staggerContainer(reduce, 0.09, 0.08)}
              initial="hidden"
              animate="visible"
              className="max-w-xl flex-1 text-center lg:pt-2 lg:text-left"
            >
              <motion.h1
                variants={fadeUpItem(reduce)}
                className="text-3xl font-bold tracking-tight text-slate-50 sm:text-4xl lg:max-w-[22ch] lg:text-[2.65rem] lg:leading-[1.12]"
              >
                End the payday panic—know what you can safely spend.
              </motion.h1>

              <motion.p
                variants={fadeUpItem(reduce)}
                className="mt-5 max-w-2xl text-base leading-relaxed text-slate-400 sm:mt-6 sm:text-lg lg:mx-0"
              >
                Most apps show <span className="font-medium text-slate-300">past spending</span>. Balnced
                shows <span className="font-medium text-emerald-200/95">future safe-to-spend</span>
                —what&apos;s still yours after bills and paydays. Less stress, fewer overdrafts, real
                clarity.
              </motion.p>

              <motion.div variants={fadeUpItem(reduce)} className="mt-8 sm:mt-9">
                <div className="flex flex-wrap justify-center gap-3 lg:justify-start">
                  <PrimaryCtaLink
                    href="/signup"
                    reduce={reduce}
                    className="inline-flex min-h-[2.75rem] items-center justify-center rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-[0_12px_32px_-10px_rgba(5,150,105,0.4)] ring-1 ring-emerald-400/25 transition hover:bg-emerald-500 motion-reduce:transition-none sm:px-8 sm:text-base"
                  >
                    Get my safe-to-spend number — free
                  </PrimaryCtaLink>
                  <Link
                    href="/login"
                    className="inline-flex min-h-[2.75rem] items-center justify-center rounded-xl border border-white/[0.08] bg-transparent px-6 py-2.5 text-sm font-medium text-slate-500 transition hover:border-white/[0.14] hover:bg-white/[0.04] hover:text-slate-300 motion-reduce:transition-none sm:px-8 sm:text-base"
                  >
                    Log in
                  </Link>
                </div>
                <p className="mt-3.5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-slate-500 lg:justify-start">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-1 w-1 rounded-full bg-emerald-500/80" aria-hidden />
                    No credit card required
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-1 w-1 rounded-full bg-emerald-500/80" aria-hidden />
                    ~30 seconds to start
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-1 w-1 rounded-full bg-emerald-500/80" aria-hidden />
                    Free · cancel anytime
                  </span>
                </p>
                <p className="mt-2 text-center text-[0.8rem] text-slate-500 lg:text-left">
                  No spam. Your numbers stay private—we don&apos;t sell your data.
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

        {/* Interactive demo — try the outcome before signup */}
        <section className={`${SECTION} pb-14 sm:pb-16`}>
          {/* Start visible: opacity-0 + whileInView can fail to fire and leave the block empty */}
          <motion.div
            initial={reduce ? false : { opacity: 1, y: 0 }}
            whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15, margin: "0px" }}
            transition={{ duration: 0.45, ease: EASE_OUT }}
          >
            <LandingSpendDemo />
          </motion.div>
        </section>

        {/* Social proof + trust */}
        <section className={`${SECTION} pb-14 sm:pb-16`}>
          <motion.div
            initial={reduce ? false : { opacity: 1, y: 0 }}
            whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15, margin: "0px" }}
            transition={{ duration: 0.45, ease: EASE_OUT }}
            className="mx-auto max-w-3xl text-center"
          >
            <p className="text-[0.95rem] leading-relaxed text-slate-400 sm:text-base">
              <span className="text-slate-300">
                &ldquo;Finally know what I can spend without stressing.&rdquo;
              </span>
            </p>
            <p className="mt-6 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-slate-600">
              Why people trust Balnced
            </p>
            <div className="mt-3 grid gap-4 rounded-2xl border border-white/[0.08] bg-slate-950/40 px-5 py-6 text-left sm:grid-cols-3 sm:gap-6 sm:px-8 sm:py-7 sm:text-center">
              <div>
                <p className="text-sm font-semibold text-slate-100">Built for real budgets, not spreadsheets</p>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                  For paycheck-to-paycheck life—not another template you&apos;ll abandon.
                </p>
              </div>
              <div className="border-t border-white/[0.06] pt-4 sm:border-l sm:border-t-0 sm:pt-0 sm:pl-6">
                <p className="text-sm font-semibold text-slate-100">Your data stays private</p>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                  We don&apos;t sell your financial data. You control your account.
                </p>
              </div>
              <div className="border-t border-white/[0.06] pt-4 sm:border-l sm:border-t-0 sm:pt-0 sm:pl-6">
                <p className="text-sm font-semibold text-slate-100">Join early planners</p>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                  {/* Replace with real stats when available, e.g. “10k+ safe-to-spend checks” */}
                  People who want clarity—not chaos—before every payday.
                </p>
              </div>
            </div>
          </motion.div>
        </section>

        {/* How it works */}
        <section className={`${SECTION} pb-14 sm:pb-16`}>
          <motion.div
            variants={staggerContainer(reduce, 0.08, 0.05)}
            initial="visible"
            whileInView="visible"
            viewport={{ once: true, amount: 0.12, margin: "0px" }}
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
              Three steps. One calm number.
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
        <section className={`${SECTION} pb-16 sm:pb-20`}>
          <p className="mb-8 text-center text-xs font-semibold uppercase tracking-[0.16em] text-emerald-400/90">
            What you get
          </p>
          <motion.div
            variants={staggerContainer(reduce, 0.09, 0.06)}
            initial="visible"
            whileInView="visible"
            viewport={{ once: true, amount: 0.12, margin: "0px" }}
            className="grid w-full grid-cols-1 gap-5 text-left sm:grid-cols-3 sm:gap-6"
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

        {/* About — product philosophy */}
        <section className={`${SECTION} pb-12 sm:pb-14`}>
          <motion.div
            initial={reduce ? false : { opacity: 1, y: 0 }}
            whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15, margin: "0px" }}
            transition={{ duration: 0.45, ease: EASE_OUT }}
            className="mx-auto max-w-xl text-center"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-400/90">
              About
            </p>
            <h2 className="mt-3 text-xl font-semibold tracking-tight text-slate-100 sm:text-2xl">
              Why Balnced exists
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-slate-500 sm:text-base">
              Most tools look backward. Balnced looks forward—so you always know what&apos;s safe to
              spend before the next paycheck.
            </p>
            <div className="mt-6 flex justify-center">
              <Link
                href="/about"
                className="inline-flex items-center gap-1 text-sm font-medium text-emerald-400/85 transition hover:text-emerald-300"
              >
                Learn more
                <span aria-hidden>→</span>
              </Link>
            </div>
          </motion.div>
        </section>

        {/* Final CTA */}
        <section className={`${SECTION} pb-16 sm:pb-20`}>
          <motion.div
            initial={reduce ? false : { opacity: 1, y: 0 }}
            whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15, margin: "0px" }}
            transition={{ duration: 0.5, ease: EASE_OUT }}
            className="rounded-[2rem] border border-white/[0.08] bg-slate-950/45 px-6 py-11 text-center backdrop-blur-sm sm:px-10 sm:py-12"
          >
            <h2 className="text-2xl font-bold tracking-tight text-slate-50 sm:text-[1.75rem]">
              Get your free safe-to-spend number
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-400 sm:text-base">
              Fast signup · No credit card · Nothing to lose
            </p>
            <div className="mt-8 flex justify-center">
              <PrimaryCtaLink
                href="/signup"
                reduce={reduce}
                className="inline-flex min-h-[2.75rem] items-center justify-center rounded-xl bg-emerald-600 px-8 py-3 text-base font-semibold text-white shadow-[0_12px_32px_-10px_rgba(5,150,105,0.4)] ring-1 ring-emerald-400/25 transition hover:bg-emerald-500 motion-reduce:transition-none"
              >
                Start free — see my number
              </PrimaryCtaLink>
            </div>
            <p className="mx-auto mt-4 max-w-sm text-center text-xs text-slate-600">
              Join in under a minute. Cancel anytime.
            </p>
          </motion.div>
        </section>

        <footer className={`${SECTION} border-t border-white/[0.06] py-10`}>
          <p className="text-center text-[0.7rem] leading-relaxed text-slate-600">
            {TRUST_DISCLAIMER} {TRUST_DATA_NOTE}
          </p>
        </footer>
      </div>
    </main>
  );
}
