"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { computeAvailableBalance, loadDashboardData } from "@/lib/dashboard-data";

type WalletBalanceContextValue = {
  /** Same as Overview "Current balance" — bank balance minus logged expenses. */
  availableBalance: number | null;
  /** First letter for the account avatar (from session email). */
  userInitial: string;
  loaded: boolean;
  refresh: () => Promise<void>;
};

const WalletBalanceContext = createContext<WalletBalanceContextValue | null>(null);

function initialFromEmail(email: string | undefined): string {
  if (!email) return "?";
  const ch = email.trim()[0];
  return ch && /[a-zA-Z]/.test(ch) ? ch.toUpperCase() : "?";
}

export function WalletBalanceProvider({ children }: { children: React.ReactNode }) {
  const [availableBalance, setAvailableBalance] = useState<number | null>(null);
  const [userInitial, setUserInitial] = useState("");
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const data = await loadDashboardData();
    if (!data.user) {
      setAvailableBalance(null);
      setUserInitial("?");
      setLoaded(true);
      return;
    }
    setUserInitial(initialFromEmail(data.user.email));
    if (data.budget == null) {
      setAvailableBalance(null);
    } else {
      const bal = computeAvailableBalance(data.budget, data.expenses);
      setAvailableBalance(Number.isFinite(bal) ? bal : null);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") void refresh();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  const value = useMemo(
    () => ({ availableBalance, userInitial, loaded, refresh }),
    [availableBalance, userInitial, loaded, refresh]
  );

  return (
    <WalletBalanceContext.Provider value={value}>{children}</WalletBalanceContext.Provider>
  );
}

export function useWalletBalance(): WalletBalanceContextValue {
  const ctx = useContext(WalletBalanceContext);
  if (!ctx) {
    throw new Error("useWalletBalance must be used within WalletBalanceProvider");
  }
  return ctx;
}
