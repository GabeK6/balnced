"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function handleSignup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("Creating account...");

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      setMessage("Account created. Check your email to confirm your signup.");
    } catch (err) {
      console.error("Signup error:", err);
      setMessage(
        "Could not connect to Supabase. Check your URL/key in .env.local and restart the server."
      );
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-12 text-slate-100 sm:py-16">
      <div className="balnced-panel mx-auto max-w-md rounded-3xl p-6 sm:p-8">
        <a href="/" className="text-lg font-bold text-slate-50 sm:text-xl">
          Balnced
        </a>
        <h1 className="mt-5 text-2xl font-bold tracking-tight text-slate-50 sm:text-[1.65rem]">
          Create your account
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">Start using Balnced.</p>

        <form onSubmit={handleSignup} className="mt-7 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-400">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="balnced-input"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-400">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="balnced-input"
              placeholder="Create a password"
            />
          </div>

          <button
            type="submit"
            className="min-h-[2.75rem] w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 sm:text-base"
          >
            Sign up
          </button>
        </form>

        {message ? <p className="mt-4 text-sm text-slate-400">{message}</p> : null}

        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <a href="/login" className="font-medium text-emerald-400 hover:text-emerald-300">
            Log in
          </a>
        </p>
        <p className="mt-2 text-center text-sm text-slate-500">
          <a href="/" className="font-medium text-emerald-400 hover:text-emerald-300">
            Back to home
          </a>
        </p>
      </div>
    </main>
  );
}
