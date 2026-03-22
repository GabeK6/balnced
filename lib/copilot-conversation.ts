/** Last N user+assistant turns sent to OpenAI (token control). */
export const COPILOT_MAX_MESSAGES = 10;

/** Per-message cap to limit tokens. */
export const COPILOT_MAX_CHARS_PER_MESSAGE = 3500;

export type CopilotChatLine = { role: "user" | "assistant"; content: string };

/**
 * Trims and caps messages for `/api/copilot` and related routes.
 * Keeps the most recent turns only.
 */
export function trimMessagesForApi(
  messages: Array<{ role: string; content: string }>,
  opts?: { maxMessages?: number; maxCharsPerMessage?: number }
): CopilotChatLine[] {
  const maxM = opts?.maxMessages ?? COPILOT_MAX_MESSAGES;
  const maxC = opts?.maxCharsPerMessage ?? COPILOT_MAX_CHARS_PER_MESSAGE;

  const list: CopilotChatLine[] = [];
  for (const m of messages) {
    if (m.role !== "user" && m.role !== "assistant") continue;
    const c = typeof m.content === "string" ? m.content : "";
    if (!c.trim()) continue;
    list.push({
      role: m.role,
      content: c.length > maxC ? c.slice(0, maxC) + "…" : c,
    });
  }
  return list.slice(-maxM);
}
