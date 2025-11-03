import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type Theme = "dark" | "light" | "system";
type ThemeProviderProps = { children: React.ReactNode; defaultTheme?: Theme; storageKey?: string };
type ThemeProviderState = { theme: Theme; setTheme: (t: Theme) => void };

const ThemeCtx = createContext<ThemeProviderState>({ theme: "system", setTheme: () => null });

export function ThemeProvider({ children, defaultTheme = "system", storageKey = "eduforum-theme" }: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(defaultTheme);

  const apply = (t: Theme) => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    const resolved = t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : t === "system" ? "light" : t;
    root.classList.add(resolved);
  };

  useEffect(() => {
    const saved = typeof window !== "undefined" ? (localStorage.getItem(storageKey) as Theme | null) : null;
    setTheme(saved || defaultTheme);
  }, [defaultTheme, storageKey]);

  useEffect(() => {
    apply(theme);
    if (typeof window === "undefined") return;

    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystem = () => theme === "system" && apply("system");
    const onStorage = (e: StorageEvent) => { if (e.key === storageKey) setTheme((e.newValue as Theme) || defaultTheme); };

    mql.addEventListener?.("change", onSystem);
    window.addEventListener("storage", onStorage);
    return () => {
      mql.removeEventListener?.("change", onSystem);
      window.removeEventListener("storage", onStorage);
    };
  }, [theme, storageKey, defaultTheme]);

  const value = useMemo(() => ({
    theme,
    setTheme: (t: Theme) => { localStorage.setItem(storageKey, t); setTheme(t); }
  }), [theme, storageKey]);

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);