import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/lib/theme";

export function ThemeChoice() {
  const { theme, setTheme } = useTheme();
  return <div className="flex gap-2" role="group" aria-label="Theme">
    <Button variant="ghost" className="glass rounded-full" aria-pressed={theme === "light"} onClick={() => setTheme("light")}><Sun />Light</Button>
    <Button variant="ghost" className="glass rounded-full" aria-pressed={theme === "dark"} onClick={() => setTheme("dark")}><Moon />Dark</Button>
  </div>;
}