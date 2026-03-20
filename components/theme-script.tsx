"use client";

const THEME_KEY = "balnced_theme";

export function getStoredTheme(): "light" | "dark" | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(THEME_KEY);
  if (v === "dark" || v === "light") return v;
  return null;
}

export function setStoredTheme(theme: "light" | "dark") {
  if (typeof window === "undefined") return;
  localStorage.setItem(THEME_KEY, theme);
  document.documentElement.classList.toggle("dark", theme === "dark");
}

/** Inline script run before React to prevent flash. Must be embedded in layout. */
export function ThemeInitScript() {
  const script = `
    (function() {
      var key = "balnced_theme";
      var stored = localStorage.getItem(key);
      var dark = stored === "dark" || (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches);
      document.documentElement.classList.toggle("dark", dark);
    })();
  `;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
