"use client";

import Link from "next/link";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { getAuthRedirectBaseUrl } from "@/lib/auth-redirect-base-url";
import BalncedLogo from "@/components/brand/balnced-logo";
import { AuthFormSurface } from "@/components/auth/auth-form-surface";
import { AuthLoginCenteredShell } from "@/components/auth/auth-login-centered-shell";
import { AUTH_PRIMARY_BUTTON_CLASS } from "@/components/auth/auth-styles";
import { TRUST_DISCLAIMER } from "@/lib/trust-copy";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    setErrorMessage("");

    const base = getAuthRedirectBaseUrl();
    if (!base) {
      setStatus("error");
      setErrorMessage(
        "App URL is not configured. Set NEXT_PUBLIC_APP_URL or open this page in the browser."
      );
      return;
    }

    const redirectTo = `${base}/update-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo }
    );

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }

    setStatus("success");
  }

  return (
    <AuthLoginCenteredShell>
      <div className="balnced-page-enter relative z-10 w-full min-w-0">
        <AuthFormSurface className="min-w-0 !border-white/[0.14] !bg-slate-950/92 shadow-[0_24px_64px_-28px_rgba(0,0,0,0.88),0_0_0_1px_rgba(255,255,255,0.05)_inset,0_0_48px_-28px_rgba(16,185,129,0.08)] ring-1 ring-white/[0.1] backdrop-blur-sm">
          <BalncedLogo size="md" href="/" />

          <p className="balnced-eyebrow mt-6 text-emerald-400/80">
            Account recovery
          </p>
          <h1 className="mt-3 text-[1.75rem] font-bold tracking-tight text-slate-50 sm:text-[2rem] sm:leading-tight">
            Reset your password
          </h1>
          <p className="balnced-text-muted mt-2 max-w-lg text-base leading-relaxed">
            Forgot your password? Reset it in seconds. Enter your email and we
            will send you a secure link to choose a new password.
          </p>

          {status === "success" ? (
            <div
              className="mt-9 rounded-xl border border-emerald-500/25 bg-emerald-950/35 px-4 py-3.5 text-sm leading-relaxed text-emerald-100/95"
              role="status"
            >
              If an account exists for that email, we sent a reset link. Check
              your inbox and spam folder.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-9">
              <div>
                <label
                  htmlFor="forgot-email"
                  className="mb-2 block text-sm font-medium text-slate-400"
                >
                  Email
                </label>
                <input
                  id="forgot-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  disabled={status === "loading"}
                  className="balnced-input disabled:opacity-60"
                  placeholder="you@example.com"
                />
              </div>

              <button
                type="submit"
                disabled={status === "loading"}
                className={`${AUTH_PRIMARY_BUTTON_CLASS} mt-7 shadow-[0_10px_36px_-18px_rgba(16,185,129,0.35)] disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {status === "loading" ? "Sending link…" : "Send reset link"}
              </button>
            </form>
          )}

          {status === "error" && errorMessage ? (
            <p
              className="mt-5 rounded-xl border border-red-500/25 bg-red-950/40 px-3.5 py-2.5 text-sm leading-snug text-red-100/95"
              role="alert"
            >
              {errorMessage}
            </p>
          ) : null}

          <footer className="mt-9 w-full min-w-0 border-t border-white/[0.09] pt-8">
            <div className="flex w-full justify-center px-0">
              <div className="w-full max-w-[420px] space-y-2 text-center">
                <nav
                  className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm"
                  aria-label="Account links"
                >
                  <Link
                    href="/login"
                    className="font-medium text-emerald-400 transition hover:text-emerald-300"
                  >
                    Back to log in
                  </Link>
                  <span className="select-none text-slate-600" aria-hidden>
                    ·
                  </span>
                  <Link
                    href="/"
                    className="font-medium text-slate-200 transition hover:text-white"
                  >
                    Home
                  </Link>
                </nav>

                <p className="text-xs leading-relaxed text-slate-500">
                  Encrypted connection · Protected account access
                </p>

                <p className="text-[11px] leading-relaxed text-slate-600">
                  {TRUST_DISCLAIMER}
                </p>
              </div>
            </div>
          </footer>
        </AuthFormSurface>
      </div>
    </AuthLoginCenteredShell>
  );
}
