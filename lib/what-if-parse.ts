import type { WhatIfScenario } from "./what-if-simulate";

function num(s: string): number | null {
  const n = Number.parseFloat(s.replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** User is exploring a hypothetical — not a generic chat message */
function looksLikeScenarioPrompt(t: string): boolean {
  return /\bwhat\s+if\b/i.test(t) || /\bhow\s+about\b/i.test(t) || /\bsimulate\b/i.test(t);
}

/**
 * Lightweight NL → structured scenario (no network). Used client + server.
 * Returns null if the message doesn’t look like a what-if question.
 */
export function parseWhatIfQuery(text: string): WhatIfScenario | null {
  const t = text.trim();
  if (!t) return null;

  const lower = t.toLowerCase();

  // Spend / one-off purchase
  if (looksLikeScenarioPrompt(t) && /spend|spent|pay\s+for|buy|purchase|cost\s+me/.test(lower)) {
    const m =
      t.match(/(?:spend|spent|pay\s+for|buy|purchase|cost)\s*(?:of|about)?\s*\$?\s*([\d,]+(?:\.\d+)?)/i) ||
      t.match(/\$\s*([\d,]+(?:\.\d+)?)\s*(?:on|for)?/i);
    if (m) {
      const a = num(m[1]);
      if (a != null) return { kind: "one_time_spend", amount: a };
    }
  }

  // Extra monthly toward goals (save)
  if (
    looksLikeScenarioPrompt(t) &&
    /save|saving|goals?|put away|set aside/.test(lower) &&
    /month|\/mo|per month|each month|monthly|a month/.test(lower)
  ) {
    const m = t.match(/\$?\s*([\d,]+(?:\.\d+)?)/);
    if (m) {
      const a = num(m[1]);
      if (a != null) return { kind: "monthly_extra_to_goals", amount: a };
    }
  }

  // Extra monthly toward retirement / invest
  if (
    looksLikeScenarioPrompt(t) &&
    /invest|investing|contribute|401|403|ira|retirement/.test(lower) &&
    /month|\/mo|per month|each month|monthly|a month/.test(lower)
  ) {
    const m = t.match(/\$?\s*([\d,]+(?:\.\d+)?)/);
    if (m) {
      const a = num(m[1]);
      if (a != null) return { kind: "monthly_extra_to_invest", amount: a };
    }
  }

  return null;
}
