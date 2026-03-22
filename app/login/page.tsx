"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import BalncedLogo from "@/components/brand/balnced-logo";
import { AuthBrandedPanel } from "@/components/auth/auth-branded-panel";
import { AuthFormSurface } from "@/components/auth/auth-form-surface";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { AUTH_PRIMARY_BUTTON_CLASS } from "@/components/auth/auth-styles";
import { AUTH_FEATURE_BULLETS, AUTH_LOGIN_COPY } from "@/lib/auth-marketing";
import { TRUST_DISCLAIMER } from "@/lib/trust-copy";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

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

  const formPanel = (
    <div className="balnced-page-enter mx-auto w-full max-w-md">
      <AuthFormSurface>
        <BalncedLogo size="md" href="/" />
        <h1 className="mt-6 text-2xl font-bold tracking-tight text-slate-50 sm:text-[1.75rem]">
          Log in
        </h1>
        <p className="balnced-text-muted mt-2 text-[0.95rem] leading-relaxed">
          Welcome back — pick up where you left off.
        </p>

        <form onSubmit={handleLogin} className="mt-8 space-y-5">
          <div>
            <label
              htmlFor="login-email"
              className="mb-1.5 block text-sm font-medium text-slate-400"
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
            <label
              htmlFor="login-password"
              className="mb-1.5 block text-sm font-medium text-slate-400"
            >
              Password
            </label>
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

          <button type="submit" className={AUTH_PRIMARY_BUTTON_CLASS}>
            Log in
          </button>
        </form>

        {message ? (
          <p
            className="mt-5 rounded-xl border border-white/[0.08] bg-slate-900/50 px-3 py-2.5 text-sm text-slate-300"
            role="status"
          >
            {message}
          </p>
        ) : null}

        <div className="mt-8 flex flex-col gap-3 border-t border-white/[0.08] pt-8 text-center text-sm sm:flex-row sm:items-center sm:justify-center sm:gap-6 sm:text-left">
          <a
            href="/"
            className="font-medium text-emerald-400 transition hover:text-emerald-300"
          >
            Back to home
          </a>
          <span className="hidden text-slate-600 sm:inline" aria-hidden>
            ·
          </span>
          <a
            href="/signup"
            className="font-medium text-slate-300 transition hover:text-white"
          >
            Sign up
          </a>
        </div>
        <p className="mt-6 text-center text-[0.65rem] leading-relaxed text-slate-600">
          {TRUST_DISCLAIMER}
        </p>
      </AuthFormSurface>
    </div>
  );

  const brandedPanel = (
    <AuthBrandedPanel
      headline={AUTH_LOGIN_COPY.headline}
      supporting={AUTH_LOGIN_COPY.supporting}
      features={AUTH_FEATURE_BULLETS}
      mobileHeadline={AUTH_LOGIN_COPY.mobileHeadline}
      mobileSupporting={AUTH_LOGIN_COPY.mobileSupporting}
    />
  );

  return <AuthPageShell formPanel={formPanel} brandedPanel={brandedPanel} />;
}
