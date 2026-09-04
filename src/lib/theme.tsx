import { createContext, useContext, useEffect, type ReactNode } from "react";

/**
 * Avenxa has ONE permanent visual theme (editorial ink over the wallpaper).
 * The provider is kept for API compatibility, but there is no dark mode,
 * no theme switcher and no system-preference detection.
 */
export type ThemePref = "light";

type Ctx = {
  theme: ThemePref;
  resolved: "light";
  setTheme: (t: ThemePref) => void;
};

const VALUE: Ctx = { theme: "light", resolved: "light", setTheme: () => {} };
const ThemeCtx = createContext<Ctx>(VALUE);

export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.remove("dark");
    document.documentElement.style.colorScheme = "light";
  }, []);
  return <ThemeCtx.Provider value={VALUE}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  return useContext(ThemeCtx);
}
