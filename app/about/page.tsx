import Link from "next/link";
import { Sparkles, Wallet, Users } from "lucide-react";
import BalncedLogo from "@/components/brand/balnced-logo";
import { TRUST_DISCLAIMER } from "@/lib/trust-copy";

const SUPPORT_CARDS = [
  {
    icon: Wallet,
    title: "What Balnced helps with",
    body: "A clear safe-to-spend number, daily limits, and bills in context—so you know what’s left before you swipe.",
  },
  {
    icon: Users,
    title: "Who it’s for",
    body: "Anyone paid on a schedule who wants less guesswork between paychecks—without living in a spreadsheet.",
  },
  {
    icon: Sparkles,
    title: "What makes it different",
    body: "We start from cash flow and timing, not guilt about past purchases. The goal is forward-looking clarity.",
  },
] as const;

const PRINCIPLES = [
  {
    title: "Clarity over complexity",
    body: "Fewer dashboards, fewer buzzwords—just the numbers that matter for this week.",
  },
  {
    title: "Real-life cash flow first",
    body: "Paydays, bills, and goals in one view so the math matches how your money actually moves.",
  },
  {
    title: "Guidance you can actually use",
    body: "Next steps that fit your real balance, not generic advice you’ll ignore tomorrow.",
  },
] as const;

export default function AboutPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(16,185,129,0.07),transparent_55%)]"
      />

      <div className="relative mx-auto max-w-5xl px-5 py-12 sm:px-6 sm:py-16">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <BalncedLogo size="md" href="/" />
          <Link
            href="/"
            className="text-sm font-medium text-slate-500 transition hover:text-emerald-300"
          >
            ← Back to home
          </Link>
        </header>

        {/* Hero */}
        <section className="mt-14 sm:mt-16">
          <p className="balnced-eyebrow">About</p>
          <h1 className="mt-3 max-w-3xl text-3xl font-bold tracking-tight text-slate-50 sm:text-[2.15rem] sm:leading-tight">
            Why Balnced exists
          </h1>
          <p className="balnced-text-muted mt-6 max-w-3xl text-base leading-relaxed sm:text-lg">
            Most budgeting tools tell you what you already spent. Balnced tells you what you can safely
            spend — before payday. We built it for people who want calm clarity between paychecks, not
            another spreadsheet.
          </p>
        </section>

        {/* Supporting cards */}
        <section className="mt-16 sm:mt-20" aria-labelledby="about-support-heading">
          <h2 id="about-support-heading" className="sr-only">
            What Balnced offers
          </h2>
          <div className="grid gap-5 md:grid-cols-3 md:gap-6">
            {SUPPORT_CARDS.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="balnced-panel rounded-3xl p-6 sm:p-7"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/12 text-emerald-400">
                  <Icon className="h-5 w-5" strokeWidth={1.85} aria-hidden />
                </div>
                <h3 className="mt-4 text-lg font-semibold tracking-tight text-slate-100">{title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-500">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Principles */}
        <section className="mt-16 border-t border-white/[0.08] pt-16 sm:mt-20 sm:pt-20">
          <h2 className="text-center text-xs font-semibold uppercase tracking-[0.16em] text-emerald-400/90">
            Built around three ideas
          </h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-3 sm:gap-10">
            {PRINCIPLES.map(({ title, body }) => (
              <div key={title} className="text-center sm:text-left">
                <h3 className="text-base font-semibold text-slate-100">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="mt-16 sm:mt-20">
          <div className="rounded-[2rem] border border-white/[0.08] bg-slate-950/50 px-6 py-11 text-center backdrop-blur-sm sm:px-10 sm:py-12">
            <h2 className="text-2xl font-bold tracking-tight text-slate-50 sm:text-[1.75rem]">
              Start building clarity
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-400 sm:text-base">
              See what’s safe to spend before payday in minutes.
            </p>
            <div className="mt-8 flex justify-center">
              <Link
                href="/signup"
                className="inline-flex min-h-[2.75rem] items-center justify-center rounded-xl bg-emerald-600 px-8 py-3 text-base font-semibold text-white shadow-[0_12px_32px_-10px_rgba(5,150,105,0.4)] ring-1 ring-emerald-400/25 transition hover:bg-emerald-500"
              >
                Get started
              </Link>
            </div>
          </div>
        </section>

        <footer className="mt-14 border-t border-white/[0.06] pt-10 text-center sm:mt-16">
          <p className="text-[0.7rem] leading-relaxed text-slate-600">{TRUST_DISCLAIMER}</p>
        </footer>
      </div>
    </main>
  );
}
