/** Local calendar day as YYYY-MM-DD (not UTC). */
export function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function localDateKeyFromExpenseCreated(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return localDateKey(d);
}

/**
 * Consecutive calendar days (local) with ≥1 expense logged.
 * Streak is “active” only if the most recent log was today or yesterday (grace if you haven’t opened the app yet today).
 */
export function computeExpenseLoggingStreak(
  expenses: { created_at: string }[],
  now: Date = new Date()
): { streak: number; loggedToday: boolean } {
  const keys = new Set<string>();
  for (const e of expenses) {
    const k = localDateKeyFromExpenseCreated(e.created_at);
    if (k) keys.add(k);
  }

  const todayKey = localDateKey(now);
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  const yesterdayKey = localDateKey(y);

  const loggedToday = keys.has(todayKey);

  let startKey: string | null = null;
  if (keys.has(todayKey)) startKey = todayKey;
  else if (keys.has(yesterdayKey)) startKey = yesterdayKey;
  else return { streak: 0, loggedToday: false };

  const [sy, sm, sd] = startKey.split("-").map(Number);
  let cursor = new Date(sy, sm - 1, sd);
  let streak = 0;

  while (true) {
    const k = localDateKey(cursor);
    if (!keys.has(k)) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return { streak, loggedToday };
}

export function engagementStorageKey(userId: string): string {
  return `balnced.daily.engagement.v1.${userId}`;
}

export type DailyEngagementStored = {
  /** Local date key when `sawSafeToSpend` was recorded */
  dateKey: string;
  sawSafeToSpend: boolean;
};

export function readDailyEngagement(
  userId: string,
  todayKey: string
): DailyEngagementStored | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(engagementStorageKey(userId));
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<DailyEngagementStored>;
    if (p.dateKey !== todayKey) return null;
    if (typeof p.sawSafeToSpend !== "boolean") return null;
    return { dateKey: p.dateKey, sawSafeToSpend: p.sawSafeToSpend };
  } catch {
    return null;
  }
}

export function writeDailyEngagementSawSafe(
  userId: string,
  todayKey: string
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      engagementStorageKey(userId),
      JSON.stringify({
        dateKey: todayKey,
        sawSafeToSpend: true,
      } satisfies DailyEngagementStored)
    );
  } catch {
    /* ignore quota */
  }
}
