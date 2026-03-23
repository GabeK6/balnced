"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import BalncedLogo from "@/components/brand/balnced-logo";
import { AuthFormSurface } from "@/components/auth/auth-form-surface";
import { AuthLoginCenteredShell } from "@/components/auth/auth-login-centered-shell";
import { AUTH_PRIMARY_BUTTON_CLASS } from "@/components/auth/auth-styles";
import { TRUST_DISCLAIMER } from "@/lib/trust-copy";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [passwordResetDone, setPasswordResetDone] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("reset") === "success") setPasswordResetDone(true);
  }, []);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("Logging in...");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Login successful.");
    window.location.href = "/dashboard";
  }

  return (
    <AuthLoginCenteredShell>
      <div className="balnced-page-enter relative z-10 w-full min-w-0">
        <AuthFormSurface className="min-w-0 !border-white/[0.14] !bg-slate-950/92 shadow-[0_24px_64px_-28px_rgba(0,0,0,0.88),0_0_0_1px_rgba(255,255,255,0.05)_inset,0_0_48px_-28px_rgba(16,185,129,0.08)] ring-1 ring-white/[0.1] backdrop-blur-sm">
          <BalncedLogo size="md" href="/" />

          <p className="balnced-eyebrow mt-6 text-emerald-400/80">
            Secure sign-in
          </p>
          <h1 className="mt-3 text-[1.75rem] font-bold tracking-tight text-slate-50 sm:text-[2rem] sm:leading-tight">
            Log in
          </h1>
          <p className="balnced-text-muted mt-2 max-w-lg text-base leading-relaxed">
            Welcome back — pick up where you left off.
          </p>

          <form onSubmit={handleLogin} className="mt-9">
            <div className="space-y-5">
              <div>
                <label
                  htmlFor="login-email"
                  className="mb-2 block text-sm font-medium text-slate-400"
                >
                  Email
                </label>
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="balnced-input"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <div className="mb-2 flex flex-col gap-1.5 sm:flex-row sm:items-baseline sm:justify-between">
                  <label
                    htmlFor="login-password"
                    className="block text-sm font-medium text-slate-400"
                  >
                    Password
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-sm font-medium text-emerald-400/95 transition hover:text-emerald-300 sm:shrink-0"
                  >
                    Forgot password?
                  </Link>
                </div>
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="balnced-input"
                  placeholder="Your password"
                />
              </div>
            </div>

            <button
              type="submit"
              className={`${AUTH_PRIMARY_BUTTON_CLASS} mt-7 shadow-[0_10px_36px_-18px_rgba(16,185,129,0.35)]`}
            >
              Log in
            </button>
          </form>

          {passwordResetDone ? (
            <p
              className="mt-5 rounded-xl border border-emerald-500/25 bg-emerald-950/35 px-3.5 py-2.5 text-sm leading-snug text-emerald-100/95"
              role="status"
            >
              Password updated. You can log in with your new password.
            </p>
          ) : null}

          {message ? (
            <p
              className="mt-5 rounded-xl border border-white/[0.1] bg-slate-900/55 px-3.5 py-2.5 text-sm leading-snug text-slate-300 backdrop-blur-sm"
              role="status"
            >
              {message}
            </p>
          ) : null}

          <footer className="mt-9 w-full min-w-0 border-t border-white/[0.09] pt-8">
            <div className="flex w-full justify-center px-0">
              <div className="w-full max-w-[420px] space-y-2 text-center">
                <nav
                  className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm"
                  aria-label="Account links"
                >
                  <a
                    href="/"
                    className="font-medium text-emerald-400 transition hover:text-emerald-300"
                  >
                    Back to home
                  </a>
                  <span className="select-none text-slate-600" aria-hidden>
                    ·
                  </span>
                  <a
                    href="/signup"
                    className="font-medium text-slate-200 transition hover:text-white"
                  >
                    Sign up
                  </a>
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
