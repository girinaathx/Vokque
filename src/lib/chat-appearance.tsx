import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type BubbleSize = "compact" | "default" | "comfortable";
export type AnimationMode = "minimal" | "none";

export type ChatAppearance = {
  userBg: string;
  aiBg: string;
  textColor: string;
  secondaryText: string;
  borderColor: string;
  timestampColor: string;
  accentColor: string;
  opacity: number; // 0..1
  borderWidth: number; // px
  radius: number; // px
  size: BubbleSize;
  animation: AnimationMode;
  animationIntensity: number; // 0..100
  gradient: boolean;
};

export const DEFAULT_APPEARANCE: ChatAppearance = {
  userBg: "#2A2A2A",
  aiBg: "#121212",
  textColor: "#FFFFFF",
  secondaryText: "rgba(255,255,255,0.75)",
  borderColor: "rgba(255,255,255,0.08)",
  timestampColor: "rgba(255,255,255,0.45)",
  accentColor: "#FFFFFF",
  opacity: 1,
  borderWidth: 1,
  radius: 20,
  size: "default",
  animation: "minimal",
  animationIntensity: 50,
  gradient: false,
};

export type ChatTheme = {
  id: string;
  name: string;
  appearance: ChatAppearance;
};

type Ctx = {
  appearance: ChatAppearance;
  setAppearance: (patch: Partial<ChatAppearance>) => void;
  reset: () => void;
  themes: ChatTheme[];
  saveTheme: (name: string) => ChatTheme;
  applyTheme: (id: string) => void;
  renameTheme: (id: string, name: string) => void;
  duplicateTheme: (id: string) => void;
  deleteTheme: (id: string) => void;
  exportThemes: () => string;
  importThemes: (json: string) => void;
};

const ChatAppearanceCtx = createContext<Ctx | null>(null);

const STORAGE_KEY = "oi:chat-appearance:v1";
const THEMES_KEY = "oi:chat-themes:v1";

function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) } as T;
  } catch {
    return fallback;
  }
}

function loadThemes(): ChatTheme[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(THEMES_KEY);
    return raw ? (JSON.parse(raw) as ChatTheme[]) : [];
  } catch {
    return [];
  }
}

export function ChatAppearanceProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearanceState] = useState<ChatAppearance>(() =>
    load<ChatAppearance>(STORAGE_KEY, DEFAULT_APPEARANCE),
  );
  const [themes, setThemes] = useState<ChatTheme[]>(() => loadThemes());

  // Persist
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(appearance));
    } catch { /* noop */ }
  }, [appearance]);
  useEffect(() => {
    try {
      window.localStorage.setItem(THEMES_KEY, JSON.stringify(themes));
    } catch { /* noop */ }
  }, [themes]);

  // Apply CSS variables on :root
  useEffect(() => {
    const r = document.documentElement;
    const a = appearance;
    r.style.setProperty("--chat-user-bg", a.userBg);
    r.style.setProperty("--chat-ai-bg", a.aiBg);
    r.style.setProperty("--chat-text", a.textColor);
    r.style.setProperty("--chat-text-2", a.secondaryText);
    r.style.setProperty("--chat-border", a.borderColor);
    r.style.setProperty("--chat-timestamp", a.timestampColor);
    r.style.setProperty("--chat-accent", a.accentColor);
    r.style.setProperty("--chat-opacity", String(a.opacity));
    r.style.setProperty("--chat-border-w", `${a.borderWidth}px`);
    r.style.setProperty("--chat-radius", `${a.radius}px`);
    const pad =
      a.size === "compact"
        ? "8px 12px"
        : a.size === "comfortable"
          ? "14px 18px"
          : "10px 14px";
    r.style.setProperty("--chat-padding", pad);
    const dur =
      a.animation === "none"
        ? "0ms"
        : `${Math.round(150 + (a.animationIntensity / 100) * 50)}ms`;
    r.style.setProperty("--chat-anim-dur", dur);
    const translate =
      a.animation === "none"
        ? "0px"
        : `${Math.max(2, Math.round((a.animationIntensity / 100) * 10))}px`;
    r.style.setProperty("--chat-anim-translate", translate);
    r.style.setProperty("--chat-gradient", a.gradient ? "1" : "0");
  }, [appearance]);

  const setAppearance = useCallback((patch: Partial<ChatAppearance>) => {
    setAppearanceState((prev) => ({ ...prev, ...patch }));
  }, []);

  const reset = useCallback(
    () => setAppearanceState(DEFAULT_APPEARANCE),
    [],
  );

  const saveTheme = useCallback(
    (name: string) => {
      const t: ChatTheme = {
        id: crypto.randomUUID(),
        name: name.trim() || "Untitled",
        appearance,
      };
      setThemes((prev) => [...prev, t]);
      return t;
    },
    [appearance],
  );

  const applyTheme = useCallback(
    (id: string) => {
      const t = themes.find((x) => x.id === id);
      if (t) setAppearanceState(t.appearance);
    },
    [themes],
  );

  const renameTheme = useCallback((id: string, name: string) => {
    setThemes((prev) =>
      prev.map((t) => (t.id === id ? { ...t, name } : t)),
    );
  }, []);

  const duplicateTheme = useCallback((id: string) => {
    setThemes((prev) => {
      const t = prev.find((x) => x.id === id);
      if (!t) return prev;
      return [...prev, { ...t, id: crypto.randomUUID(), name: `${t.name} copy` }];
    });
  }, []);

  const deleteTheme = useCallback((id: string) => {
    setThemes((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const exportThemes = useCallback(
    () => JSON.stringify({ themes, current: appearance }, null, 2),
    [themes, appearance],
  );

  const importThemes = useCallback((json: string) => {
    try {
      const data = JSON.parse(json);
      if (Array.isArray(data?.themes)) setThemes(data.themes as ChatTheme[]);
      if (data?.current) setAppearanceState({ ...DEFAULT_APPEARANCE, ...data.current });
    } catch {
      throw new Error("Invalid theme file");
    }
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      appearance,
      setAppearance,
      reset,
      themes,
      saveTheme,
      applyTheme,
      renameTheme,
      duplicateTheme,
      deleteTheme,
      exportThemes,
      importThemes,
    }),
    [
      appearance,
      setAppearance,
      reset,
      themes,
      saveTheme,
      applyTheme,
      renameTheme,
      duplicateTheme,
      deleteTheme,
      exportThemes,
      importThemes,
    ],
  );

  return (
    <ChatAppearanceCtx.Provider value={value}>
      {children}
    </ChatAppearanceCtx.Provider>
  );
}

export function useChatAppearance() {
  const ctx = useContext(ChatAppearanceCtx);
  if (!ctx)
    throw new Error("useChatAppearance must be used within ChatAppearanceProvider");
  return ctx;
}

export const PRESET_GROUPS: Array<{
  group: string;
  swatches: Array<{ name: string; color: string }>;
}> = [
  {
    group: "Dark",
    swatches: [
      { name: "Pure Black", color: "#000000" },
      { name: "Graphite", color: "#1A1A1A" },
      { name: "Slate", color: "#1F2937" },
      { name: "Midnight", color: "#0B1020" },
    ],
  },
  {
    group: "Blue",
    swatches: [
      { name: "Ocean Blue", color: "#0E4C92" },
      { name: "Royal Blue", color: "#1D4ED8" },
      { name: "Sky Blue", color: "#38BDF8" },
      { name: "Cyan", color: "#06B6D4" },
    ],
  },
  {
    group: "Green",
    swatches: [
      { name: "Emerald", color: "#10B981" },
      { name: "Mint", color: "#5EEAD4" },
      { name: "Forest", color: "#166534" },
      { name: "Lime", color: "#84CC16" },
    ],
  },
  {
    group: "Purple",
    swatches: [
      { name: "Violet", color: "#7C3AED" },
      { name: "Lavender", color: "#A78BFA" },
      { name: "Deep Purple", color: "#4C1D95" },
    ],
  },
  {
    group: "Red",
    swatches: [
      { name: "Crimson", color: "#DC2626" },
      { name: "Ruby", color: "#9F1239" },
      { name: "Rose", color: "#F43F5E" },
    ],
  },
  {
    group: "Orange",
    swatches: [
      { name: "Sunset", color: "#FB7185" },
      { name: "Amber", color: "#F59E0B" },
      { name: "Gold", color: "#D4AF37" },
    ],
  },
  {
    group: "Pink",
    swatches: [
      { name: "Sakura", color: "#FBCFE8" },
      { name: "Neon Pink", color: "#FF1493" },
    ],
  },
];
