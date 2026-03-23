import "server-only";
import { loadEnvConfig } from "@next/env";

/**
 * Canonical app origin for Stripe redirects and absolute links (no trailing slash).
 * Uses `loadEnvConfig` so `NEXT_PUBLIC_APP_URL` from `.env.local` is visible to the server bundle.
 */
export function getAppBaseUrl(): string {
  const dev = process.env.NODE_ENV !== "production";
  const { combinedEnv } = loadEnvConfig(process.cwd(), dev);
  const fromProcess = process.env.NEXT_PUBLIC_APP_URL;
  const fromCombined = combinedEnv.NEXT_PUBLIC_APP_URL;
  const raw =
    typeof fromProcess === "string" && fromProcess.trim() !== ""
      ? fromProcess.trim()
      : typeof fromCombined === "string" && fromCombined.trim() !== ""
        ? fromCombined.trim()
        : "";
  if (!raw) {
    throw new Error("NEXT_PUBLIC_APP_URL is not configured");
  }
  return raw.replace(/\/+$/, "");
}
