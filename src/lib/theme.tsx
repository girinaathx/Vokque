import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemePref = "light" | "dark";
type Ctx = { theme: ThemePref; resolved: ThemePref; setTheme: (theme: ThemePref) => void };
const ThemeCtx = createContext<Ctx>({ theme: "light", resolved: "light", setTheme: () => {} });
const KEY = "vokque:theme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, updateTheme] = useState<ThemePref>("light");
  useEffect(() => {
    const stored = localStorage.getItem(KEY);
    const initial = stored === "light" || stored === "dark" ? stored : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    updateTheme(initial);
    document.documentElement.classList.toggle("dark", initial === "dark");
    document.documentElement.style.colorScheme = initial;
    if (stored) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (localStorage.getItem(KEY)) return;
      const next = media.matches ? "dark" : "light";
      updateTheme(next);
      document.documentElement.classList.toggle("dark", next === "dark");
      document.documentElement.style.colorScheme = next;
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  const setTheme = (next: ThemePref) => {
    localStorage.setItem(KEY, next);
    updateTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    document.documentElement.style.colorScheme = next;
  };
  return <ThemeCtx.Provider value={{ theme, resolved: theme, setTheme }}>{children}</ThemeCtx.Provider>;
}

export function useTheme() { return useContext(ThemeCtx); }
