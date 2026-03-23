"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import BalncedLogo from "@/components/brand/balnced-logo";
import { AuthBrandedPanel } from "@/components/auth/auth-branded-panel";
import { AuthFormSurface } from "@/components/auth/auth-form-surface";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { AUTH_PRIMARY_BUTTON_CLASS } from "@/components/auth/auth-styles";
import { AUTH_FEATURE_BULLETS, AUTH_SIGNUP_COPY } from "@/lib/auth-marketing";
import { TRUST_DISCLAIMER } from "@/lib/trust-copy";

export default function SignupPage() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");

  async function handleSignup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setMessage("Password must be at least 6 characters.");
      return;
    }

    setMessage("Creating account...");

    try {
      const trimmedName = displayName.trim();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options:
          trimmedName.length > 0
            ? { data: { full_name: trimmedName } }
            : undefined,
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      if (data.session) {
        window.location.href = "/onboarding";
        return;
      }

      setMessage("Account created. Check your email to confirm, then log in to finish setup.");
    } catch (err) {
      console.error("Signup error:", err);
      setMessage(
        "Could not connect to Supabase. Check your URL/key in .env.local and restart the server."
      );
    }
  }

  const formPanel = (
    <div className="balnced-page-enter mx-auto w-full max-w-md">
      <AuthFormSurface>
        <BalncedLogo size="md" href="/" />
        <h1 className="mt-6 text-2xl font-bold tracking-tight text-slate-50 sm:text-[1.75rem]">
          Create your account
        </h1>
        <p className="balnced-text-muted mt-2 text-[0.95rem] leading-relaxed">
          Join Balnced and see your money in one place.
        </p>

        <form onSubmit={handleSignup} className="mt-8 space-y-5">
          <div>
            <label
              htmlFor="signup-name"
              className="mb-1.5 block text-sm font-medium text-slate-400"
            >
              Name <span className="font-normal text-slate-500">(optional)</span>
            </label>
            <input
              id="signup-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="name"
              className="balnced-input"
              placeholder="Alex"
            />
          </div>

          <div>
            <label
              htmlFor="signup-email"
              className="mb-1.5 block text-sm font-medium text-slate-400"
            >
              Email
            </label>
            <input
              id="signup-email"
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
              htmlFor="signup-password"
              className="mb-1.5 block text-sm font-medium text-slate-400"
            >
              Password
            </label>
            <input
              id="signup-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="balnced-input"
              placeholder="Create a password"
              minLength={6}
            />
          </div>

          <div>
            <label
              htmlFor="signup-confirm"
              className="mb-1.5 block text-sm font-medium text-slate-400"
            >
              Confirm password
            </label>
            <input
              id="signup-confirm"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="balnced-input"
              placeholder="Re-enter password"
              minLength={6}
            />
          </div>

          <button type="submit" className={AUTH_PRIMARY_BUTTON_CLASS}>
            Sign up
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

        <div className="mt-8 border-t border-white/[0.08] pt-8 text-sm">
          {/* Dot is in the center column so it stays on the card’s horizontal center */}
          <div className="flex flex-col items-center gap-2 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-x-0">
            <div className="flex w-full justify-center sm:justify-end sm:pr-3">
              <a
                href="/"
                className="font-medium text-emerald-400 transition hover:text-emerald-300"
              >
                Back to home
              </a>
            </div>
            <span
              className="select-none px-2 text-slate-500 sm:px-0"
              aria-hidden
            >
              ·
            </span>
            <div className="flex w-full justify-center sm:justify-start sm:pl-3">
              <a
                href="/login"
                className="font-medium text-slate-300 transition hover:text-white"
              >
                Log in
              </a>
            </div>
          </div>
        </div>
        <p className="mt-6 text-center text-[0.65rem] leading-relaxed text-slate-600">
          {TRUST_DISCLAIMER}
        </p>
      </AuthFormSurface>
    </div>
  );

  const brandedPanel = (
    <AuthBrandedPanel
      headline={AUTH_SIGNUP_COPY.headline}
      supporting={AUTH_SIGNUP_COPY.supporting}
      features={AUTH_FEATURE_BULLETS}
      mobileHeadline={AUTH_SIGNUP_COPY.mobileHeadline}
      mobileSupporting={AUTH_SIGNUP_COPY.mobileSupporting}
    />
  );

  return <AuthPageShell formPanel={formPanel} brandedPanel={brandedPanel} />;
}
