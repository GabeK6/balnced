"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { EASE_OUT } from "@/components/motion/overview-variants";
import type { CopilotOverviewContext } from "@/lib/copilot-types";
import type { AffordabilityVerdict } from "@/lib/affordability-check";
import { parseWhatIfQuery } from "@/lib/what-if-parse";
import { trimMessagesForApi } from "@/lib/copilot-conversation";
import UpgradeModal from "@/components/dashboard/upgrade-modal";
import ProFeatureTeaser from "@/components/dashboard/pro-feature-teaser";
import { useUserPlan } from "@/hooks/use-user-plan";
import {
  UPGRADE_CONTEXT_HEADLINE,
  isProRequiredApiError,
  proRequiredFriendlyMessage,
} from "@/lib/upgrade-prompt";
import { TRUST_AI_LIMITATION, TRUST_DISCLAIMER } from "@/lib/trust-copy";

type ChatRow = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

function newId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const INITIAL_ASSISTANT =
  "Ask me anything about your finances — or try “What if I spend $300?” or “What if I save $200 more per month?”";

/** Short prompts — click sends immediately */
const SUGGESTED_PROMPTS = [
  "Can I afford a $100 purchase?",
  "How can I save more?",
  "Am I on track for retirement?",
  "What if I spend $300?",
  "Am I overspending?",
] as const;

type Props = {
  context: CopilotOverviewContext;
  /** AI Copilot requires Balnced Pro (server + UI enforced). */
  isPro?: boolean;
};

function parsePurchaseAmount(raw: string): number | null {
  const s = raw.replace(/[$,\s]/g, "").trim();
  if (!s) return null;
  const n = Number.parseFloat(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function verdictLabel(v: AffordabilityVerdict): string {
  switch (v) {
    case "yes":
      return "Yes";
    case "no":
      return "No";
    default:
      return "Risky";
  }
}

function verdictStyles(v: AffordabilityVerdict): string {
  switch (v) {
    case "yes":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
    case "no":
      return "border-rose-500/30 bg-rose-500/10 text-rose-100";
    default:
      return "border-amber-500/25 bg-amber-500/10 text-amber-100";
  }
}

function TypingIndicator({ reduce }: { reduce: boolean | null }) {
  return (
    <motion.div
      className="flex justify-start"
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: EASE_OUT }}
      aria-live="polite"
      aria-busy="true"
    >
      <div className="max-w-[92%] rounded-2xl border border-white/[0.08] bg-gradient-to-br from-slate-800/95 to-slate-900/90 px-4 py-3 shadow-[0_0_24px_-10px_rgba(16,185,129,0.2)] ring-1 ring-emerald-500/10">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">Copilot</p>
        <div className="mt-1.5 flex items-center gap-2">
          <span className="text-sm text-slate-300">AI is thinking</span>
          <span className="inline-flex gap-1" aria-hidden>
            <span
              className="copilot-dot h-1.5 w-1.5 rounded-full bg-emerald-400/85"
              style={{ animationDelay: "0ms" }}
            />
            <span
              className="copilot-dot h-1.5 w-1.5 rounded-full bg-emerald-400/85"
              style={{ animationDelay: "160ms" }}
            />
            <span
              className="copilot-dot h-1.5 w-1.5 rounded-full bg-emerald-400/85"
              style={{ animationDelay: "320ms" }}
            />
          </span>
        </div>
      </div>
    </motion.div>
  );
}

function ChatMessageBubble({
  m,
  reduce,
}: {
  m: ChatRow;
  reduce: boolean | null;
}) {
  const isUser = m.role === "user";
  return (
    <motion.div
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, ease: EASE_OUT }}
    >
      <div className={`flex max-w-[92%] flex-col ${isUser ? "items-end" : "items-start"} gap-0.5`}>
        <span
          className={`px-1 text-[0.65rem] font-medium uppercase tracking-[0.12em] ${
            isUser ? "text-emerald-500/70" : "text-slate-500"
          }`}
        >
          {isUser ? "You" : "Copilot"}
        </span>
        <div
          className={
            isUser
              ? "rounded-2xl rounded-br-md border border-emerald-400/25 bg-gradient-to-br from-emerald-600/40 via-emerald-700/25 to-emerald-900/30 px-3.5 py-2.5 text-sm leading-relaxed text-emerald-50 shadow-[0_0_28px_-10px_rgba(16,185,129,0.45)]"
              : "rounded-2xl rounded-bl-md border border-white/[0.09] bg-gradient-to-br from-slate-800/95 to-slate-950/90 px-3.5 py-2.5 text-sm leading-relaxed text-slate-100 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.5)] ring-1 ring-white/[0.04]"
          }
        >
          {m.content}
        </div>
      </div>
    </motion.div>
  );
}

export default function CopilotChat({ context, isPro = false }: Props) {
  const { planAccess, refresh, loading: planLoading } = useUserPlan();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [input, setInput] = useState("");
  const [affordInput, setAffordInput] = useState("");
  const [affordLoading, setAffordLoading] = useState(false);
  const [affordError, setAffordError] = useState<string | null>(null);
  const [affordResult, setAffordResult] = useState<{
    verdict: AffordabilityVerdict;
    explanation: string;
  } | null>(null);
  const [messages, setMessages] = useState<ChatRow[]>(() => [
    { id: newId(), role: "assistant", content: INITIAL_ASSISTANT },
  ]);
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const scrollToBottom = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, open, scrollToBottom]);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  const sendMessage = useCallback(
    async (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed || sending) return;

      const userMsg: ChatRow = { id: newId(), role: "user", content: trimmed };
      const nextMessages = [...messagesRef.current, userMsg];
      setMessages(nextMessages);
      setInput("");
      setSending(true);

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) {
          setMessages((prev) => [
            ...prev,
            {
              id: newId(),
              role: "assistant",
              content: "You need to be signed in to use the copilot.",
            },
          ]);
          return;
        }

        const whatIf = parseWhatIfQuery(trimmed);
        if (whatIf) {
          const conversationTail = trimMessagesForApi(
            messagesRef.current.map(({ role, content }) => ({ role, content }))
          );
          const res = await fetch("/api/copilot/simulate", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              scenario: whatIf,
              context,
              conversationTail,
            }),
          });

          const data = (await res.json()) as {
            explanation?: string;
            error?: string;
            message?: string;
          };

          if (!res.ok) {
            setMessages((prev) => [
              ...prev,
              {
                id: newId(),
                role: "assistant",
                content:
                  typeof data.message === "string"
                    ? data.message
                    : "Couldn’t run that simulation — try again.",
              },
            ]);
            return;
          }

          const explanation =
            typeof data.explanation === "string" && data.explanation.trim()
              ? data.explanation.trim()
              : "Simulation finished with no summary.";

          setMessages((prev) => [
            ...prev,
            { id: newId(), role: "assistant", content: explanation },
          ]);
          return;
        }

        const payload = {
          messages: trimMessagesForApi(
            nextMessages.map(({ role, content }) => ({ role, content }))
          ),
          context,
        };

        const res = await fetch("/api/copilot", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        const data = (await res.json()) as { reply?: string; error?: string };

        if (!res.ok) {
          setMessages((prev) => [
            ...prev,
            {
              id: newId(),
              role: "assistant",
              content:
                data.error === "invalid_session" || data.error === "missing_auth"
                  ? "Session expired — refresh the page and sign in again."
                  : "Couldn’t reach the assistant. Try again in a moment.",
            },
          ]);
          return;
        }

        const reply = typeof data.reply === "string" ? data.reply : "";
        setMessages((prev) => [
          ...prev,
          {
            id: newId(),
            role: "assistant",
            content: reply || "No reply returned — try again.",
          },
        ]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: newId(),
            role: "assistant",
            content: "Network error — check your connection and try again.",
          },
        ]);
      } finally {
        setSending(false);
      }
    },
    [context, sending]
  );

  const send = useCallback(() => {
    void sendMessage(input);
  }, [input, sendMessage]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  const runAffordCheck = useCallback(async () => {
    const amt = parsePurchaseAmount(affordInput);
    if (amt == null) {
      setAffordError("Enter a valid amount.");
      setAffordResult(null);
      return;
    }
    setAffordError(null);
    setAffordLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setAffordResult({
          verdict: "no",
          explanation: "Sign in to run an affordability check.",
        });
        return;
      }

      const res = await fetch("/api/copilot/afford", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount: amt, context }),
      });

      const data = (await res.json()) as {
        verdict?: AffordabilityVerdict;
        explanation?: string;
        error?: string;
      };

      if (!res.ok) {
        setAffordResult({
          verdict: "no",
          explanation:
            data.error === "invalid_session" || data.error === "missing_auth"
              ? "Session expired — refresh and try again."
              : "Couldn’t check right now.",
        });
        return;
      }

      const verdict = data.verdict === "yes" || data.verdict === "no" || data.verdict === "risky" ? data.verdict : "no";
      const explanation =
        typeof data.explanation === "string" && data.explanation.trim()
          ? data.explanation.trim()
          : "No explanation returned.";

      setAffordResult({ verdict, explanation });
    } catch {
      setAffordResult({
        verdict: "no",
        explanation: "Network error — try again.",
      });
    } finally {
      setAffordLoading(false);
    }
  }, [affordInput, context]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`fixed bottom-5 right-5 z-[60] flex h-14 w-14 items-center justify-center rounded-full border bg-slate-950/90 backdrop-blur-md transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 sm:bottom-7 sm:right-7 ${
          isPro
            ? "border-emerald-500/25 text-emerald-400 shadow-[0_12px_40px_-12px_rgba(16,185,129,0.45)] hover:border-emerald-400/40 hover:bg-slate-900/95 hover:text-emerald-300"
            : "border-white/15 text-slate-400 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.5)] hover:border-white/25 hover:bg-slate-900/95 hover:text-slate-300"
        }`}
        aria-expanded={open}
        aria-controls="balnced-copilot-panel"
        title={
          open
            ? "Close"
            : isPro
              ? "Open copilot"
              : `Copilot — ${UPGRADE_CONTEXT_HEADLINE.replace(/\.$/, "")}`
        }
      >
        {open ? (
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
            />
          </svg>
        )}
      </button>

      <UpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        planAccess={planAccess}
        loadingPlan={planLoading}
        onRefresh={refresh}
      />

      {open && !isPro ? (
        <div
          id="balnced-copilot-panel"
          className="fixed bottom-[5.25rem] right-5 z-[60] flex w-[min(100vw-2rem,22rem)] flex-col overflow-hidden rounded-2xl border border-white/[0.1] bg-gradient-to-b from-slate-900/[0.98] to-slate-950 shadow-[0_24px_64px_-20px_rgba(0,0,0,0.85)] backdrop-blur-xl sm:bottom-[5.5rem] sm:right-7 sm:w-[24rem]"
          role="dialog"
          aria-label="Copilot upgrade"
        >
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
            <div>
              <p className="text-sm font-semibold tracking-tight text-slate-100">Copilot</p>
              <p className="text-[0.65rem] font-medium uppercase tracking-[0.12em] text-slate-500">
                Pro feature
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1.5 text-slate-500 transition hover:bg-white/[0.06] hover:text-slate-300"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="p-3 sm:p-4">
            <ProFeatureTeaser
              title="Copilot"
              surface="copilot"
              withModal={false}
              onOpenPro={() => setUpgradeOpen(true)}
              className="border-0 bg-transparent shadow-none"
            />
          </div>
        </div>
      ) : null}

      {open && isPro ? (
        <div
          id="balnced-copilot-panel"
          className="fixed bottom-[5.25rem] right-5 z-[60] flex max-h-[min(38rem,calc(100vh-6rem))] w-[min(100vw-2rem,22rem)] flex-col overflow-hidden rounded-2xl border border-white/[0.1] bg-gradient-to-b from-slate-900/[0.98] via-slate-950/[0.99] to-slate-950 shadow-[0_24px_64px_-20px_rgba(0,0,0,0.85),0_0_48px_-18px_rgba(16,185,129,0.12)] backdrop-blur-xl sm:bottom-[5.5rem] sm:right-7 sm:w-[24rem]"
          role="dialog"
          aria-label="Financial copilot"
        >
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
            <div>
              <p className="text-sm font-semibold tracking-tight text-slate-100">Copilot</p>
              <p className="text-[0.65rem] font-medium uppercase tracking-[0.12em] text-slate-500">
                Balnced · overview
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1.5 text-slate-500 transition hover:bg-white/[0.06] hover:text-slate-300"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="shrink-0 border-b border-white/[0.06] px-3 py-2.5">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Affordability
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
              Uses your safe-to-spend, bills before payday, and goal savings.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-sm font-medium text-slate-400">$</span>
              <input
                type="text"
                inputMode="decimal"
                value={affordInput}
                onChange={(e) => setAffordInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void runAffordCheck();
                  }
                }}
                placeholder="0"
                disabled={affordLoading}
                className="min-w-0 flex-1 rounded-lg border border-white/[0.08] bg-slate-900/45 px-2 py-1.5 text-sm tabular-nums text-slate-100 placeholder:text-slate-600 focus:border-emerald-500/35 focus:outline-none focus:ring-1 focus:ring-emerald-500/25 disabled:opacity-50"
                aria-label="Purchase amount"
              />
              {([50, 100, 200] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  disabled={affordLoading}
                  onClick={() => {
                    setAffordInput(String(n));
                    setAffordError(null);
                  }}
                  className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-2 py-1 text-[11px] font-medium text-slate-300 transition hover:border-white/15 hover:bg-white/[0.07] disabled:opacity-50"
                >
                  ${n}
                </button>
              ))}
              <button
                type="button"
                disabled={affordLoading}
                onClick={() => void runAffordCheck()}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
              >
                {affordLoading ? "…" : "Check"}
              </button>
            </div>
            {affordError ? (
              <p className="mt-1.5 text-[11px] text-rose-400/90">{affordError}</p>
            ) : null}
            {affordResult ? (
              <div
                className="mt-2.5 rounded-xl border px-3 py-2.5"
                role="status"
                aria-live="polite"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-md border px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider ${verdictStyles(affordResult.verdict)}`}
                  >
                    {verdictLabel(affordResult.verdict)}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-300">{affordResult.explanation}</p>
              </div>
            ) : null}
          </div>

          <div
            ref={listRef}
            className="min-h-0 flex-1 space-y-3.5 overflow-y-auto px-4 py-3 [scrollbar-gutter:stable]"
          >
            {messages.map((m) => (
              <ChatMessageBubble key={m.id} m={m} reduce={reduce} />
            ))}
            {sending ? <TypingIndicator reduce={reduce} /> : null}
          </div>

          <div className="border-t border-white/[0.06] p-3">
            <div className="mb-2.5">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Try asking
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5" aria-label="Suggested prompts">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    disabled={sending}
                    onClick={() => void sendMessage(prompt)}
                    className="max-w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5 text-left text-[11px] leading-snug text-slate-300 transition hover:border-emerald-500/25 hover:bg-emerald-500/10 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Message…"
                rows={1}
                disabled={sending}
                className="max-h-28 min-h-[2.75rem] flex-1 resize-none rounded-xl border border-white/[0.08] bg-slate-900/60 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-emerald-500/35 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => void send()}
                disabled={sending || !input.trim()}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Send"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
              </button>
            </div>
            <p className="mt-2 text-center text-[10px] leading-snug text-slate-600">
              {TRUST_DISCLAIMER} {TRUST_AI_LIMITATION}
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
