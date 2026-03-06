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
    setMessage("Could not connect to Supabase. Check your URL/key in .env.local and restart the server.");
  }
}
  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <h1 className="text-3xl font-bold">Create your account</h1>
      <p className="mt-2 text-gray-600">Start using Balnced.</p>

      <form onSubmit={handleSignup} className="mt-8 space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-xl border border-gray-300 px-4 py-3"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded-xl border border-gray-300 px-4 py-3"
            placeholder="Create a password"
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-xl bg-black px-4 py-3 text-white"
        >
          Sign Up
        </button>
      </form>

      {message && <p className="mt-4 text-sm text-gray-700">{message}</p>}
    </main>
  );
}