import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";
const key = "vokque:theme";
const subscribe = (notify: () => void) => {
  window.addEventListener("vokque-theme", notify);
  window.addEventListener("storage", notify);
  return () => { window.removeEventListener("vokque-theme", notify); window.removeEventListener("storage", notify); };
};
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, () => document.documentElement.classList.contains("dark") ? "dark" : "light", () => "light");
  const setTheme = (value: Theme) => {
    try { localStorage.setItem(key, value); } catch { /* Theme still works without storage. */ }
    document.documentElement.classList.toggle("dark", value === "dark");
    document.documentElement.style.colorScheme = value;
    window.dispatchEvent(new Event("vokque-theme"));
  };
  return { theme, setTheme };
}