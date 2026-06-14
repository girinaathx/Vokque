import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type ThemePref = "light" | "dark" | "system";
const STORAGE_KEY = "oi:theme";

type Ctx = {
  theme: ThemePref;
  resolved: "light" | "dark";
  setTheme: (t: ThemePref) => void;
};

const ThemeCtx = createContext<Ctx | null>(null);

function systemPrefersDark() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyClass(resolved: "light" | "dark") {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePref>(() => {
    if (typeof window === "undefined") return "system";
    return (
      (window.localStorage.getItem(STORAGE_KEY) as ThemePref | null) ?? "system"
    );
  });
  const [resolved, setResolved] = useState<"light" | "dark">(() =>
    theme === "system" ? (systemPrefersDark() ? "dark" : "light") : theme,
  );

  useEffect(() => {
    const next: "light" | "dark" =
      theme === "system" ? (systemPrefersDark() ? "dark" : "light") : theme;
    setResolved(next);
    applyClass(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* noop */
    }
  }, [theme]);

  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const next = mq.matches ? "dark" : "light";
      setResolved(next);
      applyClass(next);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  return (
    <ThemeCtx.Provider value={{ theme, resolved, setTheme: setThemeState }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
