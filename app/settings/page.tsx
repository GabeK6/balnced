"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import DashboardShell from "@/components/dashboard/shell";
import { supabase } from "@/lib/supabase";

function displayNameFromUser(user: User | null): string {
  const m = user?.user_metadata;
  if (!m || typeof m !== "object") return "";
  const meta = m as Record<string, unknown>;
  return String(meta.full_name ?? meta.name ?? meta.display_name ?? "").trim();
}

function phoneFromUser(user: User | null): string {
  if (!user) return "";
  const m = user.user_metadata;
  if (m && typeof m === "object" && "phone" in m && m.phone != null) {
    return String(m.phone).trim();
  }
  return (user.phone ?? "").trim();
}

export default function UserSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState("");
  const [emailInitial, setEmailInitial] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = "/login";
        return;
      }
      setEmail(user.email ?? "");
      setEmailInitial(user.email ?? "");
      setFullName(displayNameFromUser(user));
      setPhone(phoneFromUser(user));
      setLoading(false);
    }
    load();
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    setSaving(true);

    const nextEmail = email.trim();
    const emailChanged = nextEmail !== emailInitial.trim();

    try {
      const updates: {
        email?: string;
        data: { full_name: string; phone: string };
      } = {
        data: {
          full_name: fullName.trim(),
          phone: phone.trim(),
        },
      };
      if (emailChanged) {
        if (!nextEmail) {
          setMessage({ type: "err", text: "Email cannot be empty." });
          setSaving(false);
          return;
        }
        updates.email = nextEmail;
      }

      const { error } = await supabase.auth.updateUser(updates);

      if (error) {
        setMessage({ type: "err", text: error.message });
        setSaving(false);
        return;
      }

      setEmailInitial(nextEmail);
      setMessage({
        type: "ok",
        text: emailChanged
          ? "Saved. If you changed your email, check your inbox to confirm the new address (if your project requires it)."
          : "Your profile has been updated.",
      });
    } catch (err) {
      setMessage({
        type: "err",
        text: err instanceof Error ? err.message : "Something went wrong.",
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <DashboardShell
        title="User settings"
        subtitle="Loading your account…"
        backHref="/dashboard"
        backLabel="Back to Overview"
        compact
      >
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      title="User settings"
      subtitle="Update the name, email, and phone stored on your Balnced account."
      backHref="/dashboard"
      backLabel="Back to Overview"
      compact
    >
      <div className="balnced-panel mx-auto max-w-lg rounded-2xl p-6 sm:p-8">
        <p className="mb-6 text-sm text-slate-500">
          Manage your name and contact info. For plan and billing, go to{" "}
          <Link href="/settings/subscription" className="font-medium text-emerald-400 hover:text-emerald-300">
            Subscription
          </Link>
          .
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="settings-full-name" className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">
              Display name
            </label>
            <input
              id="settings-full-name"
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="balnced-input w-full"
              placeholder="Your name"
            />
          </div>

          <div>
            <label htmlFor="settings-email" className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">
              Email
            </label>
            <input
              id="settings-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="balnced-input w-full"
              placeholder="you@example.com"
            />
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-500">
              Changing your email may require a confirmation link, depending on your Supabase project settings.
            </p>
          </div>

          <div>
            <label htmlFor="settings-phone" className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">
              Phone number
            </label>
            <input
              id="settings-phone"
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="balnced-input w-full"
              placeholder="Optional"
            />
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-500">
              Stored in your account profile for your reference. Not used for SMS login unless you enable phone sign-in in Supabase.
            </p>
          </div>

          {message ? (
            <p
              className={`rounded-xl px-3 py-2 text-sm ${
                message.type === "ok"
                  ? "bg-emerald-500/10 text-emerald-200"
                  : "bg-rose-500/10 text-rose-200"
              }`}
              role={message.type === "err" ? "alert" : "status"}
            >
              {message.text}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </form>
      </div>
    </DashboardShell>
  );
}
