"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import BalncedLogo from "@/components/brand/balnced-logo";
import { AuthFormSurface } from "@/components/auth/auth-form-surface";
import { AuthLoginCenteredShell } from "@/components/auth/auth-login-centered-shell";
import { AUTH_PRIMARY_BUTTON_CLASS } from "@/components/auth/auth-styles";
import { TRUST_DISCLAIMER } from "@/lib/trust-copy";

const MIN_PASSWORD = 6;

type RecoveryState = "checking" | "ready" | "invalid";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [recoveryState, setRecoveryState] = useState<RecoveryState>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const resolvedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const markReadyIfSession = (session: Session | null) => {
      if (cancelled) return;
      if (session) {
        resolvedRef.current = true;
        setRecoveryState("ready");
      }
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      markReadyIfSession(session);
    });

    void supabase.auth.getSession().then(({ data: { session } }) => {
      markReadyIfSession(session);
    });

    const t = window.setTimeout(() => {
      if (cancelled || resolvedRef.current) return;
      void supabase.auth.getSession().then(({ data: { session } }) => {
        if (cancelled || resolvedRef.current) return;
        markReadyIfSession(session);
        if (!resolvedRef.current) setRecoveryState("invalid");
      });
    }, 2500);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
      sub.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFieldError("");
    setSubmitError("");

    if (!password.trim()) {
      setFieldError("Enter a new password.");
      return;
    }
    if (password.length < MIN_PASSWORD) {
      setFieldError(`Password must be at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setFieldError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setSubmitting(false);
      setSubmitError(error.message);
      return;
    }

    await supabase.auth.signOut();
    router.replace("/login?reset=success");
  }

  return (
    <AuthLoginCenteredShell>
      <div className="balnced-page-enter relative z-10 w-full min-w-0">
        <AuthFormSurface className="min-w-0 !border-white/[0.14] !bg-slate-950/92 shadow-[0_24px_64px_-28px_rgba(0,0,0,0.88),0_0_0_1px_rgba(255,255,255,0.05)_inset,0_0_48px_-28px_rgba(16,185,129,0.08)] ring-1 ring-white/[0.1] backdrop-blur-sm">
          <BalncedLogo size="md" href="/" />

          {recoveryState === "checking" ? (
            <>
              <p className="balnced-eyebrow mt-6 text-emerald-400/80">
                Secure update
              </p>
              <h1 className="mt-3 text-[1.75rem] font-bold tracking-tight text-slate-50 sm:text-[2rem] sm:leading-tight">
                Verifying your link…
              </h1>
              <p className="balnced-text-muted mt-2 max-w-lg text-base leading-relaxed">
                One moment while we confirm your reset link.
              </p>
              <div className="mt-9 flex justify-center">
                <div
                  className="h-9 w-9 animate-spin rounded-full border-2 border-emerald-500/30 border-t-emerald-400"
                  aria-hidden
                />
              </div>
            </>
          ) : recoveryState === "invalid" ? (
            <>
              <p className="balnced-eyebrow mt-6 text-amber-400/90">
                Link issue
              </p>
              <h1 className="mt-3 text-[1.75rem] font-bold tracking-tight text-slate-50 sm:text-[2rem] sm:leading-tight">
                This link is invalid or expired
              </h1>
              <p className="balnced-text-muted mt-2 max-w-lg text-base leading-relaxed">
                Request a new reset email and try again. Links expire for your
                security.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/forgot-password"
                  className={`${AUTH_PRIMARY_BUTTON_CLASS} inline-flex items-center justify-center text-center shadow-[0_10px_36px_-18px_rgba(16,185,129,0.35)]`}
                >
                  Request a new link
                </Link>
                <Link
                  href="/login"
                  className="inline-flex min-h-[3rem] items-center justify-center rounded-xl border border-white/[0.12] px-4 py-3 text-base font-semibold text-slate-200 transition hover:border-white/[0.2] hover:bg-white/[0.04]"
                >
                  Back to log in
                </Link>
              </div>
            </>
          ) : (
            <>
              <p className="balnced-eyebrow mt-6 text-emerald-400/80">
                Secure update
              </p>
              <h1 className="mt-3 text-[1.75rem] font-bold tracking-tight text-slate-50 sm:text-[2rem] sm:leading-tight">
                Choose a new password
              </h1>
              <p className="balnced-text-muted mt-2 max-w-lg text-base leading-relaxed">
                Pick a strong password you have not used elsewhere. Protected
                account access.
              </p>

              <form onSubmit={handleSubmit} className="mt-9">
                <div className="space-y-5">
                  <div>
                    <label
                      htmlFor="new-password"
                      className="mb-2 block text-sm font-medium text-slate-400"
                    >
                      New password
                    </label>
                    <input
                      id="new-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={MIN_PASSWORD}
                      autoComplete="new-password"
                      disabled={submitting}
                      className="balnced-input disabled:opacity-60"
                      placeholder="At least 6 characters"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="confirm-password"
                      className="mb-2 block text-sm font-medium text-slate-400"
                    >
                      Confirm password
                    </label>
                    <input
                      id="confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={MIN_PASSWORD}
                      autoComplete="new-password"
                      disabled={submitting}
                      className="balnced-input disabled:opacity-60"
                      placeholder="Re-enter your password"
                    />
                  </div>
                </div>

                {fieldError ? (
                  <p
                    className="mt-4 text-sm text-amber-200/95"
                    role="alert"
                  >
                    {fieldError}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={submitting}
                  className={`${AUTH_PRIMARY_BUTTON_CLASS} mt-7 shadow-[0_10px_36px_-18px_rgba(16,185,129,0.35)] disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  {submitting ? "Updating…" : "Update password"}
                </button>
              </form>

              {submitError ? (
                <p
                  className="mt-5 rounded-xl border border-red-500/25 bg-red-950/40 px-3.5 py-2.5 text-sm leading-snug text-red-100/95"
                  role="alert"
                >
                  {submitError}
                </p>
              ) : null}
            </>
          )}

          <footer className="mt-9 w-full min-w-0 border-t border-white/[0.09] pt-8">
            <div className="flex w-full justify-center px-0">
              <div className="w-full max-w-[420px] space-y-2 text-center">
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
